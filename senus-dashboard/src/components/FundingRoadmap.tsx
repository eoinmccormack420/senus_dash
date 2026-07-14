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
import { RouteIcon, SparkleIcon } from "./icons";
import { styles } from "../styles/FundingRoadmapStyles";

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
            <span style={styles.cardIconBadge}>
              <RouteIcon size={14} />
            </span>
            <p style={styles.eyebrow}>Funding Readiness Roadmap</p>
            <span style={styles.aiBadge}>
              <SparkleIcon size={9} /> AI-Generated
            </span>
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
