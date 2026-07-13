# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Senus PLC AI-native board report: financial data enters via Gemini extraction from source PDFs, is validated in code before it's trusted, and powers a React dashboard. See `assiduous_dash/README.md` for the full narrative (architecture rationale, real debugging examples, assumptions made, validation results) — it's worth reading before making changes to the extraction/commentary pipelines.

This is a monorepo with two independently-run projects:

- `assiduous_dash/` — Django 5 + DRF backend (the source of truth; also serves the built frontend in production)
- `senus-dashboard/` — React 19 + TypeScript + Vite frontend

## Commands

### Backend (`assiduous_dash/`)

```bash
python -m venv ../.venv
../.venv/Scripts/activate        # Windows; ../.venv/bin/activate on macOS/Linux
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_senus_data       # seeds FY2024/FY2025/HY2025/HY2026 demo data
python manage.py createsuperuser
python manage.py runserver             # http://localhost:8000
```

Tests (pytest + pytest-django, config in `pytest.ini`):

```bash
pytest                                          # full suite
pytest board/tests/test_pipeline.py             # one file
pytest board/tests/test_pipeline.py::TestNormalizeSigns::test_pl_negative_fields_forced_negative_from_positive_input  # one test
```

Extraction/insight management commands (all under `board/management/commands/`):

```bash
python manage.py run_extraction --period HY2026 --kind pl_statement --pdf /path/to/file.pdf
python manage.py run_extraction --period HY2026 --all-kinds --pdf /path/to/file.pdf [--force]
python manage.py sync_drive_documents --folder-id <drive-folder-id> --period HY2026
python manage.py generate_insights --period HY2026 [--section cash_liquidity] [--force]
python manage.py reset_demo --confirm     # destructive: wipes ExtractionAttempt/AIInsight, re-seeds
```

`GEMINI_API_KEY` is required for extraction and commentary generation. See `assiduous_dash/README.md` §8 for the full environment variable table (Drive ingestion, Slack/Teams webhooks, email/Gmail notification config — all optional and DB-setting-over-env-var).

### Frontend (`senus-dashboard/`)

```bash
npm install
npm run dev        # http://localhost:5173, proxies /api to localhost:8000 (vite.config.ts)
npm run build       # tsc -b && vite build — this is also the CI/typecheck gate, no separate `tsc --noEmit` script
npm run lint        # eslint .
```

Production build output goes to `../assiduous_dash/frontend_dist` (not a local `dist/`), because Railway's backend deploy only packages the `assiduous_dash/` subtree — see `vite.config.ts`'s comment for why.

### CI

`.github/workflows/ci.yml` runs `pytest` (backend) and `npm run build` (frontend type-check + build) on every push/PR. No separate lint job — `npm run build`'s `tsc -b` is the enforced gate.

## Architecture

### Two AI pipelines, deliberately kept separate

- **Extraction** (`board/extraction/pipeline.py`, `gemini_client.py`, `schemas.py`, `pdf_utils.py`) — PDF → Gemini 2.5 Flash (JSON mode) → Pydantic schema validation → sign normalization (`_normalize_signs`, forces known sign-convention fields in code rather than trusting the prompt) → cross-check against manually-verified ground truth (1% tolerance) → `ExtractionAttempt` staging row.
- **Commentary** (`board/extraction/commentary.py`) — reads *already-validated* DB figures, never a raw document, and asks Gemini for prose. A narrative error and an extraction error can never be conflated because they're separate calls with separate inputs.

Never merge these into a single "read PDF, extract, narrate" call — that was an explicit early design decision (see README §1) to keep failure modes distinguishable.

### Human approval gate

`ExtractionAttempt.verified` (bool) gates everything. Nothing writes to the live `PLStatement`/`BalanceSheet`/`CashFlow`/`BusinessMetrics` tables until a reviewer sets `verified=True` and `promote_attempt()` (`pipeline.py`) runs. Don't add a code path that writes extracted data directly to the live statement models — that bypasses the entire point of the staging table.

### Caching, to avoid burning Gemini quota

