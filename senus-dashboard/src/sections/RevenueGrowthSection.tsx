// src/sections/RevenueGrowthSection.tsx
//
// First dashboard section: a breakdown of the CURRENTLY SELECTED
// period. The revenue trend across all periods used to be embedded
// here — it moved to the History tab (src/sections/HistorySection.tsx)
// since it already portrayed the full extracted history rather than
// this one period's snapshot.

import { type PeriodDetail, formatEUR, formatPct } from "../api/client";
import { AIInsightCard } from "../components/AIInsightCard";
import EmptyState from "../components/EmptyState";

interface Props {
  detail: PeriodDetail; // the currently selected period, from Dashboard
}

export function RevenueGrowthSection({ detail }: Props) {
  const pl = detail.pl_statement;

  if (!pl) {
    return <EmptyState>No P&amp;L data available for {detail.label} yet.</EmptyState>;
  }

  return (
    <div>
      <AIInsightCard insight={detail.ai_insights.find((i) => i.section === "revenue_growth")} />

      <div className="print-keep-together">
        <h2 style={sectionTitle}>{detail.label} breakdown</h2>
        <div className="print-avoid-break" style={breakdownGrid}>
          <BreakdownRow label="Revenue" value={formatEUR(pl.revenue)} />
          <BreakdownRow label="Cost of Sales" value={formatEUR(pl.cost_of_sales)} muted />
          <BreakdownRow label="Gross Profit" value={formatEUR(pl.gross_profit)} bold />
          <BreakdownRow label="Gross Margin" value={formatPct(pl.gross_margin_pct ?? undefined)} bold />
          <BreakdownRow
            label="Revenue YoY"
            value={
              detail.yoy_revenue_growth_pct !== null
                ? formatPct(detail.yoy_revenue_growth_pct)
                : "n/a — no prior-year period"
            }
            negative={(detail.yoy_revenue_growth_pct ?? 0) < 0}
            bold
          />
          <BreakdownRow label="Admin Expenses" value={formatEUR(pl.admin_expenses)} muted />
          <BreakdownRow
            label="Operating Loss"
            value={formatEUR(pl.operating_loss)}
            negative
            bold
          />
        </div>
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
