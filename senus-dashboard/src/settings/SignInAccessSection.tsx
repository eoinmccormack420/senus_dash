// src/settings/SignInAccessSection.tsx
//
// Admin-only — manages the AllowedGoogleEmail allowlist that gates
// Google Sign-In (board/views.py's GoogleLoginView), replacing what
// used to require editing the GOOGLE_ALLOWED_EMAILS Railway env var.

import { useEffect, useState } from "react";
import { adminApi, type AllowedEmail } from "../api/client";
import { Skeleton } from "../components/Skeleton";
import { title, caption, emailList, emailRow, removeButton, addForm, addInput, addButton, errorText } from "../styles/SignInAccessSectionStyles";

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
