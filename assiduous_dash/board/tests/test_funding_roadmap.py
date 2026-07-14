"""
Tests for the Funding Readiness Roadmap: roadmap.py's
generate_funding_roadmap retry/validation behavior and
generate_roadmap_for_period's caching, plus GenerateFundingRoadmapView's
permission gating and PeriodDetailSerializer's funding_roadmap field.
Gemini calls are mocked throughout — same convention as
test_advisory_goals.py (patch-where-used: board.extraction.roadmap._get_client).
"""

from datetime import date
from decimal import Decimal
from unittest.mock import MagicMock

import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient

from board.extraction.roadmap import generate_funding_roadmap, generate_roadmap_for_period
from board.models import BalanceSheet, CashFlow, FinancialPeriod, FundingRoadmapStep, PLStatement


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


def make_full_period(label="TEST"):
    period = make_period(label=label)
    make_pl_statement(period)
    make_balance_sheet(period)
    make_cash_flow(period)
    return period


FOUR_STEPS_JSON = (
    '[{"timeframe": "Months 1-3", "title": "Close the runway gap", "description": "Extend cash runway."},'
    '{"timeframe": "Months 4-6", "title": "Verify financials", "description": "Get figures AI-verified."},'
    '{"timeframe": "Months 7-9", "title": "Complete an audit", "description": "Engage an auditor."},'
    '{"timeframe": "Months 10-12", "title": "Engage investors", "description": "Begin investor outreach."}]'
)


@pytest.mark.django_db
class TestGenerateFundingRoadmapRetry:
    def test_succeeds_after_transient_failure(self, monkeypatch):
        monkeypatch.setattr("board.extraction.roadmap.time.sleep", lambda _: None)
        mock_response = MagicMock()
        mock_response.text = FOUR_STEPS_JSON
        mock_client = MagicMock()
        mock_client.models.generate_content.side_effect = [
            OSError("503 UNAVAILABLE: The model is overloaded."),
            mock_response,
        ]
        monkeypatch.setattr("board.extraction.roadmap._get_client", lambda: mock_client)
        period = make_full_period()

        steps = generate_funding_roadmap(period)

        assert len(steps) == 4
        assert steps[0]["title"] == "Close the runway gap"
        assert mock_client.models.generate_content.call_count == 2

    def test_raises_wrapped_error_after_exhausting_retries(self, monkeypatch):
        monkeypatch.setattr("board.extraction.roadmap.time.sleep", lambda _: None)
        mock_client = MagicMock()
        mock_client.models.generate_content.side_effect = OSError("model is overloaded")
        monkeypatch.setattr("board.extraction.roadmap._get_client", lambda: mock_client)
        period = make_full_period()

        with pytest.raises(RuntimeError, match="Gemini funding roadmap generation failed"):
            generate_funding_roadmap(period, max_retries=1)

        assert mock_client.models.generate_content.call_count == 2

    def test_retries_on_malformed_response(self, monkeypatch):
        monkeypatch.setattr("board.extraction.roadmap.time.sleep", lambda _: None)
        bad_response = MagicMock()
        bad_response.text = '[{"title": "Only one step"}]'  # not 4, missing keys
        good_response = MagicMock()
        good_response.text = FOUR_STEPS_JSON
        mock_client = MagicMock()
        mock_client.models.generate_content.side_effect = [bad_response, good_response]
        monkeypatch.setattr("board.extraction.roadmap._get_client", lambda: mock_client)
        period = make_full_period()

        steps = generate_funding_roadmap(period)

        assert len(steps) == 4
        assert mock_client.models.generate_content.call_count == 2


