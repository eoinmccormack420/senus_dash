"""
"Connect Gmail" for outbound notifications — lets an admin authorize
the Gmail API to send on their own Google account's behalf, instead of
typing SMTP host/username/password. This is a separate OAuth
authorization-code flow from the ID-token "Sign In With Google" flow
GoogleLoginView handles; it additionally requests the gmail.send scope
and needs GOOGLE_OAUTH_CLIENT_SECRET (unlike ID-token verification,
which needs only the client ID) to exchange the code for tokens.

Frontend side: google.accounts.oauth2.initCodeClient(...) (Google
Identity Services' "Code Client", loaded by the same <script> tag
LoginScreen.tsx already uses) requests scope="openid email
https://www.googleapis.com/auth/gmail.send" with ux_mode="popup",
which implies redirect_uri="postmessage" for the code exchange below —
see NotificationsSection.tsx.
"""

import json
import urllib.error
import urllib.parse
import urllib.request

from django.conf import settings
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token

GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send"
TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"


class GmailOAuthError(Exception):
    """Raised for any failure exchanging a code or reading the connected email — always caught and reported as a 400, never a 500."""


def exchange_code_for_tokens(code: str) -> dict:
    """
    Exchanges an authorization code (from the frontend's popup code
    client) for tokens. Returns the parsed JSON response, which
    includes "refresh_token" and "id_token" on success. Raises
    GmailOAuthError with a human-readable message on any failure.
    """
    if not settings.GOOGLE_OAUTH_CLIENT_ID or not settings.GOOGLE_OAUTH_CLIENT_SECRET:
        raise GmailOAuthError("Gmail connect is not configured on the server (missing OAuth client ID/secret).")

    body = urllib.parse.urlencode(
        {
            "code": code,
            "client_id": settings.GOOGLE_OAUTH_CLIENT_ID,
            "client_secret": settings.GOOGLE_OAUTH_CLIENT_SECRET,
            "redirect_uri": "postmessage",  # matches ux_mode: "popup" on the frontend
            "grant_type": "authorization_code",
        }
    ).encode("utf-8")
    request = urllib.request.Request(
        TOKEN_ENDPOINT, data=body, headers={"Content-Type": "application/x-www-form-urlencoded"}
    )

    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise GmailOAuthError(f"Google rejected the authorization code: {detail}") from exc
    except Exception as exc:  # noqa: BLE001
        raise GmailOAuthError(f"Couldn't reach Google's token endpoint: {exc}") from exc


def get_email_from_id_token(id_token_str: str) -> str:
    """Verifies the id_token and returns its email claim, reusing the same verification GoogleLoginView uses."""
    try:
        claims = google_id_token.verify_oauth2_token(
            id_token_str, google_requests.Request(), settings.GOOGLE_OAUTH_CLIENT_ID
        )
    except ValueError as exc:
        raise GmailOAuthError("Google returned an invalid identity token.") from exc

    email = claims.get("email")
    if not email:
        raise GmailOAuthError("Google's response didn't include an email address.")
    return email
