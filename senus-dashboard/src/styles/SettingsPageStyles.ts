// src/styles/SettingsPageStyles.ts
//
// Style constants extracted from src/SettingsPage.tsx.

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

export const title: CSSProperties = {
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

export const body: CSSProperties = {
  display: "flex",
  gap: "var(--space-5)",
  alignItems: "flex-start",
  flexWrap: "wrap",
};

export const sidebar: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-1)",
  width: 220,
  flexShrink: 0,
};

export const navItem: CSSProperties = {
  textAlign: "left",
  fontFamily: "var(--font-body)",
  fontWeight: 500,
  fontSize: "var(--text-sm)",
  color: "var(--color-grey-text)",
  padding: "var(--space-2) var(--space-3)",
  border: "none",
  background: "transparent",
  borderRadius: "var(--radius-sm)",
  cursor: "pointer",
};

export const navItemActive: CSSProperties = {
  background: "var(--color-paper-raised)",
  color: "var(--color-ink)",
  fontWeight: 600,
  boxShadow: "var(--shadow-card)",
};

export const content: CSSProperties = {
  flex: 1,
  minWidth: 280,
  background: "var(--color-paper-raised)",
  borderRadius: "var(--radius-md)",
  boxShadow: "var(--shadow-card)",
  padding: "var(--space-5)",
};
