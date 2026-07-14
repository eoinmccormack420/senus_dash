// Read-only "Nearby Startup Incubators" card on /readiness — real, live
// Google Places (New) results (board/extraction/places_client.py), not
// manually-entered data. Not period-scoped, so it self-fetches on mount
// rather than receiving `detail` as a prop — same "own data, own effect"
// precedent as EcosystemChecklist.tsx/HistorySection.tsx.
//
// Unlike Drive's sync (a multi-minute background-thread job with its
// own Settings panel), a Places refresh is a single fast API call, so
// the "Refresh" button lives right on this card, gated to staff users.

import { useEffect, useState } from "react";
import { incubatorsApi, type Incubator, type IncubatorsResponse } from "../api/client";
import { Skeleton } from "./Skeleton";

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
        <div>
          <p style={styles.eyebrow}>Nearby Startup Incubators</p>
          <p style={styles.caption}>
            Live results from Google Places near {data?.settings.search_location ?? "Dublin, Ireland"}
          </p>
        </div>
        {isStaff && (
          <button type="button" onClick={handleRefresh} disabled={refreshing || loading} style={styles.refreshButton}>
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        )}
      </div>

      {loading ? (
        <div style={styles.itemList}>
          <Skeleton height={52} radius="var(--radius-sm)" />
          <Skeleton height={52} radius="var(--radius-sm)" />
          <Skeleton height={52} radius="var(--radius-sm)" />
        </div>
      ) : error ? (
        <p style={styles.errorText}>{error}</p>
      ) : !data || data.incubators.length === 0 ? (
        <p style={styles.emptyText}>
          No results yet. {isStaff ? 'Click "Refresh" to search.' : "An admin needs to refresh this list."}
        </p>
      ) : (
        <>
          <div style={styles.itemList}>
            {data.incubators.map((incubator) => (
              <IncubatorRow key={incubator.place_id} incubator={incubator} />
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

function IncubatorRow({ incubator }: { incubator: Incubator }) {
  const link = incubator.maps_url || incubator.website;
  return (
    <div style={styles.row}>
      <div style={styles.rowText}>
        <p style={styles.rowTitle}>{link ? <a href={link} target="_blank" rel="noreferrer" style={styles.link}>{incubator.name}</a> : incubator.name}</p>
        {incubator.address && <p style={styles.rowDescription}>{incubator.address}</p>}
      </div>
      {incubator.rating != null && <span style={styles.ratingBadge}>★ {incubator.rating.toFixed(1)}</span>}
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
  itemList: {
    display: "flex",
    flexDirection: "column",
    gap: "var(--space-2)",
  },
  row: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "var(--space-3)",
    padding: "var(--space-2) var(--space-3)",
    border: "1px solid var(--color-grey-line)",
    borderRadius: "var(--radius-sm)",
    background: "var(--color-paper-raised)",
  },
  rowText: {
    minWidth: 0,
  },
  rowTitle: {
    fontSize: "var(--text-sm)",
    fontWeight: 600,
    color: "var(--color-ink)",
    margin: 0,
  },
  link: {
    color: "inherit",
    textDecoration: "underline",
  },
  rowDescription: {
    fontSize: "var(--text-xs)",
    color: "var(--color-grey-text)",
    margin: "2px 0 0 0",
  },
  ratingBadge: {
    flexShrink: 0,
    fontSize: "var(--text-xs)",
    fontWeight: 600,
    color: "var(--color-ink)",
    whiteSpace: "nowrap",
  },
  lastRefreshed: {
    fontSize: "var(--text-xs)",
    color: "var(--color-grey-text)",
    margin: "var(--space-2) 0 0 0",
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
