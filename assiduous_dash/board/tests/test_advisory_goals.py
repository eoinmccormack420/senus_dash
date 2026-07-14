"""
Tests for the Strategic Advisory Agent: advisory.py's generate_strategic_goals
retry/validation behavior and generate_goals_for_period's caching, plus
AdvisoryGoalViewSet's commit/dismiss/complete actions and
PeriodDetailSerializer's advisory_goals field. Gemini calls are mocked
throughout — same convention as test_commentary.py (patch-where-used:
board.extraction.advisory._get_client, not gemini_client._get_client).
"""

from datetime import date
from decimal import Decimal
from unittest.mock import MagicMock

import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient

from board.extraction.advisory import generate_goals_for_period, generate_strategic_goals
from board.models import AdvisoryGoal, BalanceSheet, CashFlow, FinancialPeriod, PLStatement


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


THREE_GOALS_JSON = (
    '[{"title": "Reach 12mo runway", "description": "Extend cash runway to 12 months '
    'by Q4 through cost discipline.", "rationale": "Investors expect at least a year of runway."},'
    '{"title": "Achieve EBITDA breakeven", "description": "Close the EBITDA gap within '
    '12 months via revenue growth.", "rationale": "Profitability de-risks the equity story."},'
    '{"title": "Complete an audit", "description": "Engage an auditor for full-year financials.", '
    '"rationale": "Audited accounts are a baseline Euronext requirement."}]'
)


@pytest.mark.django_db
class TestGenerateStrategicGoalsRetry:
    def test_succeeds_after_transient_failure(self, monkeypatch):
        monkeypatch.setattr("board.extraction.advisory.time.sleep", lambda _: None)
        mock_response = MagicMock()
        mock_response.text = THREE_GOALS_JSON
        mock_client = MagicMock()
        mock_client.models.generate_content.side_effect = [
            OSError("503 UNAVAILABLE: The model is overloaded."),
            mock_response,
        ]
        monkeypatch.setattr("board.extraction.advisory._get_client", lambda: mock_client)
        period = make_full_period()

        goals = generate_strategic_goals(period)

        assert len(goals) == 3
        assert goals[0]["title"] == "Reach 12mo runway"
        assert mock_client.models.generate_content.call_count == 2

    def test_raises_wrapped_error_after_exhausting_retries(self, monkeypatch):
        monkeypatch.setattr("board.extraction.advisory.time.sleep", lambda _: None)
        mock_client = MagicMock()
        mock_client.models.generate_content.side_effect = OSError("model is overloaded")
        monkeypatch.setattr("board.extraction.advisory._get_client", lambda: mock_client)
        period = make_full_period()

        with pytest.raises(RuntimeError, match="Gemini strategic goal generation failed"):
            generate_strategic_goals(period, max_retries=1)

        assert mock_client.models.generate_content.call_count == 2

    def test_retries_on_malformed_response(self, monkeypatch):
        monkeypatch.setattr("board.extraction.advisory.time.sleep", lambda _: None)
        bad_response = MagicMock()
        bad_response.text = '[{"title": "Only one goal"}]'  # not 3, missing keys
        good_response = MagicMock()
        good_response.text = THREE_GOALS_JSON
        mock_client = MagicMock()
        mock_client.models.generate_content.side_effect = [bad_response, good_response]
        monkeypatch.setattr("board.extraction.advisory._get_client", lambda: mock_client)
        period = make_full_period()

        goals = generate_strategic_goals(period)

        assert len(goals) == 3
        assert mock_client.models.generate_content.call_count == 2


