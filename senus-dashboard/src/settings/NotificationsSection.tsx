// src/settings/NotificationsSection.tsx
//
// Personal preference (email me on new insights) is visible to every
// signed-in user; the Email/Slack/Teams "connections" below it are
// admin-only, since they're workspace-wide settings affecting every
// extraction attempt notification and every subscriber's email, not a
// personal preference. Each channel is shown as a connection card
// (status badge + Connect/Change/Disconnect), replacing the need to
// edit SLACK_WEBHOOK_URL/TEAMS_WEBHOOK_URL/EMAIL_* on the deployment
// platform — same role SignInAccessSection plays for
// GOOGLE_ALLOWED_EMAILS (see board/models.py's NotificationSettings
// and board/views.py's NotificationStatusView).
//
// Email defaults to "Connect Gmail" — an OAuth popup
// (google.accounts.oauth2 Code Client, same <script> tag LoginScreen.tsx
// uses for sign-in) that grants Gmail API send access for the admin's
// own Google account, so no SMTP host/password ever needs typing for
// the common case. A collapsed "Use a different email provider"
// fallback still covers Outlook/SendGrid/custom SMTP.

import { useEffect, useState } from "react";
import { preferencesApi, notificationsApi, type NotificationStatus } from "../api/client";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
const GMAIL_SEND_SCOPE = "openid email https://www.googleapis.com/auth/gmail.send";

export function NotificationsSection({ isAdmin = false }: { isAdmin?: boolean }) {
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
        You'll get an email when new AI commentary is published for a period.
      </p>

      {isAdmin && <ChannelSettings />}
    </div>
  );
}

function ChannelSettings() {
  const [status, setStatus] = useState<NotificationStatus | null>(null);
  const [loading, setLoading] = useState(true);

  function refresh() {
    return notificationsApi.getStatus().then(setStatus);
  }

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, []);

  if (loading || !status) {
    return (
      <div style={channelSection}>
        <p style={sectionCaption}>Loading connected apps…</p>
      </div>
    );
  }

  return (
    <div style={channelSection}>
      <h3 style={sectionTitle}>Connected apps</h3>
      <p style={sectionCaption}>
        Every completed extraction attempt posts a summary to Slack/Teams, if connected, and
        subscribed users get an email when insights are regenerated. This affects the whole team,
        not just you.
      </p>

      <EmailSettings status={status} onChange={setStatus} />
      <SlackSettings status={status} onChange={setStatus} />
      <TeamsSettings status={status} onChange={setStatus} />
    </div>
  );
}

// --- Shared connection-card shell -------------------------------------

function ConnectionCard({
  icon,
  name,
  connected,
  statusLabel,
  children,
}: {
  icon: string;
  name: string;
  connected: boolean;
  statusLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div style={card}>
      <div style={cardHeader}>
        <div style={cardTitleRow}>
          <span style={cardIcon} aria-hidden="true">
            {icon}
          </span>
          <span style={cardName}>{name}</span>
        </div>
        <span style={{ ...badge, ...(connected ? badgeConnected : badgeNotConnected) }}>{statusLabel}</span>
      </div>
      {children}
    </div>
  );
}

// --- Email -------------------------------------------------------------

