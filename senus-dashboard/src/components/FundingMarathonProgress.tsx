// Persistent "Funding Marathon Progress" card — visible above every
// dashboard section (not just the active one), reflecting
// PeriodDetail.funding_readiness (board/readiness.py).
//
// The score (a continuous 0-100 composite) and the milestones (four
// independent yes/no conditions) are deliberately NOT plotted on one
// axis — a milestone isn't "unlocked" at some score threshold, so
// placing checkpoint dots along a score gauge would imply a
// relationship that doesn't exist. Instead: a circular SVG gauge for
// the score, with Priority Tasks and Long-Term Goals broken into two
// clearly separate boxes below it — they're different kinds of
// progress (data-derived checkpoints vs. human-committed goals) and
// reading them as one undifferentiated list blurred that distinction.
//
// Each item collapses to just its title + status icon by default —
// showing every item's full description/rationale at once read as a
// wall of paragraph text, the opposite of the compact, scannable card
// this is meant to be. Clicking a row expands it in place.

import { useState } from "react";
import type { AdvisoryGoal, FundingReadiness, FundingMilestone } from "../api/client";
import { ChecklistIcon, TargetIcon, SparkleIcon } from "./icons";

function scoreStatus(score: number | null): { color: string; label: string } {
  if (score === null) return { color: "var(--color-grey)", label: "No data yet" };
  if (score < 40) return { color: "var(--color-rust)", label: "Early Stage" };
  if (score < 70) return { color: "#C8862B", label: "Building Momentum" };
  return { color: "var(--color-forest)", label: "Investor Ready" };
}

// Circular gauge replacing the old flat progress bar — the score is
// the first thing on the page, so it gets the most visual weight.
const GAUGE_SIZE = 132;
const GAUGE_RADIUS = 54;
const GAUGE_STROKE = 10;
const GAUGE_CIRCUMFERENCE = 2 * Math.PI * GAUGE_RADIUS;