@pytest.mark.django_db
class TestGenerateGoalsForPeriod:
    def test_generates_and_persists_three_goals(self, monkeypatch):
        monkeypatch.setattr(
            "board.extraction.advisory.generate_strategic_goals",
            lambda period, **kwargs: [
                {"title": f"Goal {i}", "description": "desc", "rationale": "why"} for i in range(1, 4)
            ],
        )
        period = make_full_period()

        result = generate_goals_for_period(period)

        assert result["status"] == "generated"
        goals = list(AdvisoryGoal.objects.filter(period=period).order_by("order"))
        assert [g.title for g in goals] == ["Goal 1", "Goal 2", "Goal 3"]
        assert all(g.status == "suggested" for g in goals)
        assert all(g.source_data_hash for g in goals)

    def test_skips_when_figures_unchanged(self, monkeypatch):
        call_count = {"n": 0}

        def fake_generate(period, **kwargs):
            call_count["n"] += 1
            return [{"title": f"Goal {i}", "description": "d", "rationale": "r"} for i in range(1, 4)]

        monkeypatch.setattr("board.extraction.advisory.generate_strategic_goals", fake_generate)
        period = make_full_period()

        first = generate_goals_for_period(period)
        second = generate_goals_for_period(period)

        assert first["status"] == "generated"
        assert second["status"] == "skipped"
        assert call_count["n"] == 1

    def test_force_regenerates_even_when_unchanged(self, monkeypatch):
        call_count = {"n": 0}

        def fake_generate(period, **kwargs):
            call_count["n"] += 1
            return [{"title": f"Goal {i} v{call_count['n']}", "description": "d", "rationale": "r"} for i in range(1, 4)]

        monkeypatch.setattr("board.extraction.advisory.generate_strategic_goals", fake_generate)
        period = make_full_period()

        generate_goals_for_period(period)
        result = generate_goals_for_period(period, force=True)

        assert result["status"] == "generated"
        assert call_count["n"] == 2

    def test_committed_goal_survives_regenerate(self, monkeypatch):
        monkeypatch.setattr(
            "board.extraction.advisory.generate_strategic_goals",
            lambda period, **kwargs: [
                {"title": f"Goal {i}", "description": "d", "rationale": "r"} for i in range(1, 4)
            ],
        )
        period = make_full_period()
        generate_goals_for_period(period)

        committed = AdvisoryGoal.objects.filter(period=period).first()
        committed.status = "committed"
        committed.save()

        generate_goals_for_period(period, force=True)

        committed.refresh_from_db()
        assert committed.status == "committed"
        # the committed row survives untouched; the regenerate creates a
        # fresh batch of 3 "suggested" rows alongside it (1 + 3 = 4)
        goals = AdvisoryGoal.objects.filter(period=period)
        assert goals.count() == 4
        assert goals.filter(status="committed").count() == 1
        assert goals.filter(status="suggested").count() == 3

    def test_error_from_gemini_is_recorded_not_raised(self, monkeypatch):
        def fake_generate(period, **kwargs):
            raise RuntimeError("Gemini strategic goal generation failed for TEST after 3 attempt(s): boom")

        monkeypatch.setattr("board.extraction.advisory.generate_strategic_goals", fake_generate)
        period = make_full_period()

        result = generate_goals_for_period(period)

        assert result["status"] == "error"
        assert "boom" in result["detail"]
        assert AdvisoryGoal.objects.filter(period=period).count() == 0


@pytest.mark.django_db
class TestAdvisoryGoalViewSetActions:
    def _make_goal(self, period, status="suggested"):
        return AdvisoryGoal.objects.create(
            period=period, order=1, title="Reach 12mo runway", description="d", rationale="r", status=status
        )

    def test_commit_requires_admin(self):
        period = make_full_period()
        goal = self._make_goal(period)
        user = User.objects.create_user(username="regular", password="pw")
        client = APIClient()
        client.force_authenticate(user=user)

        response = client.post(f"/api/advisory-goals/{goal.id}/commit/")

        assert response.status_code == 403

    def test_commit_sets_committed_fields(self):
        period = make_full_period()
        goal = self._make_goal(period)
        admin = User.objects.create_user(username="admin", password="pw", is_staff=True)
        client = APIClient()
        client.force_authenticate(user=admin)

        response = client.post(f"/api/advisory-goals/{goal.id}/commit/")

        assert response.status_code == 200
        goal.refresh_from_db()
        assert goal.status == "committed"
        assert goal.committed_at is not None
        assert goal.committed_by == admin

    def test_dismiss_sets_dismissed_status(self):
        period = make_full_period()
        goal = self._make_goal(period)
        admin = User.objects.create_user(username="admin", password="pw", is_staff=True)
        client = APIClient()
        client.force_authenticate(user=admin)

        response = client.post(f"/api/advisory-goals/{goal.id}/dismiss/")

        assert response.status_code == 200
        goal.refresh_from_db()
        assert goal.status == "dismissed"

    def test_complete_sets_completed_status(self):
        period = make_full_period()
        goal = self._make_goal(period, status="committed")
        admin = User.objects.create_user(username="admin", password="pw", is_staff=True)
        client = APIClient()
        client.force_authenticate(user=admin)

        response = client.post(f"/api/advisory-goals/{goal.id}/complete/")

        assert response.status_code == 200
        goal.refresh_from_db()
        assert goal.status == "completed"


@pytest.mark.django_db
class TestPeriodDetailAdvisoryGoals:
    def test_advisory_goals_included_in_response(self):
        period = make_full_period()
        AdvisoryGoal.objects.create(
            period=period, order=1, title="Reach 12mo runway", description="d", rationale="r"
        )
        admin = User.objects.create_user(username="admin", password="pw", is_staff=True)
        client = APIClient()
        client.force_authenticate(user=admin)

        response = client.get(f"/api/periods/{period.id}/")

        assert response.status_code == 200
        goals = response.data["advisory_goals"]
        assert len(goals) == 1
        assert goals[0]["title"] == "Reach 12mo runway"
        assert goals[0]["status"] == "suggested"
