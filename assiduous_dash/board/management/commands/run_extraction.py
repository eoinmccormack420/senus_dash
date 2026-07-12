"""
CLI entry point for running the Gemini extraction pipeline.

Save as: <yourapp>/management/commands/run_extraction.py

Usage examples:
    # Run one statement type against one period, using a specific PDF
    python manage.py run_extraction --period HY2026 --kind pl_statement \\
        --pdf /path/to/senus_half_year_results.pdf

    # Run all four statement types against one period/document in one go
    python manage.py run_extraction --period HY2026 --all-kinds \\
        --pdf /path/to/senus_half_year_results.pdf

After running, check results in the Django admin (ExtractionAttempt)
or shell:
    ExtractionAttempt.objects.filter(period__label="HY2026")
Review match_rate_pct and cross_check_results before setting
verified=True and calling promote_attempt().
"""

from django.core.management.base import BaseCommand, CommandError

from board.models import FinancialPeriod, ExtractionAttempt
from board.extraction.pipeline import run_extraction
from board.extraction.schemas import SCHEMA_REGISTRY


class Command(BaseCommand):
    help = "Runs the Gemini financial data extraction pipeline against a source PDF"

    def add_arguments(self, parser):
        parser.add_argument("--period", required=True, help="FinancialPeriod label, e.g. HY2026")
        parser.add_argument("--pdf", required=True, help="Path to the source PDF")
        parser.add_argument(
            "--kind",
            choices=list(SCHEMA_REGISTRY.keys()),
            help="Statement type to extract (omit if using --all-kinds)",
        )
        parser.add_argument(
            "--all-kinds",
            action="store_true",
            help="Run extraction for all four statement types against this document",
        )
        parser.add_argument(
            "--force",
            action="store_true",
            help="Re-call Gemini even if a cached attempt already exists for this "
                 "exact document/period/kind",
        )

    def handle(self, *args, **options):
        try:
            period = FinancialPeriod.objects.get(label=options["period"])
        except FinancialPeriod.DoesNotExist:
            raise CommandError(
                f"No FinancialPeriod with label '{options['period']}'. "
                f"Run seed_senus_data first, or check spelling."
            )

        if not options["kind"] and not options["all_kinds"]:
            raise CommandError("Specify --kind <statement_type> or --all-kinds")

        kinds = list(SCHEMA_REGISTRY.keys()) if options["all_kinds"] else [options["kind"]]

        for kind in kinds:
            self.stdout.write(f"Extracting {kind} for {period.label}...")
            attempt = run_extraction(kind, period, options["pdf"], force=options["force"])
            self._report(attempt)

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
                f"  -> {attempt.statement_kind}: {attempt.status}"
                + (
                    f" (match rate: {attempt.match_rate_pct}%)"
                    if attempt.match_rate_pct is not None
                    else ""
                )
            )
        )
        if attempt.error_message:
            self.stdout.write(self.style.ERROR(f"     {attempt.error_message[:300]}"))
