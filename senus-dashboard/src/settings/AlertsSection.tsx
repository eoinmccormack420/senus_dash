// src/settings/AlertsSection.tsx
//
// Admin-only configuration for the four board-alert thresholds (cash
// runway, EBITDA margin, admin expense ratio, current ratio) evaluated
// by board/alerts.py and surfaced as `board_alerts` on every period
// detail response (see Dashboard.tsx's BoardAlertBanner). Also exposes
// a manual "Send digest now" action for the latest period, since
// there's no scheduled digest yet — same one-off-admin-action pattern
// as RegenerateInsightsSection.

import { useEffect, useState } from "react";
import {
  boardAlertsApi,
  boardApi,
  type BoardAlertSettingsData,
  type BoardAlertSettingsUpdate,
} from "../api/client";

export function AlertsSection() {
  const [settings, setSettings] = useState<BoardAlertSettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [digestMessage, setDigestMessage] = useState<string | null>(null);

  useEffect(() => {
    boardAlertsApi
      .getSettings()
      .then(setSettings)
      .finally(() => setLoading(false));
  }, []);

  function update(patch: BoardAlertSettingsUpdate) {
    setSettings((prev) => (prev ? { ...prev, ...patch } : prev));
  }

  async function handleSave() {
    if (!settings) return;
    setSaving(true);
    setMessage(null);
    try {
      const updated = await boardAlertsApi.updateSettings({
        cash_runway_enabled: settings.cash_runway_enabled,
        cash_runway_months_min: settings.cash_runway_months_min,
        ebitda_margin_enabled: settings.ebitda_margin_enabled,
        ebitda_margin_min_pct: settings.ebitda_margin_min_pct,
        admin_expense_ratio_enabled: settings.admin_expense_ratio_enabled,
        admin_expense_ratio_max_pct: settings.admin_expense_ratio_max_pct,
        current_ratio_enabled: settings.current_ratio_enabled,
        current_ratio_min: settings.current_ratio_min,
      });
      setSettings(updated);
      setMessage("Saved.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Couldn't save.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSendDigest() {
    setSending(true);
    setDigestMessage(null);
    try {
      const latest = await boardApi.getLatestPeriod();
      const result = await boardAlertsApi.sendDigest(latest.id);
      setDigestMessage(
        result.active_alerts === 0
          ? `No active breaches for ${latest.label} — nothing sent.`
          : `Sent ${result.active_alerts} breach${result.active_alerts === 1 ? "" : "es"} for ${latest.label} — Slack ${result.slack ? "✓" : "—"}, Teams ${result.teams ? "✓" : "—"}, Email ${result.email ? "✓" : "—"}.`
      );
    } catch (err) {
      setDigestMessage(err instanceof Error ? err.message : "Couldn't send digest.");
    } finally {
      setSending(false);
    }
  }

  if (loading || !settings) {
    return (
      <div>
        <h2 style={title}>Board Alerts</h2>
        <p style={caption}>Loading thresholds…</p>
      </div>
    );
  }

  return (
    <div>
      <h2 style={title}>Board Alerts</h2>
      <p style={caption}>
        Thresholds that turn key risk signals into a breach banner on the dashboard.
        Disabling a signal hides it from the banner entirely rather than always showing "clear."
      </p>

      <ThresholdRow
        label="Cash runway"
        unit="months"
        helper="Flag when runway drops below"
        enabled={settings.cash_runway_enabled}
        value={settings.cash_runway_months_min}
        onEnabledChange={(v) => update({ cash_runway_enabled: v })}
        onValueChange={(v) => update({ cash_runway_months_min: v })}
      />
      <ThresholdRow
        label="EBITDA margin"
        unit="%"
        helper="Flag when margin drops below"
        enabled={settings.ebitda_margin_enabled}
        value={settings.ebitda_margin_min_pct}
        onEnabledChange={(v) => update({ ebitda_margin_enabled: v })}
        onValueChange={(v) => update({ ebitda_margin_min_pct: v })}
      />
      <ThresholdRow
        label="Admin expense ratio"
        unit="%"
        helper="Flag when it rises above"
        enabled={settings.admin_expense_ratio_enabled}
        value={settings.admin_expense_ratio_max_pct}
        onEnabledChange={(v) => update({ admin_expense_ratio_enabled: v })}
        onValueChange={(v) => update({ admin_expense_ratio_max_pct: v })}
      />
      <ThresholdRow
        label="Current ratio"
        unit="x"
        helper="Flag when it drops below"
        enabled={settings.current_ratio_enabled}
        value={settings.current_ratio_min}
        onEnabledChange={(v) => update({ current_ratio_enabled: v })}
        onValueChange={(v) => update({ current_ratio_min: v })}
      />

      <div style={inputRow}>
        <button type="button" onClick={handleSave} disabled={saving} style={saveButton}>
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
      {message && <p style={feedbackText}>{message}</p>}

      <div style={digestSection}>
        <p style={sectionCaption}>
          No scheduled digest yet — send breaches for the latest period on demand.
        </p>
        <button type="button" onClick={handleSendDigest} disabled={sending} style={testButton}>
          {sending ? "Sending…" : "Send digest now"}
        </button>
        {digestMessage && <p style={feedbackText}>{digestMessage}</p>}
      </div>
    </div>
  );
}

function ThresholdRow({
  label,
  unit,
  helper,
  enabled,
  value,
  onEnabledChange,
  onValueChange,
}: {
  label: string;
  unit: string;
  helper: string;
  enabled: boolean;
  value: number;
  onEnabledChange: (v: boolean) => void;
  onValueChange: (v: number) => void;
}) {
  return (
    <div style={row}>
      <label style={toggleRow}>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onEnabledChange(e.target.checked)}
          style={checkbox}
        />
        {label}
      </label>
      <div style={valueRow}>
        <span style={helperText}>{helper}</span>
        <input
          type="number"
          step="0.1"
          value={value}
          disabled={!enabled}
          onChange={(e) => onValueChange(Number(e.target.value))}
          style={numberInput}
          aria-label={`${label} threshold`}
        />
        <span style={helperText}>{unit}</span>
      </div>
    </div>
  );
}

const title: React.CSSProperties = {
  fontFamily: "var(--font-body)",
  fontWeight: 600,
  fontSize: "var(--text-lg)",
  color: "var(--color-ink)",
  margin: "0 0 var(--space-2) 0",
};

const caption: React.CSSProperties = {
  fontSize: "var(--text-xs)",
  color: "var(--color-grey-text)",
  margin: "0 0 var(--space-4) 0",
};

const row: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  flexWrap: "wrap",
  gap: "var(--space-2)",
  padding: "var(--space-3) 0",
  borderBottom: "1px solid var(--color-grey-line)",
};

const toggleRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--space-2)",
  fontFamily: "var(--font-body)",
  fontSize: "var(--text-sm)",
  color: "var(--color-ink)",
  cursor: "pointer",
};

const checkbox: React.CSSProperties = {
  width: 16,
  height: 16,
  cursor: "pointer",
};

const valueRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--space-2)",
};

const helperText: React.CSSProperties = {
  fontSize: "var(--text-xs)",
  color: "var(--color-grey-text)",
  whiteSpace: "nowrap",
};

const numberInput: React.CSSProperties = {
  width: 80,
  fontFamily: "var(--font-body)",
  fontSize: "var(--text-sm)",
  padding: "var(--space-2)",
  border: "1px solid var(--color-grey-line)",
  borderRadius: "var(--radius-sm)",
  background: "var(--color-paper)",
  color: "var(--color-ink)",
};

const inputRow: React.CSSProperties = {
  display: "flex",
  gap: "var(--space-2)",
  marginTop: "var(--space-4)",
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
  whiteSpace: "nowrap",
};

const testButton: React.CSSProperties = {
  fontFamily: "var(--font-body)",
  fontWeight: 600,
  fontSize: "var(--text-sm)",
  color: "var(--color-ink)",
  background: "none",
  border: "1px solid var(--color-grey-line)",
  borderRadius: "var(--radius-sm)",
  padding: "var(--space-2) var(--space-3)",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const feedbackText: React.CSSProperties = {
  fontSize: "var(--text-xs)",
  color: "var(--color-grey-text)",
  margin: "var(--space-2) 0 0 0",
};

const digestSection: React.CSSProperties = {
  marginTop: "var(--space-5)",
  paddingTop: "var(--space-4)",
  borderTop: "1px solid var(--color-grey-line)",
};

const sectionCaption: React.CSSProperties = {
  fontSize: "var(--text-xs)",
  color: "var(--color-grey-text)",
  margin: "0 0 var(--space-3) 0",
};
