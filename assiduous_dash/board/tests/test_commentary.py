"""
Tests for commentary.py's _outlook_summary (the data fed into the
board Executive Summary / Key risks prompt), build_commentary_prompt's
outlook-only bullet exception, and generate_commentary's retry/backoff
control flow. The actual Gemini call is mocked throughout — this tests
retry behavior (same convention as test_notifications.py mocking
urlopen), not Gemini's real output, which is an I/O boundary.
"""

from datetime import date
from decimal import Decimal
from unittest.mock import MagicMock

import pytest

from board.extraction.commentary import _outlook_summary, build_commentary_prompt, generate_commentary
from board.models import BalanceSheet, CashFlow, ExtractionAttempt, FinancialPeriod, PLStatement


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


def make_cash_flow(period, **kwargs):
    defaults = dict(
        net_operating_cash=Decimal("-5000"),
        net_financing_cash=Decimal("2000"),
        net_cash_movement=Decimal("-3000"),
        opening_cash=Decimal("23000"),
        closing_cash=Decimal("20000"),
    )
    defaults.update(kwargs)
    return CashFlow.objects.create(period=period, **defaults)


@pytest.mark.django_db
class TestOutlookSummary:
    def test_includes_returns_data_alongside_pl_cash_solvency(self):
        period = make_period()
        make_pl_statement(period)
        make_balance_sheet(period)

        summary = _outlook_summary(period)

        assert any(k.startswith("revenue_growth.") for k in summary)
        assert any(k.startswith("solvency_leverage.") for k in summary)
        # no BusinessMetrics row -> no returns.* keys, which is correct
        assert not any(k.startswith("returns.") for k in summary)

    def test_includes_cross_statement_ratios_when_available(self):
        period = make_period()
        make_pl_statement(period, operating_loss=Decimal("-50000"))
        make_balance_sheet(period, current_creditors=Decimal("-15000"))

        summary = _outlook_summary(period)

        assert "roce_pct" in summary
        assert summary["roce_pct"] == period.roce_pct

    def test_includes_board_notes_when_present(self):
        period = make_period(notes="CEO flagged a large customer churn risk for H2.")
        make_pl_statement(period)

        summary = _outlook_summary(period)

        assert summary["board_notes"] == "CEO flagged a large customer churn risk for H2."

    def test_omits_board_notes_when_blank(self):
        period = make_period(notes="")
        make_pl_statement(period)

        summary = _outlook_summary(period)

        assert "board_notes" not in summary

    def test_includes_data_provenance_when_ai_extracted(self):
        period = make_period()
        make_pl_statement(period)
        ExtractionAttempt.objects.create(
            period=period,
            statement_kind="pl_statement",
            source_document="test.pdf",
            status="cross_check_pass",
            match_rate_pct=Decimal("97.5"),
        )

        summary = _outlook_summary(period)

        assert summary["data_provenance.match_rate_pct"] == 97.5
        assert summary["data_provenance.verified"] is False

    def test_omits_data_provenance_when_manual(self):
        period = make_period()
        make_pl_statement(period)

        summary = _outlook_summary(period)

        assert "data_provenance.match_rate_pct" not in summary


class TestBuildCommentaryPromptBulletException:
    def test_outlook_gets_bullet_exception(self):
        prompt = build_commentary_prompt("outlook", "HY2026", {"revenue": 100000})

        assert "Exception to the no-bullets rule" in prompt

    def test_other_sections_do_not_get_bullet_exception(self):
        prompt = build_commentary_prompt("revenue_growth", "HY2026", {"revenue": 100000})

        assert "Exception to the no-bullets rule" not in prompt


class TestGenerateCommentaryRetry:
    def test_succeeds_after_transient_failure(self, monkeypatch):
        monkeypatch.setattr("board.extraction.commentary.time.sleep", lambda _: None)
        mock_response = MagicMock()
        mock_response.text = "  Some commentary.  "
        mock_client = MagicMock()
        mock_client.models.generate_content.side_effect = [
            OSError("503 UNAVAILABLE: The model is overloaded. Please try again later."),
            mock_response,
        ]
        monkeypatch.setattr("board.extraction.commentary._get_client", lambda: mock_client)

        result = generate_commentary("outlook", "HY2026", {"revenue": 100000})

        assert result == "Some commentary."
        assert mock_client.models.generate_content.call_count == 2

    def test_raises_wrapped_error_after_exhausting_retries(self, monkeypatch):
        monkeypatch.setattr("board.extraction.commentary.time.sleep", lambda _: None)
        mock_client = MagicMock()
        mock_client.models.generate_content.side_effect = OSError("model is overloaded")
        monkeypatch.setattr("board.extraction.commentary._get_client", lambda: mock_client)

        with pytest.raises(RuntimeError, match="Gemini commentary generation failed"):
            generate_commentary("outlook", "HY2026", {"revenue": 100000}, max_retries=1)

        assert mock_client.models.generate_content.call_count == 2

    def test_does_not_retry_on_success(self, monkeypatch):
        sleep_mock = MagicMock()
        monkeypatch.setattr("board.extraction.commentary.time.sleep", sleep_mock)
        mock_response = MagicMock()
        mock_response.text = "Some commentary."
        mock_client = MagicMock()
        mock_client.models.generate_content.return_value = mock_response
        monkeypatch.setattr("board.extraction.commentary._get_client", lambda: mock_client)

        generate_commentary("outlook", "HY2026", {"revenue": 100000})

        sleep_mock.assert_not_called()
