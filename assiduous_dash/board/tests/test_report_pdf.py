"""
Tests for report_pdf.py's render_report_pdf: mocks playwright.sync_api's
sync_playwright entirely (no real browser spun up in the suite) to
verify the URL built, that the requesting user's own token is seeded
into localStorage under the same key the frontend reads, the readiness
selector waited on, and the page.pdf() call's format/margin args.
Real PDF output is verified manually (see the plan's Verification
section) rather than in CI, since that needs an actual browser.
"""

from datetime import date
from unittest.mock import MagicMock

import pytest
from django.contrib.auth.models import User
from rest_framework.authtoken.models import Token

from board.extraction.report_pdf import PDF_MARGIN, TOKEN_LOCALSTORAGE_KEY, render_report_pdf
from board.models import FinancialPeriod, ReportSpec


def make_period(label="TEST", **kwargs):
    defaults = dict(period_type="half_year", start_date=date(2025, 1, 1), end_date=date(2025, 6, 30))
    defaults.update(kwargs)
    return FinancialPeriod.objects.create(label=label, **defaults)


def make_spec(period, **kwargs):
    defaults = dict(audience_label="Series A Investors")
    defaults.update(kwargs)
    return ReportSpec.objects.create(period=period, **defaults)


def mock_playwright_chain(monkeypatch, pdf_bytes=b"%PDF-fake", wait_for_selector_side_effect=None):
    mock_page = MagicMock()
    mock_page.pdf.return_value = pdf_bytes
    if wait_for_selector_side_effect is not None:
        mock_page.wait_for_selector.side_effect = wait_for_selector_side_effect
    mock_context = MagicMock()
    mock_context.new_page.return_value = mock_page
    mock_browser = MagicMock()
    mock_browser.new_context.return_value = mock_context
    mock_p = MagicMock()
    mock_p.chromium.launch.return_value = mock_browser
    mock_cm = MagicMock()
    mock_cm.__enter__.return_value = mock_p
    monkeypatch.setattr("board.extraction.report_pdf.sync_playwright", MagicMock(return_value=mock_cm))
    return mock_page, mock_context, mock_browser


@pytest.mark.django_db
class TestRenderReportPdf:
    def test_navigates_to_correct_url_seeds_token_and_returns_pdf_bytes(self, monkeypatch):
        period = make_period()
        spec = make_spec(period)
        user = User.objects.create_user(username="admin", password="pw")
        mock_page, mock_context, _ = mock_playwright_chain(monkeypatch)

        result = render_report_pdf(spec, user, "http://testserver/")

        assert result == b"%PDF-fake"
        mock_page.goto.assert_called_once_with(
            f"http://testserver/print/report/{spec.id}", wait_until="domcontentloaded"
        )
        mock_page.wait_for_selector.assert_called_once()
        assert mock_page.wait_for_selector.call_args[0][0] == '[data-report-ready="true"]'
        mock_page.pdf.assert_called_once_with(format="A4", print_background=True, margin=PDF_MARGIN)

        token = Token.objects.get(user=user)
        init_script = mock_context.add_init_script.call_args[0][0]
        assert TOKEN_LOCALSTORAGE_KEY in init_script
        assert token.key in init_script

    def test_strips_trailing_slash_from_base_url(self, monkeypatch):
        period = make_period()
        spec = make_spec(period)
        user = User.objects.create_user(username="admin2", password="pw")
        mock_page, _, _ = mock_playwright_chain(monkeypatch)

        render_report_pdf(spec, user, "http://testserver")

        mock_page.goto.assert_called_once_with(
            f"http://testserver/print/report/{spec.id}", wait_until="domcontentloaded"
        )

    def test_closes_browser_even_when_rendering_fails(self, monkeypatch):
        period = make_period()
        spec = make_spec(period)
        user = User.objects.create_user(username="admin3", password="pw")
        _, _, mock_browser = mock_playwright_chain(monkeypatch, wait_for_selector_side_effect=TimeoutError("no selector"))

        with pytest.raises(TimeoutError):
            render_report_pdf(spec, user, "http://testserver/")

        mock_browser.close.assert_called_once()

    def test_reuses_existing_token_rather_than_minting_a_new_one(self, monkeypatch):
        period = make_period()
        spec = make_spec(period)
        user = User.objects.create_user(username="admin4", password="pw")
        existing_token = Token.objects.create(user=user)
        mock_playwright_chain(monkeypatch)

        render_report_pdf(spec, user, "http://testserver/")

        assert Token.objects.filter(user=user).count() == 1
        assert Token.objects.get(user=user).key == existing_token.key
