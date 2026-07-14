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
import { AlertsSection } from "./settings/AlertsSection";
import { StrategicGoalsSection } from "./settings/StrategicGoalsSection";
import { EcosystemChecklistSection } from "./settings/EcosystemChecklistSection";
import { DriveSection } from "./settings/DriveSection";
import "./styles/tokens.css";
import { page, header, eyebrow, titleRow, title, backLink, body, sidebar, navItem, navItemActive, content } from "./styles/SettingsPageStyles";

const ALL_SECTIONS = [
  { key: "notifications", label: "Notifications", adminOnly: false },
  { key: "alerts", label: "Board Alerts", adminOnly: true },
  { key: "strategic_goals", label: "Strategic Goals", adminOnly: true },
  { key: "ecosystem_checklist", label: "Ecosystem Checklist", adminOnly: true },
  { key: "drive", label: "Google Drive", adminOnly: true },
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
          {active === "alerts" && currentUser.is_staff && <AlertsSection />}
          {active === "strategic_goals" && currentUser.is_staff && <StrategicGoalsSection />}
          {active === "ecosystem_checklist" && currentUser.is_staff && <EcosystemChecklistSection />}
          {active === "drive" && currentUser.is_staff && <DriveSection />}
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
