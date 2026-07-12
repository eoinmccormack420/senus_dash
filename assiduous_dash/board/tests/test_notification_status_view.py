"""
Tests for /api/notifications/status/ — admin-only visibility AND
configuration of the Slack/Teams webhook URLs stored in
NotificationSettings (never exposes SMTP credentials, and reflects env
var fallback without exposing env var values that weren't set here).
"""

import pytest
from django.contrib.auth.models import User
from django.test import override_settings
from rest_framework.test import APIClient

from board.models import NotificationSettings


@pytest.mark.django_db
class TestNotificationStatusView:
    def test_get_requires_admin(self):
        user = User.objects.create_user(username="regular", password="pw")
        client = APIClient()
        client.force_authenticate(user=user)

        response = client.get("/api/notifications/status/")

        assert response.status_code == 403

    def test_patch_requires_admin(self):
        user = User.objects.create_user(username="regular", password="pw")
        client = APIClient()
        client.force_authenticate(user=user)

        response = client.patch("/api/notifications/status/", {"slack_webhook_url": "https://x"}, format="json")

        assert response.status_code == 403

    @override_settings(EMAIL_BACKEND="django.core.mail.backends.console.EmailBackend")
    def test_reports_env_var_fallback_without_exposing_it(self, monkeypatch):
        monkeypatch.setenv("SLACK_WEBHOOK_URL", "https://hooks.slack.example/xxx")
        monkeypatch.delenv("TEAMS_WEBHOOK_URL", raising=False)

        admin = User.objects.create_user(username="admin", password="pw", is_staff=True)
        client = APIClient()
        client.force_authenticate(user=admin)

        response = client.get("/api/notifications/status/")

        assert response.status_code == 200
        assert response.data == {
            "slack": True,
            "teams": False,
            "email": False,
            "slack_webhook_url": "",  # active via env var, not stored here
            "teams_webhook_url": "",
            "smtp_host": "",
            "smtp_port": None,
            "smtp_username": "",
            "smtp_password_set": False,
            "smtp_use_tls": True,
            "from_email": "",
            "gmail_connected_email": "",
        }
        assert "hooks.slack.example" not in str(response.content)

    def test_patch_sets_webhook_url_and_takes_precedence_over_env(self, monkeypatch):
        monkeypatch.setenv("SLACK_WEBHOOK_URL", "https://env-configured.example/xxx")

        admin = User.objects.create_user(username="admin", password="pw", is_staff=True)
        client = APIClient()
        client.force_authenticate(user=admin)

        response = client.patch(
            "/api/notifications/status/",
            {"slack_webhook_url": "https://hooks.slack.com/services/T0/B0/xyz"},
            format="json",
        )

        assert response.status_code == 200
        assert response.data["slack"] is True
        assert response.data["slack_webhook_url"] == "https://hooks.slack.com/services/T0/B0/xyz"
        assert NotificationSettings.get_solo().slack_webhook_url == "https://hooks.slack.com/services/T0/B0/xyz"

    def test_patch_with_empty_string_clears_stored_webhook(self):
        NotificationSettings.objects.create(pk=1, teams_webhook_url="https://old.example/hook")
        admin = User.objects.create_user(username="admin", password="pw", is_staff=True)
        client = APIClient()
        client.force_authenticate(user=admin)

        response = client.patch("/api/notifications/status/", {"teams_webhook_url": ""}, format="json")

        assert response.status_code == 200
        assert response.data["teams_webhook_url"] == ""
        assert response.data["teams"] is False
        assert NotificationSettings.get_solo().teams_webhook_url == ""

    def test_patch_sets_smtp_fields_and_never_echoes_password(self):
        admin = User.objects.create_user(username="admin", password="pw", is_staff=True)
        client = APIClient()
        client.force_authenticate(user=admin)

        response = client.patch(
            "/api/notifications/status/",
            {
                "smtp_host": "smtp.sendgrid.net",
                "smtp_port": 587,
                "smtp_username": "apikey",
                "smtp_password": "super-secret-value",
                "smtp_use_tls": True,
                "from_email": "Senus Board Report <noreply@senus.example>",
            },
            format="json",
        )

        assert response.status_code == 200
        assert response.data["smtp_host"] == "smtp.sendgrid.net"
        assert response.data["smtp_password_set"] is True
        assert "smtp_password" not in response.data
        assert "super-secret-value" not in str(response.content)
        assert response.data["email"] is True

        stored = NotificationSettings.get_solo()
        assert stored.smtp_password == "super-secret-value"  # actually persisted, just not echoed

    def test_get_never_returns_smtp_password(self):
        NotificationSettings.objects.create(pk=1, smtp_host="smtp.example.com", smtp_password="hunter2")
        admin = User.objects.create_user(username="admin", password="pw", is_staff=True)
        client = APIClient()
        client.force_authenticate(user=admin)

        response = client.get("/api/notifications/status/")

        assert response.data["smtp_password_set"] is True
        assert "hunter2" not in str(response.content)

    def test_patch_without_password_preserves_existing_one(self):
        NotificationSettings.objects.create(pk=1, smtp_host="smtp.example.com", smtp_password="hunter2")
        admin = User.objects.create_user(username="admin", password="pw", is_staff=True)
        client = APIClient()
        client.force_authenticate(user=admin)

        response = client.patch("/api/notifications/status/", {"smtp_username": "changed-user"}, format="json")

        assert response.status_code == 200
        assert NotificationSettings.get_solo().smtp_password == "hunter2"
