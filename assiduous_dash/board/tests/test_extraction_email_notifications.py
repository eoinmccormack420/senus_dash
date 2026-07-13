"""
Tests for notify_extraction_email's failure-isolation contract (see
board/extraction/email_notifications.py's module docstring): a
notification failure must never raise back into the caller, and it
must no-op cleanly when there are no subscribers.
"""

from datetime import date
from decimal import Decimal
from unittest.mock import patch

import pytest
from django.contrib.auth.models import User

from board.extraction.email_notifications import notify_extraction_email
from board.models import ExtractionAttempt, FinancialPeriod, UserPreferences


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


def make_subscriber(email="subscriber@example.com"):
    user = User.objects.create_user(username=email, email=email)
    UserPreferences.objects.create(user=user, notify_on_new_insights=True)
    return user


@pytest.mark.django_db
class TestNotifyExtractionEmail:
    def test_noop_when_no_subscribers(self):
        with patch("board.extraction.email_notifications._send_email") as send_email:
            notify_extraction_email(make_attempt())

        send_email.assert_not_called()

    def test_swallows_failure_instead_of_raising(self):
        make_subscriber()

        with patch(
            "board.extraction.email_notifications._send_email",
            side_effect=OSError("smtp unreachable"),
        ):
            notify_extraction_email(make_attempt())  # must not raise

    def test_sends_expected_content_to_subscribers(self):
        make_subscriber("a@example.com")
        make_subscriber("b@example.com")

        with patch("board.extraction.email_notifications._send_email") as send_email:
            attempt = make_attempt()
            notify_extraction_email(attempt)

        send_email.assert_called_once()
        subject, message, recipients = send_email.call_args[0]
        assert attempt.period.label in subject
        assert attempt.statement_kind in subject
        assert attempt.status in subject
        assert "97.5" in message
        assert sorted(recipients) == ["a@example.com", "b@example.com"]
