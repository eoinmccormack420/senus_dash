// src/ReportBuilderPage.tsx
//
// Reached via /report-builder (see App.tsx) — replaces the old
// unconfigurable "Download Board Pack" button. Configure which
// sections, for whom, and why (ReportSpec), then download a PDF
// (server-side Playwright, see board/extraction/report_pdf.py) or a
// slide deck (python-pptx, report_deck.py). AI-tailored narrative
// generation/approval is admin-only — mutations there are backend-
// gated too (ReportSpecViewSet.get_permissions), this just hides the
// controls for non-admins rather than showing a 403.

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  boardApi,
  reportSpecsApi,
  triggerBlobDownload,
  type CurrentUser,
  type PeriodSummary,
  type ReportSpec,
} from "./api/client";
import { AccountMenu } from "./components/AccountMenu";
import { Skeleton } from "./components/Skeleton";

const SECTION_OPTIONS = [
  { field: "include_revenue_growth" as const, label: "Revenue & Growth" },
  { field: "include_profitability" as const, label: "Profitability" },
  { field: "include_cash_liquidity" as const, label: "Cash & Liquidity" },
  { field: "include_solvency_leverage" as const, label: "Solvency & Leverage" },
  { field: "include_returns" as const, label: "Returns" },
  { field: "include_outlook" as const, label: "Outlook & Strategy" },
];

type SectionField = (typeof SECTION_OPTIONS)[number]["field"];

const DEFAULT_SECTIONS: Record<SectionField, boolean> = {
  include_revenue_growth: true,
  include_profitability: true,
  include_cash_liquidity: true,
  include_solvency_leverage: true,
  include_returns: true,
  include_outlook: true,
};

