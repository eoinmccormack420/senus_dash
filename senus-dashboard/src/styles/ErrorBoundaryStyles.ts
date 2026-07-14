// src/styles/ErrorBoundaryStyles.ts
//
// Style constants extracted from src/components/ErrorBoundary.tsx.

import type { CSSProperties } from "react";

export const page: CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "var(--color-paper)",
  padding: "var(--space-4)",
  boxSizing: "border-box",
};

export const panel: CSSProperties = {
  width: 360,
  maxWidth: "100%",
  boxSizing: "border-box",
  padding: "var(--space-6) var(--space-5)",
  background: "var(--color-paper-raised)",
  borderRadius: "var(--radius-md)",
  boxShadow: "var(--shadow-card-hover)",
  textAlign: "center",
};

export const eyebrow: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: "var(--text-xs)",
  fontWeight: 600,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--color-grey-text)",
  margin: "0 0 var(--space-2) 0",
};

export const title: CSSProperties = {
  fontFamily: "var(--font-display)",
  fontWeight: 600,
  fontSize: "var(--text-xl)",
  color: "var(--color-ink)",
  margin: "0 0 var(--space-2) 0",
};

export const message: CSSProperties = {
  fontSize: "var(--text-sm)",
  color: "var(--color-grey-text)",
  margin: "0 0 var(--space-5) 0",
};

export const button: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontWeight: 600,
  fontSize: "var(--text-base)",
  color: "var(--color-on-accent)",
  background: "var(--color-forest)",
  border: "none",
  borderRadius: "var(--radius-sm)",
  padding: "var(--space-3) var(--space-5)",
  cursor: "pointer",
  boxShadow: "var(--shadow-card)",
};
