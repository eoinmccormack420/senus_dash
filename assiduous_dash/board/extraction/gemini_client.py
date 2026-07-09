"""
Gemini client wrapper for structured financial data extraction.

Save as: board/extraction/gemini_client.py

Install: pip uninstall google-generativeai  (old, no longer supported)
         pip install google-genai            (current SDK)

Requires GEMINI_API_KEY in your environment / .env.

This replaces the earlier version built on `google.generativeai`, which
Google has stopped supporting. The new `google.genai` package uses a
Client object rather than configuring a global module, but the rest of
the pipeline (schemas, pdf_utils, pipeline.py) doesn't need to change —
only this file's internals.
"""

import json
import os
import time
from typing import Optional

from google import genai
from google.genai import types

GEMINI_MODEL = "gemini-2.5-flash"

FIELD_DESCRIPTIONS = {
    "pl_statement": """
revenue, cost_of_sales, distribution_costs, admin_expenses,
other_operating_income, interest_expense, tax_expense, gross_profit,
operating_loss, loss_before_tax, loss_after_tax
""",
    "balance_sheet": """
goodwill, development_costs, tangible_assets, debtors, cash,
current_creditors (report as a NEGATIVE number), contingent_consideration
(NEGATIVE if present), long_term_debt (NEGATIVE), share_capital,
share_premium, retained_earnings
""",
    "cash_flow": """
net_operating_cash, depreciation, working_capital_movement,
net_investing_cash, net_financing_cash, equity_raised, loans_net,
net_cash_movement, opening_cash, closing_cash
""",
    "business_metrics": """
total_customers, enterprise_customers, acv_soil_per_enterprise,
acv_era_per_enterprise, revenue_ireland_pct, pipeline_value,
pipeline_deals_count, employees, market_cap, share_price
""",
}

_client: Optional[genai.Client] = None


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            raise RuntimeError(
                "GEMINI_API_KEY not set. Add it to your .env and load it "
                "before running the extraction pipeline."
            )
        _client = genai.Client(api_key=api_key)
    return _client


def build_prompt(
    statement_kind: str,
    period_label: str,
    source_text: Optional[str],
    period_end_date: Optional[str] = None,
    period_start_date: Optional[str] = None,
) -> str:
    fields = FIELD_DESCRIPTIONS[statement_kind]

    date_guidance = ""
    if period_end_date:
        date_guidance = f"""
IMPORTANT — matching the correct column:
The internal label "{period_label}" will NOT appear anywhere in the
source text. This period covers {period_start_date or "unknown"} to
{period_end_date}. Financial statements typically show TWO columns side
by side: the current period and a prior-year comparative. Use ONLY the
column whose date matches {period_end_date} (or the nearest label such
as "31-Dec-25" for a 2025-12-31 period end). Do NOT use the comparative/
prior-year column even though it sits right next to the correct one.
"""

    # source_text is None for scanned/image-only PDFs, where the raw PDF
    # bytes are attached to the request directly instead (see
    # extract_statement_from_pdf below) — there's no extracted text to
    # embed in the prompt in that case, only an instruction to read the
    # attached file.
    source_block = (
        f"""Source document text:
---
{source_text}
---"""
        if source_text is not None
        else """The source document is attached to this request as a PDF file.
Read it directly — including any pages that are scanned images rather
than digital text — to find the figures below."""
    )

    return f"""You are extracting structured financial data from a company's
source financial document. The company is Senus PLC. The reporting
period you are extracting is: {period_label}.
{date_guidance}
Extract ONLY the following fields for the {statement_kind.replace('_', ' ')}:
{fields}

Rules:
- Return ONLY a single JSON object with these field names as keys. No
  markdown, no code fences, no explanation text before or after.
- If a figure is genuinely not present in the source text for this
  period, OMIT that key entirely. Do not guess, estimate, or invent a
  value.
- All monetary figures should be plain numbers (no currency symbols,
  no commas, no "€" or "k"/"m" suffixes) — e.g. 688317.00 not "€688,317".
- SIGN CONVENTION — this is critical and overrides how the source
  document displays the number. There are two groups:
  (1) ALWAYS POSITIVE, even though they represent costs/expenses:
      cost_of_sales, distribution_costs, admin_expenses,
      interest_expense, tax_expense. These are expense magnitudes, not
      net results — return them as plain positive numbers exactly as
      shown in the source document.
  (2) ALWAYS NEGATIVE, even though the source document typically shows
      them as plain positive numbers under a "Loss" heading:
      operating_loss, loss_before_tax, loss_after_tax. Example: a
      document showing "Loss before taxation: 485,144" means you should
      return loss_before_tax: -485144.00.
  For balance sheet liabilities (current_creditors,
  contingent_consideration, long_term_debt): return these as NEGATIVE
  even if shown as positive or in brackets in the source.
  Revenue, gross_profit, assets, and income line items are POSITIVE.

{source_block}

JSON output:"""