function ScoreGauge({ score, color }: { score: number | null; color: string }) {
  const center = GAUGE_SIZE / 2;
  const offset = GAUGE_CIRCUMFERENCE * (1 - (score ?? 0) / 100);
  return (
    <svg width={GAUGE_SIZE} height={GAUGE_SIZE} viewBox={`0 0 ${GAUGE_SIZE} ${GAUGE_SIZE}`}>
      <circle cx={center} cy={center} r={GAUGE_RADIUS} fill="none" stroke="var(--color-grey-line)" strokeWidth={GAUGE_STROKE} />
      <circle
        cx={center}
        cy={center}
        r={GAUGE_RADIUS}
        fill="none"
        stroke={color}
        strokeWidth={GAUGE_STROKE}
        strokeLinecap="round"
        strokeDasharray={GAUGE_CIRCUMFERENCE}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${center} ${center})`}
        style={{ transition: "stroke-dashoffset 0.6s ease" }}
      />
      <text x={center} y={center - 4} textAnchor="middle" style={gaugeStyles.number}>
        {score !== null ? Math.round(score) : "—"}
      </text>
      <text x={center} y={center + 16} textAnchor="middle" style={gaugeStyles.max}>
        / 100
      </text>
    </svg>
  );
}

const gaugeStyles: Record<string, React.CSSProperties> = {
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

// Collapsed-by-default row: title + status icon only, click to reveal
// detail below via a CSS grid-template-rows 0fr/1fr transition — this
// animates smoothly without measuring content height in JS.
function DisclosureChip({
  expanded,
  onToggle,
  chipStyle,
  icon,
  iconStyle,
  title,
  children,
}: {
  expanded: boolean;
  onToggle: () => void;
  chipStyle: React.CSSProperties;
  icon: string;
  iconStyle: React.CSSProperties;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ ...styles.chip, ...chipStyle }}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="disclosure-row"
        style={styles.chipHeader}
      >
        <span style={{ ...styles.chipIcon, ...iconStyle }}>{icon}</span>
        <p style={styles.chipTitle}>{title}</p>
        <span style={{ ...styles.chevron, transform: expanded ? "rotate(90deg)" : "rotate(0deg)" }}>›</span>
      </button>
      <div style={{ ...styles.collapseWrapper, gridTemplateRows: expanded ? "1fr" : "0fr" }}>
        <div style={styles.collapseInner}>{children}</div>
      </div>
    </div>
  );
}

export function FundingMarathonProgress({
  readiness,
  goals,
}: {
  readiness: FundingReadiness;
  goals: AdvisoryGoal[];
}) {
  const { score, milestones } = readiness;
  const { color, label } = scoreStatus(score);
  const completeCount = milestones.filter((m) => m.complete).length;
  // Only committed/completed goals show here — "suggested" ones are AI
  // proposals a human hasn't acted on yet (see StrategicGoalsSection.tsx),
  // so they don't belong on a board-facing progress card.
  const boardGoals = goals.filter((g) => g.status === "committed" || g.status === "completed");
  const completedGoalCount = boardGoals.filter((g) => g.status === "completed").length;

  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  function toggle(key: string) {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <section className="card print-avoid-break" style={styles.card}>
      <div style={styles.header}>
        <div>
          <div style={styles.eyebrowRow}>
            <span style={styles.cardIconBadge}>
              <TargetIcon size={14} />
            </span>
            <p style={styles.eyebrow}>Funding Marathon Progress</p>
          </div>
          <p style={styles.caption}>Readiness for investor engagement, scored from current fundamentals</p>
        </div>
        <div style={styles.scoreBlock}>
          <ScoreGauge score={score} color={color} />
          <p style={{ ...styles.scoreLabel, color }}>{label}</p>
        </div>
      </div>

      <div style={styles.splitRow}>
        <div style={styles.box}>
          <div style={styles.boxHeader}>
            <div style={styles.boxHeadingRow}>
              <span style={styles.boxIconBadge}>
                <ChecklistIcon size={13} />
              </span>
              <p style={styles.boxHeading}>Priority Tasks (This Period)</p>
            </div>
            <p style={styles.boxCount}>
              {completeCount} of {milestones.length} complete
            </p>
          </div>
          <div style={styles.itemList}>
            {milestones.map((m: FundingMilestone) => {
              const key = `m-${m.key}`;
              return (
                <DisclosureChip
                  key={key}
                  expanded={expandedKeys.has(key)}
                  onToggle={() => toggle(key)}
                  chipStyle={m.complete ? styles.chipComplete : styles.chipPending}
                  icon={m.complete ? "✓" : "○"}
                  iconStyle={m.complete ? styles.chipIconComplete : styles.chipIconPending}
                  title={m.title}
                >
                  <p style={styles.chipSubtext}>{m.description}</p>
                  {!m.complete && <p style={styles.chipNextStep}>Next: {m.detail}</p>}
                </DisclosureChip>
              );
            })}
          </div>
        </div>

        <div style={styles.box}>
          <div style={styles.boxHeader}>
            <div style={styles.boxHeadingRow}>
              <span style={styles.boxIconBadge}>
                <TargetIcon size={13} />
              </span>
              <p style={styles.boxHeading}>Long-Term Goals</p>
              <span style={styles.aiBadge}>
                <SparkleIcon size={9} /> AI-Generated
              </span>
            </div>
            <p style={styles.boxCount}>
              {boardGoals.length === 0
                ? "none committed"
                : `${completedGoalCount} of ${boardGoals.length} complete`}
            </p>
          </div>
          {boardGoals.length === 0 ? (
            <p style={styles.emptyText}>
              No goals committed yet. Suggest and commit SMART goals in Settings &gt; Strategic Goals.
            </p>
          ) : (
            <div style={styles.itemList}>
              {boardGoals.map((g) => {
                const key = `g-${g.id}`;
                const isComplete = g.status === "completed";
                return (
                  <DisclosureChip
                    key={key}
                    expanded={expandedKeys.has(key)}
                    onToggle={() => toggle(key)}
                    chipStyle={isComplete ? styles.chipComplete : styles.chipInProgress}
                    icon={isComplete ? "✓" : "…"}
                    iconStyle={isComplete ? styles.chipIconComplete : styles.chipIconInProgress}
                    title={g.title}
                  >
                    <p style={styles.chipSubtext}>{g.description}</p>
                    <p style={styles.chipNextStep}>Why this matters: {g.rationale}</p>
                  </DisclosureChip>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

const styles: Record<string, React.CSSProperties> = {
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
