// src/styles/NotificationsSectionStyles.ts
//
// Style constants extracted from src/settings/NotificationsSection.tsx.

import type { CSSProperties } from "react";

export const title: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontWeight: 700,
  fontSize: "var(--text-lg)",
  color: "var(--color-ink)",
  margin: "0 0 var(--space-4) 0",
};

export const toggleRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--space-2)",
  fontSize: "var(--text-sm)",
  color: "var(--color-ink)",
  cursor: "pointer",
};

export const checkbox: CSSProperties = {
  width: 16,
  height: 16,
  cursor: "pointer",
};

export const caption: CSSProperties = {
  fontSize: "var(--text-xs)",
  color: "var(--color-grey-text)",
  margin: "var(--space-2) 0 0 0",
};

export const channelSection: CSSProperties = {
  marginTop: "var(--space-5)",
  paddingTop: "var(--space-4)",
  borderTop: "1px solid var(--color-grey-line)",
};

export const sectionTitle: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontWeight: 700,
  fontSize: "var(--text-md)",
  color: "var(--color-ink)",
  margin: "0 0 var(--space-2) 0",
};

export const sectionCaption: CSSProperties = {
  fontSize: "var(--text-xs)",
  color: "var(--color-grey-text)",
  margin: "0 0 var(--space-4) 0",
};

export const card: CSSProperties = {
  border: "1px solid var(--color-grey-line)",
  borderRadius: "var(--radius-md)",
  padding: "var(--space-4)",
  marginBottom: "var(--space-3)",
  background: "var(--color-paper)",
};

export const cardHeader: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: "var(--space-3)",
};

export const cardTitleRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--space-2)",
};

export const cardIcon: CSSProperties = {
  fontSize: "var(--text-lg)",
  lineHeight: 1,
};

export const cardName: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontWeight: 600,
  fontSize: "var(--text-sm)",
  color: "var(--color-ink)",
};

export const cardBody: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-2)",
};

export const badge: CSSProperties = {
  fontSize: "var(--text-xs)",
  fontWeight: 600,
  padding: "3px 10px",
  borderRadius: 999,
  whiteSpace: "nowrap",
};

export const badgeConnected: CSSProperties = {
  color: "#1A8A5C",
  background: "#E6F6EF",
};

export const badgeNotConnected: CSSProperties = {
  color: "var(--color-grey-text)",
  background: "var(--color-paper-raised)",
};

export const connectedLabel: CSSProperties = {
  fontSize: "var(--text-sm)",
  color: "var(--color-ink)",
  margin: 0,
};

export const envNote: CSSProperties = {
  fontSize: "var(--text-xs)",
  color: "var(--color-grey-text)",
  margin: 0,
};

export const inputRow: CSSProperties = {
  display: "flex",
  gap: "var(--space-2)",
};

export const smtpGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: "var(--space-2)",
  marginBottom: "var(--space-3)",
  alignItems: "center",
};

export const smtpGridSimple: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
  gap: "var(--space-2)",
  marginBottom: "var(--space-3)",
};

export const providerSelect: CSSProperties = {
  display: "block",
  fontFamily: "var(--font-body)",
  fontSize: "var(--text-sm)",
  padding: "var(--space-2)",
  border: "1px solid var(--color-grey-line)",
  borderRadius: "var(--radius-sm)",
  background: "var(--color-paper)",
  color: "var(--color-ink)",
  marginBottom: "var(--space-2)",
  minWidth: 220,
};

export const tlsLabel: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--space-2)",
  fontSize: "var(--text-sm)",
  color: "var(--color-ink)",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

export const input: CSSProperties = {
  flex: 1,
  minWidth: 0,
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

export const connectButton: CSSProperties = {
  ...saveButton,
  alignSelf: "flex-start",
};

export const testButton: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontWeight: 600,
  fontSize: "var(--text-sm)",
  color: "var(--color-ink)",
  background: "none",
  border: "1px solid var(--color-grey-line)",
  borderRadius: "var(--radius-sm)",
  padding: "var(--space-2) var(--space-3)",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

export const disconnectButton: CSSProperties = {
  ...testButton,
  color: "var(--color-rust)",
  borderColor: "var(--color-rust)",
};

export const linkButton: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontWeight: 500,
  fontSize: "var(--text-xs)",
  color: "var(--color-grey-text)",
  background: "none",
  border: "none",
  padding: 0,
  marginTop: "var(--space-2)",
  cursor: "pointer",
  textDecoration: "underline",
  alignSelf: "flex-start",
};

export const advancedPanel: CSSProperties = {
  marginTop: "var(--space-3)",
  paddingTop: "var(--space-3)",
  borderTop: "1px solid var(--color-grey-line)",
};

export const feedbackText: CSSProperties = {
  fontSize: "var(--text-xs)",
  color: "var(--color-grey-text)",
  margin: "var(--space-2) 0 0 0",
};
