// src/sections/SolvencyLeverageSection.tsx
//
// Fourth dashboard section, for the CURRENTLY SELECTED period: a
// balance sheet composition view — what assets are made of, and what's
// financing them (liabilities vs equity) — the classic "two sides of
// the balance sheet" story, shown as two stacked horizontal bars rather
// than a table, so the relative weight of goodwill/contingent
// consideration is visible at a glance (relevant given Loamin's impact
// on HY2026).
//
// The net assets trend across all periods used to be embedded here too
// — it moved to the History tab (src/sections/HistorySection.tsx)
// since it already portrayed the full extracted history rather than
// this one period's snapshot.

import { type PeriodDetail, num, formatEUR } from "../api/client";
import { AIInsightCard } from "../components/AIInsightCard";
import EmptyState from "../components/EmptyState";
import { chartCard, chartColors } from "../styles/chartTheme";

interface Props {
  detail: PeriodDetail;
}

export function SolvencyLeverageSection({ detail }: Props) {
  const bs = detail.balance_sheet;

  if (!bs) {
    return <EmptyState>No balance sheet data available for {detail.label} yet.</EmptyState>;
  }

  // Note: BalanceSheet.net_assets doesn't currently subtract
  // contingent_consideration in the backend @property (see the seed
  // script and pipeline docs). Computing it here explicitly so this
  // section reflects the true reported figure even before that
  // backend property is fixed.
  const totalFixedAssets = num(bs.goodwill) + num(bs.development_costs) + num(bs.tangible_assets);
  const totalCurrentAssets = num(bs.debtors) + num(bs.cash);
  const totalAssets = totalFixedAssets + totalCurrentAssets;

  const currentCreditors = Math.abs(num(bs.current_creditors));
  const contingentConsideration = Math.abs(num(bs.contingent_consideration));
  const longTermDebt = Math.abs(num(bs.long_term_debt));
  const totalLiabilities = currentCreditors + contingentConsideration + longTermDebt;

  const equity = totalAssets - totalLiabilities;
  const gearingRatio = equity !== 0 ? totalLiabilities / equity : null;

  return (
    <div>
      <AIInsightCard insight={detail.ai_insights.find((i) => i.section === "solvency_leverage")} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "var(--space-5)" }}>
        <div>
          <h2 style={sectionTitle}>{detail.label} balance sheet composition</h2>
          <CompositionBars
            totalFixedAssets={totalFixedAssets}
            totalCurrentAssets={totalCurrentAssets}
            currentCreditors={currentCreditors}
            contingentConsideration={contingentConsideration}
            longTermDebt={longTermDebt}
            equity={equity}
            totalAssets={totalAssets}
          />
        </div>

        <div className="print-keep-together">
          <h2 style={sectionTitle}>Solvency metrics</h2>
          <div className="print-avoid-break" style={breakdownGrid}>
            <BreakdownRow label="Total Assets" value={formatEUR(totalAssets)} bold />
            <BreakdownRow label="Total Liabilities" value={formatEUR(totalLiabilities)} negative />
            <BreakdownRow label="Net Assets (Equity)" value={formatEUR(equity)} negative={equity < 0} bold />
            <BreakdownRow
              label="Gearing Ratio"
              value={gearingRatio !== null ? `${gearingRatio.toFixed(2)}x` : "n/a"}
              muted
            />
            <BreakdownRow
              label="Debt Service Coverage"
              value={detail.dscr !== null ? `${detail.dscr.toFixed(2)}x` : "n/a — no debt service this period"}
              muted
            />
            <BreakdownRow label="Goodwill" value={formatEUR(bs.goodwill)} muted />
            <BreakdownRow
              label="Contingent Consideration"
              value={formatEUR(-contingentConsideration)}
              negative
              muted
            />
          </div>
          <p style={{ fontSize: "var(--text-xs)", color: "var(--color-grey-text)", marginTop: "var(--space-3)" }}>
            Gearing ratio = total liabilities ÷ equity. Below 1.0x means
            equity exceeds debt; a rising ratio signals increasing reliance
            on liabilities to fund the balance sheet. Debt Service Coverage
            = EBITDA ÷ (interest + principal repaid) — "n/a" for a period
            simply means no debt was actually being serviced in cash terms
            that period, not a data gap.
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Two stacked horizontal bars of equal total width: "Assets" (what the
 * company owns) vs "Financed By" (liabilities + equity — what's
 * funding it). Segment widths are proportional to totalAssets so the
 * two bars are visually comparable, which is the whole point of a
 * balance sheet: both sides balance.
 */
