# Senus PLC — AI-Native Board Report

A full-stack board reporting platform for Senus PLC, built for the Assiduous Technology Graduate technical assessment. Financial data enters the system via AI extraction from source PDFs, is validated in code before it's trusted, and powers a dashboard a CEO or board member would actually use — not just a demo of an AI call.

**Live app:** [add deployed URL once live]
**Login:** [add demo credentials once deployed, or note "credentials on request"]

---

## 1. Architecture

```
Source PDFs (local upload or Google Drive folder)
        |
        v
Extraction pipeline (board/extraction/)
  pdfplumber -> Gemini 2.5 Flash (JSON mode) -> Pydantic validation
  -> sign normalization -> cross-check vs. ground truth
        |
        v
ExtractionAttempt  (staging table, human-approval gate)
        |  promote (only if verified=True)
        v
SQLite database
  FinancialPeriod -> PLStatement / BalanceSheet / CashFlow / BusinessMetrics
  AIInsight (board commentary, generated from validated figures only)
        |
        v
Django REST Framework API  (token auth, one aggregate endpoint per period)
        |
        v
React + TypeScript + Vite dashboard
  6 report sections, Recharts, inline AI commentary, provenance badges,
  PDF board-pack export
```

Two AI pipelines feed the system, deliberately kept separate:

- **Extraction** (`board/extraction/pipeline.py`, `gemini_client.py`, `schemas.py`) — turns raw PDF text into structured numbers, validated against a schema and cross-checked against ground truth before anything is trusted.
- **Commentary** (`board/extraction/commentary.py`) — turns *already-validated* database figures into board-level prose. It never reads a raw document, only narrates numbers that already passed validation, so a narrative error and an extraction error can never be the same failure.

This split is deliberate: a single "read PDF, extract numbers, write commentary" call would make it impossible to tell whether a wrong figure in the final commentary came from bad extraction or bad narration.

---

## 2. Tech stack

**Backend:** Django 5, Django REST Framework, SQLite (dev), Pydantic (schema validation), pdfplumber (PDF text/table extraction), `google-genai` (Gemini 2.5 Flash), DRF Token Authentication, `google-api-python-client` + `google-auth` (Drive ingestion)

**Frontend:** React 19, TypeScript, Vite, Recharts

**AI:** Gemini 2.5 Flash — used for two distinct tasks: structured data extraction (JSON mode) and narrative commentary generation (plain text mode)

---

## 3. AI-assisted development workflow

Built with Claude (Anthropic) as an active development partner throughout — architecture decisions, debugging, iteration — and with Claude Code for local setup and the Google Drive ingestion integration. Noting this transparently since the process is itself relevant to a company evaluating AI-native engineering practices.

**What Claude was used for:** scoping the extraction pipeline's architecture before writing code, debugging real failures against real Gemini API behaviour as they happened, dashboard design-system decisions, and drafting this README.

**What I made the calls on:** keeping extraction and commentary as separate pipelines, requiring human approval (`ExtractionAttempt.verified`) before AI-extracted data can overwrite live figures rather than writing directly to the database, the dashboard's design direction, and scope/effort tradeoffs on later features (Drive integration, PDF export).

**Real debugging examples** (kept here as evidence the validation layer actually works, not just architecture on paper):

1. **Sign convention drift.** Gemini would sometimes return `operating_loss` as positive (matching how the source PDF displays it under a "Loss" heading) and sometimes negative, inconsistently across otherwise-identical calls. A better prompt alone wasn't reliable enough — the fix was enforcing sign conventions **in code** after extraction (`_normalize_signs()` in `pipeline.py`), designing around LLM non-determinism rather than trusting a good prompt to be sufficient.

2. **Column-matching failure.** Early P&L extraction attempts returned an empty JSON object. The source document showed two columns side by side (current period and prior-year comparative) with no explicit period label anywhere in the text, so Gemini had no way to map the internal period label to the correct column — and correctly returned nothing rather than guess. Fixed by passing the period's actual date range into the prompt and telling Gemini explicitly which column's dates to trust.

3. **The pipeline caught my own data entry gaps.** Several early cross-check "failures" (`development_costs`, `share_premium`, `other_operating_income`) turned out to be places where my manually-seeded ground truth was incomplete, not places where Gemini was wrong. Once corrected against the source document, those fields hit 100% match — the strongest evidence that the validation pipeline is a genuine two-way check, not just a filter on AI output.

---

## 4. Data model & API

- `FinancialPeriod` (FY2024, FY2025, HY2025, HY2026) with one-to-one `PLStatement`, `BalanceSheet`, `CashFlow`, `BusinessMetrics` records
- `ExtractionAttempt` — full audit trail of every extraction run: raw Gemini output, schema validation status, per-field cross-check results, match rate, and a `verified` boolean gating promotion to live data
- `AIInsight` — one row per (period, section): generated commentary, model used, timestamp
- `FinancialPeriodViewSet` exposes a single aggregate `/api/periods/{id}/` endpoint returning all four statement types plus insights in one call, instead of five separate requests per period load

