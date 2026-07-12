// src/App.tsx
//
// Top-level auth gate. Shows LoginScreen until a token exists, then
// renders the dashboard. Logout just clears the token and re-shows
// the login screen — no server-side session to invalidate beyond that
// for this scope (DRF token auth is stateless per-token, not
// session-based).
//
// Also owns the signed-in user's identity (currentUser), fetched via
// /api/auth/me/ — the login response itself is never persisted, so
// this is the only way to recover identity after a page reload, when
// only the token survives in localStorage.

import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "./Dashboard";
import SettingsPage from "./SettingsPage";
import GovernanceCenter from "./governance/GovernanceCenter";
import { LoginScreen } from "./LoginScreen";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { getToken, clearToken, getCurrentUser, type CurrentUser } from "./api/client";

function AppContent() {
  const [authed, setAuthed] = useState<boolean>(() => getToken() !== null);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    if (!authed) return;
    let cancelled = false;
    getCurrentUser()
      .then((u) => {
        if (!cancelled) setCurrentUser(u);
      })
      .catch(() => {
        // apiFetch already handles a 401 here by clearing the token and
        // reloading back to the login screen — nothing further to do.
      });
    return () => {
      cancelled = true;
    };
  }, [authed]);

  function handleSignOut() {
    clearToken();
    setAuthed(false);
    setCurrentUser(null);
  }

  if (!authed) {
    return <LoginScreen onSuccess={() => setAuthed(true)} />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/settings" element={<SettingsPage currentUser={currentUser} onSignOut={handleSignOut} />} />
        <Route path="/governance" element={<GovernanceCenter currentUser={currentUser} onSignOut={handleSignOut} />} />
        <Route path="/*" element={<Dashboard currentUser={currentUser} onSignOut={handleSignOut} />} />
      </Routes>
    </BrowserRouter>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

export default App;