// src/styles/FundingMarathonProgressStyles.ts
//
// Style constants extracted from src/components/FundingMarathonProgress.tsx.

import type { CSSProperties } from "react";

export const gaugeStyles: Record<string, CSSProperties> = {
  number: {
    fontFamily: "var(--font-display)",
    fontSize: "1.75rem",
    fontWeight: 600,
    fill: "var(--color-ink)",
  },
  max: {
    fontFamily: "var(--font-body)",
    fontSize: "var(--text-xs)",
    fontWeight: 500,
    fill: "var(--color-grey-text)",
  },
};

export const styles: Record<string, CSSProperties> = {
  card: {
    padding: "var(--space-4)",
    marginBottom: "var(--space-4)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "var(--space-4)",
    marginBottom: "var(--space-3)",
  },
  eyebrowRow: {
    display: "flex",
    alignItems: "center",
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
  scoreBlock: {
    flexShrink: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  scoreLabel: {
    fontSize: "var(--text-xs)",
    fontWeight: 600,
    margin: "var(--space-2) 0 0 0",
  },
  // Two boxes side by side on wide screens, stacking to one column
  // below ~520px per box (auto-fit does this without a media query).
  splitRow: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: "var(--space-3)",
    alignItems: "start",
  },
  // Subtle tint + border distinguishes each as its own contained box
  // against the card's white background, rather than just a heading
  // sitting directly in the card body.
  box: {
    background: "var(--color-paper)",
    border: "1px solid var(--color-grey-line)",
    borderRadius: "var(--radius-md)",
    padding: "var(--space-3)",
  },
  boxHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: "var(--space-2)",
  },
  boxHeadingRow: {
    display: "flex",
    alignItems: "center",
    gap: "var(--space-2)",
  },
  boxIconBadge: {
    flexShrink: 0,
    width: 20,
    height: 20,
    borderRadius: "var(--radius-sm)",
    background: "var(--color-forest-soft)",
    color: "var(--color-forest)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  boxHeading: {
    fontSize: "var(--text-xs)",
    fontWeight: 700,
    color: "var(--color-ink)",
    textTransform: "uppercase",
    letterSpacing: "0.03em",
    margin: 0,
  },
  aiBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "3px",
    fontSize: "10px",
    fontWeight: 700,
    color: "var(--color-forest)",
    background: "var(--color-forest-soft)",
    padding: "2px 7px",
    borderRadius: 999,
    letterSpacing: "0.02em",
  },
  boxCount: {
    fontSize: "var(--text-xs)",
    color: "var(--color-grey-text)",
    margin: 0,
  },
  emptyText: {
    fontSize: "var(--text-xs)",
    color: "var(--color-grey-text)",
    margin: 0,
  },
  itemList: {
    display: "flex",
    flexDirection: "column",
    gap: "var(--space-1)",
  },
  chip: {
    display: "flex",
    flexDirection: "column",
    borderRadius: "var(--radius-sm)",
    border: "1px solid",
    background: "var(--color-paper-raised)",
    overflow: "hidden",
  },
  chipHeader: {
    display: "flex",
    alignItems: "center",
    gap: "var(--space-2)",
    width: "100%",
    padding: "var(--space-2) var(--space-3)",
    border: "none",
    background: "transparent",
    font: "inherit",
    textAlign: "left",
    cursor: "pointer",
  },
  // Same green as .trend-badge.up / .provenance-verified in tokens.css —
  // "complete" here means the same thing as "verified" elsewhere.
  chipComplete: {
    background: "#E6F6EF",
    borderColor: "#CFEEDF",
  },
  // Neutral, not alarming — most periods won't have all four milestones
  // yet by design (e.g. audited financials land later than draft
  // figures), so "pending" reads as "not yet" rather than "failing".
  chipPending: {
    borderColor: "var(--color-grey-line)",
  },
  // Same amber as .provenance-pending in tokens.css — a committed goal
  // is "in progress," not a problem, but distinct from both "done" and
  // "not started yet" so it needs its own color rather than reusing
  // complete/pending.
  chipInProgress: {
    background: "#FBF1DE",
    borderColor: "#F0DDB2",
  },
  chipIcon: {
    flexShrink: 0,
    width: 18,
    height: 18,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 10,
    lineHeight: 1,
  },
  chipIconComplete: {
    background: "#1A8A5C",
    color: "#FFFFFF",
  },
  chipIconPending: {
    background: "var(--color-paper-raised)",
    color: "var(--color-grey-text)",
    border: "1px solid var(--color-grey-line)",
  },
  chipIconInProgress: {
    background: "#A8720E",
    color: "#FFFFFF",
  },
  chipTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: "var(--text-sm)",
    fontWeight: 600,
    color: "var(--color-ink)",
    margin: 0,
  },
  chevron: {
    flexShrink: 0,
    fontSize: "var(--text-sm)",
    color: "var(--color-grey-text)",
    transition: "transform 0.2s ease",
    lineHeight: 1,
  },
  collapseWrapper: {
    display: "grid",
    transition: "grid-template-rows 0.25s ease",
  },
  collapseInner: {
    overflow: "hidden",
    minHeight: 0,
    padding: "0 var(--space-3)",
  },
  chipSubtext: {
    fontSize: "var(--text-xs)",
    color: "var(--color-grey-text)",
    margin: "0 0 var(--space-2) 0",
  },
  chipNextStep: {
    fontSize: "var(--text-xs)",
    color: "var(--color-ink)",
    fontStyle: "italic",
    margin: "0 0 var(--space-2) 0",
  },
};
