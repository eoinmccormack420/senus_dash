"""
Optional email notification for subscribers of newly-generated AI
insights. Deliberately isolated from commentary.py's business logic,
same contract as notifications.py's notify_slack: a send failure must
NEVER raise back into the caller. See
board/tests/test_email_notifications.py for the failure-isolation test.

Three ways to actually send, in priority order:
1. Gmail API, if NotificationSettings.gmail_refresh_token is set (the
   "Connect Gmail" flow — see gmail_oauth.py — instead of typing SMTP
   credentials).
2. SMTP settings from Settings > Notifications
   (NotificationSettings.smtp_host, etc.) instead of the EMAIL_HOST/
   EMAIL_PORT/... env vars.
3. The normal Django EMAIL_* settings (console backend by default), so
   existing env-var-only deployments keep working unchanged.
"""

import base64
import logging
from email.mime.text import MIMEText

from django.conf import settings as django_settings
from django.core.mail import get_connection, send_mail
from google.auth.transport.requests import Request as GoogleAuthRequest
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

from board.models import NotificationSettings, UserPreferences

logger = logging.getLogger(__name__)


def _connection_and_from_email():
    ns = NotificationSettings.get_solo()
    if not ns.smtp_host:
        return get_connection(), None  # None -> send_mail falls back to settings.DEFAULT_FROM_EMAIL

    connection = get_connection(
        backend="django.core.mail.backends.smtp.EmailBackend",
        host=ns.smtp_host,
        port=ns.smtp_port or 587,
        username=ns.smtp_username,
        password=ns.smtp_password,
        use_tls=ns.smtp_use_tls,
    )
    return connection, (ns.from_email or django_settings.DEFAULT_FROM_EMAIL)


def _send_via_gmail_api(ns: NotificationSettings, subject: str, message: str, recipient_list: list[str]) -> None:
    creds = Credentials(
        token=None,
        refresh_token=ns.gmail_refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=django_settings.GOOGLE_OAUTH_CLIENT_ID,
        client_secret=django_settings.GOOGLE_OAUTH_CLIENT_SECRET,
    )
    creds.refresh(GoogleAuthRequest())

    mime_message = MIMEText(message)
    mime_message["to"] = ", ".join(recipient_list)
    mime_message["subject"] = subject
    raw = base64.urlsafe_b64encode(mime_message.as_bytes()).decode("utf-8")

    service = build("gmail", "v1", credentials=creds)
    service.users().messages().send(userId="me", body={"raw": raw}).execute()


def _send_email(subject: str, message: str, recipient_list: list[str]) -> None:
    ns = NotificationSettings.get_solo()
    if ns.gmail_refresh_token:
        _send_via_gmail_api(ns, subject, message, recipient_list)
        return

    connection, from_email = _connection_and_from_email()
    send_mail(
        subject=subject,
        message=message,
        from_email=from_email,
        recipient_list=recipient_list,
        connection=connection,
    )


def notify_insight_subscribers(period, results) -> None:
    """
    Emails everyone with notify_on_new_insights=True a short summary of
    which sections were (re)generated for `period`, per the `results`
    list returned by generate_insights_for_period(). No-ops if nothing
    was actually generated (a no-op regenerate — everything cached) or
    if there are no subscribers. Any failure is logged and swallowed,
    never raised.
    """
    generated_sections = [r["section"] for r in results if r["status"] == "generated"]
    if not generated_sections:
        return

    subscribers = UserPreferences.objects.filter(
        notify_on_new_insights=True, user__email__gt=""
    ).select_related("user")
    recipient_emails = [prefs.user.email for prefs in subscribers]
    if not recipient_emails:
        return

    subject = f"New board insights published — {period.label}"
    message = (
        f"New AI commentary is available for {period.label}:\n\n"
        + "\n".join(f"- {section}" for section in generated_sections)
        + "\n\nView it in the Senus board dashboard."
    )

    try:
        _send_email(subject, message, recipient_emails)
    except Exception:  # noqa: BLE001 — a notification failure must never break insight generation
        logger.exception("Email notification failed for period %s", period.pk)


def notify_extraction_email(attempt) -> None:
    """
    Emails everyone with notify_on_new_insights=True a short summary of
    a completed extraction attempt — the email counterpart to
    notify_slack/notify_teams (see notifications.py, teams_notifications.py),
    called from run_extraction() right after the attempt is saved. Reuses
    the insight-subscriber list rather than a separate preference, since
    both are "people who want board pipeline updates". Any failure is
    logged and swallowed, never raised, matching the Slack/Teams contract.
    """
    subscribers = UserPreferences.objects.filter(
        notify_on_new_insights=True, user__email__gt=""
    ).select_related("user")
    recipient_emails = [prefs.user.email for prefs in subscribers]
    if not recipient_emails:
        return

    subject = f"Extraction {attempt.status}: {attempt.period.label} — {attempt.statement_kind}"
    message = (
        f"{attempt.period.label} / {attempt.statement_kind} -> {attempt.status}\n"
        f"Match rate: {attempt.match_rate_pct}%\n\n"
        "View it in the Senus board dashboard."
    )

    try:
        _send_email(subject, message, recipient_emails)
    except Exception:  # noqa: BLE001 — a notification failure must never break extraction
        logger.exception("Email notification failed for ExtractionAttempt %s", attempt.pk)


def send_test_email(to_email: str) -> bool:
    """
    Sends a test email to `to_email` (the admin clicking "Send test"),
    using the same send-method resolution as notify_insight_subscribers.
    Unlike that function, this reports success/failure back to the
    caller rather than swallowing it, since the whole point is letting
    an admin confirm email delivery actually works. Returns False on
    any failure (auth error, connection refused, etc.).
    """
    try:
        _send_email(
            "Senus Board Report — test notification",
            "This is a test email from the Senus Board Report. Email delivery is connected.",
            [to_email],
        )
        return True
    except Exception:  # noqa: BLE001
        logger.exception("Test email failed")
        return False