- `ExtractionAttempt.source_content_hash` (SHA-256 of PDF bytes) — re-running the same document/period/kind skips the Gemini call unless `--force`.
- `AIInsight.source_data_hash` (SHA-256 of the exact figures fed to the prompt) — `generate_insights_for_period()` skips regenerating a section if the underlying figures haven't changed since last generation. Changing what data a section's summary builder feeds into the prompt (e.g. `_outlook_summary()` in `commentary.py`) naturally invalidates this cache on the next run — no manual cache-busting needed.

### Retry conventions for Gemini calls

Both `extract_statement`/`extract_statement_from_pdf` (`gemini_client.py`) and `generate_commentary` (`commentary.py`) retry with backoff and re-raise a wrapped `RuntimeError` after exhausting attempts — the caller (`pipeline.py` / `generate_insights_for_period`) is responsible for catching that and recording it against the attempt/result rather than letting it propagate further. Follow this pattern for any new Gemini call site rather than a bare unguarded call.

### Notification system (Slack, Teams, email)

`board/extraction/notifications.py`, `teams_notifications.py`, `email_notifications.py` all share one contract: **a notification failure must never raise back into the caller.** `run_extraction()` fires all three after an attempt lands in `cross_check_pass`/`cross_check_fail`; each function catches its own exceptions, logs, and returns. When adding a new notification channel, match this — wrap the send in try/except, never let it interrupt the pipeline.

Each channel resolves its config as **DB setting (`NotificationSettings.get_solo()`) takes precedence over an env var fallback** (`SLACK_WEBHOOK_URL`, `TEAMS_WEBHOOK_URL`, `EMAIL_*`), so existing env-var-only deployments keep working while still being editable from Settings > Notifications in the app. `NotificationSettings` is a singleton (always `pk=1`, via `get_solo()`), same pattern as `AllowedGoogleEmail` replaces the `GOOGLE_ALLOWED_EMAILS` env var.

Test convention for this layer: mock the actual I/O call (`urllib.request.urlopen`, `_send_email`) and assert the no-op-when-unconfigured / swallow-failure / correct-payload contract — see `test_notifications.py`, `test_teams_notifications.py`, `test_extraction_email_notifications.py`. Don't try to hit a real webhook or SMTP server in tests.

### Data model

`FinancialPeriod` (annual or half-year) has one-to-one `PLStatement`, `BalanceSheet`, `CashFlow`, `BusinessMetrics`, plus computed `@property` ratios (`roce_pct`, `dscr`, `yoy_revenue_growth_pct`, `provenance`) that live on the period itself rather than any single statement — pull from these directly (not from a statement model) when a feature needs a cross-statement ratio. `AIInsight` is one row per `(period, section)`. `ExtractionAttempt` is the full audit trail (raw Gemini response, schema/cross-check status, match rate, `verified`).

`FinancialPeriodViewSet`'s `/api/periods/{id}/` returns all four statement types plus insights in a single aggregate response — extend that serializer rather than adding new per-statement endpoints when the frontend needs another field.

### Frontend structure

- `App.tsx` — auth gate (DRF token in localStorage, not session-based); routes to `Dashboard` or `SettingsPage`.
- `sections/*.tsx` — one component per dashboard section (Revenue & Growth, Profitability, Cash & Liquidity, Solvency & Leverage, Returns), each drops in `<AIInsightCard>` for its own section's commentary inline next to the relevant chart.
- `sections/AIInsightsSection.tsx` is different — it renders only the `outlook` section as a single "Executive Summary" card, not per-section commentary.
- `settings/*.tsx` — admin-only panels (Notifications, Governance/allowed-emails, Sign-in access, Regenerate insights), composed into `SettingsPage.tsx`.
- `api/client.ts` — single typed fetch client, always relative `/api/...` paths (same-origin in production; proxied in dev via `vite.config.ts`).

### Deployment

Single Railway service: Django serves the Vite build directly via WhiteNoise (`WHITENOISE_ROOT` pointed at `assiduous_dash/frontend_dist/`, separate from Django's own `/static/`). This is why the frontend build output is configured to land inside `assiduous_dash/` rather than as a sibling directory — see `vite.config.ts` and `settings.py`'s `FRONTEND_DIST_DIR` comment. `DATABASE_URL` (Postgres, via `dj_database_url`) and `SECRET_KEY` come from the environment in production; SQLite and a hardcoded dev key are the local fallback.
