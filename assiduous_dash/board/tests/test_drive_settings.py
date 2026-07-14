"""
Tests for the Google Drive settings panel: drive_sync.py's core sync
logic (list/dedupe/download/extract, mocked at the I/O boundary — same
convention as every other test file here, no real Drive/Gemini calls),
_run_and_record's status/summary persistence, and DriveSettingsView/
SyncDriveNowView's permission gating + guard clauses. The background
thread itself is never actually spawned in these tests — SyncDriveNowView
tests mock sync_drive_folder_in_background (patch-where-used), and
_run_and_record is exercised directly and synchronously.
"""

from datetime import date
from unittest.mock import MagicMock, patch

import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient

from board.extraction.drive_sync import _run_and_record, sync_drive_folder
from board.models import DriveSettings, ExtractionAttempt, FinancialPeriod


def make_period(label="TEST", **kwargs):
    defaults = dict(period_type="half_year", start_date=date(2025, 1, 1), end_date=date(2025, 6, 30))
    defaults.update(kwargs)
    return FinancialPeriod.objects.create(label=label, **defaults)


def mock_attempt(statement_kind, status="cross_check_pass", match_rate_pct=100.0, error_message=""):
    attempt = MagicMock()
    attempt.statement_kind = statement_kind
    attempt.status = status
    attempt.match_rate_pct = match_rate_pct
    attempt.error_message = error_message
    return attempt


@pytest.mark.django_db
class TestSyncDriveFolder:
    def test_processes_new_files_and_skips_already_processed(self, monkeypatch):
        period = make_period()
        ExtractionAttempt.objects.create(
            period=period, statement_kind="pl_statement", source_document="drive://old_id/old.pdf",
            status="cross_check_pass",
        )
        monkeypatch.setattr(
            "board.extraction.drive_sync.list_pdfs_in_folder",
            lambda folder_id: [
                {"id": "old_id", "name": "old.pdf"},
                {"id": "new_id", "name": "new.pdf"},
            ],
        )
        monkeypatch.setattr("board.extraction.drive_sync.download_pdf", lambda file_id, filename=None: "/tmp/fake.pdf")
        monkeypatch.setattr(
            "board.extraction.drive_sync.run_extraction",
            lambda kind, period, path: mock_attempt(kind),
        )
        monkeypatch.setattr("board.extraction.drive_sync.time.sleep", lambda _: None)

        result = sync_drive_folder("folder123", period)

        assert result["skipped"] == 1
        assert result["processed"] == 1
        assert result["errors"] == []

    def test_download_failure_is_recorded_and_does_not_stop_the_run(self, monkeypatch):
        period = make_period()
        monkeypatch.setattr(
            "board.extraction.drive_sync.list_pdfs_in_folder",
            lambda folder_id: [{"id": "bad_id", "name": "bad.pdf"}, {"id": "good_id", "name": "good.pdf"}],
        )

        def fake_download(file_id, filename=None):
            if file_id == "bad_id":
                raise OSError("network error")
            return "/tmp/fake.pdf"

        monkeypatch.setattr("board.extraction.drive_sync.download_pdf", fake_download)
        monkeypatch.setattr(
            "board.extraction.drive_sync.run_extraction",
            lambda kind, period, path: mock_attempt(kind),
        )
        monkeypatch.setattr("board.extraction.drive_sync.time.sleep", lambda _: None)

        result = sync_drive_folder("folder123", period)

        assert result["processed"] == 1
        assert len(result["errors"]) == 1
        assert "bad.pdf" in result["errors"][0]

    def test_extraction_failure_status_is_recorded_as_an_error(self, monkeypatch):
        period = make_period()
        monkeypatch.setattr(
            "board.extraction.drive_sync.list_pdfs_in_folder",
            lambda folder_id: [{"id": "id1", "name": "doc.pdf"}],
        )
        monkeypatch.setattr("board.extraction.drive_sync.download_pdf", lambda file_id, filename=None: "/tmp/fake.pdf")
        monkeypatch.setattr(
            "board.extraction.drive_sync.run_extraction",
            lambda kind, period, path: mock_attempt(kind, status="api_error", error_message="Gemini timed out"),
        )
        monkeypatch.setattr("board.extraction.drive_sync.time.sleep", lambda _: None)

        result = sync_drive_folder("folder123", period)

        assert result["processed"] == 1
        assert len(result["errors"]) == 4  # one per SCHEMA_REGISTRY kind
        assert "api_error" in result["errors"][0]

    def test_on_progress_callback_receives_updates(self, monkeypatch):
        period = make_period()
        monkeypatch.setattr(
            "board.extraction.drive_sync.list_pdfs_in_folder",
            lambda folder_id: [{"id": "id1", "name": "doc.pdf"}],
        )
        monkeypatch.setattr("board.extraction.drive_sync.download_pdf", lambda file_id, filename=None: "/tmp/fake.pdf")
        monkeypatch.setattr(
            "board.extraction.drive_sync.run_extraction",
            lambda kind, period, path: mock_attempt(kind),
        )
        monkeypatch.setattr("board.extraction.drive_sync.time.sleep", lambda _: None)
        messages = []

        sync_drive_folder("folder123", period, on_progress=messages.append)

        assert any("Found 1 PDF" in m for m in messages)
        assert any("Downloading doc.pdf" in m for m in messages)


