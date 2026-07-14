"""
Tests for the Funding Marathon Readiness feature: readiness.py's pure
scoring/milestone functions, and PeriodDetailSerializer's funding_readiness
field (mirrors test_board_alerts.py's fixtures and structure).
"""

from datetime import date
from decimal import Decimal

import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient

from board.models import BalanceSheet, CashFlow, ExtractionAttempt, FinancialPeriod, PLStatement
from board.readiness import compute_funding_milestones, compute_readiness_score


def make_period(label="TEST", **kwargs):
    defaults = dict(period_type="half_year", start_date=date(2025, 1, 1), end_date=date(2025, 6, 30))
    defaults.update(kwargs)
    return FinancialPeriod.objects.create(label=label, **defaults)


def make_pl_statement(period, **kwargs):
    defaults = dict(
        revenue=Decimal("100000"),
        cost_of_sales=Decimal("20000"),
        admin_expenses=Decimal("30000"),
        gross_profit=Decimal("80000"),
        operating_loss=Decimal("-10000"),
        loss_before_tax=Decimal("-10000"),
        loss_after_tax=Decimal("-10000"),
    )
    defaults.update(kwargs)
    return PLStatement.objects.create(period=period, **defaults)


def make_balance_sheet(period, **kwargs):
    defaults = dict(
        tangible_assets=Decimal("50000"),
        debtors=Decimal("10000"),
        cash=Decimal("1000"),
        current_creditors=Decimal("-500"),
        share_capital=Decimal("1000"),
        retained_earnings=Decimal("-5000"),
    )
    defaults.update(kwargs)
    return BalanceSheet.objects.create(period=period, **defaults)


def make_cash_flow(period, **kwargs):
    defaults = dict(
        net_operating_cash=Decimal("-1000"),
        depreciation=Decimal("2000"),
        net_financing_cash=Decimal("2000"),
        net_cash_movement=Decimal("-3000"),
        opening_cash=Decimal("4000"),
        closing_cash=Decimal("1000"),
    )
    defaults.update(kwargs)
    return CashFlow.objects.create(period=period, **defaults)


def make_extraction_attempt(period, verified=False, statement_kind="pl_statement", **kwargs):
    defaults = dict(
        source_document="test.pdf",
        status="cross_check_pass",
        match_rate_pct=Decimal("100.0"),
        verified=verified,
    )
    defaults.update(kwargs)
    return ExtractionAttempt.objects.create(period=period, statement_kind=statement_kind, **defaults)


@pytest.mark.django_db
class TestComputeReadinessScore:
    def test_full_data_scores_every_component(self):
        period = make_period(is_audited=True)
        make_pl_statement(period)
        make_balance_sheet(period)
        make_cash_flow(period)
        make_extraction_attempt(period, verified=True)

        result = compute_readiness_score(period)

        by_key = {c["key"]: c for c in result["components"]}
        assert result["score"] is not None
        assert len(result["components"]) == 5
        assert by_key["governance_verified"]["score"] == 100.0
        assert by_key["audited_financials"]["score"] == 100.0
        assert all(c["score"] is not None for c in result["components"])

    def test_missing_balance_sheet_and_cash_flow_renormalizes_weights(self):
        period = make_period()
        make_pl_statement(period)
        # No balance_sheet, no cash_flow -> cash_runway, liquidity, and
        # (since ebitda needs cash_flow.depreciation) ebitda_trajectory
        # all lack data.

        result = compute_readiness_score(period)

        by_key = {c["key"]: c for c in result["components"]}
        assert by_key["cash_runway"]["score"] is None
        assert by_key["liquidity"]["score"] is None
        assert by_key["ebitda_trajectory"]["score"] is None
        # governance_verified and audited_financials never depend on
        # pl/bs, so the score is still computed from those two alone.
        assert result["score"] is not None
        assert result["score"] == by_key["governance_verified"]["score"] * 0.5 + \
            by_key["audited_financials"]["score"] * 0.5

    def test_ebitda_margin_scaling_clamps_at_bounds(self):
        period = make_period()
        # ebitda = operating_loss + depreciation; deeply negative margin
        # should clamp to a score of 0, not go negative.
        make_pl_statement(period, revenue=Decimal("100000"), operating_loss=Decimal("-90000"))
        make_cash_flow(period, depreciation=Decimal("1000"))

        result = compute_readiness_score(period)
        by_key = {c["key"]: c for c in result["components"]}
        assert by_key["ebitda_trajectory"]["score"] == 0.0

    def test_governance_score_reflects_verification_state(self):
        # No extraction attempts at all -> manual entry -> baseline 60.
        manual_period = make_period(label="MANUAL")
        manual_result = compute_readiness_score(manual_period)
        assert {c["key"]: c["score"] for c in manual_result["components"]}["governance_verified"] == 60.0

        # AI-extracted but not yet verified by a human -> 40.
        unverified_period = make_period(label="UNVERIFIED")
        make_extraction_attempt(unverified_period, verified=False)
        unverified_result = compute_readiness_score(unverified_period)
        assert {c["key"]: c["score"] for c in unverified_result["components"]}["governance_verified"] == 40.0

        # AI-extracted and human-verified -> 100.
        verified_period = make_period(label="VERIFIED")
        make_extraction_attempt(verified_period, verified=True)
        verified_result = compute_readiness_score(verified_period)
        assert {c["key"]: c["score"] for c in verified_result["components"]}["governance_verified"] == 100.0


