// src/styles/StrategicGoalsSectionStyles.ts
//
// Style constants extracted from src/settings/StrategicGoalsSection.tsx.

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

export const generateButton: CSSProperties = {
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

export const genResultText: CSSProperties = {
  fontSize: "var(--text-xs)",
  color: "var(--color-grey-text)",
  margin: "var(--space-2) 0 0 0",
};

export const goalList: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-3)",
  marginTop: "var(--space-5)",
};

export const goalCard: CSSProperties = {
  border: "1px solid var(--color-grey-line)",
  borderRadius: "var(--radius-sm)",
  padding: "var(--space-3)",
};

export const goalHeader: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "var(--space-2)",
};

export const goalTitle: CSSProperties = {
  fontSize: "var(--text-sm)",
  fontWeight: 700,
  color: "var(--color-ink)",
  margin: 0,
};

export const statusBadge: CSSProperties = {
  fontSize: "var(--text-xs)",
  fontWeight: 600,
  padding: "2px 8px",
  borderRadius: 999,
  textTransform: "capitalize",
};

export const goalText: CSSProperties = {
  fontSize: "var(--text-sm)",
  color: "var(--color-ink)",
  margin: "0 0 var(--space-2) 0",
};

export const goalRationale: CSSProperties = {
  fontSize: "var(--text-xs)",
  color: "var(--color-grey-text)",
  fontStyle: "italic",
  margin: "0 0 var(--space-3) 0",
};

export const actionRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--space-3)",
};

export const commitButton: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontWeight: 600,
  fontSize: "var(--text-sm)",
  color: "#FFFFFF",
  background: "var(--color-forest)",
  border: "none",
  borderRadius: "var(--radius-sm)",
  padding: "var(--space-2) var(--space-3)",
  cursor: "pointer",
};

export const dismissButton: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontWeight: 600,
  fontSize: "var(--text-sm)",
  color: "var(--color-rust)",
  background: "none",
  border: "1px solid var(--color-rust)",
  borderRadius: "var(--radius-sm)",
  padding: "var(--space-2) var(--space-3)",
  cursor: "pointer",
};

export const errorText: CSSProperties = {
  fontSize: "var(--text-sm)",
  color: "var(--color-rust)",
  marginTop: "var(--space-2)",
};
