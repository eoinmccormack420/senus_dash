"""
CLI entry point for syncing PDFs from a Google Drive folder into the
extraction pipeline.

Save as: board/management/commands/sync_drive_documents.py

Usage:
    python manage.py sync_drive_documents --folder-id <drive-folder-id> --period HY2026

What it does:
1. Lists PDFs in the given Drive folder (drive_client.py).
2. Skips any file already processed for this period — checked against
   ExtractionAttempt.source_document using the same "drive://{file_id}/
   {name}" value this command writes, so re-running it is safe and
   won't reprocess documents.
3. Downloads each new PDF to a local temp file.
4. Runs it through the EXISTING run_extraction() pipeline for all four
   statement kinds, unchanged — this command is only a document
   source, it doesn't touch extraction/validation/cross-check logic.
5. Deletes the temp file once all four kinds have been attempted.

Requires GOOGLE_SERVICE_ACCOUNT_KEY_PATH in .env (see drive_client.py)
and the target Drive folder shared with the service account's email
address (Viewer access is enough).

Rate limiting: a full folder sync can fire off many Gemini calls in a
row (documents x 4 statement kinds each), which the free-tier API
quota does not tolerate back-to-back — gemini_client.py's retry logic
only allows for a transient network blip (one retry, 2s sleep), not a
rate limit. GEMINI_CALL_DELAY_SECONDS below paces calls from this
command specifically, rather than changing that shared retry logic
(also used by the single-document run_extraction CLI, which doesn't
have this problem since a human runs it one document at a time).
"""

import os
import time

from django.core.management.base import BaseCommand, CommandError

from board.models import FinancialPeriod, ExtractionAttempt
from board.extraction.drive_client import list_pdfs_in_folder, download_pdf
from board.extraction.pipeline import run_extraction
from board.extraction.schemas import SCHEMA_REGISTRY

# Seconds to wait between Gemini calls, so a multi-document folder
# sync doesn't blast through the free-tier rate limit. 4s between 16
# calls (4 docs x 4 kinds) adds ~1 minute to a full sync — cheap
# insurance against a run failing halfway through on a 429.
GEMINI_CALL_DELAY_SECONDS = 4


class Command(BaseCommand):
    help = "Syncs PDFs from a Google Drive folder and runs them through the extraction pipeline"

    def add_arguments(self, parser):
        parser.add_argument("--folder-id", required=True, help="Google Drive folder ID")
        parser.add_argument("--period", required=True, help="FinancialPeriod label, e.g. HY2026")

    def handle(self, *args, **options):
        try:
            period = FinancialPeriod.objects.get(label=options["period"])
        except FinancialPeriod.DoesNotExist:
            raise CommandError(
                f"No FinancialPeriod with label '{options['period']}'. "
                f"Run seed_senus_data first, or check spelling."
            )

        folder_id = options["folder_id"]
        self.stdout.write(f"Listing PDFs in Drive folder {folder_id}...")
        drive_files = list_pdfs_in_folder(folder_id)

        if not drive_files:
            self.stdout.write(self.style.WARNING("No PDFs found in that folder."))
            return
        self.stdout.write(f"Found {len(drive_files)} PDF(s).")

        # Already-processed Drive files for this period. source_document
        # is stored as "drive://{file_id}/{name}", so an exact-match set
        # is enough to detect a repeat run.
        processed = set(
            ExtractionAttempt.objects.filter(
                period=period, source_document__startswith="drive://"
            ).values_list("source_document", flat=True)
        )

        for drive_file in drive_files:
            file_id = drive_file["id"]
            name = drive_file["name"]
            source_document = f"drive://{file_id}/{name}"

            if source_document in processed:
                self.stdout.write(f"Skipping {name} — already processed for {period.label}")
                continue

            self.stdout.write(f"Downloading {name}...")
            try:
                local_path = download_pdf(file_id, filename=name)
            except Exception as exc:  # noqa: BLE001
                self.stdout.write(self.style.ERROR(f"  failed to download {name}: {exc}"))
                continue

            try:
                for kind in SCHEMA_REGISTRY:
                    self.stdout.write(f"  extracting {kind}...")
                    # run_extraction reads pdf_path from disk AND stores
                    # it verbatim as source_document. We need the real
                    # local temp path for the former but the drive://
                    # identifier for the latter, so pass the temp path
                    # in and correct source_document on the resulting
                    # record afterward, rather than changing
                    # run_extraction's signature.
                    attempt = run_extraction(kind, period, local_path)
                    attempt.source_document = source_document
                    attempt.save(update_fields=["source_document"])
                    self._report(attempt)
                    time.sleep(GEMINI_CALL_DELAY_SECONDS)
            finally:
                if os.path.exists(local_path):
                    os.remove(local_path)

    def _report(self, attempt: ExtractionAttempt):
        status_style = {
            "cross_check_pass": self.style.SUCCESS,
            "schema_valid": self.style.SUCCESS,
            "cross_check_fail": self.style.WARNING,
            "schema_invalid": self.style.ERROR,
            "api_error": self.style.ERROR,
        }.get(attempt.status, self.style.NOTICE)

        self.stdout.write(
            status_style(
                f"    -> {attempt.statement_kind}: {attempt.status}"
                + (
                    f" (match rate: {attempt.match_rate_pct}%)"
                    if attempt.match_rate_pct is not None
                    else ""
                )
            )
        )
        if attempt.error_message:
            self.stdout.write(self.style.ERROR(f"       {attempt.error_message[:300]}"))
