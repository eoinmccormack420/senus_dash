// src/sections/HistorySection.tsx
//
// The "History" pseudo-tab, sitting after the real period tabs in
// Dashboard.tsx's PeriodTabs. Unlike every other tab, it isn't tied to
// a single selected period — it hosts the multi-period trend charts
// that used to live embedded inside each period section (Revenue &
// Growth, Profitability, Cash & Liquidity, Solvency & Leverage,
// Returns), now relocated here since they already portrayed the full
// extracted history rather than one period's snapshot. Per-period
// breakdowns (bridges, composition bars, metric tables) stay in their
// own section — only the "across all periods" charts moved.
//
// Fetches all periods once (same Promise.all-of-getPeriod pattern each
// section used to run independently) rather than re-fetching per
// chart, since none of these charts depend on which period tab was
// last selected.

import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { boardApi, num, formatEUR, formatPct } from "../api/client";
import { ResponsiveChartContainer } from "../components/ResponsiveChartContainer";
import { Skeleton } from "../components/Skeleton";
import {
  barRadius,
  chartCard,
  chartColors,
  chartMargin,
  chartCursor,
  CHART_HEIGHT,
  CHART_HEIGHT_TALL,
  formatCompactEURTick,
  formatPercentTick,
  gridProps,
  legendProps,
  tooltipStyle,
  xAxisProps,
  yAxisProps,
} from "../styles/chartTheme";

interface RevenuePoint {
  label: string;
  revenue: number;
  grossMarginPct: number | null;
}

interface EbitdaPoint {
  label: string;
  ebitda: number;
  operatingMarginPct: number;
}

interface CashPoint {
  label: string;
  closingCash: number;
}

interface NetAssetsPoint {
  label: string;
  netAssets: number;
}

interface MarketCapPoint {
  label: string;
  marketCap: number;
}

interface RocePoint {
  label: string;
  rocePct: number;
}

// Every point rendered equally — there's no "currently selected period"
// concept here the way there is on the per-period tabs.
const trendDot = { r: 4, strokeWidth: 2, stroke: "#FFFFFF" };

