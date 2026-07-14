// src/sections/AIInsightsSection.tsx
//
// Now shows just the executive summary ("outlook") — the four
// section-level commentaries moved to live inline within their
// respective sections (via AIInsightCard), so this tab no longer
// needs to repeat them. This is the one insight written to synthesise
// everything into a single board-level paragraph.

import type { PeriodDetail } from "../api/client";
import EmptyState from "../components/EmptyState";
import { card, cardHeader, cardTitle, modelBadge, cardBody, cardTimestamp, codeStyle } from "../styles/AIInsightsSectionStyles";

interface Props {
  detail: PeriodDetail;
}

export function AIInsightsSection({ detail }: Props) {
  const outlook = detail.ai_insights.find((i) => i.section === "outlook");

  if (!outlook) {
    return (
      <EmptyState>
        <p style={{ fontFamily: "var(--font-body)", fontWeight: 600, fontSize: "var(--text-lg)", color: "var(--color-ink)" }}>
          No executive summary generated yet for {detail.label}.
        </p>
        <p style={{ color: "var(--color-grey-text)", fontSize: "var(--text-sm)", marginTop: "var(--space-2)" }}>
          Run <code style={codeStyle}>python manage.py generate_insights --period {detail.label}</code>{" "}
          to generate board commentary from this period's validated figures.
          Individual section commentary appears inline within Revenue &amp;
          Growth, Profitability, Cash &amp; Liquidity, Solvency &amp;
          Leverage, and Returns once generated.
        </p>
      </EmptyState>
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
