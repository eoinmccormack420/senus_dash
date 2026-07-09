"""
CLI entry point for generating board AI insights.

Save as: board/management/commands/generate_insights.py

Usage:
    # Generate all four sections + the outlook summary for a period
    python manage.py generate_insights --period HY2026

    # Generate just one section
    python manage.py generate_insights --period HY2026 --section cash_liquidity

Pulls figures directly from the validated PLStatement/BalanceSheet/
CashFlow rows for the period (and, where available, the prior
comparable period for trend context), builds a per-section summary
dict, and calls Gemini to write commentary. Saves/updates one
AIInsight row per (period, section) — safe to re-run, it overwrites
the existing commentary for that section rather than duplicating rows.

Caching: the exact (current_summary, prior_summary) pair handed to the
prompt is hashed (SHA-256) and stored on the AIInsight row alongside
the generated text — prior_summary is included because a backfill to
the PRIOR period's figures (e.g. correcting a ground-truth error)
changes the trend context this period's commentary was written
against, even though this period's own numbers didn't move. On a
re-run, if a row already exists for (period, section) and its stored
hash matches, the figures are unchanged since the commentary was last
written — Gemini would just be re-narrating identical numbers, so the
call is skipped entirely. Pass --force to regenerate anyway (e.g.
after a prompt/instructions change with no underlying data change).
"""

import hashlib
import json

from django.core.management.base import BaseCommand, CommandError

from board.models import FinancialPeriod, AIInsight
from board.extraction.commentary import generate_commentary, SECTION_INSTRUCTIONS


def _hash_summaries(current_summary: dict, prior_summary: dict | None) -> str:
    canonical = json.dumps(
        {"current": current_summary, "prior": prior_summary}, sort_keys=True, default=str
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _pl_summary(period: FinancialPeriod) -> dict | None:
    pl = getattr(period, "pl_statement", None)
    if pl is None:
        return None
    return {
        "revenue": pl.revenue,
        "cost_of_sales": pl.cost_of_sales,
        "gross_profit": pl.gross_profit,
        "gross_margin_pct": pl.gross_margin_pct,
        "admin_expenses": pl.admin_expenses,
        "admin_expense_pct": pl.admin_expense_pct,
        "ebitda": pl.ebitda,
        "operating_loss": pl.operating_loss,
        "loss_after_tax": pl.loss_after_tax,
    }


def _cash_summary(period: FinancialPeriod) -> dict | None:
    cf = getattr(period, "cash_flow", None)
    bs = getattr(period, "balance_sheet", None)
    if cf is None:
        return None
    summary = {
        "opening_cash": cf.opening_cash,
        "closing_cash": cf.closing_cash,
        "net_cash_movement": cf.net_cash_movement,
        "net_operating_cash": cf.net_operating_cash,
        "net_investing_cash": cf.net_investing_cash,
        "net_financing_cash": cf.net_financing_cash,
        "free_cash_flow": cf.free_cash_flow,
    }
    if bs is not None:
        summary["cash_runway_months"] = bs.cash_runway_months
        summary["current_ratio"] = bs.current_ratio
    return summary


def _solvency_summary(period: FinancialPeriod) -> dict | None:
    bs = getattr(period, "balance_sheet", None)
    if bs is None:
        return None
    total_liabilities = (
        abs(bs.current_creditors) + abs(bs.contingent_consideration) + abs(bs.long_term_debt)
    )
    return {
        "total_fixed_assets": bs.total_fixed_assets,
        "total_current_assets": bs.total_current_assets,
        "net_assets": bs.net_assets,
        "total_liabilities": total_liabilities,
        "contingent_consideration": bs.contingent_consideration,
        "long_term_debt": bs.long_term_debt,
        "goodwill": bs.goodwill,
    }


def _returns_summary(period: FinancialPeriod) -> dict | None:
    bm = getattr(period, "business_metrics", None)
    if bm is None:
        return None
    summary = {}
    for field in [
        "market_cap", "share_price", "total_customers", "enterprise_customers",
        "acv_soil_per_enterprise", "acv_era_per_enterprise", "revenue_per_customer",
        "enterprise_revenue_concentration", "pipeline_value", "pipeline_deals_count",
    ]:
        value = getattr(bm, field, None)
        if value is not None:
            summary[field] = value
    return summary or None


def _outlook_summary(period: FinancialPeriod) -> dict:
    summary = {}
    for label, fn in [
        ("revenue_growth", _pl_summary),
        ("cash_liquidity", _cash_summary),
        ("solvency_leverage", _solvency_summary),
    ]:
        section_data = fn(period)
        if section_data:
            summary.update({f"{label}.{k}": v for k, v in section_data.items()})
    return summary


SUMMARY_BUILDERS = {
    "revenue_growth": _pl_summary,
    "profitability": _pl_summary,  # same underlying data, different prompt focus
    "cash_liquidity": _cash_summary,
    "solvency_leverage": _solvency_summary,
    "returns": _returns_summary,
    "outlook": _outlook_summary,
}


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

        prior_period = (
            FinancialPeriod.objects.filter(end_date__lt=period.end_date)
            .order_by("-end_date")
            .select_related("pl_statement", "balance_sheet", "cash_flow")
            .first()
        )

        sections = [options["section"]] if options["section"] else list(SUMMARY_BUILDERS.keys())

        for section in sections:
            builder = SUMMARY_BUILDERS[section]
            current_summary = builder(period)

            if not current_summary:
                self.stdout.write(self.style.WARNING(f"  skip {section}: no data for {period.label}"))
                continue

            prior_summary = builder(prior_period) if prior_period else None
            data_hash = _hash_summaries(current_summary, prior_summary)

            existing = AIInsight.objects.filter(period=period, section=section).first()
            if existing and existing.source_data_hash == data_hash and not options["force"]:
                self.stdout.write(f"  skip {section}: source figures unchanged, cached commentary reused")
                continue

            self.stdout.write(f"Generating {section} commentary for {period.label}...")
            try:
                text = generate_commentary(section, period.label, current_summary, prior_summary)
            except Exception as exc:  # noqa: BLE001
                self.stdout.write(self.style.ERROR(f"  failed: {exc}"))
                continue

            AIInsight.objects.update_or_create(
                period=period,
                section=section,
                defaults={
                    "generated_text": text,
                    "model_used": "gemini-2.5-flash",
                    "source_data_hash": data_hash,
                },
            )
            self.stdout.write(self.style.SUCCESS(f"  saved ({len(text)} chars)"))