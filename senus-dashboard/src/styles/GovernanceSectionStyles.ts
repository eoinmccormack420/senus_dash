// src/styles/GovernanceSectionStyles.ts
//
// Style constants extracted from src/settings/GovernanceSection.tsx.

import type { CSSProperties } from "react";

// No green/amber tokens exist in tokens.css (only the blue accent and
// rust palettes) — these two are local to GovernanceSection's status
// badges rather than global design tokens, and defined once here so
// the three usages (badgeStyle, verifiedYes, successText) can't drift
// out of sync.
export const successColor = { text: "#1A8A5C", background: "#E6F6EF" };
export const warningColor = { text: "#A8720E", background: "#FBF1DE" };

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

export const filters: CSSProperties = {
  display: "flex",
  gap: "var(--space-3)",
  marginBottom: "var(--space-4)",
};

export const select: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: "var(--text-sm)",
  padding: "var(--space-2) var(--space-3)",
  border: "1px solid var(--color-grey-line)",
  borderRadius: "var(--radius-sm)",
  background: "var(--color-paper)",
  color: "var(--color-ink)",
};

export const errorBanner: CSSProperties = {
  color: "var(--color-rust)",
  fontSize: "var(--text-sm)",
  marginBottom: "var(--space-3)",
};

export const card: CSSProperties = {
  background: "var(--color-paper)",
  border: "1px solid var(--color-grey-line)",
  borderRadius: "var(--radius-md)",
  overflow: "hidden",
};

export const emptyText: CSSProperties = {
  padding: "var(--space-5)",
  color: "var(--color-grey-text)",
  fontSize: "var(--text-sm)",
  textAlign: "center",
};

export const table: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: "var(--text-sm)",
};

export const th: CSSProperties = {
  textAlign: "left",
  color: "var(--color-grey-text)",
  fontWeight: 500,
  fontSize: "var(--text-xs)",
  padding: "var(--space-3) var(--space-4)",
  borderBottom: "1px solid var(--color-grey-line)",
};

export const thRight: CSSProperties = { ...th, textAlign: "right" };

export const row: CSSProperties = {
  cursor: "pointer",
};

export const td: CSSProperties = {
  padding: "var(--space-3) var(--space-4)",
  borderBottom: "1px solid var(--color-grey-line)",
  color: "var(--color-ink)",
};

export const tdRight: CSSProperties = { ...td, textAlign: "right" };

export const badge: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  fontSize: "var(--text-xs)",
  fontWeight: 600,
  padding: "3px 10px",
  borderRadius: 999,
  whiteSpace: "nowrap",
};

export const verifiedYes: CSSProperties = {
  fontSize: "var(--text-xs)",
  fontWeight: 600,
  color: successColor.text,
};

export const verifiedNo: CSSProperties = {
  fontSize: "var(--text-xs)",
  color: "var(--color-grey-text)",
};

export const detailCell: CSSProperties = {
  padding: "var(--space-4)",
  background: "var(--color-paper-raised)",
  borderBottom: "1px solid var(--color-grey-line)",
};

export const sourceText: CSSProperties = {
  fontSize: "var(--text-xs)",
  color: "var(--color-grey-text)",
  margin: "0 0 var(--space-3) 0",
  wordBreak: "break-all",
};

export const fieldTable: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: "var(--text-sm)",
  marginBottom: "var(--space-4)",
};

export const fth: CSSProperties = {
  textAlign: "left",
  color: "var(--color-grey-text)",
  fontWeight: 500,
  fontSize: "var(--text-xs)",
  padding: "var(--space-2)",
  borderBottom: "1px solid var(--color-grey-line)",
};

export const fthRight: CSSProperties = { ...fth, textAlign: "right" };

export const ftd: CSSProperties = {
  padding: "var(--space-2)",
  borderBottom: "1px solid var(--color-grey-line)",
  color: "var(--color-ink)",
};

export const ftdRight: CSSProperties = { ...ftd, textAlign: "right" };

export const actionRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--space-3)",
};

export const approveButton: CSSProperties = {
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

export const rejectButton: CSSProperties = {
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

export const successText: CSSProperties = {
  fontSize: "var(--text-sm)",
  color: successColor.text,
  fontWeight: 600,
};

export const errorText: CSSProperties = {
  fontSize: "var(--text-sm)",
  color: "var(--color-rust)",
  marginTop: "var(--space-2)",
};
