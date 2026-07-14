// src/api/client.ts
//
// Typed client for the Django REST Framework endpoints. Always uses a
// relative path — Django serves this same build in production
// (assiduous_dash/urls.py's catch-all), so the API is same-origin
// there. In local dev, vite.config.ts proxies /api to localhost:8000
// so the same relative path works without a separate env var.

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

export interface PLStatement {
  id: number;
  revenue: string;
  cost_of_sales: string;
  distribution_costs: string;
  admin_expenses: string;
  other_operating_income: string;
  interest_expense: string;
  tax_expense: string;
  gross_profit: string;
  operating_loss: string;
  loss_before_tax: string;
  loss_after_tax: string;
  gross_margin_pct: number | null;
  ebitda: number | null;
  admin_expense_pct: number | null;
  ebitda_margin_pct: number | null;
}

export interface BalanceSheet {
  id: number;
  goodwill: string;
  development_costs: string;
  tangible_assets: string;
  debtors: string;
  cash: string;
  current_creditors: string;
  contingent_consideration: string;
  long_term_debt: string;
  share_capital: string;
  share_premium: string;
  retained_earnings: string;
  total_fixed_assets: number;
  total_current_assets: number;
  net_assets: number;
  cash_runway_months: number | null;
  current_ratio: number | null;
}

export interface CashFlow {
  id: number;
  net_operating_cash: string;
  depreciation: string;
  working_capital_movement: string;
  net_investing_cash: string;
  net_financing_cash: string;
  equity_raised: string;
  loans_net: string;
  net_cash_movement: string;
  opening_cash: string;
  closing_cash: string;
  free_cash_flow: number;
}

export interface BusinessMetrics {
  id: number;
  total_customers: number | null;
  enterprise_customers: number | null;
  acv_soil_per_enterprise: string | null;
  acv_era_per_enterprise: string | null;
  revenue_ireland_pct: string | null;
  pipeline_value: string | null;
  pipeline_deals_count: number | null;
  employees: number | null;
  market_cap: string | null;
  share_price: string | null;
  revenue_per_customer: number | null;
  enterprise_revenue_concentration: number | null;
}

export interface AIInsight {
  id: number;
  section: string;
  section_display: string;
  generated_text: string;
  model_used: string;
  generated_at: string;
}

export interface Provenance {
  source: "manual" | "ai_extracted";
  match_rate_pct: number | null;
  verified: boolean;
}

export interface PeriodSummary {
  id: number;
  label: string;
  period_type: "annual" | "half_year";
  start_date: string;
  end_date: string;
  is_audited: boolean;
  provenance: Provenance;
}

export interface PeriodDetail extends PeriodSummary {
  notes: string;
  pl_statement: PLStatement | null;
  balance_sheet: BalanceSheet | null;
  cash_flow: CashFlow | null;
  business_metrics: BusinessMetrics | null;
  ai_insights: AIInsight[];
  // AI-suggested SMART goals for this period (board/extraction/advisory.py)
  // — "suggested" until an admin commits/dismisses them (AdvisoryGoalViewSet).
  advisory_goals: AdvisoryGoal[];
  // AI-generated, sequenced "Funding Readiness Roadmap" phases (board/
  // extraction/roadmap.py) — purely advisory narrative, no commit
  // workflow (unlike advisory_goals), regenerated wholesale on demand.
  funding_roadmap: FundingRoadmapStep[];
  // Cross-statement metrics — need pl_statement + balance_sheet/cash_flow
  // together, computed on FinancialPeriod itself (see board/models.py).
  yoy_revenue_growth_pct: number | null;
  roce_pct: number | null;
  dscr: number | null;
  // Evaluated live against BoardAlertSettings (board/alerts.py) — not
  // stored, so this always reflects the current admin-configured
  // thresholds rather than a snapshot from when the period was seeded.
  board_alerts: BoardAlertSignal[];
  // Computed live from this same payload's figures (board/readiness.py) —
  // not stored, so it always reflects current data.
  funding_readiness: FundingReadiness;
}

export interface AdvisoryGoal {
  id: number;
  order: number;
  title: string;
  description: string;
  rationale: string;
  status: "suggested" | "committed" | "completed" | "dismissed";
  model_used: string;
  generated_at: string;
  committed_at: string | null;
}

