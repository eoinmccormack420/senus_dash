"""
Tests for the extraction pipeline's business logic — sign normalization,
ground-truth cross-checking, and promotion to live statement data.
Deliberately NOT testing Gemini calls (extract_statement/
extract_statement_from_pdf) or PDF parsing — those are I/O boundaries,
not business logic, and would need mocking a third-party API rather
than exercising real behavior.
"""

from datetime import date
from decimal import Decimal

import pytest

from board.extraction.pipeline import _normalize_signs, _cross_check, promote_attempt
from board.models import FinancialPeriod, PLStatement, BalanceSheet, ExtractionAttempt


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
        cash=Decimal("20000"),
        current_creditors=Decimal("-15000"),
        share_capital=Decimal("1000"),
        retained_earnings=Decimal("-5000"),
    )
    defaults.update(kwargs)
    return BalanceSheet.objects.create(period=period, **defaults)


# --- _normalize_signs -------------------------------------------------


class TestNormalizeSigns:
    def test_pl_negative_fields_forced_negative_from_positive_input(self):
        result = _normalize_signs(
            "pl_statement",
            {"operating_loss": 483753.0, "loss_before_tax": 485144.0, "loss_after_tax": 485144.0},
        )
        assert result["operating_loss"] == -483753.0
        assert result["loss_before_tax"] == -485144.0
        assert result["loss_after_tax"] == -485144.0

    def test_pl_positive_fields_forced_positive_from_negative_input(self):
        result = _normalize_signs(
            "pl_statement",
            {"cost_of_sales": -64861.0, "admin_expenses": -781975.0, "interest_expense": -1391.0},
        )
        assert result["cost_of_sales"] == 64861.0
        assert result["admin_expenses"] == 781975.0
        assert result["interest_expense"] == 1391.0

    def test_balance_sheet_liability_fields_forced_negative(self):
        result = _normalize_signs(
            "balance_sheet",
            {"current_creditors": 15000.0, "contingent_consideration": 2000.0, "long_term_debt": 500.0},
        )
        assert result["current_creditors"] == -15000.0
        assert result["contingent_consideration"] == -2000.0
        assert result["long_term_debt"] == -500.0

    def test_decimal_inputs_converted_to_float(self):
        result = _normalize_signs("pl_statement", {"revenue": Decimal("100000.50")})
        assert result["revenue"] == 100000.50
        assert isinstance(result["revenue"], float)

    def test_fields_not_in_force_lists_pass_through_unchanged(self):
        result = _normalize_signs("pl_statement", {"revenue": 100000.0, "gross_profit": 80000.0})
        assert result["revenue"] == 100000.0
        assert result["gross_profit"] == 80000.0

    def test_none_values_do_not_crash(self):
        result = _normalize_signs(
            "pl_statement",
            {"operating_loss": None, "cost_of_sales": None, "revenue": None},
        )
        assert result == {"operating_loss": None, "cost_of_sales": None, "revenue": None}

    def test_statement_kind_with_no_force_lists_is_a_noop(self):
        # cash_flow/business_metrics have no entries in FORCE_POSITIVE_FIELDS
        # / FORCE_NEGATIVE_FIELDS — normalize_signs should still run cleanly.
        result = _normalize_signs("cash_flow", {"opening_cash": 1000.0})
        assert result == {"opening_cash": 1000.0}


# --- _cross_check -------------------------------------------------------


