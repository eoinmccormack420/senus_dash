// src/styles/chartTheme.ts
//
// Shared Recharts styling so every chart across the 6 report sections
// reads from the same design tokens (tokens.css) instead of each section
// hardcoding its own hex literals — those literals were left over from
// the pre-rebrand green/rust palette and had drifted out of sync with the
// blue palette used everywhere else in the dashboard.

export const chartCard: React.CSSProperties = {
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,255,0.96) 100%)",
  border: "1px solid var(--color-grey-line)",
  borderRadius: "var(--radius-md)",
  boxShadow: "var(--shadow-card)",
  padding: "28px 28px 22px",
  width: "100%",
  minWidth: 0,
  // Without this, a chart that renders taller/wider than expected (seen
  // in print, where Recharts' ResponsiveContainer recalculates against a
  // different width than screen) bleeds its bars/lines past this card's
  // rounded border into whatever sits next to it, rather than being
  // clipped to the card like breakdownGrid's table already is.
  overflowX: "auto",
  overflowY: "hidden",
};

// Fixed pixel width used only for print-mode charts. On-screen charts
// remain responsive, but print rendering must avoid Recharts measuring
// the width while a chart's section is still off-screen/hidden.
export const CHART_WIDTH = 620;

// Shared on-screen chart heights so switching between section tabs
// doesn't visibly resize the layout — one tier for a single chart,
// one for dual-axis/bridge charts that need more vertical room.
export const CHART_HEIGHT = 280;
export const CHART_HEIGHT_TALL = 320;

export const axisTick = {
  fontFamily: "var(--font-body)",
  fontSize: "var(--text-xs)",
  fontWeight: 700,
  fill: "#7C879D",
};

export const tooltipStyle: React.CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: "var(--text-sm)",
  color: "var(--color-ink)",
  background: "rgba(255, 255, 255, 0.96)",
  border: "1px solid rgba(209, 217, 235, 0.92)",
  borderRadius: "var(--radius-md)",
  boxShadow: "0 18px 44px rgba(20, 24, 31, 0.16)",
  padding: "12px 14px",
  backdropFilter: "blur(12px)",
};

export const chartColors = {
  primary: "#3457E8", // positive/headline series
  primaryBright: "#6385FF",
  primaryDeep: "#203FC6",
  negative: "#E0483F", // loss/negative series
  negativeBright: "#F66F66",
  secondary: "#14181F", // muted comparison series (e.g. margin %) — matches --color-ink
  secondarySoft: "#6B7280",
  softPrimary: "#DCE5FF",
  softNegative: "#FCE0DE",
  neutral: "#1F2937", // "total" bars in bridges
  neutralSoft: "#E9EEF8",
  gridLine: "rgba(139, 151, 176, 0.22)",
  axisLabel: "#7C879D",
  selectedStroke: "#0B1020",
  selectedGuide: "rgba(52, 87, 232, 0.22)",
};

export const chartMargin = {
  standard: { top: 26, right: 22, bottom: 18, left: 4 },
  dualAxis: { top: 34, right: 22, bottom: 18, left: 6 },
  bridge: { top: 24, right: 22, bottom: 24, left: 4 },
};

export const xAxisProps = {
  tick: axisTick,
  axisLine: false,
  tickLine: false,
  tickMargin: 12,
  minTickGap: 12,
};

export const yAxisProps = {
  tick: axisTick,
  axisLine: false,
  tickLine: false,
  tickMargin: 12,
  width: 58,
};

export const gridProps = {
  stroke: chartColors.gridLine,
  strokeDasharray: "2 8",
  vertical: false,
};

export const legendProps = {
  verticalAlign: "top" as const,
  align: "left" as const,
  iconType: "circle" as const,
  iconSize: 8,
  wrapperStyle: {
    paddingBottom: 12,
    fontSize: "var(--text-sm)",
    color: chartColors.axisLabel,
    fontWeight: 800,
  },
};

export const barRadius = {
  vertical: [12, 12, 4, 4] as [number, number, number, number],
  floating: [12, 12, 12, 12] as [number, number, number, number],
};

export const chartCursor = {
  fill: "rgba(52, 87, 232, 0.055)",
  radius: 12,
};

export const selectedDot = {
  r: 5,
  stroke: "#FFFFFF",
  strokeWidth: 3,
};

export function formatCompactEURTick(value: number, decimals = 0) {
  const abs = Math.abs(Number(value));
  const sign = Number(value) < 0 ? "-" : "";
  if (abs >= 1000000) return `${sign}\u20ac${(abs / 1000000).toFixed(1)}m`;
  if (abs >= 1000) return `${sign}\u20ac${(abs / 1000).toFixed(decimals)}k`;
  return `${sign}\u20ac${abs.toFixed(0)}`;
}

export function formatPercentTick(value: number, decimals = 0) {
  return `${Number(value).toFixed(decimals)}%`;
}
