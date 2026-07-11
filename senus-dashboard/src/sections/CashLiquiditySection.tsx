// src/sections/CashLiquiditySection.tsx
//
// Third dashboard section. Two visualizations:
//   1. Cash balance trend across all periods (area chart) — the
//      "are we going up or down" headline view.
//   2. A cash bridge/waterfall for the CURRENT period, showing how
//      opening cash moves through operating/investing/financing to
//      reach closing cash. This is the chart a board actually wants
//      for cash: not just "cash went up," but "cash went up because
//      of a share issue, not because the business is generating cash."
//
// Recharts has no built-in waterfall type, so the bridge is built with
// a stacked bar: an invisible "base" segment plus a colored "value"
// segment, per-bar colored via Cell (same technique used for the
// negative/positive EBITDA bars in ProfitabilitySection).

import { useEffect, useState } from "react";
import {
  AreaChart,
  Area,
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
import { chartCard, axisTick, tooltipStyle, chartColors } from "../styles/chartTheme";

interface Props {
  detail: PeriodDetail;
}

interface CashTrendPoint {
  label: string;
  closingCash: number;
}

interface BridgeStep {
  label: string;
  base: number;
  value: number;
  displayValue: number; // signed, for tooltip
  kind: "total" | "positive" | "negative";
}

export function CashLiquiditySection({ detail }: Props) {
  const [trend, setTrend] = useState<CashTrendPoint[]>([]);
  const [trendLoading, setTrendLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadTrend() {
      setTrendLoading(true);
      const periods = await boardApi.listPeriods();
      const details = await Promise.all(periods.map((p) => boardApi.getPeriod(p.id)));
      if (cancelled) return;

      const points: CashTrendPoint[] = details
        .filter((d) => d.cash_flow !== null)
        .map((d) => ({
          label: d.label,
          closingCash: num(d.cash_flow!.closing_cash),
        }));
      setTrend(points);
      setTrendLoading(false);
    }

    loadTrend().catch(() => setTrendLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const cf = detail.cash_flow;
  const bs = detail.balance_sheet;
  const pl = detail.pl_statement;

  if (!cf) {
    return (
      <div style={{ color: "var(--color-grey)", padding: "var(--space-6) 0" }}>
        No cash flow data available for {detail.label} yet.
      </div>
    );
  }

  const bridge = buildBridge(cf);
  const ebitdaBridge = pl ? buildEbitdaBridge(pl, cf) : null;

  return (
    <div>
      <AIInsightCard insight={detail.ai_insights.find((i) => i.section === "cash_liquidity")} />
      <div style={{ marginBottom: "var(--space-6)" }}>
        <h2 style={sectionTitle}>Cash balance trend</h2>
        {trendLoading ? (
          <Skeleton height={220} radius="var(--radius-md)" />
        ) : (
          <div style={chartCard}>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={trend} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                <defs>
                  <linearGradient id="cashFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={chartColors.primary} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={chartColors.primary} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={chartColors.gridLine} vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={axisTick}
                  axisLine={{ stroke: chartColors.gridLine }}
                  tickLine={false}
                />
                <YAxis
                  tick={axisTick}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip formatter={(value) => formatEUR(Number(value))} contentStyle={tooltipStyle} />
                <Area
                  type="monotone"
                  dataKey="closingCash"
                  name="Cash Balance"
                  stroke={chartColors.primary}
                  strokeWidth={2}
                  fill="url(#cashFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "var(--space-5)" }}>
        <div>
          <h2 style={sectionTitle}>{detail.label} cash bridge</h2>
          <div style={chartCard}>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={bridge} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                <CartesianGrid stroke={chartColors.gridLine} vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={axisTick}
                  axisLine={{ stroke: chartColors.gridLine }}
                  tickLine={false}
                />
                <YAxis
                  tick={axisTick}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(_value, _name, item) =>
                    formatEUR((item.payload as BridgeStep).displayValue)
                  }
                  contentStyle={tooltipStyle}
                />
                <Bar dataKey="base" stackId="bridge" fill="transparent" isAnimationActive={false} />
                <Bar dataKey="value" stackId="bridge" radius={[6, 6, 6, 6]}>
                  {bridge.map((step, i) => (
                    <Cell
                      key={i}
                      fill={
                        step.kind === "total"
                          ? chartColors.neutral
                          : step.kind === "positive"
                            ? chartColors.primary
                            : chartColors.negative
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div>
          <h2 style={sectionTitle}>Liquidity metrics</h2>
          <div style={breakdownGrid}>
            <BreakdownRow label="Opening Cash" value={formatEUR(cf.opening_cash)} muted />
            <BreakdownRow label="Closing Cash" value={formatEUR(cf.closing_cash)} bold />
            <BreakdownRow
              label="Net Cash Movement"
              value={formatEUR(cf.net_cash_movement)}
              negative={num(cf.net_cash_movement) < 0}
              bold
            />
            <BreakdownRow
              label="Operating Cash Flow"
              value={formatEUR(cf.net_operating_cash)}
              negative={num(cf.net_operating_cash) < 0}
            />
            <BreakdownRow
              label="Working Capital Movement"
              value={formatEUR(cf.working_capital_movement)}
              muted
              negative={num(cf.working_capital_movement) < 0}
            />
            <BreakdownRow label="Free Cash Flow" value={formatEUR(cf.free_cash_flow)} negative={num(cf.free_cash_flow) < 0} />
            {bs && (
              <>
                <BreakdownRow label="Current Ratio" value={bs.current_ratio !== null ? bs.current_ratio.toFixed(2) : "—"} />
                <BreakdownRow
                  label="Cash Runway"
                  value={bs.cash_runway_months !== null ? `${bs.cash_runway_months} months` : "—"}
                  bold
                />
              </>
            )}
          </div>
          <p style={{ fontSize: "var(--text-xs)", color: "var(--color-grey)", marginTop: "var(--space-3)" }}>
            Current ratio compares current assets to current liabilities —
            above 1.0 means short-term obligations are covered by
            short-term assets.
          </p>
        </div>
      </div>

      {ebitdaBridge && (
        <div style={{ marginTop: "var(--space-6)" }}>
          <h2 style={sectionTitle}>EBITDA to Free Cash Flow bridge</h2>
          <div style={chartCard}>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={ebitdaBridge} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                <CartesianGrid stroke={chartColors.gridLine} vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={axisTick}
                  axisLine={{ stroke: chartColors.gridLine }}
                  tickLine={false}
                />
                <YAxis
                  tick={axisTick}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`}
                />
                <ReferenceLine y={0} stroke={chartColors.gridLine} />
                <Tooltip
                  formatter={(_value, _name, item) =>
                    formatEUR((item.payload as BridgeStep).displayValue)
                  }
                  contentStyle={tooltipStyle}
                />
                <Bar dataKey="base" stackId="ebitda-bridge" fill="transparent" isAnimationActive={false} />
                <Bar dataKey="value" stackId="ebitda-bridge" radius={[6, 6, 6, 6]}>
                  {ebitdaBridge.map((step, i) => (
                    <Cell
                      key={i}
                      fill={
                        step.kind === "total"
                          ? chartColors.neutral
                          : step.kind === "positive"
                            ? chartColors.primary
                            : chartColors.negative
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p style={{ fontSize: "var(--text-xs)", color: "var(--color-grey)", marginTop: "var(--space-3)" }}>
            "Other Adjustments" reconciles EBITDA down to the actual
            reported operating cash flow — it absorbs working-capital and
            timing effects not separately itemised in every source
            document (working capital movement is only tracked in the
            HY2026 filing, not the earlier annual reports), so this bridge
            always ties out to the real, audited cash figures rather than
            drifting from them.
          </p>
        </div>
      )}
    </div>
  );
}

function buildEbitdaBridge(
  pl: NonNullable<PeriodDetail["pl_statement"]>,
  cf: NonNullable<PeriodDetail["cash_flow"]>
): BridgeStep[] {
  const ebitda = num(pl.ebitda);
  const interest = -Math.abs(num(pl.interest_expense));
  const tax = -Math.abs(num(pl.tax_expense));
  const workingCapital = num(cf.working_capital_movement);

  const afterInterest = ebitda + interest;
  const afterTax = afterInterest + tax;
  const afterWorkingCapital = afterTax + workingCapital;
  // Plug that forces the bridge to reconcile exactly to the real,
  // reported operating cash flow — see the caption above for why this
  // is needed rather than assumed to be zero.
  const other = num(cf.net_operating_cash) - afterWorkingCapital;
  const afterOther = afterWorkingCapital + other;
  const investing = num(cf.net_investing_cash);
  const afterInvesting = afterOther + investing; // = free_cash_flow, by construction

  const step = (from: number, to: number, label: string): BridgeStep => ({
    label,
    base: Math.min(from, to),
    value: Math.abs(to - from),
    displayValue: to - from,
    kind: to - from >= 0 ? "positive" : "negative",
  });

  return [
    { ...step(0, ebitda, "EBITDA"), kind: "total" },
    step(ebitda, afterInterest, "Interest"),
    step(afterInterest, afterTax, "Tax"),
    step(afterTax, afterWorkingCapital, "Working Capital"),
    step(afterWorkingCapital, afterOther, "Other Adj."),
    step(afterOther, afterInvesting, "Investing"),
    { ...step(0, afterInvesting, "Free Cash Flow"), kind: "total" },
  ];
}

function buildBridge(cf: NonNullable<PeriodDetail["cash_flow"]>): BridgeStep[] {
  const opening = num(cf.opening_cash);
  const operating = num(cf.net_operating_cash);
  const investing = num(cf.net_investing_cash);
  const financing = num(cf.net_financing_cash);
  const closing = num(cf.closing_cash);

  const afterOperating = opening + operating;
  const afterInvesting = afterOperating + investing;
  // afterFinancing should equal `closing`; using the running total keeps
  // the bridge internally consistent even if closing_cash has minor
  // rounding vs. the sum of components.
  const afterFinancing = afterInvesting + financing;

  const step = (from: number, to: number, label: string): BridgeStep => ({
    label,
    base: Math.min(from, to),
    value: Math.abs(to - from),
    displayValue: to - from,
    kind: to - from >= 0 ? "positive" : "negative",
  });

  return [
    { label: "Opening", base: 0, value: opening, displayValue: opening, kind: "total" },
    step(opening, afterOperating, "Operating"),
    step(afterOperating, afterInvesting, "Investing"),
    step(afterInvesting, afterFinancing, "Financing"),
    { label: "Closing", base: 0, value: closing, displayValue: closing, kind: "total" },
  ];
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