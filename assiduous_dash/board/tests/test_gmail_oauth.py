"""
Tests for the Gmail "Connect" OAuth code-exchange helpers (see
board/extraction/gmail_oauth.py). These never touch the network for
real — Google's token endpoint and id_token verification are mocked.
"""

import json
from unittest.mock import MagicMock, patch

import pytest

from board.extraction.gmail_oauth import (
    GmailOAuthError,
    exchange_code_for_tokens,
    get_email_from_id_token,
)


@pytest.fixture(autouse=True)
def _configured_oauth_client(settings):
    settings.GOOGLE_OAUTH_CLIENT_ID = "test-client-id"
    settings.GOOGLE_OAUTH_CLIENT_SECRET = "test-client-secret"


class TestExchangeCodeForTokens:
    def test_raises_when_client_secret_not_configured(self, settings):
        settings.GOOGLE_OAUTH_CLIENT_SECRET = ""
        with pytest.raises(GmailOAuthError, match="not configured"):
            exchange_code_for_tokens("some-code")

    def test_returns_parsed_json_on_success(self):
        fake_response = MagicMock()
        fake_response.read.return_value = json.dumps(
            {"access_token": "a", "refresh_token": "r", "id_token": "i"}
        ).encode("utf-8")
        fake_response.__enter__.return_value = fake_response

        with patch("board.extraction.gmail_oauth.urllib.request.urlopen", return_value=fake_response) as urlopen:
            result = exchange_code_for_tokens("auth-code-123")

        assert result == {"access_token": "a", "refresh_token": "r", "id_token": "i"}
        request = urlopen.call_args[0][0]
        assert request.full_url == "https://oauth2.googleapis.com/token"
        body = request.data.decode("utf-8")
        assert "code=auth-code-123" in body
        assert "redirect_uri=postmessage" in body
        assert "grant_type=authorization_code" in body

    def test_raises_gmail_oauth_error_on_http_error(self):
        import urllib.error

        http_error = urllib.error.HTTPError(
            url="https://oauth2.googleapis.com/token", code=400, msg="Bad Request", hdrs=None, fp=None
        )
        http_error.read = lambda: b'{"error": "invalid_grant"}'

        with patch("board.extraction.gmail_oauth.urllib.request.urlopen", side_effect=http_error):
            with pytest.raises(GmailOAuthError, match="invalid_grant"):
                exchange_code_for_tokens("bad-code")

    def test_raises_gmail_oauth_error_on_network_failure(self):
        with patch("board.extraction.gmail_oauth.urllib.request.urlopen", side_effect=OSError("network unreachable")):
            with pytest.raises(GmailOAuthError, match="Couldn't reach"):
                exchange_code_for_tokens("some-code")


class TestGetEmailFromIdToken:
    def test_returns_email_claim(self):
        with patch(
            "board.extraction.gmail_oauth.google_id_token.verify_oauth2_token",
            return_value={"email": "admin@example.com", "email_verified": True},
        ):
            assert get_email_from_id_token("fake-id-token") == "admin@example.com"

    def test_raises_on_invalid_token(self):
        with patch(
            "board.extraction.gmail_oauth.google_id_token.verify_oauth2_token",
            side_effect=ValueError("invalid token"),
        ):
            with pytest.raises(GmailOAuthError, match="invalid identity token"):
                get_email_from_id_token("garbage")

    def test_raises_when_no_email_claim(self):
        with patch(
            "board.extraction.gmail_oauth.google_id_token.verify_oauth2_token",
            return_value={"sub": "12345"},
        ):
            with pytest.raises(GmailOAuthError, match="didn't include an email"):
                get_email_from_id_token("fake-id-token")
