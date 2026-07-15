// src/styles/AskDataPageStyles.ts
//
// Style constants extracted from src/AskDataPage.tsx.

import type { CSSProperties } from "react";

export const page: CSSProperties = {
  maxWidth: 900,
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
  padding: "var(--space-5)",
  borderRadius: "var(--radius-md)",
  background: "linear-gradient(135deg, var(--color-forest-soft) 0%, var(--color-paper-raised) 65%)",
  border: "1px solid var(--color-grey-line)",
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
  gap: "var(--space-2)",
  flexWrap: "wrap",
};

export const heroIconBadge: CSSProperties = {
  flexShrink: 0,
  width: 28,
  height: 28,
  borderRadius: "var(--radius-sm)",
  background: "var(--color-forest)",
  color: "var(--color-on-accent)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

export const title: CSSProperties = {
  fontFamily: "var(--font-display)",
  fontWeight: 600,
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

export const subheading: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: "var(--text-sm)",
  color: "var(--color-grey-text)",
  margin: "var(--space-1) 0 0 0",
};

export const askCard: CSSProperties = {
  padding: "var(--space-4)",
  marginBottom: "var(--space-4)",
};

export const questionInput: CSSProperties = {
  width: "100%",
  fontFamily: "var(--font-body)",
  fontSize: "var(--text-sm)",
  color: "var(--color-ink)",
  padding: "var(--space-3)",
  border: "1px solid var(--color-grey-line)",
  borderRadius: "var(--radius-sm)",
  background: "var(--color-paper)",
  resize: "vertical",
  boxSizing: "border-box",
};

export const askControls: CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  alignItems: "center",
  gap: "var(--space-2)",
  marginTop: "var(--space-2)",
};

export const periodSelect: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: "var(--text-xs)",
  fontWeight: 600,
  color: "var(--color-ink)",
  padding: "7px 10px",
  border: "1px solid var(--color-grey-line)",
  borderRadius: "var(--radius-sm)",
  background: "var(--color-paper-raised)",
};

export const askButton: CSSProperties = {
  display: "flex",
  alignItems: "center",
  fontFamily: "var(--font-body)",
  fontSize: "var(--text-xs)",
  fontWeight: 600,
  padding: "8px 18px",
  borderRadius: "var(--radius-sm)",
  border: "none",
  background: "var(--color-forest)",
  color: "var(--color-on-accent)",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

export const buttonSpinner: CSSProperties = {
  width: 11,
  height: 11,
  borderRadius: "50%",
  border: "2px solid rgba(255,255,255,0.4)",
  borderTopColor: "#FFFFFF",
  marginRight: 6,
};

export const errorText: CSSProperties = {
  fontSize: "var(--text-xs)",
  color: "var(--color-rust)",
  margin: "var(--space-2) 0 0 0",
};

export const sectionHeading: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontWeight: 700,
  fontSize: "var(--text-lg)",
  color: "var(--color-ink)",
  margin: "var(--space-4) 0 var(--space-3) 0",
};

export const answerCard: CSSProperties = {
  marginBottom: "var(--space-3)",
  overflow: "hidden",
};

export const answerHeader: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--space-3)",
  width: "100%",
  padding: "var(--space-3) var(--space-4)",
  border: "none",
  background: "transparent",
  font: "inherit",
  textAlign: "left",
  cursor: "pointer",
};

export const answerHeaderText: CSSProperties = {
  flex: 1,
  minWidth: 0,
};

export const answerQuestion: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: "var(--text-sm)",
  fontWeight: 600,
  color: "var(--color-ink)",
  margin: 0,
};

export const answerMeta: CSSProperties = {
  fontSize: "var(--text-xs)",
  color: "var(--color-grey-text)",
  margin: "2px 0 0 0",
};

export const chevron: CSSProperties = {
  flexShrink: 0,
  fontSize: "var(--text-sm)",
  color: "var(--color-grey-text)",
  transition: "transform 0.2s ease",
  lineHeight: 1,
};

export const collapseWrapper: CSSProperties = {
  display: "grid",
  transition: "grid-template-rows 0.25s ease",
};

export const collapseInner: CSSProperties = {
  overflow: "hidden",
  minHeight: 0,
  padding: "0 var(--space-4)",
};

export const answerBadgeRow: CSSProperties = {
  marginBottom: "var(--space-2)",
};

export const aiBadge: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "3px",
  fontSize: "10px",
  fontWeight: 700,
  color: "var(--color-forest)",
  background: "var(--color-forest-soft)",
  padding: "2px 7px",
  borderRadius: 999,
  letterSpacing: "0.02em",
};

export const answerBody: CSSProperties = {
  border: "1px solid var(--color-grey-line)",
  borderLeft: "3px solid var(--color-forest)",
  borderRadius: "var(--radius-sm)",
  background: "linear-gradient(135deg, var(--color-paper-raised) 0%, rgba(255,255,255,0.96) 100%)",
  padding: "var(--space-3) var(--space-3)",
  marginBottom: "var(--space-3)",
};

export const answerBodyHeader: CSSProperties = {
  marginBottom: "var(--space-2)",
};

export const answerBodyLabel: CSSProperties = {
  fontSize: "10px",
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--color-forest)",
};

export const answerText: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-2)",
};

export const answerHeading: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: "15px",
  fontWeight: 700,
  lineHeight: 1.4,
  color: "var(--color-ink)",
  margin: "var(--space-2) 0 0 0",
};

export const answerSubheading: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: "13px",
  fontWeight: 700,
  lineHeight: 1.4,
  color: "var(--color-forest)",
  margin: "var(--space-1) 0 0 0",
};

export const answerParagraph: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: "var(--text-sm)",
  color: "var(--color-ink)",
  lineHeight: 1.7,
  whiteSpace: "pre-wrap",
  margin: 0,
};

export const answerBullet: CSSProperties = {
  display: "flex",
  gap: "8px",
  alignItems: "flex-start",
  fontFamily: "var(--font-body)",
  fontSize: "var(--text-sm)",
  color: "var(--color-ink)",
  lineHeight: 1.7,
  margin: 0,
};

export const answerBulletMarker: CSSProperties = {
  color: "var(--color-forest)",
  fontWeight: 700,
  marginTop: 1,
};

export const sourcesList: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "var(--space-2)",
  marginBottom: "var(--space-3)",
};

export const sourcePill: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "6px 10px",
  borderRadius: 999,
  background: "#2563eb",
  color: "#ffffff",
  fontSize: "var(--text-xs)",
  fontWeight: 700,
  border: "1px solid rgba(37, 99, 235, 0.2)",
};
