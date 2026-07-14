"""
CLI entry point for generating Strategic Advisory Agent goals.

Save as: board/management/commands/generate_goals.py

Usage:
    python manage.py generate_goals --period HY2026
    python manage.py generate_goals --period HY2026 --force

Thin wrapper around board.extraction.advisory.generate_goals_for_period
— shared with GenerateAdvisoryGoalsView (board/views.py) so the CLI and
the Settings > Strategic Goals "Generate goals" button behave identically.
"""

from django.core.management.base import BaseCommand, CommandError

from board.models import FinancialPeriod
from board.extraction.advisory import generate_goals_for_period


class Command(BaseCommand):
    help = "Generates Gemini strategic advisory goals for a financial period"

    def add_arguments(self, parser):
        parser.add_argument("--period", required=True, help="FinancialPeriod label, e.g. HY2026")
        parser.add_argument(
            "--force",
            action="store_true",
            help="Regenerate even if the source figures are unchanged since the last run",
        )

    def handle(self, *args, **options):
        try:
            period = FinancialPeriod.objects.select_related(
                "pl_statement", "balance_sheet", "cash_flow"
            ).get(label=options["period"])
        except FinancialPeriod.DoesNotExist:
            raise CommandError(f"No FinancialPeriod with label '{options['period']}'")

        result = generate_goals_for_period(period, force=options["force"])

        if result["status"] == "generated":
            self.stdout.write(self.style.SUCCESS(f"  {result['detail']}"))
        elif result["status"] == "skipped":
            self.stdout.write(f"  skip: {result['detail']}")
        else:
            self.stdout.write(self.style.ERROR(f"  failed: {result['detail']}"))
