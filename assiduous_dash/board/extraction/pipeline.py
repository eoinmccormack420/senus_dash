"""
Pipeline orchestrator — ties together PDF extraction, Gemini calls,
Pydantic validation, and cross-checking against known-correct values.

Save as: board/extraction/pipeline.py

This is deliberately NOT a single God function — each stage is a
separate, testable function, and run_extraction() composes them. That
composition, and the fact that a failure at any stage produces a clear
status rather than a silent bad write, is the part worth highlighting
in your README as a "technical decision."
"""

import hashlib
from decimal import Decimal, InvalidOperation
from typing import Optional

from pydantic import ValidationError

from .schemas import SCHEMA_REGISTRY
from .pdf_utils import extract_text_and_tables, extract_relevant_section, has_extractable_text
from .gemini_client import extract_statement, extract_statement_from_pdf
from .notifications import notify_slack
from .teams_notifications import notify_teams

# Keywords used to locate the relevant section of the document for each
# statement type, so Gemini gets a focused excerpt rather than the full
# document. Financial statements and business/KPI metrics often live in
# very different parts of the same PDF (e.g. a corporate presentation
# section vs. the audited accounts section), so sending everything can
# dilute Gemini's attention across irrelevant pages.
SECTION_KEYWORDS = {
    "pl_statement": [
        "Consolidated Statement of Comprehensive Income",
        "Profit and Loss",
        "Income Statement",
    ],
    "balance_sheet": [
        "Consolidated Balance Sheet",
        "Statement of Financial Position",
        "Balance Sheet",
    ],
    "cash_flow": [
        "Consolidated Statement of Cash Flows",
        "Cash Flow Statement",
    ],
    "business_metrics": [
        "Key Performance Indicators",
        "Business Metrics",
        "Customers",
        "Corporate Presentation",
        "Employees",
    ],
}

# Window sizes are larger for statements (dense number tables benefit
# from more surrounding context) and smaller for business_metrics
# (usually scattered short facts, not a single dense table).
SECTION_WINDOW = {
    "pl_statement": 3000,
    "balance_sheet": 3000,
    "cash_flow": 8000,
    "business_metrics": 1500,
}

# Adjust import to your app name
from board.models import (
    ExtractionAttempt,
    FinancialPeriod,
    PLStatement,
    BalanceSheet,
    CashFlow,
    BusinessMetrics,
)

# Ground-truth model lookup, keyed the same way as SCHEMA_REGISTRY
GROUND_TRUTH_MODELS = {
    "pl_statement": PLStatement,
    "balance_sheet": BalanceSheet,
    "cash_flow": CashFlow,
    "business_metrics": BusinessMetrics,
}

# Tolerance for considering an extracted figure a "match" against the
# known-correct seeded value. 1% absolute relative difference allows
# for benign rounding without masking a genuinely wrong extraction.
MATCH_TOLERANCE_PCT = Decimal("1.0")

# Statuses worth reusing from cache — a schema_invalid or api_error attempt
# should be retried, not treated as a settled result.
CACHEABLE_STATUSES = {"schema_valid", "cross_check_pass", "cross_check_fail"}


def _hash_pdf(pdf_path: str) -> str:
    with open(pdf_path, "rb") as f:
        return hashlib.sha256(f.read()).hexdigest()


# Fields that must always be forced to a specific sign after extraction,
# regardless of what Gemini returns. This exists because LLM output for
# sign conventions is not perfectly reliable call-to-call (observed
# empirically: identical prompt, same source text, inconsistent signs
# across repeated runs) — enforcing this in code is more robust than a
# prompt instruction alone.
FORCE_POSITIVE_FIELDS = {
    "pl_statement": [
        "cost_of_sales", "distribution_costs", "admin_expenses",
        "interest_expense", "tax_expense",
    ],
}
FORCE_NEGATIVE_FIELDS = {
    "pl_statement": ["operating_loss", "loss_before_tax", "loss_after_tax"],
    "balance_sheet": ["current_creditors", "contingent_consideration", "long_term_debt"],
}


