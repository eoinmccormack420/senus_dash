"""
Google Drive client for pulling source PDFs into the extraction
pipeline, authenticated via a service account — no per-user OAuth
login flow. The CEO/finance team just shares a Drive folder with the
service account's email address (Viewer access is enough).

Save as: board/extraction/drive_client.py

Setup required before this works (see project setup notes):
1. A Google Cloud project with the Drive API enabled
2. A service account with a downloaded JSON key, stored OUTSIDE the
   repo (never committed — see .gitignore)
3. GOOGLE_SERVICE_ACCOUNT_KEY_PATH in .env pointing at that key file
4. The target Drive folder shared with the service account's email

This module only ever lists and downloads files — it has no write
scope on Drive, so there's no risk of it modifying anything there.
"""

import os
import tempfile
from typing import List, Optional

from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload

# Read-only scope — matches the "Viewer access is enough" setup step.
SCOPES = ["https://www.googleapis.com/auth/drive.readonly"]

_service = None


def _get_service():
    """
    Lazily builds and caches the Drive API client, same singleton
    pattern as gemini_client._get_client(). Raises a clear error if
    the key path isn't configured, rather than a cryptic auth failure
    several calls downstream.
    """
    global _service
    if _service is None:
        key_path = os.environ.get("GOOGLE_SERVICE_ACCOUNT_KEY_PATH")
        if not key_path:
            raise RuntimeError(
                "GOOGLE_SERVICE_ACCOUNT_KEY_PATH not set. Add it to your "
                ".env pointing at the service account JSON key file."
            )
        if not os.path.exists(key_path):
            raise RuntimeError(f"No service account key file found at {key_path}")

        credentials = service_account.Credentials.from_service_account_file(
            key_path, scopes=SCOPES
        )
        _service = build("drive", "v3", credentials=credentials)
    return _service


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


def download_pdf(file_id: str, filename: Optional[str] = None) -> str:
    """
    Downloads a Drive file to a local temp file and returns its path,
    since extract_text_and_tables() (pdf_utils.py) expects a local
    file path, not a stream or Drive file ID.

    Caller is responsible for deleting the temp file once done with it
    (sync_drive_documents.py does this after each document finishes
    all four statement-kind extractions).
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
