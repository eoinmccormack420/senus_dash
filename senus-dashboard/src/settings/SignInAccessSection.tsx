// src/settings/SignInAccessSection.tsx
//
// Admin-only — manages the AllowedGoogleEmail allowlist that gates
// Google Sign-In (board/views.py's GoogleLoginView), replacing what
// used to require editing the GOOGLE_ALLOWED_EMAILS Railway env var.

import { useEffect, useState } from "react";
import { adminApi, type AllowedEmail } from "../api/client";
import { Skeleton } from "../components/Skeleton";

export function SignInAccessSection({ currentUserEmail }: { currentUserEmail: string }) {
  const [emails, setEmails] = useState<AllowedEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [newEmail, setNewEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function refresh() {
    return adminApi.listAllowedEmails().then(setEmails);
  }

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newEmail.trim()) return;
    setError(null);
    setBusy(true);
    try {
      await adminApi.addAllowedEmail(newEmail.trim());
      setNewEmail("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add that email.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(id: number) {
    setError(null);
    setBusy(true);
    try {
      await adminApi.removeAllowedEmail(id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't remove that email.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h2 style={title}>Sign-in access</h2>
      <p style={caption}>
        Only these Google accounts can sign in. Add or remove board members here instead of
        editing Railway environment variables.
      </p>
      {loading ? (
        <div>
          <Skeleton height={18} style={{ marginBottom: "var(--space-2)" }} />
          <Skeleton height={18} style={{ marginBottom: "var(--space-2)" }} />
          <Skeleton height={18} />
        </div>
      ) : (
        <ul style={emailList}>
          {emails.map((e) => (
            <li key={e.id} style={emailRow}>
              <span>{e.email}</span>
              {e.email.toLowerCase() !== currentUserEmail.toLowerCase() && (
                <button
                  type="button"
                  onClick={() => handleRemove(e.id)}
                  disabled={busy}
                  style={removeButton}
                  aria-label={`Remove ${e.email}`}
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={handleAdd} style={addForm}>
        <input
          type="email"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          placeholder="name@example.com"
          disabled={busy}
          style={addInput}
        />
        <button type="submit" disabled={busy || !newEmail.trim()} style={addButton}>
          Add
        </button>
      </form>
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

const emailList: React.CSSProperties = {
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-2)",
};

const emailRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  fontSize: "var(--text-sm)",
  color: "var(--color-ink)",
  wordBreak: "break-all",
  padding: "var(--space-2) 0",
  borderBottom: "1px solid var(--color-grey-line)",
};

const removeButton: React.CSSProperties = {
  fontSize: "var(--text-xs)",
  color: "var(--color-rust)",
  background: "none",
  border: "none",
  cursor: "pointer",
  flexShrink: 0,
  marginLeft: "var(--space-3)",
};

const addForm: React.CSSProperties = {
  display: "flex",
  gap: "var(--space-2)",
  marginTop: "var(--space-4)",
};

const addInput: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  fontFamily: "var(--font-body)",
  fontSize: "var(--text-sm)",
  padding: "var(--space-2)",
  border: "1px solid var(--color-grey-line)",
  borderRadius: "var(--radius-sm)",
};

const addButton: React.CSSProperties = {
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

const errorText: React.CSSProperties = {
  fontSize: "var(--text-xs)",
  color: "var(--color-rust)",
  margin: "var(--space-2) 0 0 0",
};