def _normalize_signs(statement_kind: str, data: dict) -> dict:
    """
    Forces known sign conventions on a validated extraction dict, and
    converts Decimal values to float so the result is safe to store in
    a Django JSONField (Decimal is not natively JSON-serializable).
    """
    normalized = {}
    for key, value in data.items():
        if isinstance(value, Decimal):
            value = float(value)
        normalized[key] = value

    for field in FORCE_POSITIVE_FIELDS.get(statement_kind, []):
        if field in normalized and normalized[field] is not None:
            normalized[field] = abs(normalized[field])
    for field in FORCE_NEGATIVE_FIELDS.get(statement_kind, []):
        if field in normalized and normalized[field] is not None:
            normalized[field] = -abs(normalized[field])
    return normalized


def _cross_check(statement_kind: str, period: FinancialPeriod, extracted: dict) -> dict:
    """
    Compares extracted field values against the ground-truth row already
    seeded in the database for this period (from seed_senus_data.py).

    Returns a dict of per-field results and an overall match rate. If no
    ground-truth row exists for this period/statement (e.g. HY2025 has
    no balance sheet seeded), cross-checking is skipped and flagged as
    such rather than silently reported as a pass.
    """
    model_cls = GROUND_TRUTH_MODELS[statement_kind]
    try:
        actual_obj = model_cls.objects.get(period=period)
    except model_cls.DoesNotExist:
        return {"_skipped": True, "reason": "No ground-truth row seeded for this period"}

    results = {}
    matched = 0
    checked = 0

    for field_name, extracted_value in extracted.items():
        if not hasattr(actual_obj, field_name):
            continue  # extraneous field Gemini returned; ignore for cross-check
        actual_value = getattr(actual_obj, field_name)
        if actual_value is None or extracted_value is None:
            continue

        try:
            extracted_dec = Decimal(str(extracted_value))
            actual_dec = Decimal(str(actual_value))
        except InvalidOperation:
            # Non-numeric field (shouldn't happen given the schema, but
            # don't let it crash the whole cross-check)
            continue

        checked += 1
        if actual_dec == 0:
            diff_pct = Decimal("0") if extracted_dec == 0 else Decimal("100")
        else:
            diff_pct = abs((extracted_dec - actual_dec) / actual_dec) * 100

        is_match = diff_pct <= MATCH_TOLERANCE_PCT
        if is_match:
            matched += 1

        results[field_name] = {
            "extracted": float(extracted_dec),
            "actual": float(actual_dec),
            "diff_pct": float(round(diff_pct, 2)),
            "match": is_match,
        }

    match_rate = round((matched / checked) * 100, 1) if checked else None
    return {"_skipped": False, "match_rate_pct": match_rate, "fields": results}


