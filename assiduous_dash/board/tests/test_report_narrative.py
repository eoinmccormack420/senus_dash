"""
Tests for report_narrative.py's generate_narrative_for_spec: retry/
caching/persistence behavior. Gemini calls are mocked throughout — same
convention as test_advisory_goals.py/test_commentary.py (patch-where-
used: board.extraction.report_narrative._get_client).
"""

from datetime import date
from decimal import Decimal
from unittest.mock import MagicMock

import pytest

from board.extraction.report_narrative import generate_narrative_for_spec
from board.models import (
    BalanceSheet,
    BusinessMetrics,
    CashFlow,
    ExtractionAttempt,
    FinancialPeriod,
    PLStatement,
    ReportSpec,
)


def make_period(label="TEST", **kwargs):
    defaults = dict(period_type="half_year", start_date=date(2025, 1, 1), end_date=date(2025, 6, 30))
    defaults.update(kwargs)
    return FinancialPeriod.objects.create(label=label, **defaults)


def make_pl_statement(period, **kwargs):
    defaults = dict(
        revenue=Decimal("100000"), cost_of_sales=Decimal("20000"), admin_expenses=Decimal("30000"),
        gross_profit=Decimal("80000"), operating_loss=Decimal("-10000"),
        loss_before_tax=Decimal("-10000"), loss_after_tax=Decimal("-10000"),
    )
    defaults.update(kwargs)
    return PLStatement.objects.create(period=period, **defaults)


def make_balance_sheet(period, **kwargs):
    defaults = dict(
        tangible_assets=Decimal("50000"), debtors=Decimal("10000"), cash=Decimal("20000"),
        current_creditors=Decimal("-15000"), share_capital=Decimal("1000"), retained_earnings=Decimal("-5000"),
    )
    defaults.update(kwargs)
    return BalanceSheet.objects.create(period=period, **defaults)


def make_cash_flow(period, **kwargs):
    defaults = dict(
        net_operating_cash=Decimal("-5000"), net_financing_cash=Decimal("2000"),
        net_cash_movement=Decimal("-3000"), opening_cash=Decimal("23000"), closing_cash=Decimal("20000"),
    )
    defaults.update(kwargs)
    return CashFlow.objects.create(period=period, **defaults)


def make_business_metrics(period, **kwargs):
    defaults = dict(total_customers=10, enterprise_customers=3, market_cap=Decimal("5000000"))
    defaults.update(kwargs)
    return BusinessMetrics.objects.create(period=period, **defaults)


def make_full_period(label="TEST"):
    period = make_period(label=label)
    make_pl_statement(period)
    make_balance_sheet(period)
    make_cash_flow(period)
    make_business_metrics(period)
    return period


def make_spec(period, **kwargs):
    defaults = dict(audience_label="Series A Investors", context_note="Fundraising round")
    defaults.update(kwargs)
    return ReportSpec.objects.create(period=period, **defaults)


def mock_gemini_client(monkeypatch, text="Some narrative text."):
    mock_response = MagicMock()
    mock_response.text = text
    mock_client = MagicMock()
    mock_client.models.generate_content.return_value = mock_response
    monkeypatch.setattr("board.extraction.report_narrative._get_client", lambda: mock_client)
    monkeypatch.setattr("board.extraction.report_narrative.time.sleep", lambda _: None)
    return mock_client


