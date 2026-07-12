"""
Tests for POST /api/notifications/test-slack/ and /test-teams/ — the
admin "send test message" buttons in Settings > Notifications.
"""

from unittest.mock import patch

import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient


@pytest.mark.django_db
class TestTestSendViews:
    def test_slack_requires_admin(self):
        user = User.objects.create_user(username="regular", password="pw")
        client = APIClient()
        client.force_authenticate(user=user)

        response = client.post("/api/notifications/test-slack/")

        assert response.status_code == 403

    def test_teams_requires_admin(self):
        user = User.objects.create_user(username="regular", password="pw")
        client = APIClient()
        client.force_authenticate(user=user)

        response = client.post("/api/notifications/test-teams/")

        assert response.status_code == 403

    def test_slack_reports_success(self, monkeypatch):
        monkeypatch.setenv("SLACK_WEBHOOK_URL", "https://hooks.slack.example/xxx")
        admin = User.objects.create_user(username="admin", password="pw", is_staff=True)
        client = APIClient()
        client.force_authenticate(user=admin)

        with patch("board.extraction.notifications.urllib.request.urlopen"):
            response = client.post("/api/notifications/test-slack/")

        assert response.status_code == 200
        assert response.data == {"success": True}

    def test_slack_reports_failure_when_unconfigured(self, monkeypatch):
        monkeypatch.delenv("SLACK_WEBHOOK_URL", raising=False)
        admin = User.objects.create_user(username="admin", password="pw", is_staff=True)
        client = APIClient()
        client.force_authenticate(user=admin)

        response = client.post("/api/notifications/test-slack/")

        assert response.status_code == 200
        assert response.data == {"success": False}

    def test_teams_reports_success(self, monkeypatch):
        monkeypatch.setenv("TEAMS_WEBHOOK_URL", "https://example.webhook.office.com/xxx")
        admin = User.objects.create_user(username="admin", password="pw", is_staff=True)
        client = APIClient()
        client.force_authenticate(user=admin)

        with patch("board.extraction.teams_notifications.urllib.request.urlopen"):
            response = client.post("/api/notifications/test-teams/")

        assert response.status_code == 200
        assert response.data == {"success": True}

    def test_email_requires_admin(self):
        user = User.objects.create_user(username="regular", password="pw", email="regular@example.com")
        client = APIClient()
        client.force_authenticate(user=user)

        response = client.post("/api/notifications/test-email/")

        assert response.status_code == 403

    def test_email_sends_to_the_requesting_admins_own_address(self):
        admin = User.objects.create_user(username="admin", password="pw", is_staff=True, email="admin@example.com")
        client = APIClient()
        client.force_authenticate(user=admin)

        response = client.post("/api/notifications/test-email/")

        assert response.status_code == 200
        assert response.data == {"success": True, "sent_to": "admin@example.com"}

    def test_email_rejects_when_admin_has_no_email(self):
        admin = User.objects.create_user(username="admin", password="pw", is_staff=True, email="")
        client = APIClient()
        client.force_authenticate(user=admin)

        response = client.post("/api/notifications/test-email/")

        assert response.status_code == 400
