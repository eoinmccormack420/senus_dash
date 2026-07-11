// src/sections/RevenueGrowthSection.tsx
//
// First fully-built dashboard section — establishes the pattern the
// other five sections (Profitability, Cash & Liquidity, Solvency &
// Leverage, Returns, AI Insights) should follow:
//   1. Fetch full period history on mount (for trend charts)
//   2. Render a trend chart across all periods
//   3. Render a breakdown of the CURRENTLY SELECTED period below it
//
// Uses Recharts, consistent with the ScórVault stack.

import { useEffect, useState } from "react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { boardApi, type PeriodDetail, num, formatEUR, formatPct } from "../api/client";
import { AIInsightCard } from "../components/AIInsightCard";
import { Skeleton } from "../components/Skeleton";
import { chartCard, axisTick, tooltipStyle, chartColors } from "../styles/chartTheme";

interface Props {
  detail: PeriodDetail; // the currently selected period, from Dashboard
}

interface TrendPoint {
  label: string;
  revenue: number;
  grossMarginPct: number | null;
}

export function RevenueGrowthSection({ detail }: Props) {
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [trendLoading, setTrendLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadTrend() {
      setTrendLoading(true);
      const periods = await boardApi.listPeriods();
      const details = await Promise.all(periods.map((p) => boardApi.getPeriod(p.id)));
      if (cancelled) return;

      const points: TrendPoint[] = details
        .filter((d) => d.pl_statement !== null)
        .map((d) => ({
          label: d.label,
          revenue: num(d.pl_statement!.revenue),
          grossMarginPct: d.pl_statement!.gross_margin_pct,
        }));
      setTrend(points);
      setTrendLoading(false);
    }

    loadTrend().catch(() => setTrendLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const pl = detail.pl_statement;

  if (!pl) {
    return (
      <div style={{ color: "var(--color-grey)", padding: "var(--space-6) 0" }}>
        No P&amp;L data available for {detail.label} yet.
      </div>
    );
  }

  return (
    <div>
      <AIInsightCard insight={detail.ai_insights.find((i) => i.section === "revenue_growth")} />

      <div style={{ marginBottom: "var(--space-6)" }}>
        <h2 style={sectionTitle}>Revenue trend</h2>
        {trendLoading ? (
          <Skeleton height={280} radius="var(--radius-md)" />
        ) : (
          <div style={chartCard}>
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={trend} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                <CartesianGrid stroke={chartColors.gridLine} vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={axisTick}
                  axisLine={{ stroke: chartColors.gridLine }}
                  tickLine={false}
                />
                <YAxis
                  yAxisId="revenue"
                  tick={axisTick}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`}
                />
                <YAxis
                  yAxisId="margin"
                  orientation="right"
                  tick={axisTick}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  formatter={(value, name) =>
                    name === "Revenue" ? formatEUR(Number(value)) : formatPct(Number(value))
                  }
                  contentStyle={tooltipStyle}
                />
                <Bar
                  yAxisId="revenue"
                  dataKey="revenue"
                  name="Revenue"
                  fill={chartColors.primary}
                  radius={[6, 6, 0, 0]}
                  barSize={36}
                />
                <Line
                  yAxisId="margin"
                  type="monotone"
                  dataKey="grossMarginPct"
                  name="Gross Margin %"
                  stroke={chartColors.negative}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div>
        <h2 style={sectionTitle}>{detail.label} breakdown</h2>
        <div style={breakdownGrid}>
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