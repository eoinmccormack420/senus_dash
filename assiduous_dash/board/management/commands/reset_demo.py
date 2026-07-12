"""
Restores the deployed demo to a pristine state — wipes AI extraction/
insight data and re-seeds the Senus dataset from scratch.

Usage:
    python manage.py reset_demo --confirm

Destructive: deletes every ExtractionAttempt and AIInsight row, then
re-seeds financial periods (which itself clears and recreates the
FY2024/FY2025/HY2025/HY2026 periods — see seed_senus_data.py). Requires
--confirm so this can't be run by accident against production data.
"""

from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError

from board.models import ExtractionAttempt, AIInsight


class Command(BaseCommand):
    help = "Wipes AI extraction/insight data and re-seeds the demo dataset. Requires --confirm."

    def add_arguments(self, parser):
        parser.add_argument(
            "--confirm",
            action="store_true",
            help="Required — without it the command refuses to run.",
        )

    def handle(self, *args, **options):
        if not options["confirm"]:
            raise CommandError(
                "Refusing to run without --confirm — this deletes ALL "
                "ExtractionAttempt and AIInsight rows and re-seeds demo data.\n"
                "Re-run with: python manage.py reset_demo --confirm"
            )

        attempts_deleted, _ = ExtractionAttempt.objects.all().delete()
        insights_deleted, _ = AIInsight.objects.all().delete()

        self.stdout.write("Re-seeding demo data...")
        call_command("seed_senus_data")

        self.stdout.write(self.style.SUCCESS(
            f"Demo reset complete — deleted {attempts_deleted} extraction attempt(s) "
            f"and {insights_deleted} AI insight(s); financial periods re-seeded."
        ))
