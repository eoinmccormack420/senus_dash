// src/App.tsx
//
// Top-level auth gate. Shows LoginScreen until a token exists, then
// renders the dashboard. Logout just clears the token and re-shows
// the login screen — no server-side session to invalidate beyond that
// for this scope (DRF token auth is stateless per-token, not
// session-based).

import { useState } from "react";
import Dashboard from "./Dashboard";
import { LoginScreen } from "./LoginScreen";
import { getToken, clearToken } from "./api/client";

function App() {
  const [authed, setAuthed] = useState<boolean>(() => getToken() !== null);

  if (!authed) {
    return <LoginScreen onSuccess={() => setAuthed(true)} />;
  }

  return (
    <div>
      <div className="no-print" style={logoutBar}>
        <button
          onClick={() => {
            clearToken();
            setAuthed(false);
          }}
          style={logoutButton}
        >
          Sign out
        </button>
      </div>
      <Dashboard />
    </div>
  );
}

const logoutBar: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  maxWidth: 1200,
  margin: "0 auto",
  padding: "var(--space-3) var(--space-4) 0",
};

const logoutButton: React.CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: "var(--text-xs)",
  color: "var(--color-grey)",
  background: "none",
  border: "none",
  cursor: "pointer",
  textDecoration: "underline",
};

export default App;