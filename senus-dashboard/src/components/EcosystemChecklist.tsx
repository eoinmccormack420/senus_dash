// Read-only "Irish Ecosystem Checklist" card — tracks the company
// against fixed Enterprise Ireland / Euronext / NovaUCD benchmarks
// (board/models.py's EcosystemChecklistItem). Not period-scoped, so
// unlike sibling sections it self-fetches on mount rather than
// receiving `detail` as a prop — same "own data, own effect" precedent
// as HistorySection.tsx, since this data doesn't change per period.
// Mutating status/notes happens only in Settings > Ecosystem Checklist
// (EcosystemChecklistSection.tsx) — this component never writes.

import { useEffect, useState } from "react";
import { ecosystemChecklistApi, type EcosystemChecklistItem } from "../api/client";
import { Skeleton } from "./Skeleton";

const STATUS_LABEL: Record<EcosystemChecklistItem["status"], string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  complete: "Complete",
};

function statusStyle(status: EcosystemChecklistItem["status"]): React.CSSProperties {
  if (status === "complete") return { color: "#1A8A5C", background: "#E6F6EF" };
  if (status === "in_progress") return { color: "#A8720E", background: "#FBF1DE" };
  return { color: "var(--color-grey-text)", background: "var(--color-paper)" };
}

export function EcosystemChecklist() {
  const [items, setItems] = useState<EcosystemChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    ecosystemChecklistApi
      .list()
      .then(setItems)
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't load checklist."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="card print-avoid-break" style={styles.card}>
      <div style={styles.header}>
        <p style={styles.eyebrow}>Irish Ecosystem Checklist</p>
        <p style={styles.caption}>Standing against Enterprise Ireland, Euronext, and NovaUCD benchmarks</p>
      </div>

      {loading ? (
        <div style={styles.itemList}>
          <Skeleton height={52} radius="var(--radius-sm)" />
          <Skeleton height={52} radius="var(--radius-sm)" />
          <Skeleton height={52} radius="var(--radius-sm)" />
        </div>
      ) : error ? (
        <p style={styles.errorText}>{error}</p>
      ) : (
        <div style={styles.itemList}>
          {items.map((item) => (
            <div key={item.id} style={styles.row}>
              <div style={styles.rowText}>
                <p style={styles.rowTitle}>{item.title}</p>
                <p style={styles.rowDescription}>{item.description}</p>
                {item.notes && <p style={styles.rowNotes}>{item.notes}</p>}
              </div>
              <span style={{ ...styles.statusBadge, ...statusStyle(item.status) }}>
                {STATUS_LABEL[item.status]}
              </span>
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
