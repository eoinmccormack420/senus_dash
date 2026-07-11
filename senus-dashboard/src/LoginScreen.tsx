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

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

// Minimal shape of the bits of the Google Identity Services API we use —
// loaded via the <script> tag in index.html, not an npm package.
interface GoogleIdCredentialResponse {
  credential: string;
}
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: GoogleIdCredentialResponse) => void;
          }) => void;
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
        };
      };
    };
  }
}

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

    async function handleGoogleCredential(response: GoogleIdCredentialResponse) {
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

const page: React.CSSProperties = {
  position: "relative",
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "var(--color-paper)",
  overflow: "hidden",
};

const glowTop: React.CSSProperties = {
  position: "absolute",
  top: "-20%",
  left: "-10%",
  width: 480,
  height: 480,
  borderRadius: "50%",
  background: "var(--color-forest-soft)",
  filter: "blur(80px)",
  opacity: 0.8,
  pointerEvents: "none",
};

const glowBottom: React.CSSProperties = {
  position: "absolute",
  bottom: "-25%",
  right: "-10%",
  width: 520,
  height: 520,
  borderRadius: "50%",
  background: "var(--color-accent-soft)",
  filter: "blur(100px)",
  opacity: 0.35,
  pointerEvents: "none",
};

const panel: React.CSSProperties = {
  position: "relative",
  width: 360,
  padding: "var(--space-6) var(--space-5)",
  display: "flex",
  flexDirection: "column",
  boxShadow: "var(--shadow-card-hover)",
  zIndex: 1,
};

const logoMark: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: "var(--radius-sm)",
  background: "var(--color-forest)",
  color: "#FFFFFF",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: "var(--font-display)",
  fontWeight: 600,
  fontSize: "var(--text-lg)",
  marginBottom: "var(--space-4)",
};

const googleButtonWrapper: React.CSSProperties = {
  display: "flex",
  justifyContent: "center",
  marginBottom: "var(--space-4)",
};

const divider: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--space-2)",
  margin: "0 0 var(--space-4) 0",
};

const dividerLine: React.CSSProperties = {
  flex: 1,
  height: 1,
  background: "var(--color-grey-line)",
};

const dividerText: React.CSSProperties = {
  fontSize: "var(--text-xs)",
  color: "var(--color-grey)",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const eyebrow: React.CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: "var(--text-xs)",
  fontWeight: 600,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--color-grey)",
  margin: 0,
};

const title: React.CSSProperties = {
  fontFamily: "var(--font-display)",
  fontWeight: 600,
  fontSize: "var(--text-xl)",
  color: "var(--color-ink)",
  margin: "var(--space-1) 0 var(--space-2) 0",
};

const subtitle: React.CSSProperties = {
  fontSize: "var(--text-sm)",
  color: "var(--color-grey)",
  margin: "0 0 var(--space-5) 0",
};

const label: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  fontSize: "var(--text-sm)",
  fontWeight: 500,
  color: "var(--color-ink)",
  marginBottom: "var(--space-3)",
};

const inputWrapper: React.CSSProperties = {
  position: "relative",
  display: "flex",
  alignItems: "center",
};

const inputIcon: React.CSSProperties = {
  position: "absolute",
  left: 12,
  display: "flex",
  color: "var(--color-grey)",
  pointerEvents: "none",
};

const input: React.CSSProperties = {
  width: "100%",
  fontFamily: "var(--font-body)",
  fontSize: "var(--text-base)",
  padding: "var(--space-2) var(--space-3) var(--space-2) 38px",
  border: "1px solid var(--color-grey-line)",
  borderRadius: "var(--radius-sm)",
  background: "var(--color-paper)",
};

const toggleVisibility: React.CSSProperties = {
  position: "absolute",
  right: 10,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "none",
  border: "none",
  padding: 4,
  color: "var(--color-grey)",
  cursor: "pointer",
};

const errorText: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  color: "var(--color-rust)",
  background: "var(--color-rust-soft)",
  fontSize: "var(--text-sm)",
  borderRadius: "var(--radius-sm)",
  padding: "var(--space-2) var(--space-3)",
  margin: "0 0 var(--space-3) 0",
};

const submitButton: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  fontFamily: "var(--font-body)",
  fontWeight: 600,
  fontSize: "var(--text-base)",
  color: "#FFFFFF",
  background: "var(--color-forest)",
  border: "none",
  borderRadius: "var(--radius-sm)",
  padding: "var(--space-3)",
  cursor: "pointer",
  marginTop: "var(--space-2)",
  boxShadow: "var(--shadow-card)",
};

const spinner: React.CSSProperties = {
  width: 14,
  height: 14,
  borderRadius: "50%",
  border: "2px solid rgba(255,255,255,0.4)",
  borderTopColor: "#FFFFFF",
};
