// src/components/AIInsightCard.tsx
//
// Reusable commentary callout, dropped into each section (Revenue &
// Growth, Profitability, Cash & Liquidity, Solvency & Leverage) so the
// Gemini-generated narrative sits next to the chart it's commenting on,
// rather than living only in a separate AI Insights tab.
//
// Renders nothing if no insight exists for that section yet — no
// placeholder clutter in a section that just doesn't have commentary
// generated for this period.

import type { AIInsight } from "../api/client";

interface Props {
  insight: AIInsight | undefined;
}

export function AIInsightCard({ insight }: Props) {
  if (!insight) return null;

  return (
    <div style={wrapper}>
      <div style={header}>
        <span style={badge}>
          <SparkleIcon />
          AI Insight
        </span>
        <span style={meta}>
          {insight.model_used} ·{" "}
          {new Date(insight.generated_at).toLocaleDateString("en-IE", { day: "numeric", month: "short" })}
        </span>
      </div>
      <p style={body}>{insight.generated_text}</p>
    </div>
  );
}

function SparkleIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ marginRight: 4 }}>
      <path
        d="M12 2L14.09 8.26L20.5 9.27L15.75 13.5L17.18 20L12 16.5L6.82 20L8.25 13.5L3.5 9.27L9.91 8.26L12 2Z"
        fill="currentColor"
      />
    </svg>
  );
}

const wrapper: React.CSSProperties = {
  background: "var(--color-forest-soft)",
  border: "1px solid var(--color-forest)",
  borderRadius: "var(--radius-md)",
  padding: "var(--space-4)",
  marginBottom: "var(--space-5)",
};

const header: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "var(--space-2)",
};

const badge: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  fontFamily: "var(--font-body)",
  fontSize: "var(--text-xs)",
  fontWeight: 700,
  color: "var(--color-forest)",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const meta: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "var(--text-xs)",
  color: "var(--color-grey)",
};

const body: React.CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: "var(--text-sm)",
  lineHeight: 1.6,
  color: "var(--color-ink)",
  margin: 0,
};
