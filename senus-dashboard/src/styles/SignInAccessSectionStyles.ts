// src/styles/SignInAccessSectionStyles.ts
//
// Style constants extracted from src/settings/SignInAccessSection.tsx.

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

export const emailList: CSSProperties = {
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-2)",
};

export const emailRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  fontSize: "var(--text-sm)",
  color: "var(--color-ink)",
  wordBreak: "break-all",
  padding: "var(--space-2) 0",
  borderBottom: "1px solid var(--color-grey-line)",
};

export const removeButton: CSSProperties = {
  fontSize: "var(--text-xs)",
  color: "var(--color-rust)",
  background: "none",
  border: "none",
  cursor: "pointer",
  flexShrink: 0,
  marginLeft: "var(--space-3)",
};

export const addForm: CSSProperties = {
  display: "flex",
  gap: "var(--space-2)",
  marginTop: "var(--space-4)",
};

export const addInput: CSSProperties = {
  flex: 1,
  minWidth: 0,
  fontFamily: "var(--font-body)",
  fontSize: "var(--text-sm)",
  padding: "var(--space-2)",
  border: "1px solid var(--color-grey-line)",
  borderRadius: "var(--radius-sm)",
};

export const addButton: CSSProperties = {
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

export const errorText: CSSProperties = {
  fontSize: "var(--text-xs)",
  color: "var(--color-rust)",
  margin: "var(--space-2) 0 0 0",
};
