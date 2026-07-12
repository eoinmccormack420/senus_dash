// src/governance/GovernanceCenter.tsx
//
// AI Governance / verification center — replaces the need to use
// Django admin to review and approve Gemini extraction attempts.
// Admin-only (see App.tsx's route gate and AccountMenu.tsx's nav
// item). Supersedes the old Settings > Data Quality tab, which only
// covered the latest period and had no approve/reject.

import { useEffect, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import {
  boardApi,
  governanceApi,
  num,
  type CurrentUser,
  type PeriodSummary,
  type ExtractionAttemptSummary,
  type ExtractionAttemptDetail,
  type ExtractionStatus,
} from "../api/client";
import { AccountMenu } from "../components/AccountMenu";
import { Skeleton } from "../components/Skeleton";

const STATUS_OPTIONS: { value: ExtractionStatus; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "schema_valid", label: "Schema Valid" },
  { value: "schema_invalid", label: "Schema Invalid" },
  { value: "cross_check_pass", label: "Cross-Check Pass" },
  { value: "cross_check_fail", label: "Cross-Check Fail" },
  { value: "api_error", label: "API Error" },
];

const KIND_LABELS: Record<string, string> = {
  pl_statement: "P&L Statement",
  balance_sheet: "Balance Sheet",
  cash_flow: "Cash Flow",
  business_metrics: "Business Metrics",
};

function badgeStyle(status: ExtractionStatus): React.CSSProperties {
  if (status === "cross_check_pass") return { color: "#1A8A5C", background: "#E6F6EF" };
  if (status === "schema_valid") return { color: "#A8720E", background: "#FBF1DE" };
  return { color: "var(--color-rust)", background: "var(--color-rust-soft)" }; // cross_check_fail, schema_invalid, api_error, pending
}

function statusLabel(status: ExtractionStatus): string {
  return STATUS_OPTIONS.find((s) => s.value === status)?.label ?? status;
}

const formatNumber = (value: number): string => value.toLocaleString("en-IE", { maximumFractionDigits: 2 });