function EmailSettings({
  status,
  onChange,
}: {
  status: NotificationStatus;
  onChange: (s: NotificationStatus) => void;
}) {
  const [connecting, setConnecting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(!!status.smtp_host && !status.gmail_connected_email);

  const gmailConnected = !!status.gmail_connected_email;
  const viaEnv = status.email && !gmailConnected && !status.smtp_host;

  function handleConnectGmail() {
    if (!GOOGLE_CLIENT_ID || !window.google?.accounts?.oauth2) {
      setMessage("Google sign-in isn't configured for this deployment.");
      return;
    }
    setMessage(null);
    setConnecting(true);

    // Google's popup can show its own error/warning screen (e.g. "access
    // blocked", account not added as a test user, browser blocked the
    // popup) without ever invoking our callback below — without this
    // timeout, connecting would stay stuck on "Connecting…" forever with
    // no feedback in the app itself.
    let settled = false;
    const timeoutId = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      setConnecting(false);
      setMessage(
        "No response from Google after 60s. Check whether a popup was blocked by your browser, or a Google screen asked you to confirm you're a test user / click through an unverified-app warning."
      );
    }, 60000);

    try {
      const client = window.google.accounts.oauth2.initCodeClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: GMAIL_SEND_SCOPE,
        ux_mode: "popup",
        callback: async (response) => {
          if (settled) return;
          settled = true;
          window.clearTimeout(timeoutId);

          if (response.error || !response.code) {
            setMessage(
              response.error_description ||
                `Google sign-in was cancelled or failed${response.error ? ` (${response.error})` : ""}.`
            );
            setConnecting(false);
            return;
          }
          try {
            const updated = await notificationsApi.connectGmail(response.code);
            onChange(updated);
            setMessage(`✓ Connected as ${updated.gmail_connected_email}.`);
          } catch (err) {
            setMessage(err instanceof Error ? err.message : "Couldn't connect Gmail.");
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
      setMessage("Couldn't open the Google sign-in popup — check if your browser blocked it.");
    }
  }

  async function handleDisconnectGmail() {
    setConnecting(true);
    setMessage(null);
    try {
      const updated = await notificationsApi.disconnectGmail();
      onChange(updated);
      setMessage("Disconnected.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Couldn't disconnect.");
    } finally {
      setConnecting(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setMessage(null);
    try {
      const { success, sent_to } = await notificationsApi.testEmail();
      setMessage(success ? `✓ Test email sent to ${sent_to}.` : "Failed to send. Check the settings below.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to send.");
    } finally {
      setTesting(false);
    }
  }

  return (
    <ConnectionCard
      icon="✉️"
      name="Email"
      connected={status.email}
      statusLabel={gmailConnected ? "Connected" : viaEnv ? "Set via server" : status.email ? "Connected" : "Not connected"}
    >
      {gmailConnected ? (
        <div style={cardBody}>
          <p style={connectedLabel}>Connected as {status.gmail_connected_email}</p>
          <div style={inputRow}>
            <button type="button" onClick={handleTest} disabled={testing} style={testButton}>
              {testing ? "Sending…" : "Send test"}
            </button>
            <button type="button" onClick={handleDisconnectGmail} disabled={connecting} style={disconnectButton}>
              {connecting ? "…" : "Disconnect"}
            </button>
          </div>
        </div>
      ) : (
        <div style={cardBody}>
          <button type="button" onClick={handleConnectGmail} disabled={connecting || !GOOGLE_CLIENT_ID} style={connectButton}>
            {connecting ? "Connecting…" : "Connect Gmail"}
          </button>
          <p style={envNote}>Uses the same Google sign-in as this app — grants permission to send notification emails as you.</p>
          <p style={envNote}>
            You may see a "Google hasn't verified this app" screen first — that's expected while this app is in
            testing mode; click Advanced, then "Go to (app name)" to continue.
          </p>
          {!GOOGLE_CLIENT_ID && <p style={envNote}>Google sign-in isn't configured for this deployment.</p>}
        </div>
      )}
      {message && <p style={feedbackText}>{message}</p>}

      <button type="button" onClick={() => setShowAdvanced((v) => !v)} style={linkButton}>
        {showAdvanced ? "Hide advanced options" : "Use a different email provider"}
      </button>
      {showAdvanced && <SmtpProviderForm status={status} onChange={onChange} />}
    </ConnectionCard>
  );
}

type EmailProvider = "outlook" | "sendgrid" | "custom";

const PROVIDER_HOSTS: Record<Exclude<EmailProvider, "custom">, string> = {
  outlook: "smtp.office365.com",
  sendgrid: "smtp.sendgrid.net",
};

const PROVIDER_LABELS: Record<EmailProvider, string> = {
  outlook: "Outlook / Microsoft 365",
  sendgrid: "SendGrid",
  custom: "Custom SMTP server",
};

const PROVIDER_NOTES: Partial<Record<EmailProvider, string>> = {
  outlook: "If multi-factor authentication is on for this account, use an app password instead of the regular one.",
  sendgrid: 'Paste your SendGrid API key as the password below. The "from" address must be a sender verified in SendGrid.',
};

function inferProvider(status: NotificationStatus): EmailProvider {
  if (!status.smtp_host) return "outlook";
  const match = Object.entries(PROVIDER_HOSTS).find(([, host]) => host === status.smtp_host);
  return (match?.[0] as EmailProvider) ?? "custom";
}

function SmtpProviderForm({
  status,
  onChange,
}: {
  status: NotificationStatus;
  onChange: (s: NotificationStatus) => void;
}) {
  const [provider, setProvider] = useState<EmailProvider>(() => inferProvider(status));
  const [host, setHost] = useState(status.smtp_host);
  const [port, setPort] = useState(status.smtp_port ? String(status.smtp_port) : "");
  const [username, setUsername] = useState(status.smtp_username);
  const [password, setPassword] = useState(""); // never prefilled — write-only on the backend
  const [useTls, setUseTls] = useState(status.smtp_use_tls);
  const [fromEmail, setFromEmail] = useState(status.from_email);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function handleProviderChange(next: EmailProvider) {
    setProvider(next);
    setMessage(null);
    if (next === "custom") return;
    setHost(PROVIDER_HOSTS[next]);
    setPort("587");
    setUseTls(true);
    setUsername(next === "sendgrid" ? "apikey" : fromEmail);
  }

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    try {
      const updated = await notificationsApi.updateSettings({
        smtp_host: host.trim(),
        smtp_port: port.trim() ? Number(port.trim()) : null,
        smtp_username: username.trim(),
        ...(password ? { smtp_password: password } : {}),
        smtp_use_tls: useTls,
        from_email: fromEmail.trim(),
      });
      onChange(updated);
      setPassword("");
      setMessage(host.trim() ? "Saved." : "Cleared.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Couldn't save.");
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setMessage(null);
    try {
      const { success, sent_to } = await notificationsApi.testEmail();
      setMessage(success ? `✓ Test email sent to ${sent_to}.` : "Failed to send. Check the settings below.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to send.");
    } finally {
      setTesting(false);
    }
  }

  return (
    <div style={advancedPanel}>
      <select
        value={provider}
        onChange={(e) => handleProviderChange(e.target.value as EmailProvider)}
        style={providerSelect}
        aria-label="Email provider"
      >
        {(Object.keys(PROVIDER_LABELS) as EmailProvider[]).map((key) => (
          <option key={key} value={key}>
            {PROVIDER_LABELS[key]}
          </option>
        ))}
      </select>

      {PROVIDER_NOTES[provider] && <p style={envNote}>{PROVIDER_NOTES[provider]}</p>}

      {provider === "outlook" ? (
        <div style={smtpGridSimple}>
          <input
            type="email"
            value={fromEmail}
            onChange={(e) => {
              setFromEmail(e.target.value);
              setUsername(e.target.value);
            }}
            placeholder="you@example.com"
            style={input}
            aria-label="Email address"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={status.smtp_password_set ? "•••••••• (saved — enter to change)" : "Password"}
            style={input}
            aria-label="Password"
          />
        </div>
      ) : provider === "sendgrid" ? (
        <div style={smtpGridSimple}>
          <input
            type="email"
            value={fromEmail}
            onChange={(e) => setFromEmail(e.target.value)}
            placeholder="From address, e.g. noreply@yourdomain.com"
            style={input}
            aria-label="From email address"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={status.smtp_password_set ? "•••••••• (saved — enter to change)" : "SendGrid API key"}
            style={input}
            aria-label="SendGrid API key"
          />
        </div>
      ) : (
        <div style={smtpGrid}>
          <input
            type="text"
            value={host}
            onChange={(e) => setHost(e.target.value)}
            placeholder="SMTP host, e.g. smtp.example.com"
            style={input}
            aria-label="SMTP host"
          />
          <input
            type="number"
            value={port}
            onChange={(e) => setPort(e.target.value)}
            placeholder="Port (587)"
            style={{ ...input, maxWidth: 110 }}
            aria-label="SMTP port"
          />
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="SMTP username"
            style={input}
            aria-label="SMTP username"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={status.smtp_password_set ? "•••••••• (saved — enter to change)" : "SMTP password"}
            style={input}
            aria-label="SMTP password"
          />
          <input
            type="text"
            value={fromEmail}
            onChange={(e) => setFromEmail(e.target.value)}
            placeholder="From address, e.g. Senus Board Report <noreply@senus.example>"
            style={{ ...input, gridColumn: "1 / -1" }}
            aria-label="From address"
          />
          <label style={tlsLabel}>
            <input type="checkbox" checked={useTls} onChange={(e) => setUseTls(e.target.checked)} style={checkbox} />
            Use TLS
          </label>
        </div>
      )}

      <div style={inputRow}>
        <button type="button" onClick={handleSave} disabled={saving} style={saveButton}>
          {saving ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={handleTest} disabled={testing || !status.email} style={testButton}>
          {testing ? "Sending…" : "Send test"}
        </button>
      </div>
      {message && <p style={feedbackText}>{message}</p>}
    </div>
  );
}

// --- Slack / Teams -------------------------------------------------------

function SlackSettings({
  status,
  onChange,
}: {
  status: NotificationStatus;
  onChange: (s: NotificationStatus) => void;
}) {
  const [expanded, setExpanded] = useState(!status.slack);
  const [url, setUrl] = useState(status.slack_webhook_url);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const viaEnv = status.slack && !status.slack_webhook_url;

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    try {
      const updated = await notificationsApi.updateSettings({ slack_webhook_url: url.trim() });
      onChange(updated);
      setMessage(url.trim() ? "Saved." : "Cleared.");
      if (url.trim()) setExpanded(false);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Couldn't save.");
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setMessage(null);
    try {
      const { success } = await notificationsApi.testSlack();
      setMessage(success ? "✓ Test message sent — check Slack." : "Failed to send. Check the webhook URL.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to send.");
    } finally {
      setTesting(false);
    }
  }

  return (
    <ConnectionCard icon="💬" name="Slack" connected={status.slack} statusLabel={viaEnv ? "Set via server" : status.slack ? "Connected" : "Not connected"}>
      {!expanded ? (
        <div style={cardBody}>
          <div style={inputRow}>
            <button type="button" onClick={handleTest} disabled={testing} style={testButton}>
              {testing ? "Sending…" : "Send test"}
            </button>
            <button type="button" onClick={() => setExpanded(true)} style={disconnectButton}>
              Change
            </button>
          </div>
        </div>
      ) : (
        <div style={cardBody}>
          {viaEnv && <p style={envNote}>Currently set via a server environment variable — enter a URL here to override it.</p>}
          <div style={inputRow}>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://hooks.slack.com/services/..."
              style={input}
              aria-label="Slack incoming webhook URL"
            />
          </div>
          <div style={inputRow}>
            <button type="button" onClick={handleSave} disabled={saving} style={saveButton}>
              {saving ? "Saving…" : "Save"}
            </button>
            <button type="button" onClick={handleTest} disabled={testing || !status.slack} style={testButton}>
              {testing ? "Sending…" : "Send test"}
            </button>
            {status.slack && (
              <button type="button" onClick={() => setExpanded(false)} style={linkButton}>
                Cancel
              </button>
            )}
          </div>
        </div>
      )}
      {message && <p style={feedbackText}>{message}</p>}
    </ConnectionCard>
  );
}

function TeamsSettings({
  status,
  onChange,
}: {
  status: NotificationStatus;
  onChange: (s: NotificationStatus) => void;
}) {
  const [expanded, setExpanded] = useState(!status.teams);
  const [url, setUrl] = useState(status.teams_webhook_url);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const viaEnv = status.teams && !status.teams_webhook_url;

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    try {
      const updated = await notificationsApi.updateSettings({ teams_webhook_url: url.trim() });
      onChange(updated);
      setMessage(url.trim() ? "Saved." : "Cleared.");
      if (url.trim()) setExpanded(false);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Couldn't save.");
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setMessage(null);
    try {
      const { success } = await notificationsApi.testTeams();
      setMessage(success ? "✓ Test message sent — check Teams." : "Failed to send. Check the webhook URL.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to send.");
    } finally {
      setTesting(false);
    }
  }

  return (
    <ConnectionCard icon="👥" name="Microsoft Teams" connected={status.teams} statusLabel={viaEnv ? "Set via server" : status.teams ? "Connected" : "Not connected"}>
      {!expanded ? (
        <div style={cardBody}>
          <div style={inputRow}>
            <button type="button" onClick={handleTest} disabled={testing} style={testButton}>
              {testing ? "Sending…" : "Send test"}
            </button>
            <button type="button" onClick={() => setExpanded(true)} style={disconnectButton}>
              Change
            </button>
          </div>
        </div>
      ) : (
        <div style={cardBody}>
          {viaEnv && <p style={envNote}>Currently set via a server environment variable — enter a URL here to override it.</p>}
          <div style={inputRow}>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://<tenant>.webhook.office.com/webhookb2/..."
              style={input}
              aria-label="Microsoft Teams webhook URL"
            />
          </div>
          <div style={inputRow}>
            <button type="button" onClick={handleSave} disabled={saving} style={saveButton}>
              {saving ? "Saving…" : "Save"}
            </button>
            <button type="button" onClick={handleTest} disabled={testing || !status.teams} style={testButton}>
              {testing ? "Sending…" : "Send test"}
            </button>
            {status.teams && (
              <button type="button" onClick={() => setExpanded(false)} style={linkButton}>
                Cancel
              </button>
            )}
          </div>
        </div>
      )}
      {message && <p style={feedbackText}>{message}</p>}
    </ConnectionCard>
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
  color: "var(--color-grey-text)",
  margin: "var(--space-2) 0 0 0",
};

const channelSection: React.CSSProperties = {
  marginTop: "var(--space-5)",
  paddingTop: "var(--space-4)",
  borderTop: "1px solid var(--color-grey-line)",
};

const sectionTitle: React.CSSProperties = {
  fontFamily: "var(--font-body)",
  fontWeight: 700,
  fontSize: "var(--text-md)",
  color: "var(--color-ink)",
  margin: "0 0 var(--space-2) 0",
};

const sectionCaption: React.CSSProperties = {
  fontSize: "var(--text-xs)",
  color: "var(--color-grey-text)",
  margin: "0 0 var(--space-4) 0",
};

const card: React.CSSProperties = {
  border: "1px solid var(--color-grey-line)",
  borderRadius: "var(--radius-md)",
  padding: "var(--space-4)",
  marginBottom: "var(--space-3)",
  background: "var(--color-paper)",
};

const cardHeader: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: "var(--space-3)",
};

const cardTitleRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--space-2)",
};

const cardIcon: React.CSSProperties = {
  fontSize: "var(--text-lg)",
  lineHeight: 1,
};

const cardName: React.CSSProperties = {
  fontFamily: "var(--font-body)",
  fontWeight: 600,
  fontSize: "var(--text-sm)",
  color: "var(--color-ink)",
};

const cardBody: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-2)",
};

const badge: React.CSSProperties = {
  fontSize: "var(--text-xs)",
  fontWeight: 600,
  padding: "3px 10px",
  borderRadius: 999,
  whiteSpace: "nowrap",
};

const badgeConnected: React.CSSProperties = {
  color: "#1A8A5C",
  background: "#E6F6EF",
};

const badgeNotConnected: React.CSSProperties = {
  color: "var(--color-grey-text)",
  background: "var(--color-paper-raised)",
};

const connectedLabel: React.CSSProperties = {
  fontSize: "var(--text-sm)",
  color: "var(--color-ink)",
  margin: 0,
};

const envNote: React.CSSProperties = {
  fontSize: "var(--text-xs)",
  color: "var(--color-grey-text)",
  margin: 0,
};

const inputRow: React.CSSProperties = {
  display: "flex",
  gap: "var(--space-2)",
};

const smtpGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: "var(--space-2)",
  marginBottom: "var(--space-3)",
  alignItems: "center",
};

