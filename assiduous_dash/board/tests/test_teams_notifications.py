"""
Tests for the Teams notifier's failure-isolation contract (see
board/extraction/teams_notifications.py's module docstring): a
notification failure must never raise back into the caller, and the
notifier must no-op cleanly when unconfigured.
"""

import json
from datetime import date
from decimal import Decimal
from unittest.mock import patch

import pytest

from board.extraction.teams_notifications import notify_teams, send_test_teams_message
from board.models import ExtractionAttempt, FinancialPeriod, NotificationSettings


def make_attempt(**kwargs):
    period = FinancialPeriod.objects.create(
        label="TEST",
        period_type="half_year",
        start_date=date(2025, 1, 1),
        end_date=date(2025, 6, 30),
    )
    defaults = dict(
        period=period,
        statement_kind="pl_statement",
        source_document="test.pdf",
        status="cross_check_pass",
        match_rate_pct=Decimal("97.5"),
    )
    defaults.update(kwargs)
    return ExtractionAttempt.objects.create(**defaults)


@pytest.mark.django_db
class TestNotifyTeams:
    def test_noop_when_webhook_unset(self, monkeypatch):
        monkeypatch.delenv("TEAMS_WEBHOOK_URL", raising=False)

        with patch("board.extraction.teams_notifications.urllib.request.urlopen") as urlopen:
            notify_teams(make_attempt())

        urlopen.assert_not_called()

    def test_swallows_failure_instead_of_raising(self, monkeypatch):
        monkeypatch.setenv("TEAMS_WEBHOOK_URL", "https://example.webhook.office.com/xxx")

        with patch(
            "board.extraction.teams_notifications.urllib.request.urlopen",
            side_effect=OSError("network unreachable"),
        ):
            notify_teams(make_attempt())  # must not raise

    def test_posts_expected_adaptive_card_when_configured(self, monkeypatch):
        monkeypatch.setenv("TEAMS_WEBHOOK_URL", "https://example.webhook.office.com/xxx")

        with patch("board.extraction.teams_notifications.urllib.request.urlopen") as urlopen:
            attempt = make_attempt()
            notify_teams(attempt)

        urlopen.assert_called_once()
        request = urlopen.call_args[0][0]
        assert request.full_url == "https://example.webhook.office.com/xxx"
        body = json.loads(request.data.decode("utf-8"))
        card = body["attachments"][0]["content"]
        assert card["type"] == "AdaptiveCard"
        summary_text = card["body"][0]["text"]
        assert attempt.period.label in summary_text
        assert attempt.statement_kind in summary_text
        assert attempt.status in summary_text
        assert "97.5" in summary_text

    def test_db_configured_webhook_takes_precedence_over_env_var(self, monkeypatch):
        monkeypatch.setenv("TEAMS_WEBHOOK_URL", "https://env-configured.example/xxx")
        NotificationSettings.objects.create(pk=1, teams_webhook_url="https://db-configured.example/xxx")

        with patch("board.extraction.teams_notifications.urllib.request.urlopen") as urlopen:
            notify_teams(make_attempt())

        request = urlopen.call_args[0][0]
        assert request.full_url == "https://db-configured.example/xxx"


@pytest.mark.django_db
class TestSendTestTeamsMessage:
    def test_returns_false_when_unconfigured(self, monkeypatch):
        monkeypatch.delenv("TEAMS_WEBHOOK_URL", raising=False)

        with patch("board.extraction.teams_notifications.urllib.request.urlopen") as urlopen:
            result = send_test_teams_message()

        assert result is False
        urlopen.assert_not_called()

    def test_returns_true_on_success(self, monkeypatch):
        monkeypatch.setenv("TEAMS_WEBHOOK_URL", "https://example.webhook.office.com/xxx")

        with patch("board.extraction.teams_notifications.urllib.request.urlopen"):
            result = send_test_teams_message()

        assert result is True

    def test_returns_false_and_does_not_raise_on_failure(self, monkeypatch):
        monkeypatch.setenv("TEAMS_WEBHOOK_URL", "https://example.webhook.office.com/xxx")

        with patch(
            "board.extraction.teams_notifications.urllib.request.urlopen",
            side_effect=OSError("network unreachable"),
        ):
            result = send_test_teams_message()  # must not raise

        assert result is False
