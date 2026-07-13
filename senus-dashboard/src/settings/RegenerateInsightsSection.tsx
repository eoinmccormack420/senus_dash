// src/settings/RegenerateInsightsSection.tsx
//
// Admin-only — wraps RegenerateInsightsView (board/views.py), which
// reuses generate_insights_for_period() (board/extraction/commentary.py)
// so this behaves identically to `python manage.py generate_insights`,
// including its cache: unchanged sections are skipped, not re-billed.

import { useState } from "react";
import { adminApi, type RegenerateInsightsResult } from "../api/client";

export function RegenerateInsightsSection() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RegenerateInsightsResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRegenerate() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await adminApi.regenerateInsights();
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't regenerate insights.");
    } finally {
      setLoading(false);
    }
  }

  const generated = result?.results.filter((r) => r.status === "generated").length ?? 0;
  const skipped = result?.results.filter((r) => r.status === "skipped").length ?? 0;
  const failed = result?.results.filter((r) => r.status === "error").length ?? 0;

  return (
    <div>
      <h2 style={title}>AI insights</h2>
      <p style={caption}>
        Regenerates commentary for the latest period. Sections whose figures haven't changed are
        skipped automatically — this won't burn API quota on unchanged data.
      </p>
      <button type="button" onClick={handleRegenerate} disabled={loading} style={regenerateButton}>
        {loading ? "Regenerating…" : "Regenerate insights"}
      </button>
      {result && (
        <div style={resultBox}>
          <p style={resultSummary}>
            {result.period}: {generated} generated, {skipped} skipped
            {failed > 0 ? `, ${failed} failed` : ""}.
          </p>
          <ul style={resultList}>
            {result.results.map((r) => (
              <li key={r.section} style={resultRow}>
                <span style={resultSection}>{r.section}</span>
                <span style={{ ...resultStatus, ...statusStyle(r.status) }}>{r.status}</span>
                <span style={resultDetail}>{r.detail}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {error && <p style={errorText}>{error}</p>}
    </div>
  );
}

function statusStyle(status: string): React.CSSProperties {
  if (status === "generated") return { color: "#1A8A5C" };
  if (status === "error") return { color: "var(--color-rust)" };
  return { color: "var(--color-grey-text)" };
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

const regenerateButton: React.CSSProperties = {
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

const resultBox: React.CSSProperties = {
  marginTop: "var(--space-4)",
};

const resultSummary: React.CSSProperties = {
  fontSize: "var(--text-sm)",
  fontWeight: 600,
  color: "var(--color-ink)",
  margin: "0 0 var(--space-2) 0",
};

const resultList: React.CSSProperties = {
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-1)",
};

const resultRow: React.CSSProperties = {
  display: "flex",
  gap: "var(--space-2)",
  fontSize: "var(--text-xs)",
  padding: "var(--space-1) 0",
  borderBottom: "1px solid var(--color-grey-line)",
};

const resultSection: React.CSSProperties = {
  color: "var(--color-ink)",
  fontWeight: 600,
  minWidth: 120,
};

const resultStatus: React.CSSProperties = {
  minWidth: 70,
  fontWeight: 600,
};

const resultDetail: React.CSSProperties = {
  color: "var(--color-grey-text)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const errorText: React.CSSProperties = {
  fontSize: "var(--text-xs)",
  color: "var(--color-rust)",
  margin: "var(--space-2) 0 0 0",
};
