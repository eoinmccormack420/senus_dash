"""
Generates board-level narrative commentary using Gemini, from the
ALREADY-VALIDATED structured data in the database — not from raw PDFs.

Save as: board/extraction/commentary.py

This is a deliberately different pipeline from extraction.py:
- extraction.py: PDF -> Gemini -> structured JSON -> validated against
  ground truth. Output is NUMBERS.
- commentary.py: clean DB data -> Gemini -> prose. Output is NARRATIVE.

Feeding Gemini your own validated numbers (rather than asking it to
both extract AND interpret from a raw document) means the commentary
can't misstate a figure — it's writing about numbers you already know
are correct, which is a meaningfully safer design for anything a board
will actually read.
"""

import hashlib
import json
from decimal import Decimal
from typing import Optional

from .gemini_client import _get_client, GEMINI_MODEL
from google.genai import types

from board.models import AIInsight, FinancialPeriod


def _to_float(value):
    if isinstance(value, Decimal):
        return float(value)
    return value


SECTION_INSTRUCTIONS = {
    "revenue_growth": (
        "Write board-level commentary on revenue and growth. Comment on "
        "the revenue trend versus the prior period, gross margin, and "
        "what's driving any change. 2-4 sentences."
    ),
    "profitability": (
        "Write board-level commentary on profitability. Comment on EBITDA, "
        "operating margin, and specifically what is driving the operating "
        "loss (e.g. admin expense ratio versus gross profit). 2-4 sentences."
    ),
    "cash_liquidity": (
        "Write board-level commentary on cash and liquidity. Comment on "
        "the cash runway, whether operating cash flow is improving, and "
        "whether cash movement is being driven by the core business or "
        "by financing activity (e.g. a share issue). Be direct if cash "
        "runway is a concern. 2-4 sentences."
    ),
    "solvency_leverage": (
        "Write board-level commentary on solvency and leverage. Comment "
        "on net assets, the gearing ratio, and the composition of "
        "liabilities (e.g. contingent consideration from an acquisition, "
        "if present). 2-4 sentences."
    ),
    "returns": (
        "Write board-level commentary on returns and business performance "
        "— market capitalisation, customer growth, and unit economics "
        "(average contract value, revenue per customer). If market or "
        "customer data is missing for this period, note that briefly "
        "rather than fabricating a figure. 2-4 sentences."
    ),
    "outlook": (
        "Write a brief board-level executive summary synthesising revenue, "
        "profitability, cash, and solvency into a single forward-looking "
        "paragraph. This is the first thing a board member reads before "
        "the detailed sections. 3-5 sentences."
    ),
}


def build_commentary_prompt(
    section: str,
    period_label: str,
    current: dict,
    prior: Optional[dict] = None,
) -> str:
    instruction = SECTION_INSTRUCTIONS[section]

    current_str = "\n".join(f"  {k}: {v}" for k, v in current.items())
    prior_str = (
        "\n".join(f"  {k}: {v}" for k, v in prior.items())
        if prior
        else "  (no prior period data available for comparison)"
    )

    return f"""You are writing commentary for the board of Senus PLC, an
Irish natural capital software company, for their {period_label} board
report. {instruction}

Rules:
- Write in plain, direct, professional prose — the register of an
  experienced CFO writing to a board, not a marketing summary.
- Reference SPECIFIC figures from the data below, formatted as €X or
  X%. Do not invent figures not present in the data.
- Do NOT use bullet points, headers, or markdown formatting — plain
  prose paragraphs only.
- Do NOT begin with a generic phrase like "In this period" — start
  directly with the substance.
- If a figure indicates a genuine risk (e.g. cash runway under 6
  months, rising leverage), say so plainly. Do not soften bad news into
  vague language — a board relies on this being direct.

{period_label} figures:
{current_str}

Prior period figures (for comparison, may be a different period type,
e.g. comparing a half-year to the prior half-year):
{prior_str}

Commentary:"""


def generate_commentary(
    section: str,
    period_label: str,
    current: dict,
    prior: Optional[dict] = None,
) -> str:
    """
    Calls Gemini in plain-text mode (no JSON constraint needed here —
    the output is prose) and returns the generated commentary string.
    """
    client = _get_client()
    current_clean = {k: _to_float(v) for k, v in current.items()}
    prior_clean = {k: _to_float(v) for k, v in prior.items()} if prior else None

    prompt = build_commentary_prompt(section, period_label, current_clean, prior_clean)

    response = client.models.generate_content(
        model=GEMINI_MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(temperature=0.4),
    )
    return response.text.strip()


# --- Per-section summary builders + the generate-all-sections entry point ---
#
# Moved here from the generate_insights management command so the same
# logic backs both the CLI and RegenerateInsightsView (board/views.py) —
# a single source of truth for "what generating insights for a period
# actually does", with the command and the view both thin wrappers.


def _hash_summaries(current_summary: dict, prior_summary: Optional[dict]) -> str:
    canonical = json.dumps(
        {"current": current_summary, "prior": prior_summary}, sort_keys=True, default=str
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _pl_summary(period) -> Optional[dict]:
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


def _cash_summary(period) -> Optional[dict]:
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


def _solvency_summary(period) -> Optional[dict]:
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


def _returns_summary(period) -> Optional[dict]:
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


def _outlook_summary(period) -> dict:
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


def generate_insights_for_period(period, force: bool = False, sections: Optional[list] = None) -> list:
    """
    Generates (or reuses cached) commentary for each of the given
    sections (default: all of SUMMARY_BUILDERS) for `period`. Returns a
    list of {"section", "status", "detail"} dicts — status is one of
    "generated", "skipped", "error".

    Caching: the exact (current_summary, prior_summary) pair handed to
    the prompt is hashed and stored on the AIInsight row. On a re-run,
    if a row already exists for (period, section) and its stored hash
    matches, the figures are unchanged since the commentary was last
    written — Gemini would just be re-narrating identical numbers, so
    the call is skipped. Pass force=True to regenerate anyway.
    """
    prior_period = (
        FinancialPeriod.objects.filter(end_date__lt=period.end_date)
        .order_by("-end_date")
        .select_related("pl_statement", "balance_sheet", "cash_flow")
        .first()
    )

    section_keys = sections if sections is not None else list(SUMMARY_BUILDERS.keys())
    results = []

    for section in section_keys:
        builder = SUMMARY_BUILDERS[section]
        current_summary = builder(period)

        if not current_summary:
            results.append({"section": section, "status": "skipped", "detail": f"no data for {period.label}"})
            continue

        prior_summary = builder(prior_period) if prior_period else None
        data_hash = _hash_summaries(current_summary, prior_summary)

        existing = AIInsight.objects.filter(period=period, section=section).first()
        if existing and existing.source_data_hash == data_hash and not force:
            results.append({"section": section, "status": "skipped", "detail": "source figures unchanged, cached commentary reused"})
            continue

        try:
            text = generate_commentary(section, period.label, current_summary, prior_summary)
        except Exception as exc:  # noqa: BLE001
            results.append({"section": section, "status": "error", "detail": str(exc)})
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
        results.append({"section": section, "status": "generated", "detail": f"{len(text)} chars"})

    return results