@pytest.mark.django_db
class TestComputeFundingMilestones:
    def test_all_incomplete_for_a_fresh_period(self):
        period = make_period()

        milestones = compute_funding_milestones(period)

        assert {m["key"]: m["complete"] for m in milestones} == {
            "ai_verified": False,
            "audited": False,
            "cash_runway_12mo": False,
            "ebitda_positive": False,
        }

    def test_ai_verified_milestone_flips_on_verification(self):
        period = make_period()
        make_extraction_attempt(period, verified=True)

        milestones = {m["key"]: m["complete"] for m in compute_funding_milestones(period)}

        assert milestones["ai_verified"] is True

    def test_audited_milestone_reflects_period_flag(self):
        period = make_period(is_audited=True)

        milestones = {m["key"]: m["complete"] for m in compute_funding_milestones(period)}

        assert milestones["audited"] is True

    def test_cash_runway_milestone_at_12_months(self):
        below = make_period(label="BELOW")
        make_balance_sheet(below, cash=Decimal("1000"))
        make_cash_flow(below, net_operating_cash=Decimal("-1000"))  # ~6mo runway

        above = make_period(label="ABOVE")
        make_balance_sheet(above, cash=Decimal("100000"))
        make_cash_flow(above, net_operating_cash=Decimal("-1000"))  # ~600mo runway

        below_milestones = {m["key"]: m["complete"] for m in compute_funding_milestones(below)}
        above_milestones = {m["key"]: m["complete"] for m in compute_funding_milestones(above)}

        assert below_milestones["cash_runway_12mo"] is False
        assert above_milestones["cash_runway_12mo"] is True

    def test_ebitda_positive_milestone(self):
        losing = make_period(label="LOSING")
        make_pl_statement(losing, operating_loss=Decimal("-10000"))
        make_cash_flow(losing, depreciation=Decimal("1000"))

        profitable = make_period(label="PROFITABLE")
        make_pl_statement(profitable, operating_loss=Decimal("5000"))
        make_cash_flow(profitable, depreciation=Decimal("1000"))

        losing_milestones = {m["key"]: m["complete"] for m in compute_funding_milestones(losing)}
        profitable_milestones = {m["key"]: m["complete"] for m in compute_funding_milestones(profitable)}

        assert losing_milestones["ebitda_positive"] is False
        assert profitable_milestones["ebitda_positive"] is True


@pytest.mark.django_db
class TestPeriodDetailFundingReadiness:
    def test_funding_readiness_included_in_response(self):
        period = make_period(is_audited=True)
        make_pl_statement(period)
        make_balance_sheet(period)
        make_cash_flow(period)
        make_extraction_attempt(period, verified=True)
        admin = User.objects.create_user(username="admin", password="pw", is_staff=True)
        client = APIClient()
        client.force_authenticate(user=admin)

        response = client.get(f"/api/periods/{period.id}/")

        assert response.status_code == 200
        readiness = response.data["funding_readiness"]
        assert readiness["score"] is not None
        assert len(readiness["components"]) == 5
        milestones = {m["key"]: m["complete"] for m in readiness["milestones"]}
        assert milestones["audited"] is True
        assert milestones["ai_verified"] is True
