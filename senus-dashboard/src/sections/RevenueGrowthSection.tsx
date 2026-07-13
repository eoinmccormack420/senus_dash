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
  Legend,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ReferenceLine,
} from "recharts";
import { boardApi, type PeriodDetail, num, formatEUR, formatPct } from "../api/client";
import { AIInsightCard } from "../components/AIInsightCard";
import { ResponsiveChartContainer } from "../components/ResponsiveChartContainer";
import { Skeleton } from "../components/Skeleton";
import {
  barRadius,
  chartCard,
  chartColors,
  chartMargin,
  chartCursor,
  formatCompactEURTick,
  formatPercentTick,
  gridProps,
  legendProps,
  selectedDot,
  tooltipStyle,
  xAxisProps,
  yAxisProps,
} from "../styles/chartTheme";

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
  const selectedLabel = detail.label;

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
          <Skeleton height={320} radius="var(--radius-md)" />
        ) : trend.length < 2 ? (
          <div style={{ ...chartCard, padding: "var(--space-4)", color: "var(--color-grey)", fontSize: "var(--text-sm)" }}>
            Not enough historical data yet to show a trend.
          </div>
        ) : (
          <div className="print-avoid-break" style={chartCard} key={detail.id}>
            <ResponsiveChartContainer height={320}>
              <ComposedChart data={trend} margin={chartMargin.dualAxis}>
                <defs>
                  <linearGradient id="revenueActiveFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={chartColors.primaryBright} />
                    <stop offset="100%" stopColor={chartColors.primaryDeep} />
                  </linearGradient>
                  <linearGradient id="revenueMutedFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#BDCBFF" stopOpacity={0.86} />
                    <stop offset="100%" stopColor="#E8EEFF" stopOpacity={0.9} />
                  </linearGradient>
                  <linearGradient id="grossMarginStroke" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#111827" />
                    <stop offset="100%" stopColor="#64748B" />
                  </linearGradient>
                </defs>
                <CartesianGrid {...gridProps} />
                <Legend {...legendProps} />
                <XAxis
                  dataKey="label"
                  {...xAxisProps}
                />
                <YAxis
                  yAxisId="revenue"
                  {...yAxisProps}
                  tickFormatter={(v) => formatCompactEURTick(Number(v))}
                />
                <YAxis
                  yAxisId="margin"
                  orientation="right"
                  {...yAxisProps}
                  tickFormatter={(v) => formatPercentTick(Number(v))}
                />
                <Tooltip
                  formatter={(value, name) =>
                    name === "Revenue" ? formatEUR(Number(value)) : formatPct(Number(value))
                  }
                  contentStyle={tooltipStyle}
                  cursor={chartCursor}
                />
                <ReferenceLine x={selectedLabel} stroke={chartColors.selectedGuide} strokeWidth={2} />
                <Bar
                  yAxisId="revenue"
                  dataKey="revenue"
                  name="Revenue"
                  radius={barRadius.vertical}
                  barSize={42}
                  background={{ fill: "rgba(52, 87, 232, 0.045)", radius: 12 }}
                  isAnimationActive={false}
                >
                  {trend.map((point) => (
                    <Cell
                      key={point.label}
                      fill={point.label === selectedLabel ? "url(#revenueActiveFill)" : "url(#revenueMutedFill)"}
                      stroke={point.label === selectedLabel ? "rgba(255,255,255,0.8)" : "transparent"}
                      strokeWidth={point.label === selectedLabel ? 1.5 : 0}
                    />
                  ))}
                </Bar>
                <Line
                  yAxisId="margin"
                  type="monotone"
                  dataKey="grossMarginPct"
                  name="Gross Margin %"
                  stroke="url(#grossMarginStroke)"
                  strokeWidth={3.5}
                  dot={(props) =>
                    props.payload.label === selectedLabel ? (
                      <circle cx={props.cx} cy={props.cy} fill={chartColors.secondary} {...selectedDot} />
                    ) : null
                  }
                  activeDot={{ ...selectedDot, fill: chartColors.secondary }}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveChartContainer>
          </div>
        )}
      </div>

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
  padding: "var(--space-2) var(--space-4)",
  borderBottom: "1px solid var(--color-grey-line)",
  fontSize: "var(--text-base)",
};
