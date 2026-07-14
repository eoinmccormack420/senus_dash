"""
Reusable Drive-sync logic shared by sync_drive_documents.py (CLI) and
SyncDriveNowView (Settings > Google Drive "Sync now").

Save as: board/extraction/drive_sync.py
"""

import os
import threading
import time
from datetime import timedelta

from django.db import connections
from django.utils import timezone

from board.models import DriveSettings, ExtractionAttempt, FinancialPeriod

from .drive_client import download_pdf, list_pdfs_in_folder
from .pipeline import run_extraction
from .schemas import SCHEMA_REGISTRY

# Seconds to wait between Gemini calls, so a multi-document folder sync
# doesn't blast through the free-tier rate limit. 4s between 16 calls
# (4 docs x 4 kinds) adds ~1 minute to a full sync — cheap insurance
# against a run failing halfway through on a 429.
GEMINI_CALL_DELAY_SECONDS = 4

# If a sync has been "running" for longer than this with no update,
# treat it as dead rather than blocking retries forever. A background
# thread can be killed outright — e.g. the dev server's autoreload
# restarting mid-sync while other backend files are being edited, or a
# gunicorn worker recycling in production — with no chance to reach
# _run_and_record's own finally block, which would otherwise leave
# last_sync_status stuck on "running" permanently (found via exactly
# this happening during development).
STALE_SYNC_TIMEOUT_MINUTES = 20


def is_sync_stale(drive_settings: DriveSettings) -> bool:
    if drive_settings.last_sync_status != "running":
        return False
    return timezone.now() - drive_settings.updated_at > timedelta(minutes=STALE_SYNC_TIMEOUT_MINUTES)

# run_extraction statuses that count as a genuine failure worth
# surfacing in the summary — cross_check_fail still produced usable
# (if imperfect) data, same "warning not error" framing the CLI's own
# _report() styling already draws.
FAILURE_STATUSES = {"api_error", "schema_invalid"}


def sync_drive_folder(folder_id: str, period, on_progress=None) -> dict:
    """
    Lists PDFs in `folder_id`, skips any already processed for `period`,
    downloads + runs each new one through the existing run_extraction()
    pipeline for every statement kind, and cleans up its temp file.

    `on_progress`, if given, is called as on_progress(message: str) at
    each meaningful step (skip/download/extract-result) — the CLI wires
    this to self.stdout.write for the same live per-document output it
    always had; the web "Sync now" path (a background thread) leaves it
    None and just polls DriveSettings.last_sync_status/summary instead.

    Returns {"processed": int, "skipped": int, "errors": [str, ...]}.
    Raises on folder-listing/auth failure — the caller's problem to
    catch (an auth error surfacing loudly beats a silent no-op).
    """
    report = on_progress or (lambda message: None)

    drive_files = list_pdfs_in_folder(folder_id)
    report(f"Found {len(drive_files)} PDF(s).")

    already_processed = set(
        ExtractionAttempt.objects.filter(
            period=period, source_document__startswith="drive://"
        ).values_list("source_document", flat=True)
    )

    processed = 0
    skipped = 0
    errors = []

    for drive_file in drive_files:
        file_id = drive_file["id"]
        name = drive_file["name"]
        source_document = f"drive://{file_id}/{name}"

        if source_document in already_processed:
            report(f"Skipping {name} — already processed for {period.label}")
            skipped += 1
            continue

        report(f"Downloading {name}...")
        try:
            local_path = download_pdf(file_id, filename=name)
        except Exception as exc:  # noqa: BLE001
            errors.append(f"{name}: failed to download ({exc})")
            report(f"  failed to download {name}: {exc}")
            continue

        try:
            for kind in SCHEMA_REGISTRY:
                # run_extraction stores pdf_path verbatim as
                # source_document; we need the real local temp path for
                # reading the file but the drive:// identifier for the
                # record, so correct it afterward rather than changing
                # run_extraction's signature (same approach
                # sync_drive_documents.py used before this refactor).
                report(f"  extracting {kind}...")
                attempt = run_extraction(kind, period, local_path)
                attempt.source_document = source_document
                attempt.save(update_fields=["source_document"])
                match_rate = f" (match rate: {attempt.match_rate_pct}%)" if attempt.match_rate_pct is not None else ""
                report(f"    -> {attempt.statement_kind}: {attempt.status}{match_rate}")
                if attempt.status in FAILURE_STATUSES:
                    detail = f" — {attempt.error_message[:200]}" if attempt.error_message else ""
                    errors.append(f"{name}/{kind}: {attempt.status}{detail}")
                time.sleep(GEMINI_CALL_DELAY_SECONDS)
        finally:
            if os.path.exists(local_path):
                os.remove(local_path)

        processed += 1

    return {"processed": processed, "skipped": skipped, "errors": errors}


def _summary_text(result: dict) -> str:
    text = f"{result['processed']} processed, {result['skipped']} skipped"
    if result["errors"]:
        text += f", {len(result['errors'])} error(s): " + "; ".join(result["errors"][:5])
    return text


def _run_and_record(folder_id: str, period_id: int):
    settings_row = DriveSettings.get_solo()
    try:
        period = FinancialPeriod.objects.get(pk=period_id)
        result = sync_drive_folder(folder_id, period)
        settings_row.last_sync_status = "error" if result["errors"] and result["processed"] == 0 else "success"
        settings_row.last_sync_summary = _summary_text(result)
    except Exception as exc:  # noqa: BLE001 - this runs in a background thread; nothing else will see this exception
        settings_row.last_sync_status = "error"
        settings_row.last_sync_summary = str(exc)
    finally:
        settings_row.last_synced_at = timezone.now()
        settings_row.save()
        # Threads don't share Django's per-request connection cleanup —
        # without this, a connection opened in this thread just leaks.
        connections.close_all()


def sync_drive_folder_in_background(folder_id: str, period_id: int):
    """
    Marks DriveSettings as "running" immediately (so the triggering
    request's response reflects it right away), then runs the actual
    sync in a background thread — a full sync can take minutes (many
    paced Gemini calls), too long to hold open a request/response, and
    this app has no task queue to hand it to instead.
    """
    settings_row = DriveSettings.get_solo()
    settings_row.last_sync_status = "running"
    settings_row.save()

    thread = threading.Thread(target=_run_and_record, args=(folder_id, period_id), daemon=True)
    thread.start()
