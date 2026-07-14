// src/styles/DriveSectionStyles.ts
//
// Style constants extracted from src/settings/DriveSection.tsx.

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

export const fieldLabel: CSSProperties = {
  display: "block",
  fontSize: "var(--text-xs)",
  fontWeight: 600,
  color: "var(--color-ink)",
  marginBottom: "var(--space-3)",
  maxWidth: 360,
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
  background: "var(--color-paper)",
  color: "var(--color-ink)",
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

export const linkButton: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontWeight: 600,
  fontSize: "var(--text-xs)",
  color: "var(--color-grey-text)",
  background: "none",
  border: "1px solid var(--color-grey-line)",
  borderRadius: "var(--radius-sm)",
  padding: "var(--space-1) var(--space-2)",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

export const connectedText: CSSProperties = {
  fontSize: "var(--text-sm)",
  fontWeight: 600,
  color: "#1A8A5C",
  margin: 0,
};

export const feedbackText: CSSProperties = {
  fontSize: "var(--text-xs)",
  color: "var(--color-grey-text)",
  margin: "var(--space-2) 0 0 0",
};

export const errorText: CSSProperties = {
  fontSize: "var(--text-xs)",
  color: "var(--color-rust)",
  margin: "var(--space-2) 0 0 0",
};

export const folderBox: CSSProperties = {
  marginTop: "var(--space-4)",
  padding: "var(--space-3)",
  background: "var(--color-paper)",
  border: "1px solid var(--color-grey-line)",
  borderRadius: "var(--radius-sm)",
};

export const browserBox: CSSProperties = {
  marginTop: "var(--space-3)",
};

export const breadcrumbRow: CSSProperties = {
  fontSize: "var(--text-sm)",
  marginBottom: "var(--space-2)",
};

export const crumbSeparator: CSSProperties = {
  color: "var(--color-grey-text)",
};

export const crumbButton: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: "var(--text-sm)",
  color: "var(--color-forest)",
  background: "none",
  border: "none",
  padding: 0,
  cursor: "pointer",
  textDecoration: "underline",
};

export const folderList: CSSProperties = {
  listStyle: "none",
  margin: "0 0 var(--space-3) 0",
  padding: 0,
  maxHeight: 220,
  overflowY: "auto",
  border: "1px solid var(--color-grey-line)",
  borderRadius: "var(--radius-sm)",
  background: "var(--color-paper-raised)",
};

export const folderRow: CSSProperties = {
  display: "block",
  width: "100%",
  textAlign: "left",
  fontFamily: "var(--font-body)",
  fontSize: "var(--text-sm)",
  color: "var(--color-ink)",
  background: "none",
  border: "none",
  borderBottom: "1px solid var(--color-grey-line)",
  padding: "var(--space-2) var(--space-3)",
  cursor: "pointer",
};

export const syncSection: CSSProperties = {
  marginTop: "var(--space-5)",
  paddingTop: "var(--space-4)",
  borderTop: "1px solid var(--color-grey-line)",
};

export const syncRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--space-3)",
  marginTop: "var(--space-2)",
};

export const statusBadge: CSSProperties = {
  fontSize: "var(--text-xs)",
  fontWeight: 600,
  padding: "2px 10px",
  borderRadius: 999,
  whiteSpace: "nowrap",
};

export const spinnerSmall: CSSProperties = {
  width: 12,
  height: 12,
  borderRadius: "50%",
  border: "2px solid rgba(255,255,255,0.4)",
  borderTopColor: "currentColor",
  verticalAlign: "middle",
  marginRight: "var(--space-2)",
};
