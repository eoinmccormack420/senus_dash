// src/settings/DriveSection.tsx
//
// Admin-only — connects Google Drive (board/models.py's DriveSettings)
// via the same "Connect Gmail" OAuth popup pattern
// (NotificationsSection.tsx's handleConnectGmail), then lets you browse
// real Drive folders instead of typing a folder ID, and triggers a sync.
// A sync runs server-side in a background thread (see
// board/extraction/drive_sync.py's module docstring for why — it can
// take minutes, too long for a normal request/response), so this polls
// while last_sync_status is "running" rather than awaiting a single call.

import { useEffect, useState } from "react";
import { boardApi, driveApi, type DriveFolder, type DriveSettingsData, type PeriodSummary } from "../api/client";
import { title, caption, fieldLabel, input, saveButton, linkButton, connectedText, feedbackText, errorText, folderBox, browserBox, breadcrumbRow, crumbSeparator, crumbButton, folderList, folderRow, syncSection, syncRow, statusBadge, spinnerSmall } from "../styles/DriveSectionStyles";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
const DRIVE_READONLY_SCOPE = "openid email https://www.googleapis.com/auth/drive.readonly";

const STATUS_LABEL: Record<DriveSettingsData["last_sync_status"], string> = {
  idle: "Not synced yet",
  running: "Running",
  success: "Success",
  error: "Error",
};

function statusStyle(status: DriveSettingsData["last_sync_status"]): React.CSSProperties {
  if (status === "success") return { color: "#1A8A5C", background: "#E6F6EF" };
  if (status === "running") return { color: "#A8720E", background: "#FBF1DE" };
  if (status === "error") return { color: "var(--color-rust)", background: "var(--color-rust-soft)" };
  return { color: "var(--color-grey-text)", background: "var(--color-paper)" };
}

interface Crumb {
  id: string;
  name: string;
}

