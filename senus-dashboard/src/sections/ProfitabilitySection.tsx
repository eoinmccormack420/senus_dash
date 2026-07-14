// src/sections/ProfitabilitySection.tsx
//
// Second dashboard section: a breakdown of the currently selected
// period, plus a simple cost-driver comparison. The EBITDA & operating
// margin trend across all periods used to be embedded here — it moved
// to the History tab (src/sections/HistorySection.tsx) since it
// already portrayed the full extracted history rather than this one
// period's snapshot.

import { type PeriodDetail, num, formatEUR, formatPct } from "../api/client";
import { AIInsightCard } from "../components/AIInsightCard";
import EmptyState from "../components/EmptyState";

interface Props {
  detail: PeriodDetail;
}

export function ProfitabilitySection({ detail }: Props) {
  const pl = detail.pl_statement;

  if (!pl) {
    return <EmptyState>No P&amp;L data available for {detail.label} yet.</EmptyState>;
  }

  const revenue = num(pl.revenue);
  const operatingLoss = num(pl.operating_loss);
  const operatingMarginPct = revenue !== 0 ? (operatingLoss / revenue) * 100 : 0;

  return (
    <div>
      <AIInsightCard insight={detail.ai_insights.find((i) => i.section === "profitability")} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "var(--space-5)" }}>
        <div className="print-keep-together">
          <h2 style={sectionTitle}>{detail.label} P&amp;L breakdown</h2>
          <div className="print-avoid-break" style={breakdownGrid}>
            <BreakdownRow label="Gross Profit" value={formatEUR(pl.gross_profit)} />
            <BreakdownRow label="Admin Expenses" value={formatEUR(pl.admin_expenses)} muted />
            <BreakdownRow
              label="Admin Expense Ratio"
              value={formatPct(pl.admin_expense_pct ?? undefined)}
              muted
            />
            <BreakdownRow label="EBITDA" value={formatEUR(pl.ebitda ?? 0)} bold negative={num(pl.ebitda) < 0} />
            <BreakdownRow
              label="EBITDA Margin"
              value={formatPct(pl.ebitda_margin_pct ?? undefined)}
              negative={(pl.ebitda_margin_pct ?? 0) < 0}
            />
            <BreakdownRow
              label="Operating Loss"
              value={formatEUR(pl.operating_loss)}
              negative
              bold
            />
            <BreakdownRow label="Operating Margin" value={formatPct(operatingMarginPct)} negative bold />
            <BreakdownRow
              label="Loss Before Tax"
              value={formatEUR(pl.loss_before_tax)}
              negative
            />
            <BreakdownRow label="Loss After Tax" value={formatEUR(pl.loss_after_tax)} negative bold />
          </div>
        </div>

        <div>
          <h2 style={sectionTitle}>What's driving the loss</h2>
          <CostDriverBars pl={pl} />
        </div>
      </div>
    </div>
  );
}

/**
 * Simple horizontal bar comparison of the two things eating into gross
 * profit: admin expenses vs. everything else (interest + distribution).
 * Not a full waterfall — deliberately simple so it reads in 2 seconds,
 * per the "board wants the headline, not the audit trail" brief.
 */
function CostDriverBars({ pl }: { pl: NonNullable<PeriodDetail["pl_statement"]> }) {
  const grossProfit = num(pl.gross_profit);
  const adminExpenses = num(pl.admin_expenses);
  const otherCosts = num(pl.distribution_costs) + num(pl.interest_expense);
  const maxValue = Math.max(grossProfit, adminExpenses, 1);

  const bars = [
    { label: "Gross Profit", value: grossProfit, color: "var(--color-forest)" },
    { label: "Admin Expenses", value: adminExpenses, color: "var(--color-rust)" },
    { label: "Other Costs", value: otherCosts, color: "var(--color-grey)" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      {bars.map((b) => (
        <div key={b.label}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: "var(--text-sm)", color: "var(--color-grey-text)" }}>{b.label}</span>
            <span className="num" style={{ fontSize: "var(--text-sm)", fontWeight: 600 }}>
              {formatEUR(b.value)}
            </span>
          </div>
          <div style={{ height: 10, background: "var(--color-grey-line)", borderRadius: 3, overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                width: `${Math.min((b.value / maxValue) * 100, 100)}%`,
                background: b.color,
                transition: "width 0.4s ease",
              }}
            />
          </div>
        </div>
      ))}
      <p style={{ fontSize: "var(--text-xs)", color: "var(--color-grey-text)", marginTop: "var(--space-2)" }}>
        Admin expenses exceed gross profit by{" "}
        <span className="num" style={{ fontWeight: 600 }}>
          {formatEUR(Math.max(adminExpenses - grossProfit, 0))}
        </span>{" "}
        — the primary driver of the operating loss.
      </p>
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
