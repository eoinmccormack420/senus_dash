"""
Tests for ReportSpecViewSet: CRUD + permission gating (any authenticated
user can create/view/download; only admin can generate/approve tailored
narrative), and the generate_pdf/generate_deck actions' narrative-
fallback behavior. Mirrors test_ecosystem_checklist.py/test_advisory_goals.py
conventions. The actual Playwright/python-pptx calls are mocked at
board.views (patch-where-used) so these stay ViewSet-focused tests —
report_pdf.py's own internals are covered separately in test_report_pdf.py,
and report_deck.py's real output is covered in test_report_deck.py.
"""

from datetime import date
from decimal import Decimal
from unittest.mock import patch

import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient

from board.models import FinancialPeriod, ReportSpec


def make_period(label="TEST", **kwargs):
    defaults = dict(period_type="half_year", start_date=date(2025, 1, 1), end_date=date(2025, 6, 30))
    defaults.update(kwargs)
    return FinancialPeriod.objects.create(label=label, **defaults)


def make_spec(period, **kwargs):
    defaults = dict(audience_label="Series A Investors")
    defaults.update(kwargs)
    return ReportSpec.objects.create(period=period, **defaults)


@pytest.mark.django_db
class TestReportSpecCrud:
    def test_any_authenticated_user_can_create(self):
        period = make_period()
        user = User.objects.create_user(username="regular", password="pw")
        client = APIClient()
        client.force_authenticate(user=user)

        response = client.post(
            "/api/report-specs/",
            {"period": period.id, "audience_label": "Bank of Ireland", "context_note": "Loan renewal"},
            format="json",
        )

        assert response.status_code == 201
        assert response.data["audience_label"] == "Bank of Ireland"
        assert response.data["created_by_username"] == "regular"
        # all six sections default to included
        for field in ["include_revenue_growth", "include_profitability", "include_cash_liquidity",
                       "include_solvency_leverage", "include_returns", "include_outlook"]:
            assert response.data[field] is True

    def test_anonymous_user_cannot_create(self):
        period = make_period()
        client = APIClient()

        response = client.post("/api/report-specs/", {"period": period.id, "audience_label": "X"}, format="json")

        assert response.status_code == 401

    def test_can_toggle_sections(self):
        period = make_period()
        user = User.objects.create_user(username="regular", password="pw")
        client = APIClient()
        client.force_authenticate(user=user)

        response = client.post(
            "/api/report-specs/",
            {
                "period": period.id,
                "audience_label": "Board",
                "include_returns": False,
                "include_outlook": False,
            },
            format="json",
        )

        assert response.status_code == 201
        assert response.data["include_returns"] is False
        assert response.data["include_outlook"] is False
        assert response.data["include_revenue_growth"] is True


@pytest.mark.django_db
class TestNarrativePermissions:
    def test_generate_narrative_requires_admin(self):
        period = make_period()
        spec = make_spec(period)
        user = User.objects.create_user(username="regular", password="pw")
        client = APIClient()
        client.force_authenticate(user=user)

        response = client.post(f"/api/report-specs/{spec.id}/generate_narrative/")

        assert response.status_code == 403

    def test_approve_narrative_requires_admin(self):
        period = make_period()
        spec = make_spec(period)
        user = User.objects.create_user(username="regular", password="pw")
        client = APIClient()
        client.force_authenticate(user=user)

        response = client.post(f"/api/report-specs/{spec.id}/approve_narrative/")

        assert response.status_code == 403

    def test_approve_narrative_fails_without_generated_text(self):
        period = make_period()
        spec = make_spec(period)
        admin = User.objects.create_user(username="admin", password="pw", is_staff=True)
        client = APIClient()
        client.force_authenticate(user=admin)

        response = client.post(f"/api/report-specs/{spec.id}/approve_narrative/")

        assert response.status_code == 400

    def test_approve_narrative_succeeds_once_generated(self):
        period = make_period()
        spec = make_spec(period, tailored_narrative={"cover": "Hello."})
        admin = User.objects.create_user(username="admin", password="pw", is_staff=True)
        client = APIClient()
        client.force_authenticate(user=admin)

        response = client.post(f"/api/report-specs/{spec.id}/approve_narrative/")

        assert response.status_code == 200
        spec.refresh_from_db()
        assert spec.narrative_approved is True
        assert spec.narrative_approved_by == admin
        assert spec.narrative_approved_at is not None

    def test_generate_narrative_calls_pipeline_and_admin_gated(self):
        period = make_period()
        spec = make_spec(period)
        admin = User.objects.create_user(username="admin", password="pw", is_staff=True)
        client = APIClient()
        client.force_authenticate(user=admin)

        with patch("board.views.generate_narrative_for_spec", return_value={"status": "generated", "detail": "ok"}) as mock_gen:
            response = client.post(f"/api/report-specs/{spec.id}/generate_narrative/", {"force": True}, format="json")

        assert response.status_code == 200
        assert response.data == {"status": "generated", "detail": "ok"}
        mock_gen.assert_called_once_with(spec, force=True)


@pytest.mark.django_db
class TestGeneratePdfAndDeck:
    def test_generate_pdf_open_to_any_authenticated_user(self):
        period = make_period()
        spec = make_spec(period)
        user = User.objects.create_user(username="regular", password="pw")
        client = APIClient()
        client.force_authenticate(user=user)

        with patch("board.views.render_report_pdf", return_value=b"%PDF-fake") as mock_render:
            response = client.post(f"/api/report-specs/{spec.id}/generate_pdf/")

        assert response.status_code == 200
        assert response["Content-Type"] == "application/pdf"
        assert response["X-Narrative-Used"] == "standard"
        assert response.content == b"%PDF-fake"
        mock_render.assert_called_once()
        assert mock_render.call_args[0][0] == spec
        assert mock_render.call_args[0][1] == user

    def test_generate_pdf_uses_tailored_narrative_only_once_approved(self):
        period = make_period()
        spec = make_spec(period, use_tailored_narrative=True, tailored_narrative={"cover": "x"}, narrative_approved=False)
        user = User.objects.create_user(username="regular", password="pw")
        client = APIClient()
        client.force_authenticate(user=user)

        with patch("board.views.render_report_pdf", return_value=b"%PDF-fake"):
            response = client.post(f"/api/report-specs/{spec.id}/generate_pdf/")

        assert response["X-Narrative-Used"] == "standard"  # not yet approved -> falls back

        spec.narrative_approved = True
        spec.save()
        with patch("board.views.render_report_pdf", return_value=b"%PDF-fake"):
            response = client.post(f"/api/report-specs/{spec.id}/generate_pdf/")

        assert response["X-Narrative-Used"] == "tailored"

    def test_generate_deck_open_to_any_authenticated_user(self):
        period = make_period()
        spec = make_spec(period)
        user = User.objects.create_user(username="regular", password="pw")
        client = APIClient()
        client.force_authenticate(user=user)

        with patch("board.views.build_deck_bytes", return_value=b"fake-pptx-bytes") as mock_deck:
            response = client.post(f"/api/report-specs/{spec.id}/generate_deck/")

        assert response.status_code == 200
        assert response["Content-Type"] == "application/vnd.openxmlformats-officedocument.presentationml.presentation"
        assert response.content == b"fake-pptx-bytes"
        mock_deck.assert_called_once_with(spec)

    def test_generate_deck_requires_authentication(self):
        period = make_period()
        spec = make_spec(period)
        client = APIClient()

        response = client.post(f"/api/report-specs/{spec.id}/generate_deck/")

        assert response.status_code == 401