export function HistorySection() {
  const [loading, setLoading] = useState(true);
  const [revenueTrend, setRevenueTrend] = useState<RevenuePoint[]>([]);
  const [ebitdaTrend, setEbitdaTrend] = useState<EbitdaPoint[]>([]);
  const [cashTrend, setCashTrend] = useState<CashPoint[]>([]);
  const [netAssetsTrend, setNetAssetsTrend] = useState<NetAssetsPoint[]>([]);
  const [marketCapTrend, setMarketCapTrend] = useState<MarketCapPoint[]>([]);
  const [roceTrend, setRoceTrend] = useState<RocePoint[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const periods = await boardApi.listPeriods();
      const details = await Promise.all(periods.map((p) => boardApi.getPeriod(p.id)));
      if (cancelled) return;

      setRevenueTrend(
        details
          .filter((d) => d.pl_statement !== null)
          .map((d) => ({
            label: d.label,
            revenue: num(d.pl_statement!.revenue),
            grossMarginPct: d.pl_statement!.gross_margin_pct,
          }))
      );

      setEbitdaTrend(
        details
          .filter((d) => d.pl_statement !== null)
          .map((d) => {
            const pl = d.pl_statement!;
            const revenue = num(pl.revenue);
            const operatingLoss = num(pl.operating_loss);
            return {
              label: d.label,
              ebitda: pl.ebitda ?? 0,
              operatingMarginPct: revenue !== 0 ? (operatingLoss / revenue) * 100 : 0,
            };
          })
      );

      setCashTrend(
        details
          .filter((d) => d.cash_flow !== null)
          .map((d) => ({ label: d.label, closingCash: num(d.cash_flow!.closing_cash) }))
      );

      setNetAssetsTrend(
        details
          .filter((d) => d.balance_sheet !== null)
          .map((d) => ({ label: d.label, netAssets: d.balance_sheet!.net_assets }))
      );

      setMarketCapTrend(
        details
          .filter((d) => d.business_metrics?.market_cap != null)
          .map((d) => ({ label: d.label, marketCap: num(d.business_metrics!.market_cap) }))
      );

      setRoceTrend(
        details
          .filter((d) => d.roce_pct !== null)
          .map((d) => ({ label: d.label, rocePct: d.roce_pct! }))
      );

      setLoading(false);
    }

    load().catch(() => setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <p style={caption}>
        Trends across every extracted period — for a single period's figures, use the tabs above.
      </p>

      <div className="history-grid">
        {/* Row 1: the two dual-axis "amount + margin" composed charts —
            paired together so both sides of the row share the same
            taller height (dual-axis charts need extra room for the
            second y-axis + legend), rather than being matched with a
            single-axis chart at a different height. */}
        <TrendCard title="Revenue & gross margin trend" loading={loading} hasData={revenueTrend.length >= 2} height={CHART_HEIGHT_TALL}>
          <ComposedChart data={revenueTrend} margin={chartMargin.dualAxis}>
            <defs>
              <linearGradient id="historyRevenueFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={chartColors.primaryBright} />
                <stop offset="100%" stopColor={chartColors.primaryDeep} />
              </linearGradient>
              <linearGradient id="historyGrossMarginStroke" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#111827" />
                <stop offset="100%" stopColor="#64748B" />
              </linearGradient>
            </defs>
            <CartesianGrid {...gridProps} />
            <Legend {...legendProps} />
            <XAxis dataKey="label" {...xAxisProps} />
            <YAxis yAxisId="revenue" {...yAxisProps} tickFormatter={(v) => formatCompactEURTick(Number(v))} />
            <YAxis yAxisId="margin" orientation="right" {...yAxisProps} tickFormatter={(v) => formatPercentTick(Number(v))} />
            <Tooltip
              formatter={(value, name) => (name === "Revenue" ? formatEUR(Number(value)) : formatPct(Number(value)))}
              contentStyle={tooltipStyle}
              cursor={chartCursor}
            />
            <Bar
              yAxisId="revenue"
              dataKey="revenue"
              name="Revenue"
              radius={barRadius.vertical}
              barSize={42}
              fill="url(#historyRevenueFill)"
              isAnimationActive={false}
            />
            <Line
              yAxisId="margin"
              type="monotone"
              dataKey="grossMarginPct"
              name="Gross Margin %"
              stroke="url(#historyGrossMarginStroke)"
              strokeWidth={3.5}
              dot={{ ...trendDot, fill: chartColors.secondary }}
              activeDot={{ ...trendDot, r: 5, fill: chartColors.secondary }}
              isAnimationActive={false}
            />
          </ComposedChart>
        </TrendCard>

        <TrendCard title="EBITDA & operating margin trend" loading={loading} hasData={ebitdaTrend.length >= 2} height={CHART_HEIGHT_TALL}>
          <ComposedChart data={ebitdaTrend} margin={chartMargin.dualAxis}>
            <defs>
              <linearGradient id="historyEbitdaPositiveFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={chartColors.primaryBright} />
                <stop offset="100%" stopColor={chartColors.primaryDeep} />
              </linearGradient>
              <linearGradient id="historyEbitdaNegativeFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={chartColors.negativeBright} />
                <stop offset="100%" stopColor={chartColors.negative} />
              </linearGradient>
              <linearGradient id="historyOperatingMarginStroke" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#111827" />
                <stop offset="100%" stopColor="#64748B" />
              </linearGradient>
            </defs>
            <CartesianGrid {...gridProps} />
            <Legend {...legendProps} />
            <XAxis dataKey="label" {...xAxisProps} height={40} interval={0} />
            <YAxis yAxisId="ebitda" {...yAxisProps} tickFormatter={(v) => formatCompactEURTick(Number(v))} domain={["auto", "auto"]} />
            <YAxis yAxisId="margin" orientation="right" {...yAxisProps} tickFormatter={(v) => formatPercentTick(Number(v), 1)} domain={["auto", "auto"]} />
            <Tooltip
              formatter={(value, name) => (name === "EBITDA" ? formatEUR(Number(value)) : formatPct(Number(value)))}
              contentStyle={tooltipStyle}
              cursor={chartCursor}
            />
            <Bar yAxisId="ebitda" dataKey="ebitda" name="EBITDA" radius={barRadius.vertical} barSize={38} isAnimationActive={false}>
              {ebitdaTrend.map((point) => (
                <Cell key={point.label} fill={point.ebitda < 0 ? "url(#historyEbitdaNegativeFill)" : "url(#historyEbitdaPositiveFill)"} />
              ))}
            </Bar>
            <Line
              yAxisId="margin"
              type="monotone"
              dataKey="operatingMarginPct"
              name="Operating Margin %"
              stroke="url(#historyOperatingMarginStroke)"
              strokeWidth={3.5}
              dot={{ ...trendDot, fill: chartColors.secondary }}
              activeDot={{ ...trendDot, r: 5, fill: chartColors.secondary }}
              isAnimationActive={false}
            />
          </ComposedChart>
        </TrendCard>

        {/* Row 2: the two single-axis charts — same height as each
            other, deliberately shorter than row 1 since there's no
            second y-axis/legend to make room for. */}
        <TrendCard title="Cash balance trend" loading={loading} hasData={cashTrend.length >= 2} height={CHART_HEIGHT}>
          <AreaChart data={cashTrend} margin={chartMargin.standard}>
            <defs>
              <linearGradient id="historyCashFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={chartColors.primaryBright} stopOpacity={0.42} />
                <stop offset="52%" stopColor={chartColors.primary} stopOpacity={0.16} />
                <stop offset="100%" stopColor={chartColors.primary} stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="historyCashStroke" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={chartColors.primaryDeep} />
                <stop offset="100%" stopColor={chartColors.primaryBright} />
              </linearGradient>
            </defs>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="label" {...xAxisProps} />
            <YAxis {...yAxisProps} tickFormatter={(v) => formatCompactEURTick(Number(v))} />
            <Tooltip formatter={(value) => formatEUR(Number(value))} contentStyle={tooltipStyle} cursor={chartCursor} />
            <Area
              type="monotone"
              dataKey="closingCash"
              name="Cash Balance"
              stroke="url(#historyCashStroke)"
              strokeWidth={3.5}
              fill="url(#historyCashFill)"
              dot={{ ...trendDot, fill: chartColors.primary }}
              activeDot={{ ...trendDot, r: 5, fill: chartColors.primary }}
              isAnimationActive={false}
            />
          </AreaChart>
        </TrendCard>

        <TrendCard
          title="Net assets trend"
          loading={loading}
          hasData={netAssetsTrend.length >= 2}
          height={CHART_HEIGHT}
        >
          <BarChart data={netAssetsTrend} margin={chartMargin.standard}>
            <defs>
              <linearGradient id="historyNetAssetsPositiveFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={chartColors.primaryBright} />
                <stop offset="100%" stopColor={chartColors.primaryDeep} />
              </linearGradient>
              <linearGradient id="historyNetAssetsNegativeFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={chartColors.negativeBright} />
                <stop offset="100%" stopColor={chartColors.negative} />
              </linearGradient>
            </defs>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="label" {...xAxisProps} />
            <YAxis {...yAxisProps} tickFormatter={(v) => formatCompactEURTick(Number(v))} />
            <Tooltip formatter={(value) => formatEUR(Number(value))} contentStyle={tooltipStyle} cursor={chartCursor} />
            <Bar dataKey="netAssets" name="Net Assets" radius={barRadius.vertical} barSize={40} isAnimationActive={false}>
              {netAssetsTrend.map((p, i) => (
                <Cell key={i} fill={p.netAssets < 0 ? "url(#historyNetAssetsNegativeFill)" : "url(#historyNetAssetsPositiveFill)"} />
              ))}
            </Bar>
          </BarChart>
        </TrendCard>

        {/* Row 3: ROCE (return on capital employed) is already computed
            per period on the backend (FinancialPeriod.roce_pct) and
            shown as a single-period figure in the Returns tab's
            Capital Efficiency table — plotting its trend here is a
            second, more informative way to show the same underlying
            metric. It pairs naturally with Market Cap (both are
            "returns" signals) and, being available for every period
            with a P&L + balance sheet rather than only the sparse
            corporate-presentation data Market Cap depends on, also
            gives Market Cap a steady partner instead of sitting alone. */}
        <TrendCard
          title="ROCE trend"
          loading={loading}
          hasData={roceTrend.length >= 2}
          height={CHART_HEIGHT}
          spanFull={marketCapTrend.length < 2}
        >
          <AreaChart data={roceTrend} margin={chartMargin.standard}>
            <defs>
              <linearGradient id="historyRoceFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={chartColors.primaryBright} stopOpacity={0.34} />
                <stop offset="58%" stopColor={chartColors.primary} stopOpacity={0.12} />
                <stop offset="100%" stopColor={chartColors.primary} stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="historyRoceStroke" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={chartColors.primaryDeep} />
                <stop offset="100%" stopColor={chartColors.primaryBright} />
              </linearGradient>
            </defs>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="label" {...xAxisProps} />
            <YAxis {...yAxisProps} tickFormatter={(v) => formatPercentTick(Number(v))} />
            <Tooltip formatter={(value) => formatPct(Number(value))} contentStyle={tooltipStyle} cursor={chartCursor} />
            <Area
              type="monotone"
              dataKey="rocePct"
              name="ROCE"
              stroke="url(#historyRoceStroke)"
              strokeWidth={3.5}
              fill="url(#historyRoceFill)"
              dot={{ ...trendDot, fill: chartColors.primary }}
              activeDot={{ ...trendDot, r: 5, fill: chartColors.primary }}
              isAnimationActive={false}
            />
          </AreaChart>
        </TrendCard>

        {marketCapTrend.length >= 2 && (
          <TrendCard title="Market capitalisation trend" loading={loading} hasData height={CHART_HEIGHT}>
            <AreaChart data={marketCapTrend} margin={chartMargin.standard}>
              <defs>
                <linearGradient id="historyMarketCapFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={chartColors.primaryBright} stopOpacity={0.34} />
                  <stop offset="58%" stopColor={chartColors.primary} stopOpacity={0.12} />
                  <stop offset="100%" stopColor={chartColors.primary} stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="historyMarketCapStroke" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor={chartColors.primaryDeep} />
                  <stop offset="100%" stopColor={chartColors.primaryBright} />
                </linearGradient>
              </defs>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="label" {...xAxisProps} />
              <YAxis {...yAxisProps} tickFormatter={(v) => formatCompactEURTick(Number(v))} />
              <Tooltip formatter={(value) => formatEUR(Number(value))} contentStyle={tooltipStyle} cursor={chartCursor} />
              <Area
                type="monotone"
                dataKey="marketCap"
                name="Market Cap"
                stroke="url(#historyMarketCapStroke)"
                strokeWidth={3.5}
                fill="url(#historyMarketCapFill)"
                dot={{ ...trendDot, fill: chartColors.primary }}
                activeDot={{ ...trendDot, r: 5, fill: chartColors.primary }}
                isAnimationActive={false}
              />
            </AreaChart>
          </TrendCard>
        )}
      </div>
    </div>
  );
}