@pytest.mark.django_db
class TestRunAndRecord:
    def test_success_updates_settings(self, monkeypatch):
        period = make_period()
        monkeypatch.setattr(
            "board.extraction.drive_sync.sync_drive_folder",
            lambda folder_id, period: {"processed": 2, "skipped": 1, "errors": []},
        )
        monkeypatch.setattr("board.extraction.drive_sync.connections.close_all", lambda: None)

        _run_and_record("folder123", period.id)

        settings_row = DriveSettings.get_solo()
        assert settings_row.last_sync_status == "success"
        assert "2 processed" in settings_row.last_sync_summary
        assert settings_row.last_synced_at is not None

    def test_all_failed_marks_error_status(self, monkeypatch):
        period = make_period()
        monkeypatch.setattr(
            "board.extraction.drive_sync.sync_drive_folder",
            lambda folder_id, period: {"processed": 0, "skipped": 0, "errors": ["doc.pdf: failed"]},
        )
        monkeypatch.setattr("board.extraction.drive_sync.connections.close_all", lambda: None)

        _run_and_record("folder123", period.id)

        assert DriveSettings.get_solo().last_sync_status == "error"

    def test_exception_is_caught_and_recorded(self, monkeypatch):
        period = make_period()

        def raise_error(folder_id, period):
            raise RuntimeError("auth failed")

        monkeypatch.setattr("board.extraction.drive_sync.sync_drive_folder", raise_error)
        monkeypatch.setattr("board.extraction.drive_sync.connections.close_all", lambda: None)

        _run_and_record("folder123", period.id)

        settings_row = DriveSettings.get_solo()
        assert settings_row.last_sync_status == "error"
        assert "auth failed" in settings_row.last_sync_summary


@pytest.mark.django_db
class TestDriveSettingsView:
    def test_get_requires_admin(self):
        user = User.objects.create_user(username="regular", password="pw")
        client = APIClient()
        client.force_authenticate(user=user)

        response = client.get("/api/drive/settings/")

        assert response.status_code == 403

    def test_admin_can_get_and_patch(self):
        admin = User.objects.create_user(username="admin", password="pw", is_staff=True)
        client = APIClient()
        client.force_authenticate(user=admin)

        get_response = client.get("/api/drive/settings/")
        assert get_response.status_code == 200
        assert get_response.data["folder_id"] == ""

        patch_response = client.patch("/api/drive/settings/", {"folder_id": "abc123"}, format="json")
        assert patch_response.status_code == 200
        assert patch_response.data["folder_id"] == "abc123"
        assert DriveSettings.get_solo().folder_id == "abc123"


