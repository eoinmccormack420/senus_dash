// src/styles/FundingReadinessPageStyles.ts
//
// Style constants extracted from src/FundingReadinessPage.tsx.

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
  gap: "var(--space-3)",
  flexWrap: "wrap",
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

export const sectionHeadingRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--space-2)",
  margin: "var(--space-4) 0 var(--space-3) 0",
};

export const sectionIconBadge: CSSProperties = {
  flexShrink: 0,
  width: 26,
  height: 26,
  borderRadius: "var(--radius-sm)",
  background: "var(--color-forest-soft)",
  color: "var(--color-forest)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

export const sectionHeading: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontWeight: 700,
  fontSize: "var(--text-lg)",
  color: "var(--color-ink)",
  margin: 0,
};

export const skeletonStack: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-5)",
};

export const errorText: CSSProperties = {
  fontFamily: "var(--font-body)",
  color: "var(--color-grey-text)",
};
