// src/FundingReadinessPage.tsx
//
// Reached via /readiness (see App.tsx) — the Funding Marathon Progress
// card used to live at the top of the Dashboard, but it's a distinct
// concern from the board's core financial report and was crowding it,
// so it moved here. The old Ecosystem Checklist card (manually-entered
// HPSU/Euronext/NovaUCD status) has been dropped from this page
// entirely — the page is meant to show only real, sourced facts, and
// self-reported status fields don't qualify. It's replaced by Nearby
// Startup Incubators, backed by a real Google Places (New) search.
//
// Unlike Dashboard.tsx, this page doesn't have a period switcher —
// readiness score/milestones/committed goals are a "where do we stand
// right now" view, not something a board member needs to page through
// history for, so it always shows the latest period (same
// boardApi.getLatestPeriod() call StrategicGoalsSection.tsx already
// uses for the same reason).

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { boardApi, type CurrentUser, type PeriodDetail } from "./api/client";
import { AccountMenu } from "./components/AccountMenu";
import { FundingMarathonProgress } from "./components/FundingMarathonProgress";
import { FundingRoadmap } from "./components/FundingRoadmap";
import { NearbyIncubators } from "./components/NearbyIncubators";
import { Skeleton } from "./components/Skeleton";
import "./styles/tokens.css";

export default function FundingReadinessPage({
  currentUser,
  onSignOut,
}: {
  currentUser: CurrentUser | null;
  onSignOut: () => void;
}) {
  const [detail, setDetail] = useState<PeriodDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDetail();
  }, []);

  function loadDetail() {
    boardApi
      .getLatestPeriod()
      .then(setDetail)
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't load funding readiness."))
      .finally(() => setLoading(false));
  }

  return (
    <div style={page}>
      <header style={header}>
        <div>
          <p style={eyebrow}>Senus PLC</p>
          <div style={titleRow}>
            <h1 style={title}>Funding Readiness</h1>
            <Link to="/" style={backLink}>
              ← Back to dashboard
            </Link>
          </div>
          <p style={subheading}>Where the company stands against its funding milestones and goals, right now.</p>
        </div>
        <AccountMenu user={currentUser} onSignOut={onSignOut} />
      </header>

      {loading ? (
        <div style={skeletonStack}>
          <Skeleton height={220} radius="var(--radius-md)" />
          <Skeleton height={220} radius="var(--radius-md)" />
        </div>
      ) : error ? (
        <p style={errorText}>{error}</p>
      ) : !detail ? (
        <p style={errorText}>No financial periods have been seeded yet.</p>
      ) : (
        <>
          <FundingRoadmap
            steps={detail.funding_roadmap}
            isStaff={!!currentUser?.is_staff}
            onRegenerated={loadDetail}
          />

          <FundingMarathonProgress readiness={detail.funding_readiness} goals={detail.advisory_goals} />

          <h2 style={sectionHeading}>Irish Startup Ecosystem</h2>
          <NearbyIncubators isStaff={!!currentUser?.is_staff} />
        </>
      )}
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
  color: "var(--color-grey-text)",
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
  color: "var(--color-grey-text)",
  textDecoration: "none",
};

const subheading: React.CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: "var(--text-sm)",
  color: "var(--color-grey-text)",
  margin: "var(--space-1) 0 0 0",
};

const sectionHeading: React.CSSProperties = {
  fontFamily: "var(--font-body)",
  fontWeight: 700,
  fontSize: "var(--text-lg)",
  color: "var(--color-ink)",
  margin: "var(--space-4) 0 var(--space-3) 0",
};

const skeletonStack: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-5)",
};

const errorText: React.CSSProperties = {
  fontFamily: "var(--font-body)",
  color: "var(--color-grey-text)",
};