@pytest.mark.django_db
class TestSyncDriveNowView:
    def test_requires_admin(self):
        user = User.objects.create_user(username="regular", password="pw")
        client = APIClient()
        client.force_authenticate(user=user)

        response = client.post("/api/drive/sync/", {"period": "HY2026"}, format="json")

        assert response.status_code == 403

    def test_requires_folder_id_to_be_set(self):
        make_period(label="HY2026")
        admin = User.objects.create_user(username="admin", password="pw", is_staff=True)
        client = APIClient()
        client.force_authenticate(user=admin)

        response = client.post("/api/drive/sync/", {"period": "HY2026"}, format="json")

        assert response.status_code == 400

    def test_rejects_unknown_period(self):
        DriveSettings.objects.create(pk=1, folder_id="abc123")
        admin = User.objects.create_user(username="admin", password="pw", is_staff=True)
        client = APIClient()
        client.force_authenticate(user=admin)

        response = client.post("/api/drive/sync/", {"period": "NOPE"}, format="json")

        assert response.status_code == 400

    def test_rejects_when_already_running(self):
        make_period(label="HY2026")
        DriveSettings.objects.create(pk=1, folder_id="abc123", last_sync_status="running")
        admin = User.objects.create_user(username="admin", password="pw", is_staff=True)
        client = APIClient()
        client.force_authenticate(user=admin)

        response = client.post("/api/drive/sync/", {"period": "HY2026"}, format="json")

        assert response.status_code == 400

    def test_allows_retry_when_running_status_is_stale(self):
        """
        Regression test: a background thread can be killed outright
        (e.g. the dev server's autoreload restarting mid-sync) with no
        chance to update last_sync_status away from "running" — without
        this staleness check, that permanently blocks every future sync.
        """
        from datetime import timedelta

        from django.utils import timezone

        make_period(label="HY2026")
        DriveSettings.objects.create(pk=1, folder_id="abc123", last_sync_status="running")
        # auto_now only applies via .save(), so .update() lets us backdate
        # it directly to simulate a stale/abandoned "running" row.
        DriveSettings.objects.filter(pk=1).update(updated_at=timezone.now() - timedelta(minutes=30))
        admin = User.objects.create_user(username="admin", password="pw", is_staff=True)
        client = APIClient()
        client.force_authenticate(user=admin)

        with patch("board.views.sync_drive_folder_in_background") as mock_bg:
            response = client.post("/api/drive/sync/", {"period": "HY2026"}, format="json")

        assert response.status_code == 200
        mock_bg.assert_called_once()

    def test_starts_sync_and_returns_immediately(self):
        period = make_period(label="HY2026")
        DriveSettings.objects.create(pk=1, folder_id="abc123")
        admin = User.objects.create_user(username="admin", password="pw", is_staff=True)
        client = APIClient()
        client.force_authenticate(user=admin)

        with patch("board.views.sync_drive_folder_in_background") as mock_bg:
            response = client.post("/api/drive/sync/", {"period": "HY2026"}, format="json")

        assert response.status_code == 200
        assert response.data == {"status": "started"}
        mock_bg.assert_called_once_with("abc123", period.id)


@pytest.mark.django_db
class TestConnectDriveView:
    def test_requires_admin(self):
        user = User.objects.create_user(username="regular", password="pw")
        client = APIClient()
        client.force_authenticate(user=user)

        response = client.post("/api/drive/connect/", {"code": "x"}, format="json")

        assert response.status_code == 403

    def test_requires_code(self):
        admin = User.objects.create_user(username="admin", password="pw", is_staff=True)
        client = APIClient()
        client.force_authenticate(user=admin)

        response = client.post("/api/drive/connect/", {}, format="json")

        assert response.status_code == 400

    def test_stores_refresh_token_and_email_on_success(self):
        admin = User.objects.create_user(username="admin", password="pw", is_staff=True)
        client = APIClient()
        client.force_authenticate(user=admin)

        with patch(
            "board.views.exchange_code_for_tokens",
            return_value={"refresh_token": "r-token-abc", "id_token": "fake-id-token"},
        ), patch("board.views.get_email_from_id_token", return_value="admin@gmail.com"):
            response = client.post("/api/drive/connect/", {"code": "auth-code"}, format="json")

        assert response.status_code == 200
        assert response.data["connected_email"] == "admin@gmail.com"
        assert "r-token-abc" not in str(response.content)  # refresh token never echoed

        stored = DriveSettings.get_solo()
        assert stored.refresh_token == "r-token-abc"
        assert stored.connected_email == "admin@gmail.com"

    def test_reports_error_when_no_refresh_token_returned(self):
        admin = User.objects.create_user(username="admin", password="pw", is_staff=True)
        client = APIClient()
        client.force_authenticate(user=admin)

        with patch("board.views.exchange_code_for_tokens", return_value={"id_token": "fake-id-token"}):
            response = client.post("/api/drive/connect/", {"code": "auth-code"}, format="json")

        assert response.status_code == 400
        assert DriveSettings.get_solo().refresh_token == ""

    def test_reports_oauth_error_as_400(self):
        from board.extraction.gmail_oauth import GmailOAuthError

        admin = User.objects.create_user(username="admin", password="pw", is_staff=True)
        client = APIClient()
        client.force_authenticate(user=admin)

        with patch("board.views.exchange_code_for_tokens", side_effect=GmailOAuthError("boom")):
            response = client.post("/api/drive/connect/", {"code": "auth-code"}, format="json")

        assert response.status_code == 400
        assert response.data["detail"] == "boom"


