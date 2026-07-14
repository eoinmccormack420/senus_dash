"""
Tailored report narrative — adapts board commentary's register to a
named external audience (investor, lender, etc.) for a specific
ReportSpec, using Gemini.

Save as: board/extraction/report_narrative.py

Fourth Gemini pipeline (extraction, commentary, advisory, this one),
kept separate for the same reason as the others: it reads
already-validated DB figures via commentary.py's own summary builders,
never a raw document, and it never asserts anything the board's own
commentary wouldn't — audience only changes register (which figures to
foreground, how directly to state risk), never facts. Gated behind
ReportSpec.narrative_approved (see ReportSpecViewSet.approve_narrative
in views.py) before any PDF/deck can use it — same human-review-before-
anything-external-facing philosophy as ExtractionAttempt.verified /
AdvisoryGoal.commit.
"""

import time
from decimal import Decimal
from typing import Optional

from django.utils import timezone

from .commentary import SUMMARY_BUILDERS, _hash_summaries
from .gemini_client import GEMINI_MODEL, _get_client
from google.genai import types

SECTION_LABELS = {
    "revenue_growth": "Revenue & Growth",
    "profitability": "Profitability",
    "cash_liquidity": "Cash & Liquidity",
    "solvency_leverage": "Solvency & Leverage",
    "returns": "Returns",
    "outlook": "Outlook & Strategy",
}


def _section_prompt(section_label: str, period_label: str, audience_label: str, context_note: str, figures: dict) -> str:
    figures_str = "\n".join(f"  {k}: {v}" for k, v in figures.items())
    context_line = f"\nContext for this report: {context_note}\n" if context_note else ""
    return f"""You are writing the "{section_label}" section of a {period_label} financial
report for Senus PLC, an Irish natural capital software company. This
report is being prepared specifically for: {audience_label}.{context_line}

Rules:
- Write in plain, direct, professional prose suited to {audience_label} —
  adjust emphasis and register for this reader, but do not soften or
  embellish the substance.
- Reference SPECIFIC figures from the data below, formatted as €X or
  X%. Do not invent figures not present in the data.
- Do NOT use bullet points, headers, or markdown formatting — plain
  prose paragraphs only.
- Do NOT begin with a generic phrase like "In this period" — start
  directly with the substance.
- If a figure indicates genuine risk, say so plainly — do not soften
  bad news into vague language.

{period_label} figures:
{figures_str}

Commentary:"""


def _cover_prompt(period_label: str, audience_label: str, context_note: str) -> str:
    context_line = f"\nContext for this report: {context_note}\n" if context_note else ""
    return f"""Write a 2-3 sentence cover-page introduction for a {period_label}
financial report from Senus PLC, an Irish natural capital software
company, being prepared specifically for: {audience_label}.{context_line}

Plain, direct, professional prose — no bullet points or markdown. Do
not cite specific figures here (that belongs in the sections below);
this is framing only — what the report covers and why it's being
shared with this reader.

Introduction:"""


def _generate_one(prompt: str, max_retries: int, label: str, period_label: str) -> str:
    client = _get_client()
    last_error: Optional[Exception] = None
    for attempt in range(max_retries + 1):
        try:
            response = client.models.generate_content(
                model=GEMINI_MODEL,
                contents=prompt,
                config=types.GenerateContentConfig(temperature=0.4),
            )
            return response.text.strip()
        except Exception as exc:  # noqa: BLE001 - caught upstream in generate_narrative_for_spec
            last_error = exc
            if attempt < max_retries:
                time.sleep(2 ** (attempt + 1))
                continue
            raise RuntimeError(
                f"Gemini tailored narrative generation failed for {label}/{period_label} "
                f"after {max_retries + 1} attempt(s): {last_error}"
            ) from last_error


def _normalize_for_hash(value):
    """
    Coerces int/Decimal/float uniformly to float so the SAME logical
    number doesn't hash differently depending on whether it arrived as
    an unsaved model instance's int default (e.g. DecimalField(default=0))
    or a Decimal read back from the DB — json.dumps renders 0 and 0.0
    differently, silently breaking source_data_hash's cache-hit check.

    Non-numeric values pass through unchanged rather than being forced
    through float(): _outlook_summary (SUMMARY_BUILDERS["outlook"]) can
    include a bool (data_provenance.verified) and free-text
    (board_notes) alongside its numeric fields — float("some board
    note") raises ValueError, which is exactly what caused a 500 here
    for any period with board notes set, since this ran outside
    generate_narrative_for_spec's try/except.
    """
    if value is None or isinstance(value, bool):
        return value
    if isinstance(value, (int, float, Decimal)):
        return float(value)
    return value


def _figures_for_spec(spec) -> dict:
    """{section_key: {field: float|str|bool, ...}, ...} for every included section that has data."""
    period = spec.period
    figures = {}
    for section_key, field_name in spec.SECTION_FIELDS:
        if not getattr(spec, field_name):
            continue
        summary = SUMMARY_BUILDERS[section_key](period)
        if summary:
            figures[section_key] = {k: _normalize_for_hash(v) for k, v in summary.items()}
    return figures


def _generate_narrative_text(spec, figures: dict, max_retries: int) -> dict:
    period_label = spec.period.label
    narrative = {
        "cover": _generate_one(
            _cover_prompt(period_label, spec.audience_label, spec.context_note),
            max_retries, "cover", period_label,
        )
    }
    for section_key, section_figures in figures.items():
        prompt = _section_prompt(
            SECTION_LABELS[section_key], period_label, spec.audience_label, spec.context_note, section_figures
        )
        narrative[section_key] = _generate_one(prompt, max_retries, section_key, period_label)
    return narrative


def generate_narrative_for_spec(spec, force: bool = False, max_retries: int = 2) -> dict:
    """
    Generates (or reuses cached) tailored narrative for `spec`. Returns
    {"status": "generated"|"skipped"|"error", "detail": ...}.

    Owns hashing, the Gemini calls, and persisting the result onto the
    ReportSpec row — same shape as advisory.generate_goals_for_period,
    so ReportSpecViewSet.generate_narrative is a thin wrapper like
    every other admin-triggered generation view in this codebase.
    Regenerating always resets narrative_approved to False: a stale
    approval on newly-generated text would defeat the review gate.
    """
    try:
        figures = _figures_for_spec(spec)
        data_hash = _hash_summaries(
            {"audience": spec.audience_label, "context": spec.context_note, "figures": figures}, None
        )

        if spec.narrative_source_hash == data_hash and not force:
            return {"status": "skipped", "detail": "audience/context/figures unchanged, cached narrative reused"}

        narrative = _generate_narrative_text(spec, figures, max_retries)
    except Exception as exc:  # noqa: BLE001 - this function must never let ReportSpecViewSet.generate_narrative 500
        return {"status": "error", "detail": str(exc)}

    spec.tailored_narrative = narrative
    spec.narrative_model_used = GEMINI_MODEL
    spec.narrative_source_hash = data_hash
    spec.narrative_generated_at = timezone.now()
    spec.narrative_approved = False
    spec.narrative_approved_by = None
    spec.narrative_approved_at = None
    spec.save()

    return {"status": "generated", "detail": f"{len(narrative)} piece(s) generated, pending review"}
