// src/styles/AIInsightsSectionStyles.ts
//
// Style constants extracted from src/sections/AIInsightsSection.tsx.

import type { CSSProperties } from "react";

export const card: CSSProperties = {
  border: "1px solid var(--color-forest)",
  background: "var(--color-forest-soft)",
  borderRadius: "var(--radius-md)",
  boxShadow: "var(--shadow-card)",
  padding: "var(--space-5)",
};

export const cardHeader: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "var(--space-3)",
};

export const cardTitle: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontWeight: 600,
  fontSize: "var(--text-lg)",
  color: "var(--color-ink)",
  margin: 0,
};

export const modelBadge: CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "var(--text-xs)",
  color: "var(--color-grey-text)",
  border: "1px solid var(--color-grey-line)",
  borderRadius: "var(--radius-sm)",
  padding: "2px 8px",
};

export const cardBody: CSSProperties = {
  fontFamily: "var(--font-display)",
  fontSize: "var(--text-base)",
  lineHeight: 1.7,
  color: "var(--color-ink)",
  margin: 0,
  overflowWrap: "break-word",
  whiteSpace: "pre-wrap", // preserves the "- " Key risks lines Gemini leads with
};

export const cardTimestamp: CSSProperties = {
  fontSize: "var(--text-xs)",
  color: "var(--color-grey-text)",
  marginTop: "var(--space-3)",
  marginBottom: 0,
};

export const codeStyle: CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "var(--text-xs)",
  background: "var(--color-paper)",
  padding: "2px 6px",
  borderRadius: "var(--radius-sm)",
};
