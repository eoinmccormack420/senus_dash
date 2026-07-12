// src/settings/NotificationsSection.tsx
//
// Persists the preference but doesn't send anything yet — email
// delivery isn't wired up (see SettingsPage.tsx / board/views.py's
// UserPreferencesView).

import { useEffect, useState } from "react";
import { preferencesApi } from "../api/client";

export function NotificationsSection() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    preferencesApi
      .get()
      .then((p) => setEnabled(p.notify_on_new_insights))
      .finally(() => setLoading(false));
  }, []);

  async function toggle() {
    const next = !enabled;
    setEnabled(next);
    setSaving(true);
    try {
      await preferencesApi.update({ notify_on_new_insights: next });
    } catch {
      setEnabled(!next); // revert on failure
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h2 style={title}>Notifications</h2>
      <label style={toggleRow}>
        <input
          type="checkbox"
          checked={enabled}
          disabled={loading || saving}
          onChange={toggle}
          style={checkbox}
        />
        Email me when new insights are published
      </label>
      <p style={caption}>
        This saves your preference but doesn't send anything yet — email delivery isn't wired up.
      </p>
    </div>
  );
}

const title: React.CSSProperties = {
  fontFamily: "var(--font-body)",
  fontWeight: 700,
  fontSize: "var(--text-lg)",
  color: "var(--color-ink)",
  margin: "0 0 var(--space-4) 0",
};

const toggleRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--space-2)",
  fontSize: "var(--text-sm)",
  color: "var(--color-ink)",
  cursor: "pointer",
};

const checkbox: React.CSSProperties = {
  width: 16,
  height: 16,
  cursor: "pointer",
};

const caption: React.CSSProperties = {
  fontSize: "var(--text-xs)",
  color: "var(--color-grey)",
  margin: "var(--space-2) 0 0 0",
};
