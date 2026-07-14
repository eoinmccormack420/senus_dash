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
import { gaugeStyles, styles } from "../styles/FundingMarathonProgressStyles";

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