@pytest.mark.django_db
class TestCrossCheck:
    def test_exact_match(self):
        period = make_period()
        make_pl_statement(period, revenue=Decimal("100000"))
        result = _cross_check("pl_statement", period, {"revenue": 100000.0})
        assert result["_skipped"] is False
        assert result["fields"]["revenue"]["match"] is True
        assert result["fields"]["revenue"]["diff_pct"] == 0.0
        assert result["match_rate_pct"] == 100.0

    def test_within_tolerance_matches(self):
        period = make_period()
        make_pl_statement(period, revenue=Decimal("100000"))
        # 0.5% off — within the 1% MATCH_TOLERANCE_PCT
        result = _cross_check("pl_statement", period, {"revenue": 100500.0})
        assert result["fields"]["revenue"]["match"] is True

    def test_outside_tolerance_does_not_match(self):
        period = make_period()
        make_pl_statement(period, revenue=Decimal("100000"))
        # 5% off — outside tolerance
        result = _cross_check("pl_statement", period, {"revenue": 105000.0})
        assert result["fields"]["revenue"]["match"] is False
        assert result["match_rate_pct"] == 0.0

    def test_actual_zero_and_extracted_zero_matches(self):
        period = make_period()
        make_pl_statement(period, distribution_costs=Decimal("0"))
        result = _cross_check("pl_statement", period, {"distribution_costs": 0.0})
        assert result["fields"]["distribution_costs"]["match"] is True

    def test_actual_zero_and_extracted_nonzero_does_not_match(self):
        period = make_period()
        make_pl_statement(period, distribution_costs=Decimal("0"))
        result = _cross_check("pl_statement", period, {"distribution_costs": 500.0})
        assert result["fields"]["distribution_costs"]["match"] is False
        assert result["fields"]["distribution_costs"]["diff_pct"] == 100.0

    def test_missing_ground_truth_row_is_skipped_not_a_false_pass(self):
        period = make_period()  # no PLStatement created for this period
        result = _cross_check("pl_statement", period, {"revenue": 100000.0})
        assert result["_skipped"] is True
        assert "fields" not in result
        assert "match_rate_pct" not in result

    def test_extraneous_field_is_ignored(self):
        period = make_period()
        make_pl_statement(period, revenue=Decimal("100000"))
        result = _cross_check(
            "pl_statement", period, {"revenue": 100000.0, "not_a_real_field": 999.0}
        )
        assert "not_a_real_field" not in result["fields"]
        assert result["match_rate_pct"] == 100.0  # only the real field counts


# --- promote_attempt ------------------------------------------------------


def make_attempt(period, statement_kind="pl_statement", status="cross_check_pass", verified=True, normalized=None):
    return ExtractionAttempt.objects.create(
        period=period,
        statement_kind=statement_kind,
        source_document="test.pdf",
        status=status,
        verified=verified,
        raw_response={"_normalized": normalized or {}},
    )


@pytest.mark.django_db
class TestPromoteAttempt:
    def test_raises_when_not_verified(self):
        period = make_period()
        attempt = make_attempt(period, verified=False, status="cross_check_pass")
        with pytest.raises(ValueError, match="unverified"):
            promote_attempt(attempt)

    def test_raises_when_status_not_promotable(self):
        period = make_period()
        attempt = make_attempt(period, verified=True, status="cross_check_fail")
        with pytest.raises(ValueError, match="Refusing to promote"):
            promote_attempt(attempt)

    def test_creates_statement_row_when_none_exists(self):
        period = make_period()
        assert not PLStatement.objects.filter(period=period).exists()

        normalized = {
            "revenue": 100000.0,
            "cost_of_sales": 20000.0,
            "admin_expenses": 30000.0,
            "gross_profit": 80000.0,
            "operating_loss": -10000.0,
            "loss_before_tax": -10000.0,
            "loss_after_tax": -10000.0,
        }
        attempt = make_attempt(period, verified=True, status="cross_check_pass", normalized=normalized)

        promote_attempt(attempt)

        pl = PLStatement.objects.get(period=period)
        assert pl.revenue == Decimal("100000.0")
        assert pl.operating_loss == Decimal("-10000.0")

    def test_updates_existing_statement_row(self):
        period = make_period()
        existing = make_pl_statement(period, revenue=Decimal("100000"))
        original_pk = existing.pk

        normalized = {
            "revenue": 150000.0,
            "cost_of_sales": 20000.0,
            "admin_expenses": 30000.0,
            "gross_profit": 130000.0,
            "operating_loss": -5000.0,
            "loss_before_tax": -5000.0,
            "loss_after_tax": -5000.0,
        }
        attempt = make_attempt(period, verified=True, status="schema_valid", normalized=normalized)

        promote_attempt(attempt)

        assert PLStatement.objects.filter(period=period).count() == 1  # updated, not duplicated
        pl = PLStatement.objects.get(period=period)
        assert pl.pk == original_pk
        assert pl.revenue == Decimal("150000.0")