export default function GovernanceCenter({
  currentUser,
  onSignOut,
}: {
  currentUser: CurrentUser | null;
  onSignOut: () => void;
}) {
  const [periods, setPeriods] = useState<PeriodSummary[]>([]);
  const [attempts, setAttempts] = useState<ExtractionAttemptSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [periodFilter, setPeriodFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    boardApi.listPeriods().then(setPeriods).catch(() => {});
  }, []);

  function refresh() {
    setLoading(true);
    setError(null);
    return governanceApi
      .listAttempts({
        period: periodFilter ? Number(periodFilter) : undefined,
        status: (statusFilter as ExtractionStatus) || undefined,
      })
      .then(setAttempts)
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't load extraction attempts."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodFilter, statusFilter]);

  if (currentUser && !currentUser.is_staff) {
    return <Navigate to="/" replace />;
  }
  if (!currentUser) return null;

  return (
    <div style={page}>
      <header style={header}>
        <div>
          <p style={eyebrow}>Senus PLC</p>
          <div style={titleRow}>
            <h1 style={title}>AI Governance</h1>
            <Link to="/" style={backLink}>
              ← Back to dashboard
            </Link>
          </div>
        </div>
        <AccountMenu user={currentUser} onSignOut={onSignOut} />
      </header>

      <div style={filters}>
        <select value={periodFilter} onChange={(e) => setPeriodFilter(e.target.value)} style={select}>
          <option value="">All periods</option>
          {periods.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={select}>
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {error && <p style={errorBanner}>{error}</p>}

      <div style={card}>
        {loading ? (
          <div style={{ padding: "var(--space-4)" }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} height={20} style={{ marginBottom: "var(--space-3)" }} />
            ))}
          </div>
        ) : attempts.length === 0 ? (
          <p style={emptyText}>No extraction attempts match these filters.</p>
        ) : (
          <table style={table}>
            <thead>
              <tr>
                <th style={th}></th>
                <th style={th}>Period</th>
                <th style={th}>Statement</th>
                <th style={th}>Status</th>
                <th style={thRight}>Match</th>
                <th style={th}>Verified</th>
                <th style={th}>Created</th>
              </tr>
            </thead>
            <tbody>
              {attempts.map((a) => (
                <AttemptRow
                  key={a.id}
                  attempt={a}
                  expanded={expandedId === a.id}
                  onToggle={() => setExpandedId(expandedId === a.id ? null : a.id)}
                  onChanged={refresh}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function AttemptRow({
  attempt,
  expanded,
  onToggle,
  onChanged,
}: {
  attempt: ExtractionAttemptSummary;
  expanded: boolean;
  onToggle: () => void;
  onChanged: () => void;
}) {
  const [detail, setDetail] = useState<ExtractionAttemptDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [justApproved, setJustApproved] = useState(false);

  useEffect(() => {
    if (!expanded) return;
    setDetailLoading(true);
    setActionError(null);
    governanceApi
      .getAttempt(attempt.id)
      .then(setDetail)
      .catch((err) => setActionError(err instanceof Error ? err.message : "Couldn't load details."))
      .finally(() => setDetailLoading(false));
  }, [expanded, attempt.id]);

  const canApprove = (attempt.status === "cross_check_pass" || attempt.status === "schema_valid") && !attempt.verified;

  async function handleApprove() {
    const confirmed = window.confirm(
      `Approve this ${KIND_LABELS[attempt.statement_kind] ?? attempt.statement_kind} extraction for ${attempt.period.label}?\n\n` +
        "This overwrites the live board data for this statement with the extracted values."
    );
    if (!confirmed) return;
    setActionBusy(true);
    setActionError(null);
    try {
      const updated = await governanceApi.approveAttempt(attempt.id);
      setDetail(updated);
      setJustApproved(true);
      onChanged();
    } catch (err) {
      // Surfaces promote_attempt()'s own validation error verbatim (e.g.
      // wrong status) — note the attempt may still show verified=true
      // even on failure, since that flag is set before promotion is
      // attempted (matches the existing Django admin behavior).
      setActionError(err instanceof Error ? err.message : "Approval failed.");
      try {
        setDetail(await governanceApi.getAttempt(attempt.id));
      } catch {
        // ignore — actionError above is still shown
      }
      onChanged();
    } finally {
      setActionBusy(false);
    }
  }

  async function handleReject() {
    setActionBusy(true);
    setActionError(null);
    try {
      const updated = await governanceApi.rejectAttempt(attempt.id);
      setDetail(updated);
      setJustApproved(false);
      onChanged();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Reject failed.");
    } finally {
      setActionBusy(false);
    }
  }

  const fields = detail?.cross_check_results ? Object.entries(detail.cross_check_results) : [];

  return (
    <>
      <tr onClick={onToggle} style={row}>
        <td style={{ ...td, width: 20, color: "var(--color-grey)" }}>{expanded ? "▾" : "▸"}</td>
        <td style={td}>{attempt.period.label}</td>
        <td style={td}>{KIND_LABELS[attempt.statement_kind] ?? attempt.statement_kind}</td>
        <td style={td}>
          <span style={{ ...badge, ...badgeStyle(attempt.status) }}>{statusLabel(attempt.status)}</span>
        </td>
        <td style={tdRight}>{attempt.match_rate_pct !== null ? `${num(attempt.match_rate_pct)}%` : "—"}</td>
        <td style={td}>
          {attempt.verified ? <span style={verifiedYes}>✓ Verified</span> : <span style={verifiedNo}>Unverified</span>}
        </td>
        <td style={td}>{new Date(attempt.created_at).toLocaleString("en-IE")}</td>
      </tr>

      {expanded && (
        <tr>
          <td colSpan={7} style={detailCell}>
            {detailLoading ? (
              <Skeleton height={100} radius="var(--radius-sm)" />
            ) : (
              <div>
                {detail && (
                  <p style={sourceText}>
                    {detail.source_document} · {detail.model_used}
                  </p>
                )}

                {fields.length > 0 && (
                  <table style={fieldTable}>
                    <thead>
                      <tr>
                        <th style={fth}>Field</th>
                        <th style={fthRight}>Extracted</th>
                        <th style={fthRight}>Actual</th>
                        <th style={fthRight}>Diff</th>
                        <th style={fthRight}>Match</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fields.map(([field, result]) => (
                        <tr key={field}>
                          <td style={ftd}>{field}</td>
                          <td style={ftdRight}>{formatNumber(result.extracted)}</td>
                          <td style={ftdRight}>{formatNumber(result.actual)}</td>
                          <td style={ftdRight}>{result.diff_pct.toFixed(2)}%</td>
                          <td style={ftdRight}>{result.match ? "✓" : "✗"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                <div style={actionRow}>
                  {canApprove && (
                    <button type="button" onClick={handleApprove} disabled={actionBusy} style={approveButton}>
                      {actionBusy ? "Approving…" : "Approve"}
                    </button>
                  )}
                  {(detail?.verified ?? attempt.verified) && (
                    <button type="button" onClick={handleReject} disabled={actionBusy} style={rejectButton}>
                      {actionBusy ? "…" : "Unverify"}
                    </button>
                  )}
                  {justApproved && !actionError && <span style={successText}>✓ Approved and promoted to live data.</span>}
                </div>
                {actionError && <p style={errorText}>{actionError}</p>}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

const page: React.CSSProperties = {
  maxWidth: 1200,
  margin: "0 auto",
  padding: "var(--space-6) var(--space-4)",
};

const header: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-end",
  flexWrap: "wrap",
  gap: "var(--space-4)",
  marginBottom: "var(--space-5)",
};

const eyebrow: React.CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: "var(--text-xs)",
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--color-grey)",
  margin: 0,
  fontWeight: 600,
};

const titleRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--space-3)",
  flexWrap: "wrap",
};

const title: React.CSSProperties = {
  fontFamily: "var(--font-body)",
  fontWeight: 700,
  fontSize: "var(--text-xl)",
  color: "var(--color-ink)",
  margin: "var(--space-1) 0 0 0",
};

const backLink: React.CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: "var(--text-sm)",
  color: "var(--color-grey)",
  textDecoration: "none",
};

const filters: React.CSSProperties = {
  display: "flex",
  gap: "var(--space-3)",
  marginBottom: "var(--space-4)",
};

const select: React.CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: "var(--text-sm)",
  padding: "var(--space-2) var(--space-3)",
  border: "1px solid var(--color-grey-line)",
  borderRadius: "var(--radius-sm)",
  background: "var(--color-paper-raised)",
  color: "var(--color-ink)",
};

const errorBanner: React.CSSProperties = {
  color: "var(--color-rust)",
  fontSize: "var(--text-sm)",
  marginBottom: "var(--space-3)",
};

const card: React.CSSProperties = {
  background: "var(--color-paper-raised)",
  borderRadius: "var(--radius-md)",
  boxShadow: "var(--shadow-card)",
  overflow: "hidden",
};

const emptyText: React.CSSProperties = {
  padding: "var(--space-5)",
  color: "var(--color-grey)",
  fontSize: "var(--text-sm)",
  textAlign: "center",
};

const table: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: "var(--text-sm)",
};

const th: React.CSSProperties = {
  textAlign: "left",
  color: "var(--color-grey)",
  fontWeight: 500,
  fontSize: "var(--text-xs)",
  padding: "var(--space-3) var(--space-4)",
  borderBottom: "1px solid var(--color-grey-line)",
};

const thRight: React.CSSProperties = { ...th, textAlign: "right" };

const row: React.CSSProperties = {
  cursor: "pointer",
};

const td: React.CSSProperties = {
  padding: "var(--space-3) var(--space-4)",
  borderBottom: "1px solid var(--color-grey-line)",
  color: "var(--color-ink)",
};

const tdRight: React.CSSProperties = { ...td, textAlign: "right" };

const badge: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  fontSize: "var(--text-xs)",
  fontWeight: 600,
  padding: "3px 10px",
  borderRadius: 999,
  whiteSpace: "nowrap",
};

const verifiedYes: React.CSSProperties = {
  fontSize: "var(--text-xs)",
  fontWeight: 600,
  color: "#1A8A5C",
};

const verifiedNo: React.CSSProperties = {
  fontSize: "var(--text-xs)",
  color: "var(--color-grey)",
};

const detailCell: React.CSSProperties = {
  padding: "var(--space-4)",
  background: "var(--color-paper)",
  borderBottom: "1px solid var(--color-grey-line)",
};

const sourceText: React.CSSProperties = {
  fontSize: "var(--text-xs)",
  color: "var(--color-grey)",
  margin: "0 0 var(--space-3) 0",
  wordBreak: "break-all",
};

const fieldTable: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: "var(--text-sm)",
  marginBottom: "var(--space-4)",
};

const fth: React.CSSProperties = {
  textAlign: "left",
  color: "var(--color-grey)",
  fontWeight: 500,
  fontSize: "var(--text-xs)",
  padding: "var(--space-2)",
  borderBottom: "1px solid var(--color-grey-line)",
};

const fthRight: React.CSSProperties = { ...fth, textAlign: "right" };

const ftd: React.CSSProperties = {
  padding: "var(--space-2)",
  borderBottom: "1px solid var(--color-grey-line)",
  color: "var(--color-ink)",
};

const ftdRight: React.CSSProperties = { ...ftd, textAlign: "right" };

const actionRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--space-3)",
};

const approveButton: React.CSSProperties = {
  fontFamily: "var(--font-body)",
  fontWeight: 600,
  fontSize: "var(--text-sm)",
  color: "#FFFFFF",
  background: "var(--color-forest)",
  border: "none",
  borderRadius: "var(--radius-sm)",
  padding: "var(--space-2) var(--space-3)",
  cursor: "pointer",
};

const rejectButton: React.CSSProperties = {
  fontFamily: "var(--font-body)",
  fontWeight: 600,
  fontSize: "var(--text-sm)",
  color: "var(--color-rust)",
  background: "none",
  border: "1px solid var(--color-rust)",
  borderRadius: "var(--radius-sm)",
  padding: "var(--space-2) var(--space-3)",
  cursor: "pointer",
};

const successText: React.CSSProperties = {
  fontSize: "var(--text-sm)",
  color: "#1A8A5C",
  fontWeight: 600,
};

const errorText: React.CSSProperties = {
  fontSize: "var(--text-sm)",
  color: "var(--color-rust)",
  marginTop: "var(--space-2)",
};