function TrendCard({
  title,
  loading,
  hasData,
  height,
  spanFull,
  children,
}: {
  title: string;
  loading: boolean;
  hasData: boolean;
  height: number;
  spanFull?: boolean;
  children: React.ReactElement;
}) {
  return (
    <div className={spanFull ? "history-grid-full" : undefined}>
      <h2 style={sectionTitle}>{title}</h2>
      {loading ? (
        <Skeleton height={height} radius="var(--radius-md)" />
      ) : !hasData ? (
        <div style={{ ...chartCard, padding: "var(--space-4)", color: "var(--color-grey-text)", fontSize: "var(--text-sm)" }}>
          Not enough historical data yet to show a trend.
        </div>
      ) : (
        <div style={chartCard}>
          <ResponsiveChartContainer height={height}>{children}</ResponsiveChartContainer>
        </div>
      )}
    </div>
  );
}

const caption: React.CSSProperties = {
  fontSize: "var(--text-sm)",
  color: "var(--color-grey-text)",
  margin: "0 0 var(--space-5) 0",
};

const sectionTitle: React.CSSProperties = {
  fontFamily: "var(--font-body)",
  fontWeight: 600,
  fontSize: "var(--text-lg)",
  color: "var(--color-ink)",
  marginBottom: "var(--space-4)",
};
