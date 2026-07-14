// src/styles/ReportBuilderPageStyles.ts
//
// Style constants extracted from src/ReportBuilderPage.tsx.

import type { CSSProperties } from "react";

export const page: CSSProperties = {
  maxWidth: 1200,
  margin: "0 auto",
  padding: "var(--space-6) var(--space-4)",
};

export const header: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-end",
  flexWrap: "wrap",
  gap: "var(--space-4)",
  marginBottom: "var(--space-5)",
};

export const eyebrow: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: "var(--text-xs)",
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--color-grey-text)",
  margin: 0,
  fontWeight: 600,
};

export const titleRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--space-3)",
  flexWrap: "wrap",
};

export const title_: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontWeight: 700,
  fontSize: "var(--text-xl)",
  color: "var(--color-ink)",
  margin: "var(--space-1) 0 0 0",
};

export const backLink: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: "var(--text-sm)",
  color: "var(--color-grey-text)",
  textDecoration: "none",
};

export const sectionHeading: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontWeight: 700,
  fontSize: "var(--text-lg)",
  color: "var(--color-ink)",
  margin: "0 0 var(--space-3) 0",
};

export const formCard: CSSProperties = {
  padding: "var(--space-4)",
};

export const fieldRow: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "var(--space-3)",
};

export const fieldLabel: CSSProperties = {
  display: "block",
  fontSize: "var(--text-xs)",
  fontWeight: 600,
  color: "var(--color-ink)",
  margin: "0 0 var(--space-3) 0",
};

export const input: CSSProperties = {
  display: "block",
  marginTop: "var(--space-1)",
  width: "100%",
  boxSizing: "border-box",
  fontFamily: "var(--font-body)",
  fontSize: "var(--text-sm)",
  padding: "var(--space-2)",
  border: "1px solid var(--color-grey-line)",
  borderRadius: "var(--radius-sm)",
};

export const checkboxGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "var(--space-2)",
  marginBottom: "var(--space-3)",
};

export const checkboxLabel: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--space-2)",
  fontSize: "var(--text-sm)",
  color: "var(--color-ink)",
  marginBottom: "var(--space-3)",
};

export const createButton: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontWeight: 600,
  fontSize: "var(--text-sm)",
  color: "var(--color-on-accent)",
  background: "var(--color-forest)",
  border: "none",
  borderRadius: "var(--radius-sm)",
  padding: "var(--space-2) var(--space-4)",
  cursor: "pointer",
};

export const caption: CSSProperties = {
  fontSize: "var(--text-sm)",
  color: "var(--color-grey-text)",
};

export const specList: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-3)",
};

export const specCard: CSSProperties = {
  padding: "var(--space-3) var(--space-4)",
};

export const specHeader: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  cursor: "pointer",
};

export const specTitle: CSSProperties = {
  fontSize: "var(--text-sm)",
  fontWeight: 700,
  color: "var(--color-ink)",
  margin: 0,
};

export const specSubtitle: CSSProperties = {
  fontSize: "var(--text-xs)",
  color: "var(--color-grey-text)",
  margin: "2px 0 0 0",
};

export const caretIcon: CSSProperties = {
  color: "var(--color-grey-text)",
};

export const specBody: CSSProperties = {
  marginTop: "var(--space-3)",
  paddingTop: "var(--space-3)",
  borderTop: "1px solid var(--color-grey-line)",
};

export const specContext: CSSProperties = {
  fontSize: "var(--text-sm)",
  color: "var(--color-ink)",
  fontStyle: "italic",
  margin: "0 0 var(--space-2) 0",
};

export const specSectionsLine: CSSProperties = {
  fontSize: "var(--text-xs)",
  color: "var(--color-grey-text)",
  margin: 0,
};

export const narrativeBox: CSSProperties = {
  marginTop: "var(--space-3)",
  padding: "var(--space-3)",
  background: "var(--color-paper)",
  border: "1px solid var(--color-grey-line)",
  borderRadius: "var(--radius-sm)",
};

export const narrativeStatus: CSSProperties = {
  fontSize: "var(--text-sm)",
  color: "var(--color-ink)",
  margin: "0 0 var(--space-2) 0",
};

export const actionRow: CSSProperties = {
  display: "flex",
  gap: "var(--space-3)",
  flexWrap: "wrap",
};

export const primaryButton: CSSProperties = {
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

export const secondaryButton: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontWeight: 600,
  fontSize: "var(--text-sm)",
  color: "var(--color-ink)",
  background: "var(--color-paper-raised)",
  border: "1px solid var(--color-grey-line)",
  borderRadius: "var(--radius-sm)",
  padding: "var(--space-2) var(--space-3)",
  cursor: "pointer",
};

export const errorText: CSSProperties = {
  fontSize: "var(--text-sm)",
  color: "var(--color-rust)",
  marginTop: "var(--space-2)",
};

export const loadingBlock: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--space-3)",
};

export const loadingTitle: CSSProperties = {
  fontSize: "var(--text-sm)",
  fontWeight: 600,
  color: "var(--color-ink)",
  margin: 0,
};

export const loadingSubtext: CSSProperties = {
  fontSize: "var(--text-xs)",
  color: "var(--color-grey-text)",
  margin: "2px 0 0 0",
};

export const spinnerLarge: CSSProperties = {
  flexShrink: 0,
  width: 22,
  height: 22,
  borderRadius: "50%",
  border: "3px solid var(--color-grey-line)",
  borderTopColor: "var(--color-forest)",
};

export const spinnerSmall: CSSProperties = {
  width: 12,
  height: 12,
  borderRadius: "50%",
  border: "2px solid rgba(128,128,128,0.35)",
  borderTopColor: "currentColor",
  verticalAlign: "middle",
  marginRight: "var(--space-2)",
};