@pytest.mark.django_db
class TestGenerateRoadmapForPeriod:
    def test_generates_and_persists_four_steps(self, monkeypatch):
        monkeypatch.setattr(
            "board.extraction.roadmap.generate_funding_roadmap",
            lambda period, **kwargs: [
                {"timeframe": f"Phase {i}", "title": f"Step {i}", "description": "desc"} for i in range(1, 5)
            ],
        )
        period = make_full_period()

        result = generate_roadmap_for_period(period)

        assert result["status"] == "generated"
        steps = list(FundingRoadmapStep.objects.filter(period=period).order_by("order"))
        assert [s.title for s in steps] == ["Step 1", "Step 2", "Step 3", "Step 4"]
        assert all(s.source_data_hash for s in steps)

    def test_skips_when_figures_unchanged(self, monkeypatch):
        call_count = {"n": 0}

        def fake_generate(period, **kwargs):
            call_count["n"] += 1
            return [{"timeframe": f"Phase {i}", "title": f"Step {i}", "description": "d"} for i in range(1, 5)]

        monkeypatch.setattr("board.extraction.roadmap.generate_funding_roadmap", fake_generate)
        period = make_full_period()

        first = generate_roadmap_for_period(period)
        second = generate_roadmap_for_period(period)

        assert first["status"] == "generated"
        assert second["status"] == "skipped"
        assert call_count["n"] == 1

    def test_force_regenerates_even_when_unchanged(self, monkeypatch):
        call_count = {"n": 0}

        def fake_generate(period, **kwargs):
            call_count["n"] += 1
            return [
                {"timeframe": f"Phase {i}", "title": f"Step {i} v{call_count['n']}", "description": "d"}
                for i in range(1, 5)
            ]

        monkeypatch.setattr("board.extraction.roadmap.generate_funding_roadmap", fake_generate)
        period = make_full_period()

        generate_roadmap_for_period(period)
        result = generate_roadmap_for_period(period, force=True)

        assert result["status"] == "generated"
        assert call_count["n"] == 2
        # wholesale replace, not accumulation
        assert FundingRoadmapStep.objects.filter(period=period).count() == 4

    def test_error_from_gemini_is_recorded_not_raised(self, monkeypatch):
        def fake_generate(period, **kwargs):
            raise RuntimeError("Gemini funding roadmap generation failed for TEST after 3 attempt(s): boom")

        monkeypatch.setattr("board.extraction.roadmap.generate_funding_roadmap", fake_generate)
        period = make_full_period()

        result = generate_roadmap_for_period(period)

        assert result["status"] == "error"
        assert "boom" in result["detail"]
        assert FundingRoadmapStep.objects.filter(period=period).count() == 0


@pytest.mark.django_db
class TestGenerateFundingRoadmapView:
    def test_requires_admin(self):
        make_full_period()
        user = User.objects.create_user(username="regular", password="pw")
        client = APIClient()
        client.force_authenticate(user=user)

        response = client.post("/api/admin/generate-roadmap/")

        assert response.status_code == 403

    def test_returns_404_when_no_periods(self):
        admin = User.objects.create_user(username="admin", password="pw", is_staff=True)
        client = APIClient()
        client.force_authenticate(user=admin)

        response = client.post("/api/admin/generate-roadmap/")

        assert response.status_code == 404

    def test_admin_triggers_generation(self, monkeypatch):
        period = make_full_period(label="HY2026")
        monkeypatch.setattr(
            "board.views.generate_roadmap_for_period",
            lambda period, force=False: {"status": "generated", "detail": "4 roadmap steps generated"},
        )
        admin = User.objects.create_user(username="admin", password="pw", is_staff=True)
        client = APIClient()
        client.force_authenticate(user=admin)

        response = client.post("/api/admin/generate-roadmap/")

        assert response.status_code == 200
        assert response.data["period"] == "HY2026"
        assert response.data["result"]["status"] == "generated"


@pytest.mark.django_db
class TestPeriodDetailFundingRoadmap:
    def test_funding_roadmap_included_in_response(self):
        period = make_full_period()
        FundingRoadmapStep.objects.create(
            period=period, order=1, timeframe="Months 1-3", title="Close the runway gap", description="d"
        )
        admin = User.objects.create_user(username="admin", password="pw", is_staff=True)
        client = APIClient()
        client.force_authenticate(user=admin)

        response = client.get(f"/api/periods/{period.id}/")

        assert response.status_code == 200
        steps = response.data["funding_roadmap"]
        assert len(steps) == 1
        assert steps[0]["title"] == "Close the runway gap"
        assert steps[0]["timeframe"] == "Months 1-3"