export interface FundingRoadmapStep {
  id: number;
  order: number;
  timeframe: string;
  title: string;
  description: string;
  model_used: string;
  generated_at: string;
}

export interface BoardAlertSignal {
  key: string;
  title: string;
  section: string;
  enabled: boolean;
  value: number | null;
  threshold: number;
  unit: string;
  operator: "above" | "below";
  status: "attention" | "clear" | "not_monitored" | "unavailable";
  detail: string;
}

export interface ReadinessComponent {
  key: string;
  title: string;
  value: number | null;
  unit: string;
  score: number | null;
  weight_pct: number;
  detail: string;
}

export interface FundingMilestone {
  key: string;
  title: string;
  description: string;
  complete: boolean;
  detail: string;
}

export interface FundingReadiness {
  score: number | null;
  components: ReadinessComponent[];
  milestones: FundingMilestone[];
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Token ${token}` } : {};
}

async function handleApiResponse<T>(response: Response): Promise<T> {
  if (response.status === 401) {
    clearToken();
    window.location.reload(); // bounce back to the login screen
    throw new Error("Session expired — please log in again.");
  }
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.detail || `API request failed: ${response.status} ${response.statusText}`);
  }
  if (response.status === 204) return undefined as T;
  return response.json();
}

async function apiFetch<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, { headers: authHeaders() });
  return handleApiResponse<T>(response);
}

// For POST/PATCH/DELETE — same auth/401 handling as apiFetch, plus a
// JSON body when provided.
async function apiMutate<T>(path: string, method: string, body?: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      ...authHeaders(),
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return handleApiResponse<T>(response);
}

// For binary responses (PDF/slide deck) — same auth/401 handling as
// apiFetch/apiMutate, but returns a Blob plus the server-suggested
// filename (from Content-Disposition) instead of parsing JSON.
async function apiDownload(path: string, method: string = "POST"): Promise<{ blob: Blob; filename: string }> {
  const response = await fetch(`${API_BASE_URL}${path}`, { method, headers: authHeaders() });
  if (response.status === 401) {
    clearToken();
    window.location.reload();
    throw new Error("Session expired — please log in again.");
  }
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.detail || `API request failed: ${response.status} ${response.statusText}`);
  }
  const disposition = response.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename="?([^"]+)"?/);
  const blob = await response.blob();
  return { blob, filename: match ? match[1] : "download" };
}

// Standard browser download trick: a temporary object URL + a
// programmatically-clicked <a download>, then immediate cleanup.
export function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const TOKEN_KEY = "senus_board_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export async function login(username: string, password: string): Promise<{ token: string; username: string }> {
  const response = await fetch(`${API_BASE_URL}/auth/login/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!response.ok) {
    throw new Error("Invalid username or password.");
  }
  const data = await response.json();
  setToken(data.token);
  return data;
}

