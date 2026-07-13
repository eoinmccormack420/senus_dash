"""
Optional Slack notification for completed extraction attempts.

Deliberately isolated from pipeline.py's business logic — run_extraction()
just calls notify_slack() after an attempt lands in cross_check_pass or
cross_check_fail. This module owns the one guarantee that matters: a
notification failure (unset/misconfigured webhook, Slack outage, bad
network) must NEVER raise back into the pipeline. See
board/tests/test_notifications.py for the failure-isolation test.

The webhook URL can be set from Settings > Notifications
(NotificationSettings.slack_webhook_url) instead of the SLACK_WEBHOOK_URL
env var — the DB value takes precedence when both are set, so a
deployment already using the env var keeps working unchanged.
"""

import json
import logging
import os
import urllib.request

from board.models import NotificationSettings

logger = logging.getLogger(__name__)


def _webhook_url() -> str:
    return NotificationSettings.get_solo().slack_webhook_url or os.environ.get("SLACK_WEBHOOK_URL", "")


def _post(webhook_url: str, payload: dict) -> None:
    body = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        webhook_url, data=body, headers={"Content-Type": "application/json"}
    )
    urllib.request.urlopen(request, timeout=5)


def notify_slack(attempt) -> None:
    """
    POSTs a short summary of `attempt` to the configured Slack webhook,
    if any. No-ops silently if unconfigured. Any failure (unreachable,
    non-2xx response, etc.) is logged and swallowed, never raised.
    """
    webhook_url = _webhook_url()
    if not webhook_url:
        return

    message = (
        f"*{attempt.period.label}* / {attempt.statement_kind} -> "
        f"*{attempt.status}* (match rate: {attempt.match_rate_pct}%)"
    )

    try:
        _post(webhook_url, {"text": message})
    except Exception:  # noqa: BLE001 — a notification failure must never break extraction
        logger.exception("Slack notification failed for ExtractionAttempt %s", attempt.pk)


def send_test_slack_message() -> bool:
    """
    Posts a test message to the configured Slack webhook, for the
    admin "Send test message" button. Unlike notify_slack(), this
    reports success/failure back to the caller rather than swallowing
    it, since the whole point is letting an admin confirm the webhook
    actually works. Returns False if unconfigured or the request fails.
    """
    webhook_url = _webhook_url()
    if not webhook_url:
        return False

    try:
        _post(webhook_url, {"text": "✅ Test notification from the Senus Board Report — Slack is connected."})
        return True
    except Exception:  # noqa: BLE001
        logger.exception("Slack test notification failed")
        return False


def send_slack_message(text: str) -> bool:
    """Send a board alert message, returning delivery status to its caller."""
    webhook_url = _webhook_url()
    if not webhook_url:
        return False
    try:
        _post(webhook_url, {"text": text})
        return True
    except Exception:  # noqa: BLE001
        logger.exception("Slack board alert notification failed")
        return False
