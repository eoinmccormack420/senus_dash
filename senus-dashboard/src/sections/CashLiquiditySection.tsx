// src/sections/CashLiquiditySection.tsx
//
// Third dashboard section, for the CURRENTLY SELECTED period. Two
// visualizations:
//   1. A cash bridge/waterfall for the period, showing how opening
//      cash moves through operating/investing/financing to reach
//      closing cash. This is the chart a board actually wants for
//      cash: not just "cash went up," but "cash went up because of a
//      share issue, not because the business is generating cash."
//   2. An EBITDA-to-Free-Cash-Flow bridge for the same reason.
//
// The cash balance trend across all periods used to be embedded here
// too — it moved to the History tab (src/sections/HistorySection.tsx)
// since it already portrayed the full extracted history rather than
// this one period's snapshot.
//
// Recharts has no built-in waterfall type, so each bridge is built with
// a stacked bar: an invisible "base" segment plus a colored "value"
// segment, per-bar colored via Cell (same technique used for the
// negative/positive EBITDA bars that used to live in this file).

import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { type PeriodDetail, num, formatEUR } from "../api/client";
import { AIInsightCard } from "../components/AIInsightCard";
import { ResponsiveChartContainer } from "../components/ResponsiveChartContainer";
import EmptyState from "../components/EmptyState";
import {
  barRadius,
  chartCard,
  chartColors,
  chartMargin,
  chartCursor,
  CHART_HEIGHT,
  formatCompactEURTick,
  gridProps,
  tooltipStyle,
  xAxisProps,
  yAxisProps,
} from "../styles/chartTheme";

interface Props {
  detail: PeriodDetail;
}

interface BridgeStep {
  label: string;
  base: number;
  value: number;
  displayValue: number; // signed, for tooltip
  kind: "total" | "positive" | "negative";
}

interface Bridge {
  steps: BridgeStep[];
  // Recharts' stacked BarChart auto-separates positive and negative
  // values into separate per-datapoint stacks, which breaks the
  // "invisible base + visible value" waterfall trick as soon as `base`
  // needs to go negative (common here — a large operating loss can push
  // an intermediate running cash total well below zero even when
  // opening/closing cash are both positive). Every base/value below is
  // shifted up by `offset` so nothing handed to Recharts is ever
  // negative; the YAxis tickFormatter subtracts `offset` back out for
  // display. Pure vertical translation — the rendered bars land in
  // exactly the same relative positions either way.
  offset: number;
}

