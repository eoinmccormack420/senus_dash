"""Funding-readiness scoring and milestone evaluation.

Both functions are side-effect free and computed live from already-validated
period data (never stored) — same rationale as `board/alerts.py`'s
`evaluate_board_alerts`: the dashboard should always reflect current data,
not a stale cached score.
"""

from __future__ import annotations


def _clamp(value: float, low: float = 0.0, high: float = 100.0) -> float:
    return max(low, min(high, value))


def _scale(value: float, low: float, high: float) -> float:
    """Map value linearly from [low, high] to [0, 100], clamped at both ends."""
    return _clamp((value - low) / (high - low) * 100)


def compute_readiness_score(period) -> dict:
    """
    Weighted-average "Funding Marathon" readiness score (0-100) from
    existing, already-validated period fundamentals.

    Components whose underlying data is missing (e.g. no balance sheet
    filed yet) are dropped from the average and the remaining weights are
    renormalized, rather than scoring a missing figure as 0 — the codebase's
    general rule of not fabricating or penalizing absent data (see
    `FinancialPeriod.provenance` / `yoy_revenue_growth_pct` docstrings in
    models.py) applies here too. Returns score=None if no component has data.
    """
    pl = getattr(period, "pl_statement", None)
    bs = getattr(period, "balance_sheet", None)
    provenance = period.provenance

    if provenance["verified"]:
        governance_score = 100.0
    elif provenance["source"] == "ai_extracted":
        governance_score = 40.0
    else:
        # No extraction attempts at all — manually keyed figures, moderate
        # baseline trust since a human already entered them directly.
        governance_score = 60.0

    components = [
        {
            "key": "ebitda_trajectory", "title": "EBITDA trajectory", "unit": "%",
            "value": pl.ebitda_margin_pct if pl else None,
            "weight_pct": 30,
            "detail": "EBITDA margin scaled from -50% (0 pts) to +20% (100 pts).",
        },
        {
            "key": "cash_runway", "title": "Cash runway", "unit": "months",
            "value": bs.cash_runway_months if bs else None,
            "weight_pct": 25,
            "detail": "Cash runway scaled from 0 months (0 pts) to 18 months (100 pts).",
        },
        {
            "key": "liquidity", "title": "Liquidity", "unit": "x",
            "value": bs.current_ratio if bs else None,
            "weight_pct": 15,
            "detail": "Current ratio scaled from 0x (0 pts) to 2.0x (100 pts).",
        },
        {
            "key": "governance_verified", "title": "Governance & AI verification", "unit": "",
            "value": governance_score,
            "weight_pct": 15,
            "detail": "Human-verified AI-extracted figures score highest; "
                      "unverified AI extractions score lowest.",
        },
        {
            "key": "audited_financials", "title": "Audited financials", "unit": "",
            "value": 100.0 if period.is_audited else 0.0,
            "weight_pct": 15,
            "detail": "100 if the period's financials are audited, else 0.",
        },
    ]

    scale_ranges = {
        "ebitda_trajectory": (-50.0, 20.0),
        "cash_runway": (0.0, 18.0),
        "liquidity": (0.0, 2.0),
    }

    total_weight = 0.0
    weighted_sum = 0.0
    for component in components:
        value = component["value"]
        if value is None:
            component["score"] = None
            continue
        value = float(value)
        if component["key"] in scale_ranges:
            low, high = scale_ranges[component["key"]]
            component["score"] = round(_scale(value, low, high), 1)
        else:
            component["score"] = round(_clamp(value), 1)
        component["value"] = round(value, 1)
        weighted_sum += component["score"] * component["weight_pct"]
        total_weight += component["weight_pct"]

    score = round(weighted_sum / total_weight, 1) if total_weight else None
    return {"score": score, "components": components}


def compute_funding_milestones(period) -> list[dict]:
    """Ordered checkpoints along the "Funding Marathon" progress bar."""
    pl = getattr(period, "pl_statement", None)
    bs = getattr(period, "balance_sheet", None)
    provenance = period.provenance

    milestones = [
        {
            "key": "ai_verified",
            "title": "Financials AI-Verified",
            "description": "A human reviewer has verified the AI-extracted figures.",
            "complete": bool(provenance["verified"]),
            "detail": "Verify pending extraction attempts in Settings > AI Governance.",
        },
        {
            "key": "audited",
            "title": "Audited Financials Prepared",
            "description": "The period's financials have been formally audited.",
            "complete": bool(period.is_audited),
            "detail": "Mark this period as audited once the audit is complete.",
        },
        {
            "key": "cash_runway_12mo",
            "title": "12+ Months Cash Runway",
            "description": "Cash on hand covers at least 12 months of operating burn.",
            "complete": bool(bs and bs.cash_runway_months is not None and bs.cash_runway_months >= 12),
            "detail": "Extend runway via cost reduction, revenue growth, or fundraising.",
        },
        {
            "key": "ebitda_positive",
            "title": "Investor-Ready Profitability",
            "description": "EBITDA margin has crossed into positive territory.",
            "complete": bool(pl and pl.ebitda_margin_pct is not None and pl.ebitda_margin_pct > 0),
            "detail": "Track path to EBITDA breakeven in the Profitability section.",
        },
    ]
    return milestones