def run_extraction(
    statement_kind: str,
    period: FinancialPeriod,
    pdf_path: str,
    force: bool = False,
) -> ExtractionAttempt:
    """
    Runs the full pipeline for one statement type / one period:
    PDF -> Gemini -> schema validation -> cross-check -> ExtractionAttempt record.

    Never writes to the real statement models (PLStatement etc.) — this
    only ever produces an ExtractionAttempt for human review. Promoting
    a verified attempt into the real model is a deliberate separate step
    (see promote_attempt below), not automatic.

    Caching: if a previous attempt for this exact (period, statement_kind,
    PDF content) already reached a cacheable status, that attempt is
    returned as-is and Gemini is not called again — re-running the same
    document while debugging the rest of the pipeline (schema tweaks,
    sign normalization, etc.) shouldn't burn API quota. Pass force=True
    to bypass this and re-extract anyway.
    """
    content_hash = _hash_pdf(pdf_path)

    if not force:
        cached = (
            ExtractionAttempt.objects.filter(
                period=period,
                statement_kind=statement_kind,
                source_content_hash=content_hash,
                status__in=CACHEABLE_STATUSES,
            )
            .order_by("-created_at")
            .first()
        )
        if cached is not None:
            return cached

    attempt = ExtractionAttempt.objects.create(
        period=period,
        statement_kind=statement_kind,
        source_document=pdf_path,
        source_content_hash=content_hash,
        status="pending",
    )

    # Stage 1 — read the document. Scanned/photographed statutory
    # filings (no embedded text layer) skip straight to the PDF-native
    # vision path — pdfplumber has nothing to extract from those, and
    # sending it an empty text excerpt just makes Gemini correctly
    # report no data found rather than surfacing the real problem.
    try:
        is_scanned = not has_extractable_text(pdf_path)
    except Exception as exc:  # noqa: BLE001
        attempt.status = "api_error"
        attempt.error_message = f"PDF extraction failed: {exc}"
        attempt.save()
        return attempt

    # Stage 2 — call Gemini
    try:
        if is_scanned:
            raw_json = extract_statement_from_pdf(
                statement_kind,
                period.label,
                pdf_path,
                period_end_date=str(period.end_date),
                period_start_date=str(period.start_date),
            )
        else:
            full_text = extract_text_and_tables(pdf_path)
            # Narrow to the relevant section for this statement type so
            # Gemini isn't scanning the whole document (see
            # SECTION_KEYWORDS above). Falls back to the full text if no
            # keyword match is found.
            source_text = extract_relevant_section(
                full_text,
                keywords=SECTION_KEYWORDS.get(statement_kind, []),
                window=SECTION_WINDOW.get(statement_kind, 2000),
            )
            raw_json = extract_statement(
                statement_kind,
                period.label,
                source_text,
                period_end_date=str(period.end_date),
                period_start_date=str(period.start_date),
            )
        attempt.raw_response = raw_json
    except Exception as exc:  # noqa: BLE001
        attempt.status = "api_error"
        attempt.error_message = str(exc)
        attempt.save()
        return attempt

    # Stage 3 — schema validation
    schema_cls = SCHEMA_REGISTRY[statement_kind]
    try:
        validated = schema_cls(**raw_json)
    except ValidationError as exc:
        attempt.status = "schema_invalid"
        attempt.error_message = str(exc)
        attempt.save()
        return attempt

    attempt.status = "schema_valid"

    # Stage 3.5 — normalize known sign conventions in code, since the
    # prompt instruction alone isn't 100% reliable across repeated calls
    validated_dict = {k: v for k, v in validated.model_dump().items() if v is not None}
    validated_dict = _normalize_signs(statement_kind, validated_dict)
    attempt.raw_response = {**attempt.raw_response, "_normalized": validated_dict}

    # Stage 4 — cross-check against ground truth
    cross_check = _cross_check(statement_kind, period, validated_dict)

    if cross_check.get("_skipped"):
        attempt.cross_check_results = cross_check
    else:
        attempt.cross_check_results = cross_check["fields"]
        attempt.match_rate_pct = cross_check["match_rate_pct"]
        attempt.status = (
            "cross_check_pass"
            if (cross_check["match_rate_pct"] or 0) >= 95.0
            else "cross_check_fail"
        )

    attempt.save()
    notify_slack(attempt)
    notify_teams(attempt)
    return attempt


def promote_attempt(attempt: ExtractionAttempt) -> Optional[object]:
    """
    Writes a verified ExtractionAttempt's data into the real statement
    model, creating or updating the OneToOne row for that period.

    Only runs if attempt.verified is True — this is the human approval
    gate. Call this from the admin (e.g. an admin action) or a review
    CLI command, never automatically from run_extraction().
    """
    if not attempt.verified:
        raise ValueError(
            "Cannot promote an unverified extraction attempt. "
            "Set verified=True after human review first."
        )
    if attempt.status not in ("cross_check_pass", "schema_valid"):
        raise ValueError(
            f"Refusing to promote attempt with status={attempt.status}"
        )

    model_cls = GROUND_TRUTH_MODELS[attempt.statement_kind]
    # Prefer the normalized values saved during run_extraction; fall back
    # to re-validating the raw response for older attempts predating the
    # sign-normalization step.
    if isinstance(attempt.raw_response, dict) and "_normalized" in attempt.raw_response:
        field_values = attempt.raw_response["_normalized"]
    else:
        schema_cls = SCHEMA_REGISTRY[attempt.statement_kind]
        validated = schema_cls(**attempt.raw_response)
        field_values = {k: v for k, v in validated.model_dump().items() if v is not None}
        field_values = _normalize_signs(attempt.statement_kind, field_values)

    obj, _created = model_cls.objects.update_or_create(
        period=attempt.period, defaults=field_values
    )
    return obj