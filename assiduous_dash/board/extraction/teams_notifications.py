"""
Optional Microsoft Teams notification for completed extraction
attempts. Same isolation contract as notifications.py's notify_slack —
run_extraction() calls notify_teams() alongside notify_slack() after an
attempt lands in cross_check_pass or cross_check_fail, and a
notification failure (unset/misconfigured webhook, Teams outage, bad
network) must NEVER raise back into the pipeline. See
board/tests/test_teams_notifications.py for the failure-isolation test.

Uses the Adaptive Card payload shape expected by Teams "Workflows"
incoming webhooks, not the older/deprecated Office 365 Connector
`{"text": "..."}` format Slack uses.

The webhook URL can be set from Settings > Notifications
(NotificationSettings.teams_webhook_url) instead of the
TEAMS_WEBHOOK_URL env var — the DB value takes precedence when both
are set, so a deployment already using the env var keeps working
unchanged.
"""

import json
import logging
import os
import urllib.error
import urllib.request

from board.models import NotificationSettings

logger = logging.getLogger(__name__)


def _webhook_url() -> str:
    return NotificationSettings.get_solo().teams_webhook_url or os.environ.get("TEAMS_WEBHOOK_URL", "")


def _adaptive_card(text: str) -> dict:
    return {
        "type": "message",
        "attachments": [
            {
                "contentType": "application/vnd.microsoft.card.adaptive",
                "content": {
                    "type": "AdaptiveCard",
                    "version": "1.4",
                    "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
                    "body": [
                        {
                            "type": "TextBlock",
                            "text": text,
                            "wrap": True,
                        }
                    ],
                },
            }
        ],
    }


def _post(webhook_url: str, payload: dict) -> None:
    body = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        webhook_url, data=body, headers={"Content-Type": "application/json"}
    )
    urllib.request.urlopen(request, timeout=5)


def notify_teams(attempt) -> None:
    """
    POSTs an Adaptive Card summary of `attempt` to the configured Teams
    webhook, if any. No-ops silently if unconfigured. Any failure
    (unreachable, non-2xx response, etc.) is logged and swallowed,
    never raised.
    """
    webhook_url = _webhook_url()
    if not webhook_url:
        return

    summary = (
        f"{attempt.period.label} / {attempt.statement_kind} -> "
        f"{attempt.status} (match rate: {attempt.match_rate_pct}%)"
    )

    try:
        _post(webhook_url, _adaptive_card(summary))
    except Exception:  # noqa: BLE001 — a notification failure must never break extraction
        logger.exception("Teams notification failed for ExtractionAttempt %s", attempt.pk)


def send_test_teams_message() -> bool:
    """
    Posts a test Adaptive Card to the configured Teams webhook, for the
    admin "Send test message" button. Unlike notify_teams(), this
    reports success/failure back to the caller rather than swallowing
    it. Returns False if unconfigured or the request fails.
    """
    webhook_url = _webhook_url()
    if not webhook_url:
        return False

    try:
        _post(webhook_url, _adaptive_card("✅ Test notification from the Senus Board Report — Teams is connected."))
        return True
    except Exception:  # noqa: BLE001
        logger.exception("Teams test notification failed")
        return False
