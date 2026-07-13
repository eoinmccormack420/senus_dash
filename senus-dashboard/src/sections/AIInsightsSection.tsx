// src/sections/AIInsightsSection.tsx
//
// Now shows just the executive summary ("outlook") — the four
// section-level commentaries moved to live inline within their
// respective sections (via AIInsightCard), so this tab no longer
// needs to repeat them. This is the one insight written to synthesise
// everything into a single board-level paragraph.

import type { PeriodDetail } from "../api/client";

interface Props {
  detail: PeriodDetail;
}

export function AIInsightsSection({ detail }: Props) {
  const outlook = detail.ai_insights.find((i) => i.section === "outlook");

  if (!outlook) {
    return (
      <div style={emptyState}>
        <p style={{ fontFamily: "var(--font-body)", fontWeight: 600, fontSize: "var(--text-lg)", color: "var(--color-ink)" }}>
          No executive summary generated yet for {detail.label}.
        </p>
        <p style={{ color: "var(--color-grey)", fontSize: "var(--text-sm)", marginTop: "var(--space-2)" }}>
          Run <code style={codeStyle}>python manage.py generate_insights --period {detail.label}</code>{" "}
          to generate board commentary from this period's validated figures.
          Individual section commentary appears inline within Revenue &amp;
          Growth, Profitability, Cash &amp; Liquidity, Solvency &amp;
          Leverage, and Returns once generated.
        </p>
      </div>
    );
  }

  return (
    <article className="print-avoid-break" style={card}>
      <header style={cardHeader}>
        <h2 style={cardTitle}>Executive Summary</h2>
        <span style={modelBadge}>{outlook.model_used}</span>
      </header>
      <p style={cardBody}>{outlook.generated_text}</p>
      <p style={cardTimestamp}>
        Generated{" "}
        {new Date(outlook.generated_at).toLocaleDateString("en-IE", {
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </p>
      <p style={{ ...cardTimestamp, marginTop: "var(--space-3)" }}>
        Section-level commentary is shown inline within each dashboard
        section.
      </p>
    </article>
  );
}

const card: React.CSSProperties = {
  border: "1px solid var(--color-forest)",
  background: "var(--color-forest-soft)",
  borderRadius: "var(--radius-md)",
  boxShadow: "var(--shadow-card)",
  padding: "var(--space-5)",
};

const cardHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "var(--space-3)",
};

const cardTitle: React.CSSProperties = {
  fontFamily: "var(--font-body)",
  fontWeight: 600,
  fontSize: "var(--text-lg)",
  color: "var(--color-ink)",
  margin: 0,
};

const modelBadge: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "var(--text-xs)",
  color: "var(--color-grey)",
  border: "1px solid var(--color-grey-line)",
  borderRadius: "var(--radius-sm)",
  padding: "2px 8px",
};

const cardBody: React.CSSProperties = {
  fontFamily: "var(--font-display)",
  fontSize: "var(--text-base)",
  lineHeight: 1.7,
  color: "var(--color-ink)",
  margin: 0,
  overflowWrap: "break-word",
  whiteSpace: "pre-wrap", // preserves the "- " Key risks lines Gemini leads with
};

const cardTimestamp: React.CSSProperties = {
  fontSize: "var(--text-xs)",
  color: "var(--color-grey)",
  marginTop: "var(--space-3)",
  marginBottom: 0,
};

const emptyState: React.CSSProperties = {
  padding: "var(--space-8)",
  textAlign: "center",
  border: "1px dashed var(--color-grey-line)",
  borderRadius: "var(--radius-md)",
};

const codeStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "var(--text-xs)",
  background: "var(--color-paper)",
  padding: "2px 6px",
  borderRadius: "var(--radius-sm)",
};