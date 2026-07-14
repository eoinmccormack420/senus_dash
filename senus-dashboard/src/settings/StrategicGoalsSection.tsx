// src/settings/StrategicGoalsSection.tsx
//
// Admin-only — the Strategic Advisory Agent (board/extraction/advisory.py).
// "Generate goals" wraps GenerateAdvisoryGoalsView, which reuses
// generate_goals_for_period() so this behaves identically to
// `python manage.py generate_goals`, including its cache: unchanged
// figures are skipped, not re-billed. Commit/Dismiss/Complete wrap
// AdvisoryGoalViewSet's actions — same approve/reject-as-actions shape
// as the Governance Center's extraction-attempt review flow.

import { useEffect, useState } from "react";
import {
  adminApi,
  advisoryGoalsApi,
  boardApi,
  type AdvisoryGoal,
  type GenerateGoalsResult,
} from "../api/client";

export function StrategicGoalsSection() {
  const [periodId, setPeriodId] = useState<number | null>(null);
  const [periodLabel, setPeriodLabel] = useState<string>("");
  const [goals, setGoals] = useState<AdvisoryGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [genResult, setGenResult] = useState<GenerateGoalsResult | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    boardApi
      .getLatestPeriod()
      .then((detail) => {
        setPeriodId(detail.id);
        setPeriodLabel(detail.label);
        setGoals(detail.advisory_goals);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't load goals."))
      .finally(() => setLoading(false));
  }, []);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    setGenResult(null);
    try {
      const res = await adminApi.generateGoals();
      setGenResult(res);
      if (periodId !== null) {
        const detail = await boardApi.getPeriod(periodId);
        setGoals(detail.advisory_goals);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't generate goals.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleAction(goal: AdvisoryGoal, action: "commit" | "dismiss" | "complete") {
    setBusyId(goal.id);
    setError(null);
    try {
      const updated = await advisoryGoalsApi[action](goal.id);
      setGoals((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));
    } catch (err) {
      setError(err instanceof Error ? err.message : `Couldn't ${action} goal.`);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <h2 style={title}>Strategic goals</h2>
      <p style={caption}>
        AI-suggested SMART goals for improving funding readiness, generated from the latest
        period's figures. Sections whose figures haven't changed are skipped automatically on
        regenerate — this won't burn API quota on unchanged data. Commit a goal to track it on the
        Dashboard's Funding Marathon Progress card.
      </p>
      <button type="button" onClick={handleGenerate} disabled={generating} style={generateButton}>
        {generating ? "Generating…" : "Generate goals"}
      </button>
      {genResult && (
        <p style={genResultText}>
          {genResult.period}: {genResult.result.status} — {genResult.result.detail}
        </p>
      )}

      {loading ? (
        <p style={caption}>Loading…</p>
      ) : goals.length === 0 ? (
        <p style={caption}>No goals yet for {periodLabel || "the latest period"}.</p>
      ) : (
        <div style={goalList}>
          {goals.map((goal) => (
            <div key={goal.id} style={goalCard}>
              <div style={goalHeader}>
                <p style={goalTitle}>{goal.title}</p>
                <span style={{ ...statusBadge, ...statusStyle(goal.status) }}>{goal.status}</span>
              </div>
              <p style={goalText}>{goal.description}</p>
              <p style={goalRationale}>{goal.rationale}</p>
              <div style={actionRow}>
                {goal.status === "suggested" && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleAction(goal, "commit")}
                      disabled={busyId === goal.id}
                      style={commitButton}
                    >
                      {busyId === goal.id ? "…" : "Commit to Goal"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAction(goal, "dismiss")}
                      disabled={busyId === goal.id}
                      style={dismissButton}
                    >
                      {busyId === goal.id ? "…" : "Dismiss"}
                    </button>
                  </>
                )}
                {goal.status === "committed" && (
                  <button
                    type="button"
                    onClick={() => handleAction(goal, "complete")}
                    disabled={busyId === goal.id}
                    style={commitButton}
                  >
                    {busyId === goal.id ? "…" : "Mark Complete"}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {error && <p style={errorText}>{error}</p>}
    </div>
  );
}

function statusStyle(status: AdvisoryGoal["status"]): React.CSSProperties {
  if (status === "committed") return { color: "#A8720E", background: "#FBF1DE" };
  if (status === "completed") return { color: "#1A8A5C", background: "#E6F6EF" };
  if (status === "dismissed") return { color: "var(--color-grey-text)", background: "var(--color-paper)" };
  return { color: "var(--color-forest)", background: "var(--color-forest-soft)" };
}

const title: React.CSSProperties = {
  fontFamily: "var(--font-body)",
  fontWeight: 700,
  fontSize: "var(--text-lg)",
  color: "var(--color-ink)",
  margin: "0 0 var(--space-2) 0",
};

const caption: React.CSSProperties = {
  fontSize: "var(--text-xs)",
  color: "var(--color-grey-text)",
  margin: "0 0 var(--space-4) 0",
};

const generateButton: React.CSSProperties = {
  fontFamily: "var(--font-body)",
  fontWeight: 600,
  fontSize: "var(--text-sm)",
  color: "var(--color-on-accent)",
  background: "var(--color-forest)",
  border: "none",
  borderRadius: "var(--radius-sm)",
  padding: "var(--space-2) var(--space-3)",
  cursor: "pointer",
};

const genResultText: React.CSSProperties = {
  fontSize: "var(--text-xs)",
  color: "var(--color-grey-text)",
  margin: "var(--space-2) 0 0 0",
};

const goalList: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-3)",
  marginTop: "var(--space-5)",
};

const goalCard: React.CSSProperties = {
  border: "1px solid var(--color-grey-line)",
  borderRadius: "var(--radius-sm)",
  padding: "var(--space-3)",
};

const goalHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "var(--space-2)",
};

const goalTitle: React.CSSProperties = {
  fontSize: "var(--text-sm)",
  fontWeight: 700,
  color: "var(--color-ink)",
  margin: 0,
};

const statusBadge: React.CSSProperties = {
  fontSize: "var(--text-xs)",
  fontWeight: 600,
  padding: "2px 8px",
  borderRadius: 999,
  textTransform: "capitalize",
};

const goalText: React.CSSProperties = {
  fontSize: "var(--text-sm)",
  color: "var(--color-ink)",
  margin: "0 0 var(--space-2) 0",
};

const goalRationale: React.CSSProperties = {
  fontSize: "var(--text-xs)",
  color: "var(--color-grey-text)",
  fontStyle: "italic",
  margin: "0 0 var(--space-3) 0",
};

const actionRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--space-3)",
};

const commitButton: React.CSSProperties = {
  fontFamily: "var(--font-body)",
  fontWeight: 600,
  fontSize: "var(--text-sm)",
  color: "#FFFFFF",
  background: "var(--color-forest)",
  border: "none",
  borderRadius: "var(--radius-sm)",
  padding: "var(--space-2) var(--space-3)",
  cursor: "pointer",
};

const dismissButton: React.CSSProperties = {
  fontFamily: "var(--font-body)",
  fontWeight: 600,
  fontSize: "var(--text-sm)",
  color: "var(--color-rust)",
  background: "none",
  border: "1px solid var(--color-rust)",
  borderRadius: "var(--radius-sm)",
  padding: "var(--space-2) var(--space-3)",
  cursor: "pointer",
};

const errorText: React.CSSProperties = {
  fontSize: "var(--text-sm)",
  color: "var(--color-rust)",
  marginTop: "var(--space-2)",
};