export function CashLiquiditySection({ detail }: Props) {
  const cf = detail.cash_flow;
  const bs = detail.balance_sheet;
  const pl = detail.pl_statement;

  if (!cf) {
    return <EmptyState>No cash flow data available for {detail.label} yet.</EmptyState>;
  }

  const bridge = buildBridge(cf);
  const ebitdaBridge = pl ? buildEbitdaBridge(pl, cf) : null;

  return (
    <div>
      <AIInsightCard insight={detail.ai_insights.find((i) => i.section === "cash_liquidity")} />

      <div style={{ marginBottom: "var(--space-6)" }}>
        <h2 style={sectionTitle}>{detail.label} cash bridge</h2>
        <div className="print-avoid-break" style={chartCard}>
          <ResponsiveChartContainer height={CHART_HEIGHT}>
            <BarChart data={bridge.steps} margin={chartMargin.bridge}>
              <defs>
                <linearGradient id="bridgeTotalFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#374151" />
                  <stop offset="100%" stopColor="#111827" />
                </linearGradient>
                <linearGradient id="bridgePositiveFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={chartColors.primaryBright} />
                  <stop offset="100%" stopColor={chartColors.primaryDeep} />
                </linearGradient>
                <linearGradient id="bridgeNegativeFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={chartColors.negativeBright} />
                  <stop offset="100%" stopColor={chartColors.negative} />
                </linearGradient>
              </defs>
              <CartesianGrid {...gridProps} />
              <XAxis
                dataKey="label"
                {...xAxisProps}
              />
              <YAxis
                {...yAxisProps}
                tickFormatter={(v) => formatCompactEURTick(Number(v) - bridge.offset)}
              />
              <Tooltip
                formatter={(_value, _name, item) =>
                  formatEUR((item.payload as BridgeStep).displayValue)
                }
                contentStyle={tooltipStyle}
                cursor={chartCursor}
              />
              <Bar dataKey="base" stackId="bridge" fill="transparent" isAnimationActive={false} />
              <Bar dataKey="value" stackId="bridge" radius={barRadius.floating} isAnimationActive={false}>
                {bridge.steps.map((step, i) => (
                  <Cell
                    key={i}
                    fill={
                      step.kind === "total"
                        ? "url(#bridgeTotalFill)"
                        : step.kind === "positive"
                          ? "url(#bridgePositiveFill)"
                          : "url(#bridgeNegativeFill)"
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveChartContainer>
        </div>
      </div>

      <div className="print-keep-together" style={{ marginBottom: "var(--space-6)" }}>
        <h2 style={sectionTitle}>Liquidity metrics</h2>
        <div className="print-avoid-break" style={breakdownGrid}>
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
        <p style={{ fontSize: "var(--text-xs)", color: "var(--color-grey-text)", marginTop: "var(--space-3)" }}>
          Current ratio compares current assets to current liabilities —
          above 1.0 means short-term obligations are covered by
          short-term assets.
        </p>
      </div>

      {ebitdaBridge && (
        <div className="print-keep-together" style={{ marginTop: "var(--space-6)" }}>
          <h2 style={sectionTitle}>EBITDA to Free Cash Flow bridge</h2>
          <div className="print-avoid-break" style={chartCard}>
            <ResponsiveChartContainer height={CHART_HEIGHT}>
              <BarChart data={ebitdaBridge.steps} margin={chartMargin.bridge}>
                <defs>
                  <linearGradient id="ebitdaBridgeTotalFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#374151" />
                    <stop offset="100%" stopColor="#111827" />
                  </linearGradient>
                  <linearGradient id="ebitdaBridgePositiveFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={chartColors.primaryBright} />
                    <stop offset="100%" stopColor={chartColors.primaryDeep} />
                  </linearGradient>
                  <linearGradient id="ebitdaBridgeNegativeFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={chartColors.negativeBright} />
                    <stop offset="100%" stopColor={chartColors.negative} />
                  </linearGradient>
                </defs>
                <CartesianGrid {...gridProps} />
                <XAxis
                  dataKey="label"
                  {...xAxisProps}
                />
                <YAxis
                  {...yAxisProps}
                  tickFormatter={(v) => formatCompactEURTick(Number(v) - ebitdaBridge.offset)}
                />
                <ReferenceLine y={ebitdaBridge.offset} stroke={chartColors.gridLine} strokeWidth={1.5} />
                <Tooltip
                  formatter={(_value, _name, item) =>
                    formatEUR((item.payload as BridgeStep).displayValue)
                  }
                  contentStyle={tooltipStyle}
                  cursor={chartCursor}
                />
                <Bar dataKey="base" stackId="ebitda-bridge" fill="transparent" isAnimationActive={false} />
                <Bar dataKey="value" stackId="ebitda-bridge" radius={barRadius.floating} isAnimationActive={false}>
                  {ebitdaBridge.steps.map((step, i) => (
                    <Cell
                      key={i}
                      fill={
                        step.kind === "total"
                          ? "url(#ebitdaBridgeTotalFill)"
                          : step.kind === "positive"
                            ? "url(#ebitdaBridgePositiveFill)"
                            : "url(#ebitdaBridgeNegativeFill)"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveChartContainer>
          </div>
          <p style={{ fontSize: "var(--text-xs)", color: "var(--color-grey-text)", marginTop: "var(--space-3)" }}>
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
): Bridge {
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

  const runningTotals = [0, ebitda, afterInterest, afterTax, afterWorkingCapital, afterOther, afterInvesting];
  const offset = -Math.min(0, ...runningTotals);

  const step = (from: number, to: number, label: string): BridgeStep => ({
    label,
    base: Math.min(from, to) + offset,
    value: Math.abs(to - from),
    displayValue: to - from,
    kind: to - from >= 0 ? "positive" : "negative",
  });

  return {
    offset,
    steps: [
      { ...step(0, ebitda, "EBITDA"), kind: "total" },
      step(ebitda, afterInterest, "Interest"),
      step(afterInterest, afterTax, "Tax"),
      step(afterTax, afterWorkingCapital, "Working Capital"),
      step(afterWorkingCapital, afterOther, "Other Adj."),
      step(afterOther, afterInvesting, "Investing"),
      // "FCF" not "Free Cash Flow" — this is the chart's rightmost/last
      // category, and the full label doesn't fit inside its tick slot at
      // the chart's fixed print width (gets silently clipped to "Free
      // Cash F" by the card's overflow:hidden). The full figure is still
      // in the Liquidity metrics table above and the chart's own heading
      // already says "EBITDA to Free Cash Flow bridge".
      { ...step(0, afterInvesting, "FCF"), kind: "total" },
    ],
  };
}

function buildBridge(cf: NonNullable<PeriodDetail["cash_flow"]>): Bridge {
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

  const runningTotals = [0, opening, afterOperating, afterInvesting, afterFinancing, closing];
  const offset = -Math.min(0, ...runningTotals);

  const step = (from: number, to: number, label: string): BridgeStep => ({
    label,
    base: Math.min(from, to) + offset,
    value: Math.abs(to - from),
    displayValue: to - from,
    kind: to - from >= 0 ? "positive" : "negative",
  });

  return {
    offset,
    steps: [
      { label: "Opening", base: offset, value: opening, displayValue: opening, kind: "total" },
      step(opening, afterOperating, "Operating"),
      step(afterOperating, afterInvesting, "Investing"),
      step(afterInvesting, afterFinancing, "Financing"),
      { label: "Closing", base: offset, value: closing, displayValue: closing, kind: "total" },
    ],
  };
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
