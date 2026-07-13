"""Board-alert evaluation and delivery helpers.

Evaluation is side-effect free: dashboard refreshes can inspect current risk
without sending a notification. The explicit digest endpoint owns delivery.
"""

from __future__ import annotations

from board.extraction.email_notifications import send_board_alert_email
from board.extraction.notifications import send_slack_message
from board.extraction.teams_notifications import send_teams_message


def evaluate_board_alerts(period, settings) -> list[dict]:
    """Return every configured alert signal for a period."""
    pl = getattr(period, "pl_statement", None)
    bs = getattr(period, "balance_sheet", None)
    signals = [
        {
            "key": "cash_runway", "title": "Cash runway", "section": "cash_liquidity",
            "enabled": settings.cash_runway_enabled,
            "value": bs.cash_runway_months if bs else None,
            "threshold": float(settings.cash_runway_months_min), "unit": "months", "operator": "below",
            "detail": "Cash runway is below the board's minimum threshold.",
        },
        {
            "key": "ebitda_margin", "title": "EBITDA margin", "section": "profitability",
            "enabled": settings.ebitda_margin_enabled,
            "value": pl.ebitda_margin_pct if pl else None,
            "threshold": float(settings.ebitda_margin_min_pct), "unit": "%", "operator": "below",
            "detail": "EBITDA margin is below the board's minimum threshold.",
        },
        {
            "key": "admin_expense_ratio", "title": "Admin expense ratio", "section": "profitability",
            "enabled": settings.admin_expense_ratio_enabled,
            "value": pl.admin_expense_pct if pl else None,
            "threshold": float(settings.admin_expense_ratio_max_pct), "unit": "%", "operator": "above",
            "detail": "Admin expenses exceed the board's maximum share of revenue.",
        },
        {
            "key": "current_ratio", "title": "Current ratio", "section": "solvency_leverage",
            "enabled": settings.current_ratio_enabled,
            "value": bs.current_ratio if bs else None,
            "threshold": float(settings.current_ratio_min), "unit": "x", "operator": "below",
            "detail": "Short-term liquidity is below the board's minimum threshold.",
        },
    ]

    for signal in signals:
        value = signal["value"]
        if not signal["enabled"]:
            signal["status"] = "not_monitored"
        elif value is None:
            signal["status"] = "unavailable"
        elif signal["operator"] == "below":
            signal["status"] = "attention" if float(value) < signal["threshold"] else "clear"
        else:
            signal["status"] = "attention" if float(value) > signal["threshold"] else "clear"
        signal["value"] = float(value) if value is not None else None
    return signals


def send_board_alert_digest(period, alerts: list[dict]) -> dict:
    """Send active breaches to configured channels without raising on delivery errors."""
    active = [alert for alert in alerts if alert["status"] == "attention"]
    if not active:
        return {"active_alerts": 0, "slack": False, "teams": False, "email": False}

    lines = [
        f"{alert['title']}: {alert['value']}{alert['unit']} "
        f"({alert['operator']} {alert['threshold']}{alert['unit']})"
        for alert in active
    ]
    message = f"Board alert digest - {period.label}\n\n" + "\n".join(f"- {line}" for line in lines)
    return {
        "active_alerts": len(active),
        "slack": send_slack_message(message),
        "teams": send_teams_message(message),
        "email": send_board_alert_email(period.label, lines),
    }
