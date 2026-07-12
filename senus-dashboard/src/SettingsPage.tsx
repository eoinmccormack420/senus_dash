// src/SettingsPage.tsx
//
// Full settings page, reached via /settings (see App.tsx). Sidebar nav
// + content pane, mirroring Dashboard.tsx's own SECTIONS/activeSection
// tab pattern (just vertical instead of horizontal pills). The two
// admin items are omitted from the sidebar entirely for non-staff
// users, not just their content hidden.

import { useState } from "react";
import { Link } from "react-router-dom";
import type { CurrentUser } from "./api/client";
import { AccountMenu } from "./components/AccountMenu";
import { NotificationsSection } from "./settings/NotificationsSection";
import { SignInAccessSection } from "./settings/SignInAccessSection";
import { RegenerateInsightsSection } from "./settings/RegenerateInsightsSection";
import { GovernanceSection } from "./settings/GovernanceSection";
import "./styles/tokens.css";

const ALL_SECTIONS = [
  { key: "notifications", label: "Notifications", adminOnly: false },
  { key: "sign_in_access", label: "Sign-in access", adminOnly: true },
  { key: "regenerate_insights", label: "Regenerate insights", adminOnly: true },
  { key: "governance", label: "AI Governance", adminOnly: true },
] as const;

type SectionKey = (typeof ALL_SECTIONS)[number]["key"];

export default function SettingsPage({
  currentUser,
  onSignOut,
}: {
  currentUser: CurrentUser | null;
  onSignOut: () => void;
}) {
  const [active, setActive] = useState<SectionKey>("notifications");

  if (!currentUser) return null;

  const sections = ALL_SECTIONS.filter((s) => !s.adminOnly || currentUser.is_staff);

  return (
    <div style={page}>
      <header style={header}>
        <div>
          <p style={eyebrow}>Senus PLC</p>
          <div style={titleRow}>
            <h1 style={title}>Settings</h1>
            <Link to="/" style={backLink}>
              ← Back to dashboard
            </Link>
          </div>
        </div>
        <AccountMenu user={currentUser} onSignOut={onSignOut} />
      </header>

      <div style={body}>
        <nav style={sidebar}>
          {sections.map((s) => (
            <button
              key={s.key}
              onClick={() => setActive(s.key)}
              style={{ ...navItem, ...(active === s.key ? navItemActive : {}) }}
            >
              {s.label}
            </button>
          ))}
        </nav>

        <main style={content}>
          {active === "notifications" && <NotificationsSection isAdmin={currentUser.is_staff} />}
          {active === "sign_in_access" && currentUser.is_staff && (
            <SignInAccessSection currentUserEmail={currentUser.email} />
          )}
          {active === "regenerate_insights" && currentUser.is_staff && <RegenerateInsightsSection />}
          {active === "governance" && currentUser.is_staff && <GovernanceSection />}
        </main>
      </div>
    </div>
  );
}

const page: React.CSSProperties = {
  maxWidth: 1200,
  margin: "0 auto",
  padding: "var(--space-6) var(--space-4)",
};

const header: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-end",
  flexWrap: "wrap",
  gap: "var(--space-4)",
  marginBottom: "var(--space-5)",
};

const eyebrow: React.CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: "var(--text-xs)",
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--color-grey)",
  margin: 0,
  fontWeight: 600,
};

const titleRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--space-3)",
  flexWrap: "wrap",
};

const title: React.CSSProperties = {
  fontFamily: "var(--font-body)",
  fontWeight: 700,
  fontSize: "var(--text-xl)",
  color: "var(--color-ink)",
  margin: "var(--space-1) 0 0 0",
};

const backLink: React.CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: "var(--text-sm)",
  color: "var(--color-grey)",
  textDecoration: "none",
};

const body: React.CSSProperties = {
  display: "flex",
  gap: "var(--space-5)",
  alignItems: "flex-start",
  flexWrap: "wrap",
};

const sidebar: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-1)",
  width: 220,
  flexShrink: 0,
};

const navItem: React.CSSProperties = {
  textAlign: "left",
  fontFamily: "var(--font-body)",
  fontWeight: 500,
  fontSize: "var(--text-sm)",
  color: "var(--color-grey)",
  padding: "var(--space-2) var(--space-3)",
  border: "none",
  background: "transparent",
  borderRadius: "var(--radius-sm)",
  cursor: "pointer",
};

const navItemActive: React.CSSProperties = {
  background: "var(--color-paper-raised)",
  color: "var(--color-ink)",
  fontWeight: 600,
  boxShadow: "var(--shadow-card)",
};

const content: React.CSSProperties = {
  flex: 1,
  minWidth: 280,
  background: "var(--color-paper-raised)",
  borderRadius: "var(--radius-md)",
  boxShadow: "var(--shadow-card)",
  padding: "var(--space-5)",
};