@pytest.mark.django_db
class TestDisconnectDriveView:
    def test_requires_admin(self):
        user = User.objects.create_user(username="regular", password="pw")
        client = APIClient()
        client.force_authenticate(user=user)

        response = client.post("/api/drive/disconnect/")

        assert response.status_code == 403

    def test_clears_credentials_but_keeps_folder_id(self):
        DriveSettings.objects.create(
            pk=1, folder_id="abc123", refresh_token="r-token", connected_email="admin@gmail.com"
        )
        admin = User.objects.create_user(username="admin", password="pw", is_staff=True)
        client = APIClient()
        client.force_authenticate(user=admin)

        response = client.post("/api/drive/disconnect/")

        assert response.status_code == 200
        stored = DriveSettings.get_solo()
        assert stored.refresh_token == ""
        assert stored.connected_email == ""
        assert stored.folder_id == "abc123"


@pytest.mark.django_db
class TestDriveFoldersView:
    def test_requires_admin(self):
        user = User.objects.create_user(username="regular", password="pw")
        client = APIClient()
        client.force_authenticate(user=user)

        response = client.get("/api/drive/folders/")

        assert response.status_code == 403

    def test_lists_subfolders_of_the_given_parent(self):
        admin = User.objects.create_user(username="admin", password="pw", is_staff=True)
        client = APIClient()
        client.force_authenticate(user=admin)

        with patch(
            "board.views.drive_client.list_subfolders",
            return_value=[{"id": "f1", "name": "2026 Reports"}],
        ), patch("board.views.drive_client.get_folder_name", return_value="My Drive"):
            response = client.get("/api/drive/folders/")

        assert response.status_code == 200
        assert response.data["parent_id"] == "root"
        assert response.data["parent_name"] == "My Drive"
        assert response.data["folders"] == [{"id": "f1", "name": "2026 Reports"}]

    def test_auth_failure_reported_as_400_not_500(self):
        admin = User.objects.create_user(username="admin", password="pw", is_staff=True)
        client = APIClient()
        client.force_authenticate(user=admin)

        with patch("board.views.drive_client.list_subfolders", side_effect=RuntimeError("not connected")):
            response = client.get("/api/drive/folders/")

        assert response.status_code == 400
        assert response.data["detail"] == "not connected"


@pytest.mark.django_db
class TestGetServiceAuthPath:
    def test_prefers_oauth_when_refresh_token_set(self, monkeypatch):
        DriveSettings.objects.create(pk=1, refresh_token="r-token")
        mock_creds = MagicMock()
        mock_build = MagicMock(return_value="drive-service")
        monkeypatch.setattr("board.extraction.drive_client.Credentials", MagicMock(return_value=mock_creds))
        monkeypatch.setattr("board.extraction.drive_client.build", mock_build)

        from board.extraction.drive_client import _get_service

        service = _get_service()

        mock_creds.refresh.assert_called_once()
        mock_build.assert_called_once_with("drive", "v3", credentials=mock_creds)
        assert service == "drive-service"

    def test_falls_back_to_service_account_when_no_refresh_token(self, monkeypatch):
        DriveSettings.objects.create(pk=1, refresh_token="")
        monkeypatch.setenv("GOOGLE_SERVICE_ACCOUNT_KEY_PATH", "/fake/path.json")
        monkeypatch.setattr("board.extraction.drive_client.os.path.exists", lambda path: True)
        mock_build = MagicMock(return_value="drive-service")
        monkeypatch.setattr("board.extraction.drive_client.build", mock_build)
        monkeypatch.setattr(
            "board.extraction.drive_client.service_account.Credentials.from_service_account_file",
            MagicMock(return_value="fake-creds"),
        )

        from board.extraction.drive_client import _get_service

        service = _get_service()

        mock_build.assert_called_once_with("drive", "v3", credentials="fake-creds")
        assert service == "drive-service"

    def test_raises_clear_error_when_neither_is_configured(self, monkeypatch):
        DriveSettings.objects.create(pk=1, refresh_token="")
        monkeypatch.delenv("GOOGLE_SERVICE_ACCOUNT_KEY_PATH", raising=False)

        from board.extraction.drive_client import _get_service

        with pytest.raises(RuntimeError, match="isn't connected"):
            _get_service()
