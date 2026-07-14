// "Funding Readiness Roadmap" — the AI-native centerpiece of
// /readiness: an ordered, time-sequenced set of phases toward investor
// readiness (board/extraction/roadmap.py), grounded in the same
// already-validated figures the Strategic Advisory Agent's goals use.
//
// Unlike FundingMilestone (real, tracked facts) or committed
// AdvisoryGoal rows, these phases are purely AI-authored narrative —
// there's no "status"/completion here, same as the Outlook narrative
// already is, since presenting an inferred status as a real fact would
// repeat the mistake corrected in the Ecosystem Checklist work.
//
// Data already lives on PeriodDetail (no separate fetch, same as
// FundingMarathonProgress) — this component only owns the "regenerate"
// mutation and its own busy/error state.

import { useState } from "react";
import { adminApi, type FundingRoadmapStep } from "../api/client";

export function FundingRoadmap({
  steps,
  isStaff,
  onRegenerated,
}: {
  steps: FundingRoadmapStep[];
  isStaff: boolean;
  onRegenerated: () => void;
}) {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const res = await adminApi.generateRoadmap();
      if (res.result.status === "error") {
        setError(res.result.detail);
      } else {
        onRegenerated();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't generate the roadmap.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <section className="card print-avoid-break" style={styles.card}>
      <div style={styles.header}>
        <div>
          <div style={styles.eyebrowRow}>
            <p style={styles.eyebrow}>Funding Readiness Roadmap</p>
            <span style={styles.aiBadge}>AI-Generated</span>
          </div>
          <p style={styles.caption}>AI-sequenced path to investor readiness, grounded in current fundamentals</p>
        </div>
        {isStaff && (
          <button type="button" onClick={handleGenerate} disabled={generating} style={styles.generateButton}>
            {generating ? (
              <>
                <span className="spinner" style={styles.spinner} /> Generating…
              </>
            ) : steps.length > 0 ? (
              "Regenerate"
            ) : (
              "Generate Roadmap"
            )}
          </button>
        )}
      </div>

      {error && <p style={styles.errorText}>{error}</p>}

      {steps.length === 0 && !generating ? (
        <p style={styles.emptyText}>
          {isStaff
            ? 'No roadmap generated yet. Click "Generate Roadmap" to have the AI lay out a sequenced path to investor readiness.'
            : "No roadmap generated yet. An admin needs to generate this."}
        </p>
      ) : (
        <div style={styles.timeline}>
          {steps.map((step, i) => (
            <div key={step.id} style={styles.phaseRow}>
              <div style={styles.railColumn}>
                <span style={styles.node}>{i + 1}</span>
                {i < steps.length - 1 && <span style={styles.connector} />}
              </div>
              <div style={styles.phaseCard}>
                <p style={styles.phaseTimeframe}>{step.timeframe}</p>
                <p style={styles.phaseTitle}>{step.title}</p>
                <p style={styles.phaseDescription}>{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      )}
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
    gap: "var(--space-3)",
    marginBottom: "var(--space-3)",
  },
  eyebrowRow: {
    display: "flex",
    alignItems: "center",
    gap: "var(--space-2)",
  },
  eyebrow: {
    fontFamily: "var(--font-body)",
    fontWeight: 600,
    fontSize: "var(--text-sm)",
    color: "var(--color-ink)",
    margin: 0,
  },
  aiBadge: {
    fontSize: "10px",
    fontWeight: 700,
    color: "var(--color-forest)",
    background: "var(--color-forest-soft)",
    padding: "2px 7px",
    borderRadius: 999,
    letterSpacing: "0.02em",
  },
  caption: {
    fontSize: "var(--text-xs)",
    color: "var(--color-grey-text)",
    margin: "var(--space-1) 0 0 0",
  },
  generateButton: {
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    fontFamily: "var(--font-body)",
    fontSize: "var(--text-xs)",
    fontWeight: 600,
    padding: "6px 14px",
    borderRadius: "var(--radius-sm)",
    border: "none",
    background: "var(--color-forest)",
    color: "var(--color-on-accent)",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  spinner: {
    width: 11,
    height: 11,
    borderRadius: "50%",
    border: "2px solid rgba(255,255,255,0.4)",
    borderTopColor: "#FFFFFF",
    marginRight: 6,
  },
  emptyText: {
    fontSize: "var(--text-xs)",
    color: "var(--color-grey-text)",
    margin: 0,
  },
  errorText: {
    fontSize: "var(--text-xs)",
    color: "var(--color-rust)",
    margin: "0 0 var(--space-3) 0",
  },
  timeline: {
    display: "flex",
    flexDirection: "column",
  },
  phaseRow: {
    display: "flex",
    gap: "var(--space-3)",
  },
  railColumn: {
    flexShrink: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    width: 32,
  },
  node: {
    flexShrink: 0,
    width: 32,
    height: 32,
    borderRadius: "50%",
    background: "var(--color-forest)",
    color: "var(--color-on-accent)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "var(--font-body)",
    fontWeight: 700,
    fontSize: "var(--text-sm)",
    boxShadow: "0 0 0 4px var(--color-forest-soft)",
  },
  // The rail connector fills the gap between nodes — a fixed min-height
  // rather than 100% so a short description doesn't collapse the line
  // to nothing, and flex: 1 so it still stretches for longer cards.
  connector: {
    flex: 1,
    width: 2,
    minHeight: "var(--space-3)",
    background: "linear-gradient(var(--color-forest), var(--color-forest-soft))",
  },
  phaseCard: {
    flex: 1,
    minWidth: 0,
    background: "var(--color-paper)",
    border: "1px solid var(--color-grey-line)",
    borderRadius: "var(--radius-md)",
    padding: "var(--space-3)",
    marginBottom: "var(--space-3)",
  },
  phaseTimeframe: {
    fontFamily: "var(--font-body)",
    fontSize: "var(--text-xs)",
    fontWeight: 700,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    color: "var(--color-forest)",
    margin: "0 0 var(--space-1) 0",
  },
  phaseTitle: {
    fontFamily: "var(--font-display)",
    fontWeight: 600,
    fontSize: "var(--text-lg)",
    color: "var(--color-ink)",
    margin: "0 0 var(--space-2) 0",
  },
  phaseDescription: {
    fontFamily: "var(--font-body)",
    fontSize: "var(--text-sm)",
    color: "var(--color-grey-text)",
    margin: 0,
    lineHeight: 1.5,
  },
};