const smtpGridSimple: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
  gap: "var(--space-2)",
  marginBottom: "var(--space-3)",
};

const providerSelect: React.CSSProperties = {
  display: "block",
  fontFamily: "var(--font-body)",
  fontSize: "var(--text-sm)",
  padding: "var(--space-2)",
  border: "1px solid var(--color-grey-line)",
  borderRadius: "var(--radius-sm)",
  background: "var(--color-paper)",
  color: "var(--color-ink)",
  marginBottom: "var(--space-2)",
  minWidth: 220,
};

const tlsLabel: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--space-2)",
  fontSize: "var(--text-sm)",
  color: "var(--color-ink)",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const input: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  fontFamily: "var(--font-body)",
  fontSize: "var(--text-sm)",
  padding: "var(--space-2)",
  border: "1px solid var(--color-grey-line)",
  borderRadius: "var(--radius-sm)",
  background: "var(--color-paper)",
  color: "var(--color-ink)",
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

const connectButton: React.CSSProperties = {
  ...saveButton,
  alignSelf: "flex-start",
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

const disconnectButton: React.CSSProperties = {
  ...testButton,
  color: "var(--color-rust)",
  borderColor: "var(--color-rust)",
};

const linkButton: React.CSSProperties = {
  fontFamily: "var(--font-body)",
  fontWeight: 500,
  fontSize: "var(--text-xs)",
  color: "var(--color-grey-text)",
  background: "none",
  border: "none",
  padding: 0,
  marginTop: "var(--space-2)",
  cursor: "pointer",
  textDecoration: "underline",
  alignSelf: "flex-start",
};

const advancedPanel: React.CSSProperties = {
  marginTop: "var(--space-3)",
  paddingTop: "var(--space-3)",
  borderTop: "1px solid var(--color-grey-line)",
};

const feedbackText: React.CSSProperties = {
  fontSize: "var(--text-xs)",
  color: "var(--color-grey-text)",
  margin: "var(--space-2) 0 0 0",
};
