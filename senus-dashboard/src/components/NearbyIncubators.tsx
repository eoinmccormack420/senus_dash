// Read-only "Nearby Startup Incubators" card on /readiness — real, live
// Google Places (New) results (board/extraction/places_client.py), not
// manually-entered data. Not period-scoped, so it self-fetches on mount
// rather than receiving `detail` as a prop — same "own data, own effect"
// precedent as EcosystemChecklist.tsx/HistorySection.tsx.
//
// Unlike Drive's sync (a multi-minute background-thread job with its
// own Settings panel), a Places refresh is a single fast API call, so
// the "Refresh" button lives right on this card, gated to staff users.
//
// Rendered as a responsive card grid (each incubator its own hoverable
// mini-card via .card-hover) rather than a stacked list — a plain list
// of identical rows was the least "designed" thing on this page.

import { useEffect, useState } from "react";
import { incubatorsApi, type Incubator, type IncubatorsResponse } from "../api/client";
import { Skeleton } from "./Skeleton";
import { MapPinIcon } from "./icons";

export function NearbyIncubators({ isStaff }: { isStaff: boolean }) {
  const [data, setData] = useState<IncubatorsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    load();
  }, []);

  function load() {
    setLoading(true);
    incubatorsApi
      .list()
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't load nearby incubators."))
      .finally(() => setLoading(false));
  }

  function handleRefresh() {
    setRefreshing(true);
    setError(null);
    incubatorsApi
      .refresh()
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't refresh nearby incubators."))
      .finally(() => setRefreshing(false));
  }

  return (
    <section className="card print-avoid-break" style={styles.card}>
      <div style={styles.header}>
        <div style={styles.eyebrowRow}>
          <span style={styles.cardIconBadge}>
            <MapPinIcon size={14} />
          </span>
          <div>
            <p style={styles.eyebrow}>Nearby Startup Incubators</p>
            <p style={styles.caption}>
              Live results from Google Places near {data?.settings.search_location ?? "Dublin, Ireland"}
            </p>
          </div>
        </div>
        {isStaff && (
          <button type="button" onClick={handleRefresh} disabled={refreshing || loading} style={styles.refreshButton}>
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        )}
      </div>

      {loading ? (
        <div style={styles.grid}>
          <Skeleton height={128} radius="var(--radius-md)" />
          <Skeleton height={128} radius="var(--radius-md)" />
          <Skeleton height={128} radius="var(--radius-md)" />
        </div>
      ) : error ? (
        <p style={styles.errorText}>{error}</p>
      ) : !data || data.incubators.length === 0 ? (
        <p style={styles.emptyText}>
          No results yet. {isStaff ? 'Click "Refresh" to search.' : "An admin needs to refresh this list."}
        </p>
      ) : (
        <>
          <div style={styles.grid}>
            {data.incubators.map((incubator) => (
              <IncubatorCard key={incubator.place_id} incubator={incubator} />
            ))}
          </div>
          {data.settings.last_refreshed_at && (
            <p style={styles.lastRefreshed}>
              Last refreshed {new Date(data.settings.last_refreshed_at).toLocaleString()}
            </p>
          )}
        </>
      )}
    </section>
  );
}

function IncubatorCard({ incubator }: { incubator: Incubator }) {
  const link = incubator.maps_url || incubator.website;
  return (
    <div className="card card-hover" style={styles.tile}>
      <div style={styles.tileTop}>
        <span style={styles.tilePin}>
          <MapPinIcon size={13} />
        </span>
        {incubator.rating != null && <span style={styles.ratingBadge}>★ {incubator.rating.toFixed(1)}</span>}
      </div>
      <p style={styles.tileTitle}>{incubator.name}</p>
      {incubator.address && <p style={styles.tileAddress}>{incubator.address}</p>}
      {link && (
        <a href={link} target="_blank" rel="noreferrer" style={styles.tileLink}>
          Visit ↗
        </a>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    padding: "var(--space-4)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "var(--space-3)",
    marginBottom: "var(--space-3)",
  },
  eyebrowRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: "var(--space-2)",
  },
  cardIconBadge: {
    flexShrink: 0,
    width: 24,
    height: 24,
    borderRadius: "var(--radius-sm)",
    background: "var(--color-forest-soft)",
    color: "var(--color-forest)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  eyebrow: {
    fontFamily: "var(--font-body)",
    fontWeight: 600,
    fontSize: "var(--text-sm)",
    color: "var(--color-ink)",
    margin: 0,
  },
  caption: {
    fontSize: "var(--text-xs)",
    color: "var(--color-grey-text)",
    margin: "var(--space-1) 0 0 0",
  },
  refreshButton: {
    flexShrink: 0,
    fontFamily: "var(--font-body)",
    fontSize: "var(--text-xs)",
    fontWeight: 600,
    padding: "6px 14px",
    borderRadius: "var(--radius-sm)",
    border: "1px solid var(--color-grey-line)",
    background: "var(--color-paper-raised)",
    color: "var(--color-ink)",
    cursor: "pointer",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
    gap: "var(--space-3)",
  },
  tile: {
    padding: "var(--space-3)",
    display: "flex",
    flexDirection: "column",
  },
  tileTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "var(--space-2)",
  },
  tilePin: {
    flexShrink: 0,
    width: 26,
    height: 26,
    borderRadius: "50%",
    background: "var(--color-forest-soft)",
    color: "var(--color-forest)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  ratingBadge: {
    fontSize: "var(--text-xs)",
    fontWeight: 700,
    color: "#A8720E",
    background: "#FBF1DE",
    padding: "2px 7px",
    borderRadius: 999,
    whiteSpace: "nowrap",
  },
  tileTitle: {
    fontSize: "var(--text-sm)",
    fontWeight: 600,
    color: "var(--color-ink)",
    margin: "0 0 var(--space-1) 0",
  },
  tileAddress: {
    fontSize: "var(--text-xs)",
    color: "var(--color-grey-text)",
    margin: 0,
    flex: 1,
  },
  tileLink: {
    display: "inline-block",
    fontSize: "var(--text-xs)",
    fontWeight: 600,
    color: "var(--color-forest)",
    textDecoration: "none",
    marginTop: "var(--space-2)",
  },
  lastRefreshed: {
    fontSize: "var(--text-xs)",
    color: "var(--color-grey-text)",
    margin: "var(--space-3) 0 0 0",
  },
  emptyText: {
    fontSize: "var(--text-xs)",
    color: "var(--color-grey-text)",
    margin: 0,
  },
  errorText: {
    fontSize: "var(--text-xs)",
    color: "var(--color-rust)",
    margin: 0,
  },
};
