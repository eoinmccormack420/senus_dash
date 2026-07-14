// src/styles/NearbyIncubatorsStyles.ts
//
// Style constants extracted from src/components/NearbyIncubators.tsx.

import type { CSSProperties } from "react";

export const styles: Record<string, CSSProperties> = {
  card: {
    padding: "var(--space-4)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "var(--space-3)",
    marginBottom: "var(--space-3)",
  },
  eyebrowRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: "var(--space-2)",
  },
  cardIconBadge: {
    flexShrink: 0,
    width: 24,
    height: 24,
    borderRadius: "var(--radius-sm)",
    background: "var(--color-forest-soft)",
    color: "var(--color-forest)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  eyebrow: {
    fontFamily: "var(--font-body)",
    fontWeight: 600,
    fontSize: "var(--text-sm)",
    color: "var(--color-ink)",
    margin: 0,
  },
  caption: {
    fontSize: "var(--text-xs)",
    color: "var(--color-grey-text)",
    margin: "var(--space-1) 0 0 0",
  },
  refreshButton: {
    flexShrink: 0,
    fontFamily: "var(--font-body)",
    fontSize: "var(--text-xs)",
    fontWeight: 600,
    padding: "6px 14px",
    borderRadius: "var(--radius-sm)",
    border: "1px solid var(--color-grey-line)",
    background: "var(--color-paper-raised)",
    color: "var(--color-ink)",
    cursor: "pointer",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
    gap: "var(--space-3)",
  },
  tile: {
    padding: "var(--space-3)",
    display: "flex",
    flexDirection: "column",
  },
  tileTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "var(--space-2)",
  },
  tilePin: {
    flexShrink: 0,
    width: 26,
    height: 26,
    borderRadius: "50%",
    background: "var(--color-forest-soft)",
    color: "var(--color-forest)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  ratingBadge: {
    fontSize: "var(--text-xs)",
    fontWeight: 700,
    color: "#A8720E",
    background: "#FBF1DE",
    padding: "2px 7px",
    borderRadius: 999,
    whiteSpace: "nowrap",
  },
  tileTitle: {
    fontSize: "var(--text-sm)",
    fontWeight: 600,
    color: "var(--color-ink)",
    margin: "0 0 var(--space-1) 0",
  },
  tileAddress: {
    fontSize: "var(--text-xs)",
    color: "var(--color-grey-text)",
    margin: 0,
    flex: 1,
  },
  tileLink: {
    display: "inline-block",
    fontSize: "var(--text-xs)",
    fontWeight: 600,
    color: "var(--color-forest)",
    textDecoration: "none",
    marginTop: "var(--space-2)",
  },
  lastRefreshed: {
    fontSize: "var(--text-xs)",
    color: "var(--color-grey-text)",
    margin: "var(--space-3) 0 0 0",
  },
  emptyText: {
    fontSize: "var(--text-xs)",
    color: "var(--color-grey-text)",
    margin: 0,
  },
  errorText: {
    fontSize: "var(--text-xs)",
    color: "var(--color-rust)",
    margin: 0,
  },
};
