// src/styles/DashboardStyles.ts
//
// Style constants extracted from src/Dashboard.tsx.

import type { CSSProperties } from "react";

export const styles: Record<string, CSSProperties> = {
  page: {
    maxWidth: 1200,
    margin: "0 auto",
    padding: "var(--space-6) var(--space-4)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    flexWrap: "wrap",
    gap: "var(--space-4)",
    marginBottom: "var(--space-5)",
  },
  eyebrow: {
    fontFamily: "var(--font-body)",
    fontSize: "var(--text-xs)",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "var(--color-grey-text)",
    margin: 0,
    fontWeight: 600,
  },
  title: {
    fontFamily: "var(--font-body)",
    fontWeight: 700,
    fontSize: "var(--text-xl)",
    color: "var(--color-ink)",
    margin: "var(--space-1) 0 0 0",
  },
  titleRow: {
    display: "flex",
    alignItems: "center",
    gap: "var(--space-3)",
    flexWrap: "wrap",
  },
  headerControls: {
    display: "flex",
    alignItems: "center",
    gap: "var(--space-3)",
    flexWrap: "wrap",
  },
  printButton: {
    display: "flex",
    alignItems: "center",
    gap: "var(--space-2)",
    fontFamily: "var(--font-body)",
    fontWeight: 600,
    fontSize: "var(--text-sm)",
    color: "var(--color-ink)",
    background: "var(--color-paper-raised)",
    border: "1px solid var(--color-grey-line)",
    borderRadius: "var(--radius-sm)",
    padding: "var(--space-2) var(--space-3)",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  periodTabs: {
    display: "flex",
    gap: "var(--space-2)",
    background: "var(--color-paper-raised)",
    padding: 4,
    borderRadius: "var(--radius-sm)",
    boxShadow: "var(--shadow-card)",
    maxWidth: "100%",
    minWidth: 0,
    overflowX: "auto",
  },
  periodTab: {
    fontFamily: "var(--font-body)",
    fontWeight: 500,
    fontSize: "var(--text-sm)",
    color: "var(--color-grey-text)",
    padding: "var(--space-2) var(--space-3)",
    border: "none",
    background: "transparent",
    borderRadius: 6,
    cursor: "pointer",
    flexShrink: 0,
    position: "relative",
    display: "flex",
    alignItems: "center",
  },
  periodTabActive: {
    background: "var(--color-forest)",
    color: "#FFFFFF",
  },
  periodTabDisabled: {
    opacity: 0.5,
    cursor: "not-allowed",
  },
  unauditedDot: {
    display: "inline-block",
    width: 5,
    height: 5,
    borderRadius: "50%",
    marginLeft: "var(--space-2)",
  },
  provenanceDot: {
    display: "inline-block",
    width: 5,
    height: 5,
    borderRadius: "50%",
    marginLeft: "var(--space-2)",
  },
  tabSpinner: {
    width: 11,
    height: 11,
    borderRadius: "50%",
    border: "2px solid rgba(255,255,255,0.4)",
    borderTopColor: "#FFFFFF",
    marginLeft: "var(--space-2)",
  },
  hero: {
    display: "grid",
    // Column count is set by the .hero-grid CSS rule (tokens.css), not
    // here — it needs a media query to lock to exactly 5 even columns
    // at desktop widths (there are always exactly 5 tiles: Revenue,
    // Gross Margin, Operating Loss, Cash Runway, Alerts), which inline
    // styles can't express. Below that breakpoint it falls back to
    // auto-fit so tiles still reflow sensibly on narrow screens.
    gap: "var(--space-4)",
    marginBottom: "var(--space-6)",
  },
  heroCard: {
    padding: "var(--space-4)",
  },
  // Solid rust fill for the Alerts tile when something needs attention —
  // borrowed from the reference product's own pattern of giving exactly
  // one tile in an otherwise-neutral card grid a bold color fill to draw
  // the eye (e.g. its "Monthly staff expenses" tile), rather than a red
  // banner competing with the grid instead of belonging to it. Reverts to
  // a plain white card (via the "card" className) once clear.
  heroCardAlertActive: {
    padding: "var(--space-4)",
    background: "var(--color-rust)",
    borderRadius: "var(--radius-md)",
    boxShadow: "var(--shadow-card)",
  },
  heroLabelOnAlert: {
    color: "rgba(255, 255, 255, 0.8)",
  },
  heroCardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "var(--space-2)",
  },
  heroLabel: {
    fontSize: "var(--text-xs)",
    fontWeight: 600,
    color: "var(--color-grey-text)",
    margin: 0,
  },
  heroNumber: {
    fontFamily: "var(--font-display)",
    fontSize: "var(--text-hero)",
    color: "var(--color-ink)",
    margin: "0 0 var(--space-2) 0",
    lineHeight: 1,
  },
  heroCaption: {
    fontSize: "var(--text-xs)",
    color: "var(--color-grey-text)",
    margin: "var(--space-2) 0 0 0",
  },
  runwayTrack: {
    height: 5,
    background: "var(--color-grey-line)",
    borderRadius: 3,
    marginTop: "var(--space-1)",
    overflow: "hidden",
  },
  runwayFill: {
    height: "100%",
    transition: "width 0.4s ease",
  },
  alertChipRow: {
    display: "flex",
    gap: "var(--space-1)",
    flexWrap: "wrap",
    marginTop: "var(--space-1)",
  },
  // Translucent-white pill so the chip reads against the solid rust
  // card fill (heroCardAlertActive) instead of the rust-on-tint
  // combination meant for a white card background.
  alertChipOnAlert: {
    fontFamily: "var(--font-body)",
    fontWeight: 600,
    fontSize: "var(--text-xs)",
    color: "#FFFFFF",
    background: "rgba(255, 255, 255, 0.22)",
    border: "none",
    borderRadius: 999,
    padding: "2px 8px",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  sectionNav: {
    display: "flex",
    gap: "var(--space-2)",
    marginBottom: "var(--space-5)",
    flexWrap: "wrap",
  },
  sectionNavItem: {
    background: "var(--color-paper-raised)",
    border: "1px solid var(--color-grey-line)",
    borderRadius: 999,
    padding: "var(--space-2) var(--space-4)",
    fontFamily: "var(--font-body)",
    fontWeight: 500,
    fontSize: "var(--text-sm)",
    color: "var(--color-grey-text)",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  sectionNavItemActive: {
    background: "var(--color-forest)",
    border: "1px solid var(--color-forest)",
    color: "#FFFFFF",
  },
  sectionBody: {
    minHeight: 400,
  },
  errorState: {
    padding: "var(--space-8)",
    textAlign: "center",
  },
};
