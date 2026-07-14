// src/styles/EcosystemChecklistStyles.ts
//
// Style constants extracted from src/components/EcosystemChecklist.tsx.

import type { CSSProperties } from "react";

export const styles: Record<string, CSSProperties> = {
  card: {
    padding: "var(--space-4)",
    marginBottom: "var(--space-5)",
  },
  header: {
    marginBottom: "var(--space-3)",
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
  itemList: {
    display: "flex",
    flexDirection: "column",
    gap: "var(--space-2)",
  },
  row: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "var(--space-3)",
    padding: "var(--space-2) var(--space-3)",
    border: "1px solid var(--color-grey-line)",
    borderRadius: "var(--radius-sm)",
    background: "var(--color-paper-raised)",
  },
  rowText: {
    minWidth: 0,
  },
  rowTitle: {
    fontSize: "var(--text-sm)",
    fontWeight: 600,
    color: "var(--color-ink)",
    margin: 0,
  },
  rowDescription: {
    fontSize: "var(--text-xs)",
    color: "var(--color-grey-text)",
    margin: "2px 0 0 0",
  },
  rowNotes: {
    fontSize: "var(--text-xs)",
    color: "var(--color-ink)",
    fontStyle: "italic",
    margin: "var(--space-1) 0 0 0",
  },
  statusBadge: {
    flexShrink: 0,
    fontSize: "var(--text-xs)",
    fontWeight: 600,
    padding: "2px 10px",
    borderRadius: 999,
    whiteSpace: "nowrap",
  },
  errorText: {
    fontSize: "var(--text-xs)",
    color: "var(--color-rust)",
    margin: 0,
  },
};
