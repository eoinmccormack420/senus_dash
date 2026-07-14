// src/styles/RegenerateInsightsSectionStyles.ts
//
// Style constants extracted from src/settings/RegenerateInsightsSection.tsx.

import type { CSSProperties } from "react";

export const title: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontWeight: 700,
  fontSize: "var(--text-lg)",
  color: "var(--color-ink)",
  margin: "0 0 var(--space-2) 0",
};

export const caption: CSSProperties = {
  fontSize: "var(--text-xs)",
  color: "var(--color-grey-text)",
  margin: "0 0 var(--space-4) 0",
};

export const regenerateButton: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontWeight: 600,
  fontSize: "var(--text-sm)",
  color: "var(--color-on-accent)",
  background: "var(--color-forest)",
  border: "none",
  borderRadius: "var(--radius-sm)",
  padding: "var(--space-2) var(--space-3)",
  cursor: "pointer",
};

export const resultBox: CSSProperties = {
  marginTop: "var(--space-4)",
};

export const resultSummary: CSSProperties = {
  fontSize: "var(--text-sm)",
  fontWeight: 600,
  color: "var(--color-ink)",
  margin: "0 0 var(--space-2) 0",
};

export const resultList: CSSProperties = {
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-1)",
};

export const resultRow: CSSProperties = {
  display: "flex",
  gap: "var(--space-2)",
  fontSize: "var(--text-xs)",
  padding: "var(--space-1) 0",
  borderBottom: "1px solid var(--color-grey-line)",
};

export const resultSection: CSSProperties = {
  color: "var(--color-ink)",
  fontWeight: 600,
  minWidth: 120,
};

export const resultStatus: CSSProperties = {
  minWidth: 70,
  fontWeight: 600,
};

export const resultDetail: CSSProperties = {
  color: "var(--color-grey-text)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

export const errorText: CSSProperties = {
  fontSize: "var(--text-xs)",
  color: "var(--color-rust)",
  margin: "var(--space-2) 0 0 0",
};
