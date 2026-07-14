// src/styles/AlertsSectionStyles.ts
//
// Style constants extracted from src/settings/AlertsSection.tsx.

import type { CSSProperties } from "react";

export const title: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontWeight: 600,
  fontSize: "var(--text-lg)",
  color: "var(--color-ink)",
  margin: "0 0 var(--space-2) 0",
};

export const caption: CSSProperties = {
  fontSize: "var(--text-xs)",
  color: "var(--color-grey-text)",
  margin: "0 0 var(--space-4) 0",
};

export const row: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  flexWrap: "wrap",
  gap: "var(--space-2)",
  padding: "var(--space-3) 0",
  borderBottom: "1px solid var(--color-grey-line)",
};

export const toggleRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--space-2)",
  fontFamily: "var(--font-body)",
  fontSize: "var(--text-sm)",
  color: "var(--color-ink)",
  cursor: "pointer",
};

export const checkbox: CSSProperties = {
  width: 16,
  height: 16,
  cursor: "pointer",
};

export const valueRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--space-2)",
};

export const helperText: CSSProperties = {
  fontSize: "var(--text-xs)",
  color: "var(--color-grey-text)",
  whiteSpace: "nowrap",
};

export const numberInput: CSSProperties = {
  width: 80,
  fontFamily: "var(--font-body)",
  fontSize: "var(--text-sm)",
  padding: "var(--space-2)",
  border: "1px solid var(--color-grey-line)",
  borderRadius: "var(--radius-sm)",
  background: "var(--color-paper)",
  color: "var(--color-ink)",
};

export const inputRow: CSSProperties = {
  display: "flex",
  gap: "var(--space-2)",
  marginTop: "var(--space-4)",
};

export const saveButton: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontWeight: 600,
  fontSize: "var(--text-sm)",
  color: "#FFFFFF",
  background: "var(--color-forest)",
  border: "none",
  borderRadius: "var(--radius-sm)",
  padding: "var(--space-2) var(--space-3)",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

export const testButton: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontWeight: 600,
  fontSize: "var(--text-sm)",
  color: "var(--color-ink)",
  background: "none",
  border: "1px solid var(--color-grey-line)",
  borderRadius: "var(--radius-sm)",
  padding: "var(--space-2) var(--space-3)",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

export const feedbackText: CSSProperties = {
  fontSize: "var(--text-xs)",
  color: "var(--color-grey-text)",
  margin: "var(--space-2) 0 0 0",
};

export const digestSection: CSSProperties = {
  marginTop: "var(--space-5)",
  paddingTop: "var(--space-4)",
  borderTop: "1px solid var(--color-grey-line)",
};

export const sectionCaption: CSSProperties = {
  fontSize: "var(--text-xs)",
  color: "var(--color-grey-text)",
  margin: "0 0 var(--space-3) 0",
};
