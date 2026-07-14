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
import { styles } from "../styles/NearbyIncubatorsStyles";

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
