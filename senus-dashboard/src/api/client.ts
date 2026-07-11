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
  // Cross-statement metrics — need pl_statement + balance_sheet/cash_flow
  // together, computed on FinancialPeriod itself (see board/models.py).
  yoy_revenue_growth_pct: number | null;
  roce_pct: number | null;
  dscr: number | null;
}

async function apiFetch<T>(path: string): Promise<T> {
  const token = getToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: token ? { Authorization: `Token ${token}` } : {},
  });
  if (response.status === 401) {
    clearToken();
    window.location.reload(); // bounce back to the login screen
    throw new Error("Session expired — please log in again.");
  }
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }
  return response.json();
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

export const boardApi = {
  listPeriods: () => apiFetch<PeriodSummary[]>("/periods/"),
  getPeriod: (id: number) => apiFetch<PeriodDetail>(`/periods/${id}/`),
  getLatestPeriod: () => apiFetch<PeriodDetail>("/periods/latest/"),
  getPeriodInsights: (id: number) => apiFetch<AIInsight[]>(`/periods/${id}/insights/`),
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