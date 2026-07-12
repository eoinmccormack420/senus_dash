"""
Tests for POST /api/notifications/connect-gmail/ and /disconnect-gmail/
— the "Connect Gmail" flow in Settings > Notifications. The actual
Google token exchange / id_token verification is mocked; these tests
cover the view's own logic (persistence, error handling, permissions).
"""

from unittest.mock import patch

import pytest
from django.contrib.auth.models import User
from django.test import override_settings
from rest_framework.test import APIClient

from board.extraction.gmail_oauth import GmailOAuthError
from board.models import NotificationSettings


@pytest.mark.django_db
class TestConnectGmailView:
    def test_requires_admin(self):
        user = User.objects.create_user(username="regular", password="pw")
        client = APIClient()
        client.force_authenticate(user=user)

        response = client.post("/api/notifications/connect-gmail/", {"code": "x"}, format="json")

        assert response.status_code == 403

    def test_requires_code(self):
        admin = User.objects.create_user(username="admin", password="pw", is_staff=True)
        client = APIClient()
        client.force_authenticate(user=admin)

        response = client.post("/api/notifications/connect-gmail/", {}, format="json")

        assert response.status_code == 400

    def test_stores_refresh_token_and_email_on_success(self):
        admin = User.objects.create_user(username="admin", password="pw", is_staff=True)
        client = APIClient()
        client.force_authenticate(user=admin)

        with patch(
            "board.views.exchange_code_for_tokens",
            return_value={"refresh_token": "r-token-abc", "id_token": "fake-id-token"},
        ), patch("board.views.get_email_from_id_token", return_value="admin@gmail.com"):
            response = client.post("/api/notifications/connect-gmail/", {"code": "auth-code"}, format="json")

        assert response.status_code == 200
        assert response.data["gmail_connected_email"] == "admin@gmail.com"
        assert response.data["email"] is True
        assert "r-token-abc" not in str(response.content)  # refresh token never echoed

        stored = NotificationSettings.get_solo()
        assert stored.gmail_refresh_token == "r-token-abc"
        assert stored.gmail_connected_email == "admin@gmail.com"

    def test_reports_error_when_no_refresh_token_returned(self):
        admin = User.objects.create_user(username="admin", password="pw", is_staff=True)
        client = APIClient()
        client.force_authenticate(user=admin)

        with patch("board.views.exchange_code_for_tokens", return_value={"id_token": "fake-id-token"}):
            response = client.post("/api/notifications/connect-gmail/", {"code": "auth-code"}, format="json")

        assert response.status_code == 400
        assert NotificationSettings.get_solo().gmail_refresh_token == ""

    def test_reports_gmail_oauth_error_as_400(self):
        admin = User.objects.create_user(username="admin", password="pw", is_staff=True)
        client = APIClient()
        client.force_authenticate(user=admin)

        with patch("board.views.exchange_code_for_tokens", side_effect=GmailOAuthError("boom")):
            response = client.post("/api/notifications/connect-gmail/", {"code": "auth-code"}, format="json")

        assert response.status_code == 400
        assert response.data["detail"] == "boom"


@pytest.mark.django_db
class TestDisconnectGmailView:
    def test_requires_admin(self):
        user = User.objects.create_user(username="regular", password="pw")
        client = APIClient()
        client.force_authenticate(user=user)

        response = client.post("/api/notifications/disconnect-gmail/")

        assert response.status_code == 403

    @override_settings(EMAIL_BACKEND="django.core.mail.backends.console.EmailBackend")
    def test_clears_connection(self):
        NotificationSettings.objects.create(pk=1, gmail_refresh_token="r-token", gmail_connected_email="admin@gmail.com")
        admin = User.objects.create_user(username="admin", password="pw", is_staff=True)
        client = APIClient()
        client.force_authenticate(user=admin)

        response = client.post("/api/notifications/disconnect-gmail/")

        assert response.status_code == 200
        assert response.data["gmail_connected_email"] == ""
        assert response.data["email"] is False
        stored = NotificationSettings.get_solo()
        assert stored.gmail_refresh_token == ""
        assert stored.gmail_connected_email == ""
