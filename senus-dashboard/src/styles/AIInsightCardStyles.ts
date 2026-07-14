// src/styles/AIInsightCardStyles.ts
//
// Style constants extracted from src/components/AIInsightCard.tsx.

import type { CSSProperties } from "react";

export const wrapper: CSSProperties = {
  background: "var(--color-forest-soft)",
  border: "1px solid var(--color-forest)",
  borderRadius: "var(--radius-md)",
  padding: "var(--space-4)",
  marginBottom: "var(--space-5)",
};

export const header: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "var(--space-2)",
};

export const badge: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  fontFamily: "var(--font-body)",
  fontSize: "var(--text-xs)",
  fontWeight: 700,
  color: "var(--color-forest)",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

export const meta: CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: "var(--text-xs)",
  color: "var(--color-grey-text)",
};

export const body: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: "var(--text-sm)",
  lineHeight: 1.6,
  color: "var(--color-ink)",
  margin: 0,
  overflowWrap: "break-word",
};
