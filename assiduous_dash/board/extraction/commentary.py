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

from decimal import Decimal
from typing import Optional

from .gemini_client import _get_client, GEMINI_MODEL
from google.genai import types


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