def extract_statement(
    statement_kind: str,
    period_label: str,
    source_text: str,
    max_retries: int = 1,
    period_end_date: Optional[str] = None,
    period_start_date: Optional[str] = None,
) -> dict:
    """
    Calls Gemini and returns the parsed JSON dict. Raises on failure
    after retries are exhausted — the pipeline layer is responsible for
    catching this and logging it against the ExtractionAttempt record.
    """
    client = _get_client()
    prompt = build_prompt(
        statement_kind,
        period_label,
        source_text,
        period_end_date=period_end_date,
        period_start_date=period_start_date,
    )

    last_error: Optional[Exception] = None
    for attempt in range(max_retries + 1):
        try:
            response = client.models.generate_content(
                model=GEMINI_MODEL,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                ),
            )
            return json.loads(response.text)
        except Exception as exc:  # noqa: BLE001 - deliberately broad, logged upstream
            last_error = exc
            if attempt < max_retries:
                time.sleep(2)
                continue
            raise RuntimeError(
                f"Gemini extraction failed for {statement_kind}/{period_label} "
                f"after {max_retries + 1} attempt(s): {last_error}"
            ) from last_error


def extract_statement_from_pdf(
    statement_kind: str,
    period_label: str,
    pdf_path: str,
    max_retries: int = 1,
    period_end_date: Optional[str] = None,
    period_start_date: Optional[str] = None,
) -> dict:
    """
    Same contract as extract_statement(), but for scanned/image-only
    PDFs with no usable text layer (see pdf_utils.has_extractable_text).
    Gemini 2.5 Flash reads PDF pages natively as images, so rather than
    bolting on a separate OCR library, the raw file bytes are attached
    to the request directly — the model does the equivalent of OCR
    itself as part of the same multimodal call, over the actual page
    images rather than pdfplumber's (empty) text extraction.
    """
    client = _get_client()
    prompt = build_prompt(
        statement_kind,
        period_label,
        source_text=None,
        period_end_date=period_end_date,
        period_start_date=period_start_date,
    )

    with open(pdf_path, "rb") as f:
        pdf_bytes = f.read()
    pdf_part = types.Part.from_bytes(data=pdf_bytes, mime_type="application/pdf")

    last_error: Optional[Exception] = None
    for attempt in range(max_retries + 1):
        try:
            response = client.models.generate_content(
                model=GEMINI_MODEL,
                contents=[pdf_part, prompt],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                ),
            )
            return json.loads(response.text)
        except Exception as exc:  # noqa: BLE001 - deliberately broad, logged upstream
            last_error = exc
            if attempt < max_retries:
                time.sleep(2)
                continue
            raise RuntimeError(
                f"Gemini PDF extraction failed for {statement_kind}/{period_label} "
                f"after {max_retries + 1} attempt(s): {last_error}"
            ) from last_error