export async function googleLogin(credential: string): Promise<{ token: string; username: string }> {
  const response = await fetch(`${API_BASE_URL}/auth/google/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ credential }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.detail || "Google sign-in failed.");
  }
  const data = await response.json();
  setToken(data.token);
  return data;
}

export interface CurrentUser {
  username: string;
  email: string;
  is_staff: boolean;
}

export const getCurrentUser = () => apiFetch<CurrentUser>("/auth/me/");

export const boardApi = {
  listPeriods: () => apiFetch<PeriodSummary[]>("/periods/"),
  getPeriod: (id: number) => apiFetch<PeriodDetail>(`/periods/${id}/`),
  getLatestPeriod: () => apiFetch<PeriodDetail>("/periods/latest/"),
  getPeriodInsights: (id: number) => apiFetch<AIInsight[]>(`/periods/${id}/insights/`),
};

export interface AllowedEmail {
  id: number;
  email: string;
  added_by_username: string | null;
  created_at: string;
}

export interface UserPreferencesData {
  notify_on_new_insights: boolean;
}

export interface RegenerateInsightsResult {
  period: string;
  results: { section: string; status: "generated" | "skipped" | "error"; detail: string }[];
}

export interface GenerateGoalsResult {
  period: string;
  result: { status: "generated" | "skipped" | "error"; detail: string };
}

export interface GenerateRoadmapResult {
  period: string;
  result: { status: "generated" | "skipped" | "error"; detail: string };
}

export const adminApi = {
  listAllowedEmails: () => apiFetch<AllowedEmail[]>("/admin/allowed-emails/"),
  addAllowedEmail: (email: string) => apiMutate<AllowedEmail>("/admin/allowed-emails/", "POST", { email }),
  removeAllowedEmail: (id: number) => apiMutate<void>(`/admin/allowed-emails/${id}/`, "DELETE"),
  regenerateInsights: () => apiMutate<RegenerateInsightsResult>("/admin/regenerate-insights/", "POST"),
  generateGoals: () => apiMutate<GenerateGoalsResult>("/admin/generate-goals/", "POST"),
  generateRoadmap: () => apiMutate<GenerateRoadmapResult>("/admin/generate-roadmap/", "POST"),
};

export const preferencesApi = {
  get: () => apiFetch<UserPreferencesData>("/preferences/"),
  update: (data: Partial<UserPreferencesData>) => apiMutate<UserPreferencesData>("/preferences/", "PATCH", data),
};

export interface NotificationStatus {
  slack: boolean;
  teams: boolean;
  email: boolean;
  // Empty string/false means the channel (if active) is being driven
  // by a server env var, not something set from this UI.
  slack_webhook_url: string;
  teams_webhook_url: string;
  smtp_host: string;
  smtp_port: number | null;
  smtp_username: string;
  smtp_password_set: boolean; // never the password itself
  smtp_use_tls: boolean;
  from_email: string;
  gmail_connected_email: string; // empty string means not connected
}

export interface NotificationSettingsUpdate {
  slack_webhook_url?: string;
  teams_webhook_url?: string;
  smtp_host?: string;
  smtp_port?: number | null;
  smtp_username?: string;
  smtp_password?: string;
  smtp_use_tls?: boolean;
  from_email?: string;
}

export const notificationsApi = {
  getStatus: () => apiFetch<NotificationStatus>("/notifications/status/"),
  updateSettings: (data: NotificationSettingsUpdate) =>
    apiMutate<NotificationStatus>("/notifications/status/", "PATCH", data),
  testSlack: () => apiMutate<{ success: boolean }>("/notifications/test-slack/", "POST"),
  testTeams: () => apiMutate<{ success: boolean }>("/notifications/test-teams/", "POST"),
  testEmail: () => apiMutate<{ success: boolean; sent_to: string }>("/notifications/test-email/", "POST"),
  connectGmail: (code: string) => apiMutate<NotificationStatus>("/notifications/connect-gmail/", "POST", { code }),
  disconnectGmail: () => apiMutate<NotificationStatus>("/notifications/disconnect-gmail/", "POST"),
};

export interface BoardAlertSettingsData {
  cash_runway_enabled: boolean;
  cash_runway_months_min: number;
  ebitda_margin_enabled: boolean;
  ebitda_margin_min_pct: number;
  admin_expense_ratio_enabled: boolean;
  admin_expense_ratio_max_pct: number;
  current_ratio_enabled: boolean;
  current_ratio_min: number;
  updated_at: string;
}

export type BoardAlertSettingsUpdate = Partial<Omit<BoardAlertSettingsData, "updated_at">>;

export interface AlertDigestResult {
  active_alerts: number;
  slack: boolean;
  teams: boolean;
  email: boolean;
}

export const boardAlertsApi = {
  getSettings: () => apiFetch<BoardAlertSettingsData>("/board-alerts/settings/"),
  updateSettings: (data: BoardAlertSettingsUpdate) =>
    apiMutate<BoardAlertSettingsData>("/board-alerts/settings/", "PATCH", data),
  sendDigest: (periodId: number) => apiMutate<AlertDigestResult>(`/periods/${periodId}/send_alert_digest/`, "POST"),
};

export interface DriveSettingsData {
  folder_id: string;
  folder_name: string;
  connected_email: string;
  last_sync_status: "idle" | "running" | "success" | "error";
  last_sync_summary: string;
  last_synced_at: string | null;
  updated_at: string;
}

export interface DriveFolder {
  id: string;
  name: string;
}

export interface DriveFolderListing {
  parent_id: string;
  parent_name: string;
  folders: DriveFolder[];
}

export const driveApi = {
  getSettings: () => apiFetch<DriveSettingsData>("/drive/settings/"),
  updateSettings: (folder_id: string, folder_name: string) =>
    apiMutate<DriveSettingsData>("/drive/settings/", "PATCH", { folder_id, folder_name }),
  syncNow: (periodLabel: string) => apiMutate<{ status: string }>("/drive/sync/", "POST", { period: periodLabel }),
  connect: (code: string) => apiMutate<DriveSettingsData>("/drive/connect/", "POST", { code }),
  disconnect: () => apiMutate<DriveSettingsData>("/drive/disconnect/", "POST"),
  listFolders: (parentId?: string) =>
    apiFetch<DriveFolderListing>(`/drive/folders/${parentId ? `?parent=${encodeURIComponent(parentId)}` : ""}`),
};

// --- AI Governance Center (admin only) ---

export type ExtractionStatementKind = "pl_statement" | "balance_sheet" | "cash_flow" | "business_metrics";
export type ExtractionStatus = "pending" | "schema_valid" | "schema_invalid" | "cross_check_pass" | "cross_check_fail" | "api_error";

export interface ExtractionAttemptPeriod {
  id: number;
  label: string;
}

export interface ExtractionAttemptFieldResult {
  extracted: number;
  actual: number;
  diff_pct: number;
  match: boolean;
}

// Matches ExtractionAttemptListSerializer — no cross_check_results, for
// the list view's payload size.
export interface ExtractionAttemptSummary {
  id: number;
  period: ExtractionAttemptPeriod;
  statement_kind: ExtractionStatementKind;
  source_document: string;
  model_used: string;
  status: ExtractionStatus;
  match_rate_pct: string | null; // DecimalField — serializes as a string, like PLStatement.revenue etc.
  verified: boolean;
  created_at: string;
}

// Matches ExtractionAttemptSerializer — full detail, used for
// retrieve/approve/reject responses.
export interface ExtractionAttemptDetail extends ExtractionAttemptSummary {
  cross_check_results: Record<string, ExtractionAttemptFieldResult> | null;
}

export const governanceApi = {
  listAttempts: (filters?: { period?: number; status?: ExtractionStatus }) => {
    const params = new URLSearchParams();
    if (filters?.period) params.set("period", String(filters.period));
    if (filters?.status) params.set("status", filters.status);
    const qs = params.toString();
    return apiFetch<ExtractionAttemptSummary[]>(`/extraction-attempts/${qs ? `?${qs}` : ""}`);
  },
  getAttempt: (id: number) => apiFetch<ExtractionAttemptDetail>(`/extraction-attempts/${id}/`),
  approveAttempt: (id: number) => apiMutate<ExtractionAttemptDetail>(`/extraction-attempts/${id}/approve/`, "POST"),
  rejectAttempt: (id: number) => apiMutate<ExtractionAttemptDetail>(`/extraction-attempts/${id}/reject/`, "POST"),
};

export const advisoryGoalsApi = {
  list: (periodId: number) => apiFetch<AdvisoryGoal[]>(`/advisory-goals/?period=${periodId}`),
  commit: (id: number) => apiMutate<AdvisoryGoal>(`/advisory-goals/${id}/commit/`, "POST"),
  dismiss: (id: number) => apiMutate<AdvisoryGoal>(`/advisory-goals/${id}/dismiss/`, "POST"),
  complete: (id: number) => apiMutate<AdvisoryGoal>(`/advisory-goals/${id}/complete/`, "POST"),
};

// Not period-scoped (unlike AdvisoryGoal/AIInsight) — HPSU/Euronext/NovaUCD
// status is a standing company attribute, not tied to a FinancialPeriod,
// so this is a standalone endpoint rather than nested on PeriodDetail.
export interface EcosystemChecklistItem {
  id: number;
  key: string;
  order: number;
  title: string;
  description: string;
  status: "not_started" | "in_progress" | "complete";
  notes: string;
  updated_at: string;
}

export const ecosystemChecklistApi = {
  list: () => apiFetch<EcosystemChecklistItem[]>("/ecosystem-checklist/"),
  update: (id: number, patch: { status?: EcosystemChecklistItem["status"]; notes?: string }) =>
    apiMutate<EcosystemChecklistItem>(`/ecosystem-checklist/${id}/`, "PATCH", patch),
};

// "Nearby Startup Incubators" card on /readiness — real, live Google
// Places (New) results, not manually-entered data (replaces the old
// Ecosystem Checklist card on that page).
export interface IncubatorSettingsData {
  search_location: string;
  last_refreshed_at: string | null;
  last_refresh_error: string;
}

export interface Incubator {
  place_id: string;
  name: string;
  address: string;
  website: string;
  rating: number | null;
  maps_url: string;
}

export interface IncubatorsResponse {
  settings: IncubatorSettingsData;
  incubators: Incubator[];
}

export const incubatorsApi = {
  list: () => apiFetch<IncubatorsResponse>("/incubators/"),
  refresh: (location?: string) => apiMutate<IncubatorsResponse>("/incubators/refresh/", "POST", { location }),
};

// A configured board report — which sections, for whom, why (see
// board/models.py's ReportSpec). tailored_narrative/narrative_* are
// read-only here — they only change via generateNarrative/approveNarrative.
export interface ReportSpec {
  id: number;
  period: number;
  period_label: string;
  title: string;
  audience_label: string;
  context_note: string;
  include_revenue_growth: boolean;
  include_profitability: boolean;
  include_cash_liquidity: boolean;
  include_solvency_leverage: boolean;
  include_returns: boolean;
  include_outlook: boolean;
  use_tailored_narrative: boolean;
  tailored_narrative: Record<string, string> | null;
  narrative_generated_at: string | null;
  narrative_approved: boolean;
  narrative_approved_by_username: string | null;
  narrative_approved_at: string | null;
  created_by_username: string | null;
  created_at: string;
  updated_at: string;
}

export type ReportSpecInput = Partial<
  Omit<
    ReportSpec,
    | "id"
    | "period_label"
    | "tailored_narrative"
    | "narrative_generated_at"
    | "narrative_approved"
    | "narrative_approved_by_username"
    | "narrative_approved_at"
    | "created_by_username"
    | "created_at"
    | "updated_at"
  >
> & { period: number; audience_label: string };

export interface GenerateNarrativeResult {
  status: "generated" | "skipped" | "error";
  detail: string;
}

export const reportSpecsApi = {
  list: () => apiFetch<ReportSpec[]>("/report-specs/"),
  get: (id: number) => apiFetch<ReportSpec>(`/report-specs/${id}/`),
  create: (data: ReportSpecInput) => apiMutate<ReportSpec>("/report-specs/", "POST", data),
  update: (id: number, data: Partial<ReportSpecInput>) =>
    apiMutate<ReportSpec>(`/report-specs/${id}/`, "PATCH", data),
  remove: (id: number) => apiMutate<void>(`/report-specs/${id}/`, "DELETE"),
  generateNarrative: (id: number, force = false) =>
    apiMutate<GenerateNarrativeResult>(`/report-specs/${id}/generate_narrative/`, "POST", { force }),
  approveNarrative: (id: number) => apiMutate<ReportSpec>(`/report-specs/${id}/approve_narrative/`, "POST"),
  downloadPdf: (id: number) => apiDownload(`/report-specs/${id}/generate_pdf/`, "POST"),
  downloadDeck: (id: number) => apiDownload(`/report-specs/${id}/generate_deck/`, "POST"),
};

// Convenience parsers — DRF DecimalFields serialize as strings, this
// keeps chart/number-formatting code from scattering parseFloat calls
export const num = (value: string | number | null | undefined): number =>
  value === null || value === undefined ? 0 : typeof value === "number" ? value : parseFloat(value);

export const formatEUR = (value: string | number | null | undefined): string => {
  const n = num(value);
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
};

export const formatPct = (value: number | null | undefined, decimals = 1): string =>
  value === null || value === undefined ? "—" : `${value.toFixed(decimals)}%`;