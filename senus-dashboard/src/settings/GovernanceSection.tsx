// src/settings/GovernanceSection.tsx
//
// AI Governance / verification center — replaces the need to use
// Django admin to review and approve Gemini extraction attempts. Lives
// under Settings (admin-only tab, gated by SettingsPage.tsx's
// ALL_SECTIONS filter) rather than its own top-level route. Supersedes
// the old Settings > Data Quality tab, which only covered the latest
// period and had no approve/reject.

import { useEffect, useState } from "react";
import {
  boardApi,
  governanceApi,
  num,
  type PeriodSummary,
  type ExtractionAttemptSummary,
  type ExtractionAttemptDetail,
  type ExtractionStatus,
} from "../api/client";
import { Skeleton } from "../components/Skeleton";
import { title, caption, filters, select, errorBanner, card, emptyText, table, th, thRight, row, td, tdRight, badge, verifiedYes, verifiedNo, detailCell, sourceText, fieldTable, fth, fthRight, ftd, ftdRight, actionRow, approveButton, rejectButton, successText, errorText, successColor, warningColor } from "../styles/GovernanceSectionStyles";

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
  if (status === "cross_check_pass") return { color: successColor.text, background: successColor.background };
  if (status === "schema_valid") return { color: warningColor.text, background: warningColor.background };
  return { color: "var(--color-rust)", background: "var(--color-rust-soft)" }; // cross_check_fail, schema_invalid, api_error, pending
}

function statusLabel(status: ExtractionStatus): string {
  return STATUS_OPTIONS.find((s) => s.value === status)?.label ?? status;
}

const formatNumber = (value: number): string => value.toLocaleString("en-IE", { maximumFractionDigits: 2 });

export function GovernanceSection() {
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

  return (
    <div>
      <h2 style={title}>AI Governance</h2>
      <p style={caption}>
        Review Gemini extraction attempts and approve/reject them — approving promotes the
        extracted values into the live board data.
      </p>

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
        <td style={{ ...td, width: 20, color: "var(--color-grey-text)" }}>{expanded ? "▾" : "▸"}</td>
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
