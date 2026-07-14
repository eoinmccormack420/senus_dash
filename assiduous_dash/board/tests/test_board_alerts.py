"""
Tests for the Board Alerts feature: BoardAlertSettingsView (thresholds
config), PeriodDetailSerializer's board_alerts field (evaluation
against those thresholds), and the send_alert_digest action (delivery,
mocking the actual Slack/Teams/email senders per this repo's
notification-test convention).
"""

from datetime import date
from decimal import Decimal
from unittest.mock import patch

import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient

from board.models import BalanceSheet, BoardAlertSettings, CashFlow, FinancialPeriod, PLStatement


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


@pytest.mark.django_db
class TestBoardAlertSettingsView:
    def test_get_requires_admin(self):
        user = User.objects.create_user(username="regular", password="pw")
        client = APIClient()
        client.force_authenticate(user=user)

        response = client.get("/api/board-alerts/settings/")

        assert response.status_code == 403

    def test_patch_requires_admin(self):
        user = User.objects.create_user(username="regular", password="pw")
        client = APIClient()
        client.force_authenticate(user=user)

        response = client.patch("/api/board-alerts/settings/", {"cash_runway_months_min": 6}, format="json")

        assert response.status_code == 403

    def test_get_returns_defaults(self):
        admin = User.objects.create_user(username="admin", password="pw", is_staff=True)
        client = APIClient()
        client.force_authenticate(user=admin)

        response = client.get("/api/board-alerts/settings/")

        assert response.status_code == 200
        assert response.data["cash_runway_enabled"] is True
        assert float(response.data["cash_runway_months_min"]) == 12

    def test_patch_updates_threshold(self):
        admin = User.objects.create_user(username="admin", password="pw", is_staff=True)
        client = APIClient()
        client.force_authenticate(user=admin)

        response = client.patch("/api/board-alerts/settings/", {"cash_runway_months_min": 6}, format="json")

        assert response.status_code == 200
        assert float(response.data["cash_runway_months_min"]) == 6
        assert float(BoardAlertSettings.get_solo().cash_runway_months_min) == 6

    def test_patch_can_disable_a_signal(self):
        admin = User.objects.create_user(username="admin", password="pw", is_staff=True)
        client = APIClient()
        client.force_authenticate(user=admin)

        response = client.patch("/api/board-alerts/settings/", {"current_ratio_enabled": False}, format="json")

        assert response.status_code == 200
        assert response.data["current_ratio_enabled"] is False


@pytest.mark.django_db
class TestPeriodDetailBoardAlerts:
    def test_breach_reports_attention(self):
        period = make_period()
        make_pl_statement(period)
        make_balance_sheet(period)
        make_cash_flow(period)
        admin = User.objects.create_user(username="admin", password="pw", is_staff=True)
        client = APIClient()
        client.force_authenticate(user=admin)

        response = client.get(f"/api/periods/{period.id}/")

        assert response.status_code == 200
        alerts = {a["key"]: a for a in response.data["board_alerts"]}
        # cash=1000, net_operating_cash=-1000 over a half-year -> monthly
        # burn ~166.67 -> ~6 months runway, below the default 12-month min.
        assert alerts["cash_runway"]["status"] == "attention"
        # current_creditors=-500, current assets (debtors+cash)=11000 ->
        # current_ratio ~22, comfortably above the default min of 1.
        assert alerts["current_ratio"]["status"] == "clear"

    def test_disabled_signal_reports_not_monitored(self):
        BoardAlertSettings.objects.create(pk=1, cash_runway_enabled=False)
        period = make_period()
        make_pl_statement(period)
        make_balance_sheet(period)
        make_cash_flow(period)
        admin = User.objects.create_user(username="admin", password="pw", is_staff=True)
        client = APIClient()
        client.force_authenticate(user=admin)

        response = client.get(f"/api/periods/{period.id}/")

        alerts = {a["key"]: a for a in response.data["board_alerts"]}
        assert alerts["cash_runway"]["status"] == "not_monitored"

    def test_missing_statement_reports_unavailable(self):
        period = make_period()  # no balance_sheet/cash_flow at all
        admin = User.objects.create_user(username="admin", password="pw", is_staff=True)
        client = APIClient()
        client.force_authenticate(user=admin)

        response = client.get(f"/api/periods/{period.id}/")

        alerts = {a["key"]: a for a in response.data["board_alerts"]}
        assert alerts["cash_runway"]["status"] == "unavailable"
        assert alerts["current_ratio"]["status"] == "unavailable"


@pytest.mark.django_db
class TestSendAlertDigestAction:
    def test_requires_admin(self):
        period = make_period()
        make_pl_statement(period)
        make_balance_sheet(period)
        make_cash_flow(period)
        user = User.objects.create_user(username="regular", password="pw")
        client = APIClient()
        client.force_authenticate(user=user)

        response = client.post(f"/api/periods/{period.id}/send_alert_digest/")

        assert response.status_code == 403

    def test_sends_only_active_breaches(self):
        period = make_period()
        make_pl_statement(period)
        make_balance_sheet(period)
        make_cash_flow(period)
        admin = User.objects.create_user(username="admin", password="pw", is_staff=True)
        client = APIClient()
        client.force_authenticate(user=admin)

        with patch("board.alerts.send_slack_message", return_value=True) as slack, \
             patch("board.alerts.send_teams_message", return_value=True) as teams, \
             patch("board.alerts.send_board_alert_email", return_value=True) as email:
            response = client.post(f"/api/periods/{period.id}/send_alert_digest/")

        assert response.status_code == 200
        assert response.data["active_alerts"] == 1  # only cash_runway breaches
        assert response.data == {"active_alerts": 1, "slack": True, "teams": True, "email": True}

        message = slack.call_args[0][0]
        assert "Cash runway" in message
        assert "Current ratio" not in message  # not a breach, shouldn't be in the digest
        teams.assert_called_once()
        email.assert_called_once()

    def test_noop_when_no_breaches(self):
        period = make_period()
        make_pl_statement(period)
        make_balance_sheet(
            period,
            cash=Decimal("100000"),
            current_creditors=Decimal("-500"),
        )
        make_cash_flow(period, net_operating_cash=Decimal("-1000"))
        admin = User.objects.create_user(username="admin", password="pw", is_staff=True)
        client = APIClient()
        client.force_authenticate(user=admin)

        with patch("board.alerts.send_slack_message") as slack, \
             patch("board.alerts.send_teams_message") as teams, \
             patch("board.alerts.send_board_alert_email") as email:
            response = client.post(f"/api/periods/{period.id}/send_alert_digest/")

        assert response.status_code == 200
        assert response.data == {"active_alerts": 0, "slack": False, "teams": False, "email": False}
        slack.assert_not_called()
        teams.assert_not_called()
        email.assert_not_called()
