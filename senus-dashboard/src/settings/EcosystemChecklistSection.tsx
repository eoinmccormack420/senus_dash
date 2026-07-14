// src/settings/EcosystemChecklistSection.tsx
//
// Admin-only — edits status/notes for the fixed Irish ecosystem
// benchmarks (board/models.py's EcosystemChecklistItem, seeded by a
// data migration). key/title/description aren't editable here; this
// is a checklist against 3 named things, not a general-purpose todo
// list. Local draft state per row (status select + notes textarea),
// saved individually per row — mirrors StrategicGoalsSection.tsx's
// busyId-per-row pattern, adapted for an editable field pair instead
// of one-click commit/dismiss buttons.

import { useEffect, useState } from "react";
import { ecosystemChecklistApi, type EcosystemChecklistItem } from "../api/client";
import { Skeleton } from "../components/Skeleton";

const STATUS_OPTIONS: EcosystemChecklistItem["status"][] = ["not_started", "in_progress", "complete"];
const STATUS_LABEL: Record<EcosystemChecklistItem["status"], string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  complete: "Complete",
};

export function EcosystemChecklistSection() {
  const [items, setItems] = useState<EcosystemChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [savedId, setSavedId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    ecosystemChecklistApi
      .list()
      .then(setItems)
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't load checklist."))
      .finally(() => setLoading(false));
  }, []);

  function updateDraft(id: number, patch: Partial<EcosystemChecklistItem>) {
    setSavedId(null);
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  async function handleSave(item: EcosystemChecklistItem) {
    setBusyId(item.id);
    setError(null);
    try {
      const updated = await ecosystemChecklistApi.update(item.id, {
        status: item.status,
        notes: item.notes,
      });
      setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
      setSavedId(item.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save that item.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <h2 style={title}>Ecosystem checklist</h2>
      <p style={caption}>
        Track status against Enterprise Ireland, Euronext, and NovaUCD benchmarks. Shown read-only
        to every board member on the Dashboard.
      </p>

      {loading ? (
        <div style={itemList}>
          <Skeleton height={140} radius="var(--radius-sm)" />
          <Skeleton height={140} radius="var(--radius-sm)" />
          <Skeleton height={140} radius="var(--radius-sm)" />
        </div>
      ) : (
        <div style={itemList}>
          {items.map((item) => (
            <div key={item.id} style={itemCard}>
              <p style={itemTitle}>{item.title}</p>
              <p style={itemDescription}>{item.description}</p>

              <label style={fieldLabel}>
                Status
                <select
                  value={item.status}
                  onChange={(e) => updateDraft(item.id, { status: e.target.value as EcosystemChecklistItem["status"] })}
                  disabled={busyId === item.id}
                  style={select}
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
              </label>

              <label style={fieldLabel}>
                Notes
                <textarea
                  value={item.notes}
                  onChange={(e) => updateDraft(item.id, { notes: e.target.value })}
                  disabled={busyId === item.id}
                  rows={2}
                  style={textarea}
                />
              </label>

              <div style={saveRow}>
                <button
                  type="button"
                  onClick={() => handleSave(item)}
                  disabled={busyId === item.id}
                  style={saveButton}
                >
                  {busyId === item.id ? "Saving…" : "Save"}
                </button>
                {savedId === item.id && <span style={savedText}>✓ Saved</span>}
              </div>
            </div>
          ))}
        </div>
      )}
      {error && <p style={errorText}>{error}</p>}
    </div>
  );
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

const itemList: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-3)",
};

const itemCard: React.CSSProperties = {
  border: "1px solid var(--color-grey-line)",
  borderRadius: "var(--radius-sm)",
  padding: "var(--space-3)",
};

const itemTitle: React.CSSProperties = {
  fontSize: "var(--text-sm)",
  fontWeight: 700,
  color: "var(--color-ink)",
  margin: 0,
};

const itemDescription: React.CSSProperties = {
  fontSize: "var(--text-xs)",
  color: "var(--color-grey-text)",
  margin: "var(--space-1) 0 var(--space-3) 0",
};

const fieldLabel: React.CSSProperties = {
  display: "block",
  fontSize: "var(--text-xs)",
  fontWeight: 600,
  color: "var(--color-ink)",
  marginBottom: "var(--space-3)",
};

const select: React.CSSProperties = {
  display: "block",
  marginTop: "var(--space-1)",
  fontFamily: "var(--font-body)",
  fontSize: "var(--text-sm)",
  padding: "var(--space-2)",
  border: "1px solid var(--color-grey-line)",
  borderRadius: "var(--radius-sm)",
  width: "100%",
  boxSizing: "border-box",
};

const textarea: React.CSSProperties = {
  display: "block",
  marginTop: "var(--space-1)",
  fontFamily: "var(--font-body)",
  fontSize: "var(--text-sm)",
  padding: "var(--space-2)",
  border: "1px solid var(--color-grey-line)",
  borderRadius: "var(--radius-sm)",
  width: "100%",
  boxSizing: "border-box",
  resize: "vertical",
};

const saveRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--space-3)",
};

const saveButton: React.CSSProperties = {
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

const savedText: React.CSSProperties = {
  fontSize: "var(--text-sm)",
  color: "#1A8A5C",
  fontWeight: 600,
};

const errorText: React.CSSProperties = {
  fontSize: "var(--text-sm)",
  color: "var(--color-rust)",
  marginTop: "var(--space-2)",
};