export function DriveSection() {
  const [settings, setSettings] = useState<DriveSettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [connectMessage, setConnectMessage] = useState<string | null>(null);

  const [periods, setPeriods] = useState<PeriodSummary[]>([]);
  const [periodLabel, setPeriodLabel] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const [browsing, setBrowsing] = useState(false);
  const [breadcrumb, setBreadcrumb] = useState<Crumb[]>([{ id: "root", name: "My Drive" }]);
  const [folders, setFolders] = useState<DriveFolder[]>([]);
  const [folderLoading, setFolderLoading] = useState(false);
  const [folderError, setFolderError] = useState<string | null>(null);
  const [selecting, setSelecting] = useState(false);

  useEffect(() => {
    Promise.all([driveApi.getSettings(), boardApi.listPeriods()])
      .then(([settingsRes, periodsRes]) => {
        setSettings(settingsRes);
        setPeriods(periodsRes);
        if (periodsRes.length > 0) setPeriodLabel(periodsRes[periodsRes.length - 1].label);
      })
      .finally(() => setLoading(false));
  }, []);

  // Poll while a sync is running so the status/summary reflect
  // completion without a manual refresh — the sync itself runs in a
  // background thread server-side, so there's no single request to await.
  useEffect(() => {
    if (settings?.last_sync_status !== "running") return;
    const interval = setInterval(() => {
      driveApi.getSettings().then(setSettings);
    }, 3000);
    return () => clearInterval(interval);
  }, [settings?.last_sync_status]);

  function handleConnect() {
    if (!GOOGLE_CLIENT_ID || !window.google?.accounts?.oauth2) {
      setConnectMessage("Google sign-in isn't configured for this deployment.");
      return;
    }
    setConnectMessage(null);
    setConnecting(true);

    // Google's popup can show its own error/warning screen (e.g. "access
    // blocked", not a test user, browser blocked the popup) without ever
    // invoking our callback below — without this timeout, connecting
    // would stay stuck on "Connecting…" forever with no feedback.
    let settled = false;
    const timeoutId = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      setConnecting(false);
      setConnectMessage(
        "No response from Google after 60s. Check whether a popup was blocked by your browser, or a Google screen asked you to confirm you're a test user / click through an unverified-app warning."
      );
    }, 60000);

    try {
      const client = window.google.accounts.oauth2.initCodeClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: DRIVE_READONLY_SCOPE,
        ux_mode: "popup",
        callback: async (response) => {
          if (settled) return;
          settled = true;
          window.clearTimeout(timeoutId);

          if (response.error || !response.code) {
            setConnectMessage(
              response.error_description ||
                `Google sign-in was cancelled or failed${response.error ? ` (${response.error})` : ""}.`
            );
            setConnecting(false);
            return;
          }
          try {
            const updated = await driveApi.connect(response.code);
            setSettings(updated);
            setConnectMessage(`✓ Connected as ${updated.connected_email}.`);
          } catch (err) {
            setConnectMessage(err instanceof Error ? err.message : "Couldn't connect Google Drive.");
          } finally {
            setConnecting(false);
          }
        },
      });
      client.requestCode();
    } catch {
      settled = true;
      window.clearTimeout(timeoutId);
      setConnecting(false);
      setConnectMessage("Couldn't open the Google sign-in popup — check if your browser blocked it.");
    }
  }

  async function handleDisconnect() {
    setConnecting(true);
    setConnectMessage(null);
    try {
      const updated = await driveApi.disconnect();
      setSettings(updated);
      setBrowsing(false);
      setConnectMessage("Disconnected.");
    } catch (err) {
      setConnectMessage(err instanceof Error ? err.message : "Couldn't disconnect.");
    } finally {
      setConnecting(false);
    }
  }

  function loadFolder(crumb: Crumb, trail: Crumb[]) {
    setFolderLoading(true);
    setFolderError(null);
    driveApi
      .listFolders(crumb.id)
      .then((listing) => {
        setBreadcrumb(trail);
        setFolders(listing.folders);
      })
      .catch((err) => setFolderError(err instanceof Error ? err.message : "Couldn't load folders."))
      .finally(() => setFolderLoading(false));
  }

  function handleStartBrowsing() {
    setBrowsing(true);
    loadFolder({ id: "root", name: "My Drive" }, [{ id: "root", name: "My Drive" }]);
  }

  function handleNavigateInto(folder: DriveFolder) {
    loadFolder(folder, [...breadcrumb, { id: folder.id, name: folder.name }]);
  }

  function handleBreadcrumbClick(index: number) {
    const trail = breadcrumb.slice(0, index + 1);
    loadFolder(trail[trail.length - 1], trail);
  }

  async function handleSelectFolder() {
    const current = breadcrumb[breadcrumb.length - 1];
    setSelecting(true);
    setFolderError(null);
    try {
      const updated = await driveApi.updateSettings(current.id, current.name);
      setSettings(updated);
      setBrowsing(false);
    } catch (err) {
      setFolderError(err instanceof Error ? err.message : "Couldn't save that folder.");
    } finally {
      setSelecting(false);
    }
  }

  async function handleSyncNow() {
    if (!periodLabel) return;
    setSyncing(true);
    setSyncMessage(null);
    try {
      await driveApi.syncNow(periodLabel);
      setSettings((prev) => (prev ? { ...prev, last_sync_status: "running" } : prev));
    } catch (err) {
      setSyncMessage(err instanceof Error ? err.message : "Couldn't start sync.");
    } finally {
      setSyncing(false);
    }
  }

  if (loading || !settings) {
    return (
      <div>
        <h2 style={title}>Google Drive</h2>
        <p style={caption}>Loading…</p>
      </div>
    );
  }

  const isConnected = !!settings.connected_email;
  const isRunning = settings.last_sync_status === "running";

  return (
    <div>
      <h2 style={title}>Google Drive</h2>
      <p style={caption}>Pulls source PDFs from a Drive folder into the extraction pipeline.</p>

      {!isConnected ? (
        <>
          <button type="button" onClick={handleConnect} disabled={connecting || !GOOGLE_CLIENT_ID} style={saveButton}>
            {connecting ? "Connecting…" : "Connect Google Drive"}
          </button>
          <p style={feedbackText}>Uses the same Google sign-in as this app — grants read-only access to Drive.</p>
          <p style={feedbackText}>
            You may see a "Google hasn't verified this app" screen first — that's expected while this app is in
            testing mode; click Advanced, then "Go to (app name)" to continue.
          </p>
          {!GOOGLE_CLIENT_ID && <p style={feedbackText}>Google sign-in isn't configured for this deployment.</p>}
        </>
      ) : (
        <>
          <div style={syncRow}>
            <p style={connectedText}>✓ Connected as {settings.connected_email}</p>
            <button type="button" onClick={handleDisconnect} disabled={connecting} style={linkButton}>
              Disconnect
            </button>
          </div>

          <div style={folderBox}>
            <p style={feedbackText}>
              {settings.folder_name ? (
                <>
                  Currently syncing: <strong>{settings.folder_name}</strong>
                </>
              ) : (
                "No folder selected yet."
              )}
            </p>
            {!browsing ? (
              <button type="button" onClick={handleStartBrowsing} style={linkButton}>
                {settings.folder_name ? "Change folder" : "Choose a folder"}
              </button>
            ) : (
              <div style={browserBox}>
                <div style={breadcrumbRow}>
                  {breadcrumb.map((crumb, i) => (
                    <span key={crumb.id}>
                      {i > 0 && <span style={crumbSeparator}> / </span>}
                      <button type="button" onClick={() => handleBreadcrumbClick(i)} style={crumbButton}>
                        {crumb.name}
                      </button>
                    </span>
                  ))}
                </div>
                {folderLoading ? (
                  <p style={feedbackText}>Loading…</p>
                ) : folders.length === 0 ? (
                  <p style={feedbackText}>No subfolders here.</p>
                ) : (
                  <ul style={folderList}>
                    {folders.map((folder) => (
                      <li key={folder.id}>
                        <button type="button" onClick={() => handleNavigateInto(folder)} style={folderRow}>
                          📁 {folder.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <div style={syncRow}>
                  <button type="button" onClick={handleSelectFolder} disabled={selecting} style={saveButton}>
                    {selecting ? "Saving…" : `Select "${breadcrumb[breadcrumb.length - 1].name}"`}
                  </button>
                  <button type="button" onClick={() => setBrowsing(false)} style={linkButton}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
            {folderError && <p style={errorText}>{folderError}</p>}
          </div>
        </>
      )}
      {connectMessage && <p style={feedbackText}>{connectMessage}</p>}

      <div style={syncSection}>
        <label style={fieldLabel}>
          Sync into period
          <select value={periodLabel} onChange={(e) => setPeriodLabel(e.target.value)} style={input}>
            {periods.map((p) => (
              <option key={p.id} value={p.label}>
                {p.label}
              </option>
            ))}
          </select>
        </label>

        <div style={syncRow}>
          <button
            type="button"
            onClick={handleSyncNow}
            disabled={syncing || isRunning || !settings.folder_id || !periodLabel}
            style={saveButton}
          >
            {isRunning ? (
              <>
                <span className="spinner" style={spinnerSmall} /> Syncing…
              </>
            ) : syncing ? (
              "Starting…"
            ) : (
              "Sync now"
            )}
          </button>
          <span style={{ ...statusBadge, ...statusStyle(settings.last_sync_status) }}>
            {STATUS_LABEL[settings.last_sync_status]}
          </span>
        </div>
        {syncMessage && <p style={feedbackText}>{syncMessage}</p>}
        {settings.last_synced_at && (
          <p style={feedbackText}>Last synced {new Date(settings.last_synced_at).toLocaleString("en-IE")}</p>
        )}
        {settings.last_sync_summary && <p style={feedbackText}>{settings.last_sync_summary}</p>}
      </div>
    </div>
  );
}
