// src/styles/EcosystemChecklistSectionStyles.ts
//
// Style constants extracted from src/settings/EcosystemChecklistSection.tsx.

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

export const itemList: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-3)",
};

export const itemCard: CSSProperties = {
  border: "1px solid var(--color-grey-line)",
  borderRadius: "var(--radius-sm)",
  padding: "var(--space-3)",
};

export const itemTitle: CSSProperties = {
  fontSize: "var(--text-sm)",
  fontWeight: 700,
  color: "var(--color-ink)",
  margin: 0,
};

export const itemDescription: CSSProperties = {
  fontSize: "var(--text-xs)",
  color: "var(--color-grey-text)",
  margin: "var(--space-1) 0 var(--space-3) 0",
};

export const fieldLabel: CSSProperties = {
  display: "block",
  fontSize: "var(--text-xs)",
  fontWeight: 600,
  color: "var(--color-ink)",
  marginBottom: "var(--space-3)",
};

export const select: CSSProperties = {
  display: "block",
  marginTop: "var(--space-1)",
  fontFamily: "var(--font-body)",
  fontSize: "var(--text-sm)",
  padding: "var(--space-2)",
  border: "1px solid var(--color-grey-line)",
  borderRadius: "var(--radius-sm)",
  width: "100%",
  boxSizing: "border-box",
};

export const textarea: CSSProperties = {
  display: "block",
  marginTop: "var(--space-1)",
  fontFamily: "var(--font-body)",
  fontSize: "var(--text-sm)",
  padding: "var(--space-2)",
  border: "1px solid var(--color-grey-line)",
  borderRadius: "var(--radius-sm)",
  width: "100%",
  boxSizing: "border-box",
  resize: "vertical",
};

export const saveRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--space-3)",
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
};

export const savedText: CSSProperties = {
  fontSize: "var(--text-sm)",
  color: "#1A8A5C",
  fontWeight: 600,
};

export const errorText: CSSProperties = {
  fontSize: "var(--text-sm)",
  color: "var(--color-rust)",
  marginTop: "var(--space-2)",
};
