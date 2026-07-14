// src/styles/AccountMenuStyles.ts
//
// Style constants extracted from src/components/AccountMenu.tsx.

import type { CSSProperties } from "react";

export const wrapper: CSSProperties = {
  position: "relative",
};

export const avatar: CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: "50%",
  background: "var(--color-forest)",
  color: "var(--color-on-accent)",
  border: "none",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: "var(--font-body)",
  fontWeight: 600,
  fontSize: "var(--text-xs)",
  cursor: "pointer",
  flexShrink: 0,
};

export const panel: CSSProperties = {
  position: "absolute",
  top: "calc(100% + 8px)",
  right: 0,
  minWidth: 220,
  background: "var(--color-paper-raised)",
  border: "1px solid var(--color-grey-line)",
  borderRadius: "var(--radius-sm)",
  boxShadow: "var(--shadow-card-hover)",
  padding: "var(--space-2)",
  zIndex: 10,
};

export const identityBlock: CSSProperties = {
  padding: "var(--space-2) var(--space-2)",
};

export const identityPrimary: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: "var(--text-sm)",
  fontWeight: 600,
  color: "var(--color-ink)",
  margin: 0,
  wordBreak: "break-all",
};

export const identitySecondary: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: "var(--text-xs)",
  color: "var(--color-grey-text)",
  margin: "2px 0 0 0",
};

export const divider: CSSProperties = {
  height: 1,
  background: "var(--color-grey-line)",
  margin: "var(--space-2) 0",
};

export const menuItemButton: CSSProperties = {
  display: "block",
  width: "100%",
  textAlign: "left",
  fontFamily: "var(--font-body)",
  fontSize: "var(--text-sm)",
  color: "var(--color-ink)",
  background: "none",
  border: "none",
  borderRadius: "var(--radius-sm)",
  padding: "var(--space-2)",
  cursor: "pointer",
};
