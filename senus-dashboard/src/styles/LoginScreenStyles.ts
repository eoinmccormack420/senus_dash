// src/styles/LoginScreenStyles.ts
//
// Style constants extracted from src/LoginScreen.tsx.

import type { CSSProperties } from "react";

export const page: CSSProperties = {
  position: "relative",
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "var(--color-paper)",
  overflow: "hidden",
  padding: "var(--space-4)",
  boxSizing: "border-box",
};

export const glowTop: CSSProperties = {
  position: "absolute",
  top: "-20%",
  left: "-10%",
  width: 480,
  height: 480,
  borderRadius: "50%",
  background: "var(--color-forest-soft)",
  filter: "blur(80px)",
  opacity: 0.8,
  pointerEvents: "none",
};

export const glowBottom: CSSProperties = {
  position: "absolute",
  bottom: "-25%",
  right: "-10%",
  width: 520,
  height: 520,
  borderRadius: "50%",
  background: "var(--color-accent-soft)",
  filter: "blur(100px)",
  opacity: 0.35,
  pointerEvents: "none",
};

export const panel: CSSProperties = {
  position: "relative",
  width: 360,
  maxWidth: "100%",
  boxSizing: "border-box",
  padding: "var(--space-6) var(--space-5)",
  display: "flex",
  flexDirection: "column",
  boxShadow: "var(--shadow-card-hover)",
  zIndex: 1,
};

export const logoMark: CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: "var(--radius-sm)",
  background: "var(--color-forest)",
  color: "#FFFFFF",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: "var(--font-display)",
  fontWeight: 600,
  fontSize: "var(--text-lg)",
  marginBottom: "var(--space-4)",
};

export const googleButtonWrapper: CSSProperties = {
  display: "flex",
  justifyContent: "center",
  marginBottom: "var(--space-4)",
};

export const divider: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--space-2)",
  margin: "0 0 var(--space-4) 0",
};

export const dividerLine: CSSProperties = {
  flex: 1,
  height: 1,
  background: "var(--color-grey-line)",
};

export const dividerText: CSSProperties = {
  fontSize: "var(--text-xs)",
  color: "var(--color-grey-text)",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

export const eyebrow: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: "var(--text-xs)",
  fontWeight: 600,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--color-grey-text)",
  margin: 0,
};

export const title: CSSProperties = {
  fontFamily: "var(--font-display)",
  fontWeight: 600,
  fontSize: "var(--text-xl)",
  color: "var(--color-ink)",
  margin: "var(--space-1) 0 var(--space-2) 0",
};

export const subtitle: CSSProperties = {
  fontSize: "var(--text-sm)",
  color: "var(--color-grey-text)",
  margin: "0 0 var(--space-5) 0",
};

export const label: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  fontSize: "var(--text-sm)",
  fontWeight: 500,
  color: "var(--color-ink)",
  marginBottom: "var(--space-3)",
};

export const inputWrapper: CSSProperties = {
  position: "relative",
  display: "flex",
  alignItems: "center",
};

export const inputIcon: CSSProperties = {
  position: "absolute",
  left: 12,
  display: "flex",
  color: "var(--color-grey-text)",
  pointerEvents: "none",
};

export const input: CSSProperties = {
  width: "100%",
  fontFamily: "var(--font-body)",
  fontSize: "var(--text-base)",
  padding: "var(--space-2) var(--space-3) var(--space-2) 38px",
  border: "1px solid var(--color-grey-line)",
  borderRadius: "var(--radius-sm)",
  background: "var(--color-paper)",
};

export const toggleVisibility: CSSProperties = {
  position: "absolute",
  right: 10,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "none",
  border: "none",
  padding: 4,
  color: "var(--color-grey-text)",
  cursor: "pointer",
};

export const errorText: CSSProperties = {
  display: "flex",
  alignItems: "center",
  color: "var(--color-rust)",
  background: "var(--color-rust-soft)",
  fontSize: "var(--text-sm)",
  borderRadius: "var(--radius-sm)",
  padding: "var(--space-2) var(--space-3)",
  margin: "0 0 var(--space-3) 0",
};

export const submitButton: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  fontFamily: "var(--font-body)",
  fontWeight: 600,
  fontSize: "var(--text-base)",
  color: "#FFFFFF",
  background: "var(--color-forest)",
  border: "none",
  borderRadius: "var(--radius-sm)",
  padding: "var(--space-3)",
  cursor: "pointer",
  marginTop: "var(--space-2)",
  boxShadow: "var(--shadow-card)",
};

export const spinner: CSSProperties = {
  width: 14,
  height: 14,
  borderRadius: "50%",
  border: "2px solid rgba(255,255,255,0.4)",
  borderTopColor: "#FFFFFF",
};
