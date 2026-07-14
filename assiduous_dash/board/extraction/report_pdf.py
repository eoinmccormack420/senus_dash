"""
Server-side PDF rendering for a ReportSpec via headless Chromium.

Save as: board/extraction/report_pdf.py

Reuses the print-optimized layout already built for the old "Download
Board Pack" (tokens.css's @page/@media print rules, PrintReportPage.tsx)
rather than a separate PDF-templating system — Playwright's page.pdf()
drives a real Chromium print pipeline, so it renders the exact same
React output (including live Recharts/SVG charts) a person sees on
screen, not a reimplementation of it.

Auth: seeds the headless browser's localStorage with the REQUESTING
USER'S OWN token before navigating, rather than inventing a new auth
path — whoever triggered PDF generation already has a valid DRF token,
and /print/report/<id> is a normal authenticated route like any other.
"""

import json

from playwright.sync_api import sync_playwright
from rest_framework.authtoken.models import Token

# Matches api/client.ts's TOKEN_KEY — the key the frontend itself reads
# on every page load to decide whether it's authenticated.
TOKEN_LOCALSTORAGE_KEY = "senus_board_token"
REPORT_READY_SELECTOR = '[data-report-ready="true"]'

# Mirrors the @page rule in tokens.css so the server-rendered PDF
# matches what a person would get from window.print() in the browser.
PDF_MARGIN = {"top": "18mm", "bottom": "18mm", "left": "16mm", "right": "16mm"}


def render_report_pdf(spec, requesting_user, base_url: str) -> bytes:
    token, _ = Token.objects.get_or_create(user=requesting_user)
    print_url = f"{base_url.rstrip('/')}/print/report/{spec.id}"

    with sync_playwright() as p:
        browser = p.chromium.launch()
        try:
            context = browser.new_context()
            context.add_init_script(
                f"window.localStorage.setItem({json.dumps(TOKEN_LOCALSTORAGE_KEY)}, {json.dumps(token.key)});"
            )
            page = context.new_page()
            page.goto(print_url, wait_until="domcontentloaded")
            page.wait_for_selector(REPORT_READY_SELECTOR, timeout=30000)
            # page.pdf() doesn't reliably imply print media on its own —
            # explicit so the @media print rules PrintReportPage.tsx
            # relies on (print-cover, print-section-heading, etc. in
            # tokens.css) are actually applied before the snapshot.
            page.emulate_media(media="print")
            pdf_bytes = page.pdf(
                format="A4",
                print_background=True,
                margin=PDF_MARGIN,
            )
        finally:
            browser.close()

    return pdf_bytes