@pytest.mark.django_db
class TestGenerateNarrativeForSpec:
    def test_handles_board_notes_and_verified_provenance_in_outlook_section(self, monkeypatch):
        """
        Regression test: _outlook_summary (reused from commentary.py)
        includes non-numeric fields — board_notes (free text) and
        data_provenance.verified (a bool) — alongside its numeric ones.
        A period with notes set used to make generate_narrative_for_spec
        raise ValueError (float("some note")) outside its own
        try/except, 500ing the view instead of returning a graceful
        error. Covers both the string and bool cases together.
        """
        mock_gemini_client(monkeypatch)
        period = make_full_period()
        period.notes = "Board flagged the Q2 customer concentration as a watch item."
        period.save()
        ExtractionAttempt.objects.create(
            period=period, statement_kind="pl_statement", source_document="test.pdf",
            status="cross_check_pass", match_rate_pct=Decimal("100.0"), verified=True,
        )
        spec = make_spec(period, include_outlook=True)

        result = generate_narrative_for_spec(spec)

        assert result["status"] == "generated"

    def test_generates_cover_plus_one_call_per_included_section(self, monkeypatch):
        mock_client = mock_gemini_client(monkeypatch)
        period = make_full_period()
        spec = make_spec(period)

        result = generate_narrative_for_spec(spec)

        assert result["status"] == "generated"
        spec.refresh_from_db()
        assert "cover" in spec.tailored_narrative
        for section_key in ["revenue_growth", "profitability", "cash_liquidity", "solvency_leverage", "returns", "outlook"]:
            assert section_key in spec.tailored_narrative
        # cover + 6 sections = 7 calls
        assert mock_client.models.generate_content.call_count == 7

    def test_excluded_sections_are_not_generated(self, monkeypatch):
        mock_gemini_client(monkeypatch)
        period = make_full_period()
        spec = make_spec(period, include_returns=False, include_outlook=False)

        generate_narrative_for_spec(spec)

        spec.refresh_from_db()
        assert "returns" not in spec.tailored_narrative
        assert "outlook" not in spec.tailored_narrative
        assert "revenue_growth" in spec.tailored_narrative

    def test_skips_when_unchanged(self, monkeypatch):
        mock_client = mock_gemini_client(monkeypatch)
        period = make_full_period()
        spec = make_spec(period)

        first = generate_narrative_for_spec(spec)
        spec.refresh_from_db()
        second = generate_narrative_for_spec(spec)

        assert first["status"] == "generated"
        assert second["status"] == "skipped"
        assert mock_client.models.generate_content.call_count == 7  # not doubled

    def test_force_regenerates(self, monkeypatch):
        mock_client = mock_gemini_client(monkeypatch)
        period = make_full_period()
        spec = make_spec(period)

        generate_narrative_for_spec(spec)
        spec.refresh_from_db()
        generate_narrative_for_spec(spec, force=True)

        assert mock_client.models.generate_content.call_count == 14

    def test_regenerating_resets_approval(self, monkeypatch):
        mock_gemini_client(monkeypatch)
        period = make_full_period()
        spec = make_spec(period)
        generate_narrative_for_spec(spec)
        spec.refresh_from_db()
        spec.narrative_approved = True
        spec.save()

        generate_narrative_for_spec(spec, force=True)

        spec.refresh_from_db()
        assert spec.narrative_approved is False

    def test_error_is_recorded_not_raised(self, monkeypatch):
        mock_client = MagicMock()
        mock_client.models.generate_content.side_effect = OSError("model is overloaded")
        monkeypatch.setattr("board.extraction.report_narrative._get_client", lambda: mock_client)
        monkeypatch.setattr("board.extraction.report_narrative.time.sleep", lambda _: None)
        period = make_full_period()
        spec = make_spec(period)

        result = generate_narrative_for_spec(spec, max_retries=1)

        assert result["status"] == "error"
        assert "model is overloaded" in result["detail"]
        spec.refresh_from_db()
        assert spec.tailored_narrative is None

    def test_succeeds_after_transient_failure(self, monkeypatch):
        mock_response = MagicMock()
        mock_response.text = "Recovered."
        mock_client = MagicMock()
        mock_client.models.generate_content.side_effect = [
            OSError("503 UNAVAILABLE"),
            mock_response, mock_response, mock_response, mock_response, mock_response, mock_response, mock_response,
        ]
        monkeypatch.setattr("board.extraction.report_narrative._get_client", lambda: mock_client)
        monkeypatch.setattr("board.extraction.report_narrative.time.sleep", lambda _: None)
        period = make_full_period()
        spec = make_spec(period)

        result = generate_narrative_for_spec(spec)

        assert result["status"] == "generated"
        assert mock_client.models.generate_content.call_count == 8  # 1 retry + 7 successes
