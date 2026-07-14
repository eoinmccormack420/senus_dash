// src/LoginScreen.tsx
//
// Username/password login gate, plus an optional "Sign in with Google"
// button (only rendered when VITE_GOOGLE_CLIENT_ID is set at build time —
// see board/views.py:GoogleLoginView on the backend, which additionally
// enforces GOOGLE_ALLOWED_EMAILS). This is intentionally minimal
// (single-tenant, token auth, small fixed reviewer list) rather than a
// full multi-tenant auth system — appropriate scope for a board report
// tool, not a SaaS product with user management. Worth noting that scope
// decision explicitly in the README.

import { useEffect, useRef, useState } from "react";
import { login, googleLogin } from "./api/client";
import { page, glowTop, glowBottom, panel, logoMark, googleButtonWrapper, divider, dividerLine, dividerText, eyebrow, title, subtitle, label, inputWrapper, inputIcon, input, toggleVisibility, errorText, submitButton, spinner } from "./styles/LoginScreenStyles";
// Window.google is typed ambiently in src/types/google-identity.d.ts (picked up automatically via tsconfig's "include"), shared with NotificationsSection.tsx.

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

export function LoginScreen({ onSuccess }: { onSuccess: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const googleButtonRef = useRef<HTMLDivElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(username, password);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !googleButtonRef.current) return;

    async function handleGoogleCredential(response: { credential: string }) {
      setError(null);
      try {
        await googleLogin(response.credential);
        onSuccess();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Google sign-in failed.");
      }
    }

    // The GIS script tag is async/defer, so it may not have finished
    // loading yet when this effect runs — poll briefly rather than
    // assuming window.google is already present.
    let cancelled = false;
    const start = Date.now();
    const tryInit = () => {
      if (cancelled) return;
      if (window.google?.accounts?.id && googleButtonRef.current) {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleGoogleCredential,
        });
        window.google.accounts.id.renderButton(googleButtonRef.current, {
          theme: "outline",
          size: "large",
          width: 312,
        });
        return;
      }
      if (Date.now() - start < 5000) {
        setTimeout(tryInit, 100);
      }
    };
    tryInit();

    return () => {
      cancelled = true;
    };
  }, [onSuccess]);

  return (
    <div style={page}>
      <div style={glowTop} />
      <div style={glowBottom} />

      <form onSubmit={handleSubmit} className="card login-card" style={panel}>
        <div style={logoMark}>S</div>
        <p style={eyebrow}>Senus PLC</p>
        <h1 style={title}>Board Report</h1>
        <p style={subtitle}>Sign in to view the board report.</p>

        {GOOGLE_CLIENT_ID && (
          <>
            <div ref={googleButtonRef} style={googleButtonWrapper} />
            <div style={divider}>
              <span style={dividerLine} />
              <span style={dividerText}>or</span>
              <span style={dividerLine} />
            </div>
          </>
        )}

        <label style={label}>
          Username
          <div style={inputWrapper}>
            <span style={inputIcon}>
              <UserIcon />
            </span>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="login-input"
              style={input}
              autoComplete="username"
              autoFocus
              required
            />
          </div>
        </label>

        <label style={label}>
          Password
          <div style={inputWrapper}>
            <span style={inputIcon}>
              <LockIcon />
            </span>
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="login-input"
              style={{ ...input, paddingRight: 40 }}
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              style={toggleVisibility}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
        </label>

        {error && (
          <p style={errorText}>
            <ErrorIcon />
            {error}
          </p>
        )}

        <button type="submit" disabled={loading} className="login-submit" style={submitButton}>
          {loading ? (
            <>
              <span className="spinner" style={spinner} />
              Signing in…
            </>
          ) : (
            "Sign in"
          )}
        </button>
      </form>
    </div>
  );
}

function UserIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 12a5 5 0 100-10 5 5 0 000 10zM4 22a8 8 0 0116 0"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <rect x="4" y="11" width="16" height="10" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 11V7a4 4 0 118 0v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="M3 3l18 18M10.6 10.6a3 3 0 004.2 4.2M9.5 5.2A11 11 0 0112 5c7 0 11 7 11 7a13.2 13.2 0 01-3.2 3.9M6.5 6.6A13.6 13.6 0 001 12s4 7 11 7c1.3 0 2.5-.2 3.6-.6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ marginRight: 6, flexShrink: 0 }}>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 8v5M12 16h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