---

## 5. Google Drive ingestion

Source PDFs can be pulled directly from a shared Google Drive folder instead of uploaded manually, authenticated via a **service account** — no per-user OAuth login. The CEO/finance team just shares a Drive folder with the service account's email (Viewer access).

- `board/extraction/drive_client.py` — lists and downloads PDFs from a folder via the Drive API
- `board/management/commands/sync_drive_documents.py` — lists new PDFs in a folder, downloads each one not already processed for the given period, and runs it through the *same* `run_extraction()` pipeline used for local files — this is purely a document source, it doesn't change any extraction/validation logic

```bash
python manage.py sync_drive_documents --folder-id <drive-folder-id> --period HY2026
```

Safe to re-run: already-processed files (tracked via `ExtractionAttempt.source_document`, stored as `drive://{file_id}/{filename}`) are skipped automatically. Requires `GOOGLE_SERVICE_ACCOUNT_KEY_PATH` and the folder ID (see setup below).

---

## 6. Assumptions made

- **Balance sheet equity breakdown for FY2024/FY2025** — source documents didn't itemise `share_capital` / `share_premium` / `retained_earnings` separately; the residual was placed into `retained_earnings`. Flagged in code comments, not a silent error.
- **HY2025 has no balance sheet** — the source document provided P&L and cash flow comparisons for HY2025 but not a standalone Dec-2024 balance sheet.
- **`net_investing_cash`** for early periods was derived (`net_cash_movement − net_operating_cash − net_financing_cash`) where the source didn't break it out explicitly.
- **BusinessMetrics is genuinely sparse across periods by design** — customer/ACV data came from a corporate presentation, market cap from a listing document, so no single period has both yet. The Returns section shows this honestly rather than fabricating figures.
- **Authentication is intentionally single-user/token-based** — appropriate scope for a board tool with one or a few trusted reviewers, not a general SaaS product requiring user management.

---

## 7. How outputs were validated

Every extracted figure passes the same four-stage gate before reaching the live dashboard:

1. **Schema validation** — Pydantic models mirroring the Django schema reject malformed or missing fields.
2. **Sign normalization** — known sign-convention fields (losses, liabilities) are forced to the correct sign in code, independent of what Gemini returned.
3. **Cross-check against ground truth** — each field is compared against manually-verified figures already in the database, 1% tolerance for rounding. A per-field match report is stored on the `ExtractionAttempt`.
4. **Human approval gate** — nothing writes to the live `PLStatement`/`BalanceSheet`/`CashFlow` tables automatically. A reviewer inspects match rate and cross-check detail in the Django admin and explicitly marks an attempt `verified` before promotion.

**Results on real Senus source documents (HY2026 half-year results):** P&L, Balance Sheet, and Cash Flow all reached 100% field match after fixing sign convention handling, ground-truth gaps, and (for Cash Flow) widening the section-extraction window to capture a statement that spans a page break in the source PDF.

The dashboard surfaces this directly via provenance badges — a board member can see whether a figure is AI-extracted-and-verified or manually entered, rather than that distinction staying an internal implementation detail.

---

## 8. Running locally

```bash
# Backend — from the repo root
cd assiduous_dash
python -m venv ../.venv
../.venv/Scripts/activate        # Windows; use ../.venv/bin/activate on macOS/Linux
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_senus_data
python manage.py createsuperuser
python manage.py runserver

# Generate AI commentary (requires GEMINI_API_KEY)
python manage.py generate_insights --period HY2026

# Frontend — in a second terminal, from the repo root
cd senus-dashboard
npm install
npm run dev
```

**Environment variables** (`assiduous_dash/.env`):
| Variable | Required for |
|---|---|
| `GEMINI_API_KEY` | Extraction + commentary pipelines |
| `GOOGLE_SERVICE_ACCOUNT_KEY_PATH` | Google Drive ingestion only |
| `DRIVE_FOLDER_ID` | Google Drive ingestion only |

Django's `SECRET_KEY` and database are currently hardcoded for local development (SQLite) — not yet wired to environment variables, since there's no deployment target configured yet. That's the first thing to change before deploying (see below).

---

## 9. What I'd build next with more time

- Wire `SECRET_KEY` and the database to environment variables and move to PostgreSQL for an actual deployment (currently local-only, SQLite)
- Extend the extraction pipeline to the FY2024/FY2025 annual report documents, to validate it against a second document format, not just the half-year results template
- Trigger `sync_drive_documents` automatically on new file upload (Drive push notifications / a scheduled poll) instead of a manual CLI run
- A natural-language query interface over the board data (Gemini function-calling against the DRF API) — a genuine "ask the board report a question" feature
