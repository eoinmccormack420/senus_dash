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
import { MapPinIcon } from "./components/icons";
import "./styles/tokens.css";
import { page, header, eyebrow, titleRow, title, backLink, subheading, sectionHeadingRow, sectionIconBadge, sectionHeading, skeletonStack, errorText } from "./styles/FundingReadinessPageStyles";

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

          <div style={sectionHeadingRow}>
            <span style={sectionIconBadge}>
              <MapPinIcon size={14} />
            </span>
            <h2 style={sectionHeading}>Irish Startup Ecosystem</h2>
          </div>
          <NearbyIncubators isStaff={!!currentUser?.is_staff} />
        </>
      )}
    </div>
  );
}
