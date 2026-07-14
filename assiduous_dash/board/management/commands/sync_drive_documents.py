"""
CLI entry point for syncing PDFs from a Google Drive folder into the
extraction pipeline.

Save as: board/management/commands/sync_drive_documents.py

Usage:
    python manage.py sync_drive_documents --folder-id <drive-folder-id> --period HY2026

Thin wrapper around board.extraction.drive_sync.sync_drive_folder —
shared with SyncDriveNowView (board/views.py) so this CLI and the
Settings > Google Drive "Sync now" button behave identically. See
drive_sync.py for what the sync actually does (list/dedupe/download/
extract/cleanup) and drive_client.py for the Drive API auth setup this
requires (GOOGLE_SERVICE_ACCOUNT_KEY_PATH + the folder shared with the
service account).
"""

from django.core.management.base import BaseCommand, CommandError

from board.models import FinancialPeriod
from board.extraction.drive_sync import sync_drive_folder


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

        self.stdout.write(f"Syncing Drive folder {options['folder_id']} into {period.label}...")
        result = sync_drive_folder(options["folder_id"], period, on_progress=self.stdout.write)

        self.stdout.write(
            self.style.SUCCESS(f"Done: {result['processed']} processed, {result['skipped']} skipped")
        )
        for error in result["errors"]:
            self.stdout.write(self.style.ERROR(f"  {error}"))
