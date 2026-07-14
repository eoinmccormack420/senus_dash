"""
Google Drive client for pulling source PDFs into the extraction
pipeline.

Save as: board/extraction/drive_client.py

Two auth paths, OAuth preferred:
1. "Connect Google Drive" (Settings > Google Drive) — the same
   authorization-code OAuth flow as "Connect Gmail"
   (board/extraction/gmail_oauth.py, ConnectDriveView in views.py):
   an admin signs in with their own Google account once, and
   DriveSettings.refresh_token is used to build credentials the same
   way email_notifications.py's _send_via_gmail_api builds Gmail API
   credentials from NotificationSettings.gmail_refresh_token.
2. A service account (the original setup) — no per-user login, the
   target Drive folder is shared with the service account's own email
   address instead. Kept as a fallback for env-var-only deployments,
   same role SMTP settings play as a fallback under Gmail-via-API.

This module only ever lists and downloads files — it has no write
scope on Drive, so there's no risk of it modifying anything there.
"""

import os
import tempfile
from typing import List, Optional

from django.conf import settings as django_settings
from google.auth.transport.requests import Request as GoogleAuthRequest
from google.oauth2 import service_account
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload

# Read-only scope — matches the "Viewer access is enough" setup step
# for the service-account fallback, and the scope requested by the
# "Connect Google Drive" OAuth popup.
SCOPES = ["https://www.googleapis.com/auth/drive.readonly"]


def _get_service():
    """
    Builds the Drive API client, OAuth first. Rebuilt fresh on every
    call rather than cached — unlike the service-account path (fixed
    for the process lifetime, set via env var), OAuth settings can
    change at runtime (connect/reconnect/disconnect), and building
    Credentials is cheap (only .refresh()/actual API calls touch the
    network), so there's no real cost to not caching.
    """
    from board.models import DriveSettings  # local import: models importing extraction would be circular

    drive_settings = DriveSettings.get_solo()
    if drive_settings.refresh_token:
        creds = Credentials(
            token=None,
            refresh_token=drive_settings.refresh_token,
            token_uri="https://oauth2.googleapis.com/token",
            client_id=django_settings.GOOGLE_OAUTH_CLIENT_ID,
            client_secret=django_settings.GOOGLE_OAUTH_CLIENT_SECRET,
        )
        creds.refresh(GoogleAuthRequest())
        return build("drive", "v3", credentials=creds)

    key_path = os.environ.get("GOOGLE_SERVICE_ACCOUNT_KEY_PATH")
    if not key_path:
        raise RuntimeError(
            "Drive isn't connected and GOOGLE_SERVICE_ACCOUNT_KEY_PATH isn't set. "
            "Connect Google Drive from Settings, or add that env var pointing at "
            "a service account JSON key file."
        )
    if not os.path.exists(key_path):
        raise RuntimeError(f"No service account key file found at {key_path}")

    credentials = service_account.Credentials.from_service_account_file(key_path, scopes=SCOPES)
    return build("drive", "v3", credentials=credentials)


def list_pdfs_in_folder(folder_id: str) -> List[dict]:
    """
    Returns [{"id": ..., "name": ...}, ...] for every PDF directly
    inside the given Drive folder (not recursive into subfolders).
    Trashed files are excluded by the query. Paginates automatically —
    Drive's API caps each response at 100 files by default.
    """
    service = _get_service()
    # Escape single quotes in the folder ID for the Drive query syntax,
    # same convention Google's own docs use.
    safe_folder_id = folder_id.replace("'", "\\'")
    query = f"'{safe_folder_id}' in parents and mimeType='application/pdf' and trashed=false"

    files = []
    page_token = None
    while True:
        response = (
            service.files()
            .list(q=query, fields="nextPageToken, files(id, name)", pageToken=page_token)
            .execute()
        )
        files.extend(response.get("files", []))
        page_token = response.get("nextPageToken")
        if not page_token:
            break

    return files


def list_subfolders(parent_id: str = "root") -> List[dict]:
    """
    Returns [{"id": ..., "name": ...}, ...] for every subfolder directly
    inside `parent_id` ("root" for My Drive's top level) — used by the
    Settings > Google Drive folder picker. Same pagination shape as
    list_pdfs_in_folder, filtered to folders instead of PDFs.
    """
    service = _get_service()
    safe_parent_id = parent_id.replace("'", "\\'")
    query = (
        f"'{safe_parent_id}' in parents and "
        "mimeType='application/vnd.google-apps.folder' and trashed=false"
    )

    folders = []
    page_token = None
    while True:
        response = (
            service.files()
            .list(q=query, fields="nextPageToken, files(id, name)", pageToken=page_token, orderBy="name")
            .execute()
        )
        folders.extend(response.get("files", []))
        page_token = response.get("nextPageToken")
        if not page_token:
            break

    return folders


def get_folder_name(folder_id: str) -> str:
    """Display name for a folder ID — "My Drive" for the root, else a live lookup."""
    if folder_id == "root":
        return "My Drive"
    service = _get_service()
    return service.files().get(fileId=folder_id, fields="name").execute()["name"]


def download_pdf(file_id: str, filename: Optional[str] = None) -> str:
    """
    Downloads a Drive file to a local temp file and returns its path,
    since extract_text_and_tables() (pdf_utils.py) expects a local
    file path, not a stream or Drive file ID.

    Caller is responsible for deleting the temp file once done with it
    (drive_sync.py does this after each document finishes all four
    statement-kind extractions).
    """
    service = _get_service()
    request = service.files().get_media(fileId=file_id)

    # Fold the Drive filename into the temp file's suffix (sanitized —
    # Drive filenames can contain characters that aren't safe in a
    # local path) purely so it's recognizable if you're poking around
    # the temp directory mid-debug; it has no effect on extraction.
    safe_name = "".join(c for c in (filename or "") if c.isalnum() or c in "-_.")
    suffix = f"_{safe_name}.pdf" if safe_name else ".pdf"

    fd, temp_path = tempfile.mkstemp(suffix=suffix, prefix="drive_")
    os.close(fd)  # MediaIoBaseDownload opens its own handle on the path

    with open(temp_path, "wb") as f:
        downloader = MediaIoBaseDownload(f, request)
        done = False
        while not done:
            _status, done = downloader.next_chunk()

    return temp_path
