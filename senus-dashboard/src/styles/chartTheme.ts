// src/styles/chartTheme.ts
//
// Shared Recharts styling so every chart across the 6 report sections
// reads from the same design tokens (tokens.css) instead of each section
// hardcoding its own hex literals — those literals were left over from
// the pre-rebrand green/rust palette and had drifted out of sync with the
// blue palette used everywhere else in the dashboard.

export const chartCard: React.CSSProperties = {
  background: "var(--color-paper-raised)",
  border: "1px solid var(--color-grey-line)",
  borderRadius: "var(--radius-md)",
  boxShadow: "var(--shadow-card)",
  padding: "var(--space-4)",
};

export const axisTick = {
  fontFamily: "var(--font-body)",
  fontSize: 12,
  fill: "var(--color-grey)",
};

export const tooltipStyle: React.CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 13,
  border: "1px solid var(--color-grey-line)",
  borderRadius: "var(--radius-sm)",
  boxShadow: "var(--shadow-card)",
};

export const chartColors = {
  primary: "var(--color-forest)", // positive/headline series
  negative: "var(--color-rust)", // loss/negative series
  secondary: "var(--color-grey)", // muted comparison series (e.g. margin %)
  neutral: "var(--color-ink)", // "total" bars in bridges
  gridLine: "var(--color-grey-line)",
};