function CompositionBars({
  totalFixedAssets,
  totalCurrentAssets,
  currentCreditors,
  contingentConsideration,
  longTermDebt,
  equity,
  totalAssets,
}: {
  totalFixedAssets: number;
  totalCurrentAssets: number;
  currentCreditors: number;
  contingentConsideration: number;
  longTermDebt: number;
  equity: number;
  totalAssets: number;
}) {
  const base = totalAssets > 0 ? totalAssets : 1;

  const assetSegments = [
    { label: "Fixed Assets", value: totalFixedAssets, color: "var(--color-forest)" },
    { label: "Current Assets", value: totalCurrentAssets, color: "var(--color-accent-soft)" },
  ];

  const financeSegments = [
    { label: "Equity", value: Math.max(equity, 0), color: "var(--color-forest)" },
    { label: "Current Creditors", value: currentCreditors, color: "var(--color-rust)" },
    { label: "Contingent Consideration", value: contingentConsideration, color: "var(--color-rust-accent)" },
    { label: "Long-term Debt", value: longTermDebt, color: "var(--color-grey)" },
  ];

  return (
    <div style={{ ...chartCard, display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
      <StackedBarRow title="Assets" segments={assetSegments} base={base} />
      <StackedBarRow title="Financed By" segments={financeSegments} base={base} />
    </div>
  );
}

function StackedBarRow({
  title,
  segments,
  base,
}: {
  title: string;
  segments: { label: string; value: number; color: string }[];
  base: number;
}) {
  return (
    <div>
      <p style={{ fontSize: "var(--text-sm)", color: chartColors.secondary, fontWeight: 800, marginBottom: 8 }}>{title}</p>
      <div style={{ display: "flex", height: 38, borderRadius: 14, overflow: "hidden", background: chartColors.neutralSoft, boxShadow: "inset 0 0 0 1px rgba(209, 217, 235, 0.76)" }}>
        {segments
          .filter((s) => s.value > 0)
          .map((s) => (
            <div
              key={s.label}
              title={`${s.label}: ${formatEUR(s.value)}`}
              style={{
                width: `${(s.value / base) * 100}%`,
                background: s.color,
                boxShadow: "inset -1px 0 0 rgba(255,255,255,0.38)",
              }}
            />
          ))}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-3)", marginTop: 10 }}>
        {segments
          .filter((s) => s.value > 0)
          .map((s) => (
            <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 9, height: 9, borderRadius: 999, background: s.color, display: "inline-block" }} />
              <span style={{ fontSize: "var(--text-xs)", color: chartColors.axisLabel, fontWeight: 700 }}>
                {s.label} · {formatEUR(s.value)}
              </span>
            </div>
          ))}
      </div>
    </div>
  );
}

function BreakdownRow({
  label,
  value,
  muted,
  bold,
  negative,
}: {
  label: string;
  value: string;
  muted?: boolean;
  bold?: boolean;
  negative?: boolean;
}) {
  return (
    <div style={row}>
      <span style={{ color: muted ? "var(--color-grey-text)" : "var(--color-ink)" }}>{label}</span>
      <span
        className="num"
        style={{
          fontWeight: bold ? 600 : 400,
          color: negative ? "var(--color-rust)" : "var(--color-ink)",
        }}
      >
        {value}
      </span>
    </div>
  );
}

const sectionTitle: React.CSSProperties = {
  fontFamily: "var(--font-body)",
  fontWeight: 600,
  fontSize: "var(--text-lg)",
  color: "var(--color-ink)",
  marginBottom: "var(--space-4)",
};

const breakdownGrid: React.CSSProperties = {
  background: "var(--color-paper-raised)",
  border: "1px solid var(--color-grey-line)",
  borderRadius: "var(--radius-md)",
  boxShadow: "var(--shadow-card)",
  overflow: "hidden",
};

const row: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  padding: "var(--space-2) var(--space-4)",
  borderBottom: "1px solid var(--color-grey-line)",
  fontSize: "var(--text-base)",
};
