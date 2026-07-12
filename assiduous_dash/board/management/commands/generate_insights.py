"""
CLI entry point for generating board AI insights.

Save as: board/management/commands/generate_insights.py

Usage:
    # Generate all four sections + the outlook summary for a period
    python manage.py generate_insights --period HY2026

    # Generate just one section
    python manage.py generate_insights --period HY2026 --section cash_liquidity

Thin wrapper around board.extraction.commentary.generate_insights_for_period
— see that function's docstring for the actual generation/caching logic,
which is shared with RegenerateInsightsView (board/views.py) so the CLI
and the settings-menu "Regenerate insights" button behave identically.
"""

from django.core.management.base import BaseCommand, CommandError

from board.models import FinancialPeriod
from board.extraction.commentary import generate_insights_for_period, SECTION_INSTRUCTIONS


class Command(BaseCommand):
    help = "Generates Gemini board commentary for a financial period"

    def add_arguments(self, parser):
        parser.add_argument("--period", required=True, help="FinancialPeriod label, e.g. HY2026")
        parser.add_argument(
            "--section",
            choices=list(SECTION_INSTRUCTIONS.keys()),
            help="Generate just one section (omit to generate all sections)",
        )
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

        sections = [options["section"]] if options["section"] else None
        results = generate_insights_for_period(period, force=options["force"], sections=sections)

        for r in results:
            if r["status"] == "generated":
                self.stdout.write(self.style.SUCCESS(f"  {r['section']}: saved ({r['detail']})"))
            elif r["status"] == "skipped":
                self.stdout.write(f"  skip {r['section']}: {r['detail']}")
            else:
                self.stdout.write(self.style.ERROR(f"  {r['section']} failed: {r['detail']}"))
