// src/sections/ProfitabilitySection.tsx
//
// Second dashboard section, following the same pattern as
// RevenueGrowthSection: fetch full history for the trend chart,
// render a breakdown of the currently selected period below it.
//
// Focus here: EBITDA trend (the number a board actually tracks
// period-to-period for a pre-profitability company), operating
// margin, and the admin expense ratio — since Senus's admin costs
// are the dominant driver of the operating loss.

import { useEffect, useState } from "react";
import {
  ComposedChart,
  Bar,
  Cell,
  LabelList,
  Legend,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
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
  detail: PeriodDetail;
}

interface TrendPoint {
  label: string;
  ebitda: number;
  operatingMarginPct: number;
}

export function ProfitabilitySection({ detail }: Props) {
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
        .map((d) => {
          const pl = d.pl_statement!;
          const revenue = num(pl.revenue);
          const operatingLoss = num(pl.operating_loss);
          return {
            label: d.label,
            ebitda: pl.ebitda ?? 0,
            // operating margin = operating result / revenue. operating_loss
            // is stored negative, so this comes out negative directly.
            operatingMarginPct: revenue !== 0 ? (operatingLoss / revenue) * 100 : 0,
          };
        });
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

  const revenue = num(pl.revenue);
  const operatingLoss = num(pl.operating_loss);
  const operatingMarginPct = revenue !== 0 ? (operatingLoss / revenue) * 100 : 0;

  const renderEbitdaLabel = ({ x = 0, y = 0, width = 0, height = 0, value }: any) => {
    const formatted = formatCompactEURTick(Number(value));
    const isNegative = Number(value) < 0;
    const labelY = isNegative ? y + height + 18 : y - 8;
    return (
      <text
        x={x + width / 2}
        y={labelY}
        fill={chartColors.secondary}
        textAnchor="middle"
        fontSize={12}
        fontWeight={600}
      >
        {formatted}
      </text>
    );
  };

  return (
    <div>
      <AIInsightCard insight={detail.ai_insights.find((i) => i.section === "profitability")} />
      <div style={{ marginBottom: "var(--space-6)" }}>
        <h2 style={sectionTitle}>EBITDA &amp; operating margin trend</h2>
        {trendLoading ? (
          <Skeleton height={300} radius="var(--radius-md)" />
        ) : trend.length < 2 ? (
          <div style={{ ...chartCard, padding: "var(--space-4)", color: "var(--color-grey)", fontSize: "var(--text-sm)" }}>
            Not enough historical data yet to show a trend.
          </div>
        ) : (
          <div className="print-avoid-break" style={chartCard} key={detail.id}>
            <ResponsiveChartContainer height={300}>
              <ComposedChart data={trend} margin={chartMargin.dualAxis}>
                <defs>
                  <linearGradient id="ebitdaPositiveFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={chartColors.primaryBright} />
                    <stop offset="100%" stopColor={chartColors.primaryDeep} />
                  </linearGradient>
                  <linearGradient id="ebitdaNegativeFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={chartColors.negativeBright} />
                    <stop offset="100%" stopColor={chartColors.negative} />
                  </linearGradient>
                  <linearGradient id="operatingMarginStroke" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#111827" />
                    <stop offset="100%" stopColor="#64748B" />
                  </linearGradient>
                </defs>
                <CartesianGrid {...gridProps} />
                <Legend {...legendProps} />
                <XAxis
                  dataKey="label"
                  {...xAxisProps}
                  height={40}
                  interval={0}
                />
                <YAxis
                  yAxisId="ebitda"
                  {...yAxisProps}
                  tickFormatter={(v) => formatCompactEURTick(Number(v))}
                  domain={["auto", "auto"]}
                />
                <YAxis
                  yAxisId="margin"
                  orientation="right"
                  {...yAxisProps}
                  tickFormatter={(v) => formatPercentTick(Number(v), 1)}
                  domain={["auto", "auto"]}
                />
                <Tooltip
                  formatter={(value, name) =>
                    name === "EBITDA" ? formatEUR(Number(value)) : formatPct(Number(value))
                  }
                  contentStyle={tooltipStyle}
                  cursor={chartCursor}
                />
                <ReferenceLine x={selectedLabel} stroke={chartColors.selectedGuide} strokeWidth={2} />
                <ReferenceLine yAxisId="ebitda" y={0} stroke={chartColors.gridLine} strokeWidth={1.5} />
                <Bar
                  yAxisId="ebitda"
                  dataKey="ebitda"
                  name="EBITDA"
                  radius={barRadius.vertical}
                  barSize={46}
                  background={{ fill: "rgba(52, 87, 232, 0.045)", radius: 12 }}
                  isAnimationActive={false}
                >
                  {trend.map((point) => (
                    <Cell
                      key={point.label}
                      fill={Number(point.ebitda) < 0 ? "url(#ebitdaNegativeFill)" : "url(#ebitdaPositiveFill)"}
                      fillOpacity={point.label === selectedLabel ? 1 : 0.7}
                      stroke={point.label === selectedLabel ? "rgba(255,255,255,0.82)" : "transparent"}
                      strokeWidth={point.label === selectedLabel ? 1.5 : 0}
                    />
                  ))}
                  <LabelList dataKey="ebitda" content={renderEbitdaLabel} />
                </Bar>
                <Line
                  yAxisId="margin"
                  type="monotone"
                  dataKey="operatingMarginPct"
                  name="Operating Margin %"
                  stroke="url(#operatingMarginStroke)"
                  strokeWidth={3.5}
                  dot={(props) =>
                    props.payload.label === selectedLabel ? (
                      <circle cx={props.cx} cy={props.cy} fill={chartColors.secondary} {...selectedDot} />
                    ) : null
                  }
                  activeDot={{ ...selectedDot, fill: chartColors.secondary }}
                  strokeOpacity={0.95}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveChartContainer>
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-5)" }}>
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
            <span style={{ fontSize: "var(--text-sm)", color: "var(--color-grey)" }}>{b.label}</span>
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
      <p style={{ fontSize: "var(--text-xs)", color: "var(--color-grey)", marginTop: "var(--space-2)" }}>
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
