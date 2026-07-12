"""
Tests for the email notifier's failure-isolation contract (see
board/extraction/email_notifications.py's module docstring): a send
failure must never raise back into the caller, and only subscribed
users with an email address should receive anything.
"""

from datetime import date
from unittest.mock import MagicMock, patch

import pytest
from django.contrib.auth.models import User
from django.core import mail

from board.extraction.email_notifications import notify_insight_subscribers, send_test_email
from board.models import FinancialPeriod, NotificationSettings, UserPreferences

GENERATED_RESULTS = [
    {"section": "cash_liquidity", "status": "generated", "detail": "120 chars"},
    {"section": "returns", "status": "skipped", "detail": "source figures unchanged"},
]
ALL_SKIPPED_RESULTS = [
    {"section": "cash_liquidity", "status": "skipped", "detail": "source figures unchanged"},
]


def make_period(**kwargs):
    defaults = dict(period_type="half_year", start_date=date(2025, 1, 1), end_date=date(2025, 6, 30))
    defaults.update(kwargs)
    return FinancialPeriod.objects.create(label="TEST", **defaults)


def make_subscriber(username, email, notify=True):
    user = User.objects.create_user(username=username, email=email)
    return UserPreferences.objects.create(user=user, notify_on_new_insights=notify)


@pytest.mark.django_db
class TestNotifyInsightSubscribers:
    def test_emails_subscribed_users_when_sections_generated(self):
        make_subscriber("subscribed", "board-member@example.com", notify=True)
        make_subscriber("unsubscribed", "other@example.com", notify=False)
        period = make_period()

        notify_insight_subscribers(period, GENERATED_RESULTS)

        assert len(mail.outbox) == 1
        assert mail.outbox[0].to == ["board-member@example.com"]
        assert "cash_liquidity" in mail.outbox[0].body
        assert period.label in mail.outbox[0].subject

    def test_noop_when_nothing_generated(self):
        make_subscriber("subscribed", "board-member@example.com", notify=True)
        period = make_period()

        notify_insight_subscribers(period, ALL_SKIPPED_RESULTS)

        assert len(mail.outbox) == 0

    def test_noop_when_no_subscribers(self):
        period = make_period()

        notify_insight_subscribers(period, GENERATED_RESULTS)

        assert len(mail.outbox) == 0

    def test_swallows_send_failure_instead_of_raising(self):
        make_subscriber("subscribed", "board-member@example.com", notify=True)
        period = make_period()

        with patch(
            "board.extraction.email_notifications.send_mail",
            side_effect=OSError("smtp connection refused"),
        ):
            notify_insight_subscribers(period, GENERATED_RESULTS)  # must not raise


@pytest.mark.django_db
class TestConnectionResolution:
    def test_uses_db_smtp_settings_when_configured(self):
        NotificationSettings.objects.create(
            pk=1,
            smtp_host="smtp.sendgrid.net",
            smtp_port=2525,
            smtp_username="apikey",
            smtp_password="secret",
            smtp_use_tls=False,
            from_email="Custom <custom@example.com>",
        )
        make_subscriber("subscribed", "board-member@example.com", notify=True)
        period = make_period()

        with patch("board.extraction.email_notifications.get_connection") as get_connection, patch(
            "board.extraction.email_notifications.send_mail"
        ) as send_mail_mock:
            notify_insight_subscribers(period, GENERATED_RESULTS)

        get_connection.assert_called_once_with(
            backend="django.core.mail.backends.smtp.EmailBackend",
            host="smtp.sendgrid.net",
            port=2525,
            username="apikey",
            password="secret",
            use_tls=False,
        )
        send_mail_mock.assert_called_once()
        assert send_mail_mock.call_args.kwargs["from_email"] == "Custom <custom@example.com>"

    def test_falls_back_to_django_settings_when_db_unconfigured(self):
        make_subscriber("subscribed", "board-member@example.com", notify=True)
        period = make_period()

        with patch("board.extraction.email_notifications.get_connection") as get_connection, patch(
            "board.extraction.email_notifications.send_mail"
        ) as send_mail_mock:
            notify_insight_subscribers(period, GENERATED_RESULTS)

        get_connection.assert_called_once_with()
        assert send_mail_mock.call_args.kwargs["from_email"] is None


@pytest.mark.django_db
class TestGmailApiSending:
    def test_uses_gmail_api_when_connected_and_skips_smtp(self, settings):
        settings.GOOGLE_OAUTH_CLIENT_ID = "client-id"
        settings.GOOGLE_OAUTH_CLIENT_SECRET = "client-secret"
        NotificationSettings.objects.create(
            pk=1, gmail_refresh_token="r-token", gmail_connected_email="admin@gmail.com"
        )
        make_subscriber("subscribed", "board-member@example.com", notify=True)
        period = make_period()

        fake_service = MagicMock()
        with patch("board.extraction.email_notifications.Credentials") as CredsClass, patch(
            "board.extraction.email_notifications.build", return_value=fake_service
        ) as build_mock, patch("board.extraction.email_notifications.get_connection") as get_connection, patch(
            "board.extraction.email_notifications.send_mail"
        ) as send_mail_mock:
            notify_insight_subscribers(period, GENERATED_RESULTS)

        creds_instance = CredsClass.return_value
        creds_instance.refresh.assert_called_once()
        build_mock.assert_called_once_with("gmail", "v1", credentials=creds_instance)

        send_call = fake_service.users.return_value.messages.return_value.send
        send_call.assert_called_once()
        assert send_call.call_args.kwargs["userId"] == "me"
        assert "raw" in send_call.call_args.kwargs["body"]
        send_call.return_value.execute.assert_called_once()

        get_connection.assert_not_called()
        send_mail_mock.assert_not_called()

    def test_gmail_api_failure_is_swallowed_not_raised(self):
        NotificationSettings.objects.create(
            pk=1, gmail_refresh_token="r-token", gmail_connected_email="admin@gmail.com"
        )
        make_subscriber("subscribed", "board-member@example.com", notify=True)
        period = make_period()

        with patch("board.extraction.email_notifications.Credentials"), patch(
            "board.extraction.email_notifications.build", side_effect=OSError("gmail api unreachable")
        ):
            notify_insight_subscribers(period, GENERATED_RESULTS)  # must not raise


@pytest.mark.django_db
class TestSendTestEmail:
    def test_returns_true_on_success(self):
        result = send_test_email("admin@example.com")

        assert result is True
        assert len(mail.outbox) == 1
        assert mail.outbox[0].to == ["admin@example.com"]

    def test_returns_false_and_does_not_raise_on_failure(self):
        with patch(
            "board.extraction.email_notifications.send_mail",
            side_effect=OSError("smtp auth failed"),
        ):
            result = send_test_email("admin@example.com")  # must not raise

        assert result is False
