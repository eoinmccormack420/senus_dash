// src/sections/SolvencyLeverageSection.tsx
//
// Fourth dashboard section. Two visualizations:
//   1. Net assets trend across periods (bar, rust/forest split like
//      the EBITDA bars) — is the balance sheet strengthening or
//      eroding period to period.
//   2. A balance sheet composition view for the current period: what
//      assets are made of, and what's financing them (liabilities vs
//      equity) — the classic "two sides of the balance sheet" story,
//      shown as two stacked horizontal bars rather than a table, so
//      the relative weight of goodwill/contingent consideration is
//      visible at a glance (relevant given Loamin's impact on HY2026).

import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { boardApi, type PeriodDetail, num, formatEUR } from "../api/client";
import { AIInsightCard } from "../components/AIInsightCard";
import { Skeleton } from "../components/Skeleton";

interface Props {
  detail: PeriodDetail;
}

interface NetAssetsPoint {
  label: string;
  netAssets: number;
}

export function SolvencyLeverageSection({ detail }: Props) {
  const [trend, setTrend] = useState<NetAssetsPoint[]>([]);
  const [trendLoading, setTrendLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadTrend() {
      setTrendLoading(true);
      const periods = await boardApi.listPeriods();
      const details = await Promise.all(periods.map((p) => boardApi.getPeriod(p.id)));
      if (cancelled) return;

      const points: NetAssetsPoint[] = details
        .filter((d) => d.balance_sheet !== null)
        .map((d) => ({
          label: d.label,
          netAssets: d.balance_sheet!.net_assets,
        }));
      setTrend(points);
      setTrendLoading(false);
    }

    loadTrend().catch(() => setTrendLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const bs = detail.balance_sheet;

  if (!bs) {
    return (
      <div style={{ color: "var(--color-grey)", padding: "var(--space-6) 0" }}>
        No balance sheet data available for {detail.label} yet.
      </div>
    );
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
      <div style={{ marginBottom: "var(--space-6)" }}>
        <h2 style={sectionTitle}>Net assets trend</h2>
        {trendLoading ? (
          <Skeleton height={220} radius="var(--radius-md)" />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={trend} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
              <CartesianGrid stroke="var(--color-grey-line)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontFamily: "Inter, sans-serif", fontSize: 12, fill: "#8A8579" }}
                axisLine={{ stroke: "var(--color-grey-line)" }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontFamily: "Inter, sans-serif", fontSize: 12, fill: "#8A8579" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                formatter={(value) => formatEUR(Number(value))}
                contentStyle={{
                  fontFamily: "Inter, sans-serif",
                  fontSize: 13,
                  border: "1px solid #E3E0D8",
                  borderRadius: 4,
                }}
              />
              <ReferenceLine y={0} stroke="var(--color-grey-line)" />
              <Bar dataKey="netAssets" name="Net Assets" radius={[2, 2, 0, 0]} barSize={40}>
                {trend.map((p, i) => (
                  <Cell key={i} fill={p.netAssets < 0 ? "#B5462F" : "#2B4F45"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "var(--space-5)" }}>
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

        <div>
          <h2 style={sectionTitle}>Solvency metrics</h2>
          <div style={breakdownGrid}>
            <BreakdownRow label="Total Assets" value={formatEUR(totalAssets)} bold />
            <BreakdownRow label="Total Liabilities" value={formatEUR(totalLiabilities)} negative />
            <BreakdownRow label="Net Assets (Equity)" value={formatEUR(equity)} negative={equity < 0} bold />
            <BreakdownRow
              label="Gearing Ratio"
              value={gearingRatio !== null ? `${gearingRatio.toFixed(2)}x` : "n/a"}
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
          <p style={{ fontSize: "var(--text-xs)", color: "var(--color-grey)", marginTop: "var(--space-3)" }}>
            Gearing ratio = total liabilities ÷ equity. Below 1.0x means
            equity exceeds debt; a rising ratio signals increasing reliance
            on liabilities to fund the balance sheet.
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
    { label: "Fixed Assets", value: totalFixedAssets, color: "#2B4F45" },
    { label: "Current Assets", value: totalCurrentAssets, color: "#6E9187" },
  ];

  const financeSegments = [
    { label: "Equity", value: Math.max(equity, 0), color: "#2B4F45" },
    { label: "Current Creditors", value: currentCreditors, color: "#B5462F" },
    { label: "Contingent Consideration", value: contingentConsideration, color: "#D48A75" },
    { label: "Long-term Debt", value: longTermDebt, color: "#8A8579" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
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
      <p style={{ fontSize: "var(--text-sm)", color: "var(--color-grey)", marginBottom: 6 }}>{title}</p>
      <div style={{ display: "flex", height: 32, borderRadius: 3, overflow: "hidden" }}>
        {segments
          .filter((s) => s.value > 0)
          .map((s) => (
            <div
              key={s.label}
              title={`${s.label}: ${formatEUR(s.value)}`}
              style={{
                width: `${(s.value / base) * 100}%`,
                background: s.color,
              }}
            />
          ))}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-3)", marginTop: 8 }}>
        {segments
          .filter((s) => s.value > 0)
          .map((s) => (
            <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: s.color, display: "inline-block" }} />
              <span style={{ fontSize: "var(--text-xs)", color: "var(--color-grey)" }}>
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
      <span style={{ color: muted ? "var(--color-grey)" : "var(--color-ink)" }}>{label}</span>
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
  padding: "var(--space-3) var(--space-4)",
  borderBottom: "1px solid var(--color-grey-line)",
  fontSize: "var(--text-base)",
};