export default function ReportBuilderPage({
  currentUser,
  onSignOut,
}: {
  currentUser: CurrentUser | null;
  onSignOut: () => void;
}) {
  const [periods, setPeriods] = useState<PeriodSummary[]>([]);
  const [specs, setSpecs] = useState<ReportSpec[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [periodId, setPeriodId] = useState<number | "">("");
  const [title, setTitle] = useState("");
  const [audienceLabel, setAudienceLabel] = useState("");
  const [contextNote, setContextNote] = useState("");
  const [sections, setSections] = useState(DEFAULT_SECTIONS);
  const [useTailored, setUseTailored] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Separate from busyId: narrative generation is the slow one (up to
  // 7 sequential Gemini calls — cover plus each included section), so
  // it gets its own loading block with a live elapsed-time counter
  // rather than just a disabled button, per user feedback that the
  // wait needed better feedback.
  const [generatingNarrativeId, setGeneratingNarrativeId] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (generatingNarrativeId === null) return;
    setElapsedSeconds(0);
    const interval = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [generatingNarrativeId]);

  useEffect(() => {
    Promise.all([boardApi.listPeriods(), reportSpecsApi.list()])
      .then(([periodsRes, specsRes]) => {
        setPeriods(periodsRes);
        setSpecs(specsRes);
        if (periodsRes.length > 0) setPeriodId(periodsRes[periodsRes.length - 1].id);
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : "Couldn't load report builder."))
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (periodId === "" || !audienceLabel.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      const spec = await reportSpecsApi.create({
        period: periodId,
        title: title.trim(),
        audience_label: audienceLabel.trim(),
        context_note: contextNote.trim(),
        use_tailored_narrative: useTailored,
        ...sections,
      });
      setSpecs((prev) => [spec, ...prev]);
      setExpandedId(spec.id);
      setTitle("");
      setAudienceLabel("");
      setContextNote("");
      setSections(DEFAULT_SECTIONS);
      setUseTailored(false);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Couldn't create report.");
    } finally {
      setCreating(false);
    }
  }

  function replaceSpec(updated: ReportSpec) {
    setSpecs((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  }

  async function handleGenerateNarrative(spec: ReportSpec) {
    setBusyId(spec.id);
    setGeneratingNarrativeId(spec.id);
    setActionError(null);
    try {
      await reportSpecsApi.generateNarrative(spec.id, true);
      replaceSpec(await reportSpecsApi.get(spec.id));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Couldn't generate narrative.");
    } finally {
      setBusyId(null);
      setGeneratingNarrativeId(null);
    }
  }

  async function handleApproveNarrative(spec: ReportSpec) {
    setBusyId(spec.id);
    setActionError(null);
    try {
      replaceSpec(await reportSpecsApi.approveNarrative(spec.id));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Couldn't approve narrative.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDownload(spec: ReportSpec, kind: "downloadPdf" | "downloadDeck") {
    setBusyId(spec.id);
    setActionError(null);
    try {
      const { blob, filename } = await reportSpecsApi[kind](spec.id);
      triggerBlobDownload(blob, filename);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Couldn't generate the file.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div style={page}>
      <header style={header}>
        <div>
          <p style={eyebrow}>Senus PLC</p>
          <div style={titleRow}>
            <h1 style={title_}>Build a Report</h1>
            <Link to="/" style={backLink}>
              ← Back to dashboard
            </Link>
          </div>
        </div>
        <AccountMenu user={currentUser} onSignOut={onSignOut} />
      </header>

      {loading ? (
        <Skeleton height={300} radius="var(--radius-md)" />
      ) : loadError ? (
        <p style={errorText}>{loadError}</p>
      ) : (
        <>
          <section className="card" style={formCard}>
            <h2 style={sectionHeading}>New report</h2>
            <form onSubmit={handleCreate}>
              <div style={fieldRow}>
                <label style={fieldLabel}>
                  Period
                  <select
                    value={periodId}
                    onChange={(e) => setPeriodId(e.target.value ? Number(e.target.value) : "")}
                    style={input}
                    required
                  >
                    <option value="" disabled>
                      Select a period…
                    </option>
                    {periods.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label style={fieldLabel}>
                  Title (optional)
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Q2 2026 Investor Update"
                    style={input}
                  />
                </label>
              </div>

              <label style={fieldLabel}>
                Who is this for?
                <input
                  type="text"
                  value={audienceLabel}
                  onChange={(e) => setAudienceLabel(e.target.value)}
                  placeholder="Series A Investors, Bank of Ireland, the Board…"
                  style={input}
                  required
                />
              </label>

              <label style={fieldLabel}>
                Context (optional — appears on the cover page)
                <textarea
                  value={contextNote}
                  onChange={(e) => setContextNote(e.target.value)}
                  placeholder="Why this report is being shared, and any framing the reader should have"
                  rows={2}
                  style={{ ...input, resize: "vertical" }}
                />
              </label>

              <p style={fieldLabel}>Sections to include</p>
              <div style={checkboxGrid}>
                {SECTION_OPTIONS.map((opt) => (
                  <label key={opt.field} style={checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={sections[opt.field]}
                      onChange={(e) => setSections((prev) => ({ ...prev, [opt.field]: e.target.checked }))}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>

              {currentUser?.is_staff && (
                <label style={checkboxLabel}>
                  <input type="checkbox" checked={useTailored} onChange={(e) => setUseTailored(e.target.checked)} />
                  Use AI narrative tailored to this audience (requires review before it's used in a download)
                </label>
              )}

              <button type="submit" disabled={creating || periodId === "" || !audienceLabel.trim()} style={createButton}>
                {creating ? "Creating…" : "Create report"}
              </button>
              {createError && <p style={errorText}>{createError}</p>}
            </form>
          </section>

          <section style={{ marginTop: "var(--space-5)" }}>
            <h2 style={sectionHeading}>Your reports</h2>
            {specs.length === 0 ? (
              <p style={caption}>No reports yet — create one above.</p>
            ) : (
              <div style={specList}>
                {specs.map((spec) => (
                  <SpecCard
                    key={spec.id}
                    spec={spec}
                    isAdmin={!!currentUser?.is_staff}
                    expanded={expandedId === spec.id}
                    busy={busyId === spec.id}
                    generatingNarrative={generatingNarrativeId === spec.id}
                    elapsedSeconds={elapsedSeconds}
                    onToggle={() => setExpandedId(expandedId === spec.id ? null : spec.id)}
                    onGenerateNarrative={() => handleGenerateNarrative(spec)}
                    onApproveNarrative={() => handleApproveNarrative(spec)}
                    onDownloadPdf={() => handleDownload(spec, "downloadPdf")}
                    onDownloadDeck={() => handleDownload(spec, "downloadDeck")}
                  />
                ))}
              </div>
            )}
            {actionError && <p style={errorText}>{actionError}</p>}
          </section>
        </>
      )}
    </div>
  );
}

function SpecCard({
  spec,
  isAdmin,
  expanded,
  busy,
  generatingNarrative,
  elapsedSeconds,
  onToggle,
  onGenerateNarrative,
  onApproveNarrative,
  onDownloadPdf,
  onDownloadDeck,
}: {
  spec: ReportSpec;
  isAdmin: boolean;
  expanded: boolean;
  busy: boolean;
  generatingNarrative: boolean;
  elapsedSeconds: number;
  onToggle: () => void;
  onGenerateNarrative: () => void;
  onApproveNarrative: () => void;
  onDownloadPdf: () => void;
  onDownloadDeck: () => void;
}) {
  const includedLabels = SECTION_OPTIONS.filter((opt) => spec[opt.field]).map((opt) => opt.label);
  const includedCount = includedLabels.length + 1; // + cover

  return (
    <div className="card" style={specCard}>
      <div style={specHeader} onClick={onToggle}>
        <div>
          <p style={specTitle}>{spec.title || `${spec.audience_label} — ${spec.period_label}`}</p>
          <p style={specSubtitle}>
            {spec.period_label} · For {spec.audience_label}
          </p>
        </div>
        <span style={caretIcon}>{expanded ? "▾" : "▸"}</span>
      </div>

      {expanded && (
        <div style={specBody}>
          {spec.context_note && <p style={specContext}>{spec.context_note}</p>}
          <p style={specSectionsLine}>Sections: {includedLabels.join(", ") || "none"}</p>

          {spec.use_tailored_narrative && (
            <div style={narrativeBox}>
              {generatingNarrative ? (
                <div style={loadingBlock}>
                  <span className="spinner" style={spinnerLarge} />
                  <div>
                    <p style={loadingTitle}>Generating tailored narrative…</p>
                    <p style={loadingSubtext}>
                      {elapsedSeconds}s elapsed — writing up to {includedCount} pieces (cover + each included
                      section), this can take up to a minute
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <p style={narrativeStatus}>
                    {spec.narrative_approved
                      ? `✓ Tailored narrative approved by ${spec.narrative_approved_by_username ?? "an admin"}`
                      : spec.tailored_narrative
                        ? "Tailored narrative generated — pending admin review"
                        : "Tailored narrative not generated yet"}
                  </p>
                  {isAdmin && (
                    <div style={actionRow}>
                      <button type="button" onClick={onGenerateNarrative} disabled={busy} style={secondaryButton}>
                        {spec.tailored_narrative ? "Regenerate narrative" : "Generate narrative"}
                      </button>
                      {spec.tailored_narrative && !spec.narrative_approved && (
                        <button type="button" onClick={onApproveNarrative} disabled={busy} style={primaryButton}>
                          {busy ? "…" : "Approve narrative"}
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          <div style={{ ...actionRow, marginTop: "var(--space-3)" }}>
            <button type="button" onClick={onDownloadPdf} disabled={busy} style={primaryButton}>
              {busy && !generatingNarrative ? (
                <>
                  <span className="spinner" style={spinnerSmall} /> Generating…
                </>
              ) : (
                "Download PDF"
              )}
            </button>
            <button type="button" onClick={onDownloadDeck} disabled={busy} style={secondaryButton}>
              {busy && !generatingNarrative ? (
                <>
                  <span className="spinner" style={spinnerSmall} /> Generating…
                </>
              ) : (
                "Download Slide Deck"
              )}
            </button>
          </div>
        </div>
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

const title_: React.CSSProperties = {
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

const sectionHeading: React.CSSProperties = {
  fontFamily: "var(--font-body)",
  fontWeight: 700,
  fontSize: "var(--text-lg)",
  color: "var(--color-ink)",
  margin: "0 0 var(--space-3) 0",
};

const formCard: React.CSSProperties = {
  padding: "var(--space-4)",
};

const fieldRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "var(--space-3)",
};

const fieldLabel: React.CSSProperties = {
  display: "block",
  fontSize: "var(--text-xs)",
  fontWeight: 600,
  color: "var(--color-ink)",
  margin: "0 0 var(--space-3) 0",
};

const input: React.CSSProperties = {
  display: "block",
  marginTop: "var(--space-1)",
  width: "100%",
  boxSizing: "border-box",
  fontFamily: "var(--font-body)",
  fontSize: "var(--text-sm)",
  padding: "var(--space-2)",
  border: "1px solid var(--color-grey-line)",
  borderRadius: "var(--radius-sm)",
};

const checkboxGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "var(--space-2)",
  marginBottom: "var(--space-3)",
};

const checkboxLabel: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--space-2)",
  fontSize: "var(--text-sm)",
  color: "var(--color-ink)",
  marginBottom: "var(--space-3)",
};

const createButton: React.CSSProperties = {
  fontFamily: "var(--font-body)",
  fontWeight: 600,
  fontSize: "var(--text-sm)",
  color: "var(--color-on-accent)",
  background: "var(--color-forest)",
  border: "none",
  borderRadius: "var(--radius-sm)",
  padding: "var(--space-2) var(--space-4)",
  cursor: "pointer",
};

const caption: React.CSSProperties = {
  fontSize: "var(--text-sm)",
  color: "var(--color-grey-text)",
};

const specList: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-3)",
};

const specCard: React.CSSProperties = {
  padding: "var(--space-3) var(--space-4)",
};

const specHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  cursor: "pointer",
};

const specTitle: React.CSSProperties = {
  fontSize: "var(--text-sm)",
  fontWeight: 700,
  color: "var(--color-ink)",
  margin: 0,
};

const specSubtitle: React.CSSProperties = {
  fontSize: "var(--text-xs)",
  color: "var(--color-grey-text)",
  margin: "2px 0 0 0",
};

const caretIcon: React.CSSProperties = {
  color: "var(--color-grey-text)",
};

const specBody: React.CSSProperties = {
  marginTop: "var(--space-3)",
  paddingTop: "var(--space-3)",
  borderTop: "1px solid var(--color-grey-line)",
};

const specContext: React.CSSProperties = {
  fontSize: "var(--text-sm)",
  color: "var(--color-ink)",
  fontStyle: "italic",
  margin: "0 0 var(--space-2) 0",
};

const specSectionsLine: React.CSSProperties = {
  fontSize: "var(--text-xs)",
  color: "var(--color-grey-text)",
  margin: 0,
};

const narrativeBox: React.CSSProperties = {
  marginTop: "var(--space-3)",
  padding: "var(--space-3)",
  background: "var(--color-paper)",
  border: "1px solid var(--color-grey-line)",
  borderRadius: "var(--radius-sm)",
};

const narrativeStatus: React.CSSProperties = {
  fontSize: "var(--text-sm)",
  color: "var(--color-ink)",
  margin: "0 0 var(--space-2) 0",
};

const actionRow: React.CSSProperties = {
  display: "flex",
  gap: "var(--space-3)",
  flexWrap: "wrap",
};

const primaryButton: React.CSSProperties = {
  fontFamily: "var(--font-body)",
  fontWeight: 600,
  fontSize: "var(--text-sm)",
  color: "#FFFFFF",
  background: "var(--color-forest)",
  border: "none",
  borderRadius: "var(--radius-sm)",
  padding: "var(--space-2) var(--space-3)",
  cursor: "pointer",
};

const secondaryButton: React.CSSProperties = {
  fontFamily: "var(--font-body)",
  fontWeight: 600,
  fontSize: "var(--text-sm)",
  color: "var(--color-ink)",
  background: "var(--color-paper-raised)",
  border: "1px solid var(--color-grey-line)",
  borderRadius: "var(--radius-sm)",
  padding: "var(--space-2) var(--space-3)",
  cursor: "pointer",
};

const errorText: React.CSSProperties = {
  fontSize: "var(--text-sm)",
  color: "var(--color-rust)",
  marginTop: "var(--space-2)",
};

const loadingBlock: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--space-3)",
};

const loadingTitle: React.CSSProperties = {
  fontSize: "var(--text-sm)",
  fontWeight: 600,
  color: "var(--color-ink)",
  margin: 0,
};

const loadingSubtext: React.CSSProperties = {
  fontSize: "var(--text-xs)",
  color: "var(--color-grey-text)",
  margin: "2px 0 0 0",
};

const spinnerLarge: React.CSSProperties = {
  flexShrink: 0,
  width: 22,
  height: 22,
  borderRadius: "50%",
  border: "3px solid var(--color-grey-line)",
  borderTopColor: "var(--color-forest)",
};

// border uses a neutral translucent grey (not tied to light/dark) so
// the same style works on both the dark primaryButton and the light
// secondaryButton — borderTopColor: currentColor adapts to each
// button's own text color for the moving arc.
const spinnerSmall: React.CSSProperties = {
  width: 12,
  height: 12,
  borderRadius: "50%",
  border: "2px solid rgba(128,128,128,0.35)",
  borderTopColor: "currentColor",
  verticalAlign: "middle",
  marginRight: "var(--space-2)",
};
