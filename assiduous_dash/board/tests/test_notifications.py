"""
Tests for the Slack notifier's failure-isolation contract (see
board/extraction/notifications.py's module docstring): a notification
failure must never raise back into the caller, and the notifier must
no-op cleanly when unconfigured.
"""

import json
from datetime import date
from decimal import Decimal
from unittest.mock import patch

import pytest

from board.extraction.notifications import notify_slack, send_test_slack_message
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
class TestNotifySlack:
    def test_noop_when_webhook_unset(self, monkeypatch):
        monkeypatch.delenv("SLACK_WEBHOOK_URL", raising=False)

        with patch("board.extraction.notifications.urllib.request.urlopen") as urlopen:
            notify_slack(make_attempt())

        urlopen.assert_not_called()

    def test_swallows_failure_instead_of_raising(self, monkeypatch):
        monkeypatch.setenv("SLACK_WEBHOOK_URL", "https://hooks.slack.example/T000/B000/xxx")

        with patch(
            "board.extraction.notifications.urllib.request.urlopen",
            side_effect=OSError("network unreachable"),
        ):
            notify_slack(make_attempt())  # must not raise

    def test_posts_expected_payload_when_configured(self, monkeypatch):
        monkeypatch.setenv("SLACK_WEBHOOK_URL", "https://hooks.slack.example/T000/B000/xxx")

        with patch("board.extraction.notifications.urllib.request.urlopen") as urlopen:
            attempt = make_attempt()
            notify_slack(attempt)

        urlopen.assert_called_once()
        request = urlopen.call_args[0][0]
        assert request.full_url == "https://hooks.slack.example/T000/B000/xxx"
        body = json.loads(request.data.decode("utf-8"))
        assert attempt.period.label in body["text"]
        assert attempt.statement_kind in body["text"]
        assert attempt.status in body["text"]
        assert "97.5" in body["text"]

    def test_db_configured_webhook_takes_precedence_over_env_var(self, monkeypatch):
        monkeypatch.setenv("SLACK_WEBHOOK_URL", "https://env-configured.example/xxx")
        NotificationSettings.objects.create(pk=1, slack_webhook_url="https://db-configured.example/xxx")

        with patch("board.extraction.notifications.urllib.request.urlopen") as urlopen:
            notify_slack(make_attempt())

        request = urlopen.call_args[0][0]
        assert request.full_url == "https://db-configured.example/xxx"


@pytest.mark.django_db
class TestSendTestSlackMessage:
    def test_returns_false_when_unconfigured(self, monkeypatch):
        monkeypatch.delenv("SLACK_WEBHOOK_URL", raising=False)

        with patch("board.extraction.notifications.urllib.request.urlopen") as urlopen:
            result = send_test_slack_message()

        assert result is False
        urlopen.assert_not_called()

    def test_returns_true_on_success(self, monkeypatch):
        monkeypatch.setenv("SLACK_WEBHOOK_URL", "https://hooks.slack.example/T000/B000/xxx")

        with patch("board.extraction.notifications.urllib.request.urlopen"):
            result = send_test_slack_message()

        assert result is True

    def test_returns_false_and_does_not_raise_on_failure(self, monkeypatch):
        monkeypatch.setenv("SLACK_WEBHOOK_URL", "https://hooks.slack.example/T000/B000/xxx")

        with patch(
            "board.extraction.notifications.urllib.request.urlopen",
            side_effect=OSError("network unreachable"),
        ):
            result = send_test_slack_message()  # must not raise

        assert result is False
