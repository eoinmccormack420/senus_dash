// src/components/ProvenanceBadge.tsx
//
// Surfaces ExtractionAttempt.match_rate_pct — data that already exists
// in the backend but was invisible in the UI — as a trust signal next
// to each period. Distinguishes three states:
//   - manual: no AI extraction pipeline touched this period's figures
//   - ai_extracted, unverified: went through cross-checking but a human
//     hasn't signed off on every statement yet
//   - ai_extracted, verified: fully AI-extracted, cross-checked, and
//     human-approved

import type { Provenance } from "../api/client";

export function ProvenanceBadge({ provenance, style }: { provenance: Provenance; style?: React.CSSProperties }) {
  if (provenance.source === "manual") {
    return (
      <span className="provenance-badge provenance-manual" style={style}>
        Manually entered
      </span>
    );
  }

  const pct = provenance.match_rate_pct !== null ? `${provenance.match_rate_pct}% match` : "match rate unavailable";

  if (provenance.verified) {
    return (
      <span className="provenance-badge provenance-verified" style={style}>
        ✓ AI-verified · {pct}
      </span>
    );
  }

  return (
    <span className="provenance-badge provenance-pending" style={style}>
      AI-extracted · {pct} · pending review
    </span>
  );
}
