// src/Dashboard.tsx
//
// Redesigned shell: card-grid hero (matching Assiduous's own product
// visual language — white rounded cards, soft shadow, trend badges,
// mini sparklines) while keeping serif display type for the headline
// numbers themselves, as the one deliberate "board report" signal
// carried over from the original direction.

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  ResponsiveContainer,
} from "recharts";
import { boardApi, type PeriodDetail, type PeriodSummary, num, formatEUR, formatPct } from "./api/client";
import { Skeleton } from "./components/Skeleton";
import { ProvenanceBadge } from "./components/ProvenanceBadge";
import { RevenueGrowthSection } from "./sections/RevenueGrowthSection";
import { ProfitabilitySection } from "./sections/ProfitabilitySection";
import { CashLiquiditySection } from "./sections/CashLiquiditySection";
import { SolvencyLeverageSection } from "./sections/SolvencyLeverageSection";
import { ReturnsSection } from "./sections/ReturnsSection";
import { AIInsightsSection } from "./sections/AIInsightsSection";
import "./styles/tokens.css";

const SECTIONS = [
  { key: "revenue_growth", label: "Revenue & Growth" },
  { key: "profitability", label: "Profitability" },
  { key: "cash_liquidity", label: "Cash & Liquidity" },
  { key: "solvency_leverage", label: "Solvency & Leverage" },
  { key: "returns", label: "Returns" },
  { key: "outlook", label: "Executive Summary" },
] as const;

interface HistoryPoint {
  label: string;
  endDate: string;
  revenue: number;
  operatingLoss: number;
  cash: number;
}

export default function Dashboard() {
  const [periods, setPeriods] = useState<PeriodSummary[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<PeriodDetail | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [activeSection, setActiveSection] = useState<string>(SECTIONS[0].key);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    boardApi
      .listPeriods()
      .then(async (list) => {
        setPeriods(list);
        const latest = list[list.length - 1];
        if (latest) setSelectedId(latest.id);

        // Fetch full history once, for hero card sparklines + trend badges
        const details = await Promise.all(list.map((p) => boardApi.getPeriod(p.id)));
        setHistory(
          details.map((d) => ({
            label: d.label,
            endDate: d.end_date,
            revenue: d.pl_statement ? num(d.pl_statement.revenue) : 0,
            operatingLoss: d.pl_statement ? num(d.pl_statement.operating_loss) : 0,
            cash: d.balance_sheet ? num(d.balance_sheet.cash) : 0,
          }))
        );
      })
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    if (selectedId === null) return;
    let cancelled = false;
    setLoading(true);
    boardApi
      .getPeriod(selectedId)
      .then((d) => {
        // Guard against out-of-order responses: if the user has already
        // switched to a different period tab by the time this resolves,
        // discard it rather than clobbering the newer selection's data.
        if (cancelled) return;
        setDetail(d);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  if (error) {
    return (
      <div style={styles.errorState}>
        <p style={{ fontFamily: "var(--font-body)", fontWeight: 600, fontSize: "var(--text-lg)", color: "var(--color-ink)" }}>
          Couldn't load the board report.
        </p>
        <p style={{ color: "var(--color-grey)" }}>{error}</p>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div>
          <p style={styles.eyebrow}>Senus PLC</p>
          <div style={styles.titleRow}>
            <h1 style={styles.title}>Board Report</h1>
            {detail && !loading && <ProvenanceBadge provenance={detail.provenance} />}
          </div>
        </div>
        <div className="no-print" style={styles.headerControls}>
          <PeriodTabs periods={periods} selectedId={selectedId} loading={loading} onSelect={setSelectedId} />
          <button
            onClick={() => window.print()}
            disabled={loading || !detail}
            style={{
              ...styles.printButton,
              ...(loading || !detail ? styles.printButtonDisabled : {}),
            }}
            title="Print or save this period's full report as a PDF"
          >
            <DownloadIcon />
            Download Board Pack
          </button>
        </div>
      </header>

      {loading || !detail ? (
        <DashboardSkeleton />
      ) : (
        <>
          <p className="print-banner">
            Senus PLC — Board Report — {detail.label}
            {" · "}
            Generated {new Date().toLocaleDateString("en-IE", { day: "numeric", month: "long", year: "numeric" })}
          </p>

          <HeroMetrics detail={detail} history={history} />

          <nav className="no-print" style={styles.sectionNav}>
            {SECTIONS.map((s) => (
              <button
                key={s.key}
                onClick={() => setActiveSection(s.key)}
                style={{
                  ...styles.sectionNavItem,
                  ...(activeSection === s.key ? styles.sectionNavItemActive : {}),
                }}
              >
                {s.label}
              </button>
            ))}
          </nav>

          {/* All six sections stay mounted (rather than conditionally
              rendering just the active one) so "Download Board Pack" can
              print the full report in one document. Inactive sections are
              moved off-screen with position:absolute instead of
              display:none — Recharts' ResponsiveContainer measures its
              container via ResizeObserver, and a display:none container
              never gets a real width to measure, which renders charts
              blank when the print stylesheet later reveals them. Staying
              off-screen (but still laid out) keeps that measurement valid
              the whole time. */}
          <main className="section-body" style={styles.sectionBody}>
            {SECTIONS.map((s) => (
              <div
                key={s.key}
                className={activeSection === s.key ? "board-section" : "board-section board-section-hidden"}
              >
                <h2 className="print-section-heading">{s.label}</h2>
                {s.key === "revenue_growth" && <RevenueGrowthSection detail={detail} />}
                {s.key === "profitability" && <ProfitabilitySection detail={detail} />}
                {s.key === "cash_liquidity" && <CashLiquiditySection detail={detail} />}
                {s.key === "solvency_leverage" && <SolvencyLeverageSection detail={detail} />}
                {s.key === "returns" && <ReturnsSection detail={detail} />}
                {s.key === "outlook" && <AIInsightsSection detail={detail} />}
              </div>
            ))}
          </main>
        </>
      )}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <>
      <section style={styles.hero}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card" style={styles.heroCard}>
            <div style={styles.heroCardHeader}>
              <Skeleton width={70} height={11} />
            </div>
            <Skeleton width="65%" height={32} style={{ marginBottom: "var(--space-2)" }} />
            <Skeleton width="100%" height={32} />
          </div>
        ))}
      </section>

      <div style={styles.sectionNav}>
        {SECTIONS.map((s) => (
          <Skeleton key={s.key} width={100} height={36} radius={999} />
        ))}
      </div>

      <div style={styles.sectionBody}>
        <Skeleton width={180} height={20} style={{ marginBottom: "var(--space-4)" }} />
        <Skeleton width="100%" height={280} radius="var(--radius-md)" />
      </div>
    </>
  );
}

function DownloadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 3v12m0 0l-4.5-4.5M12 15l4.5-4.5M4 20h16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PeriodTabs({
  periods,
  selectedId,
  loading,
  onSelect,
}: {
  periods: PeriodSummary[];
  selectedId: number | null;
  loading: boolean;
  onSelect: (id: number) => void;
}) {
  return (
    <div style={styles.periodTabs}>
      {periods.map((p) => {
        const isSelected = p.id === selectedId;
        const isPending = isSelected && loading;
        return (
          <button
            key={p.id}
            onClick={() => onSelect(p.id)}
            disabled={loading}
            style={{
              ...styles.periodTab,
              ...(isSelected ? styles.periodTabActive : {}),
              ...(loading && !isSelected ? styles.periodTabDisabled : {}),
            }}
          >
            {p.label}
            {isPending ? (
              <span className="spinner" style={styles.tabSpinner} />
            ) : (
              <>
                {p.provenance.source === "ai_extracted" && (
                  <span
                    style={{
                      ...styles.provenanceDot,
                      background: isSelected ? "#FFFFFF" : p.provenance.verified ? "#1A8A5C" : "#A8720E",
                    }}
                    title={
                      p.provenance.verified
                        ? `✓ AI-verified · ${p.provenance.match_rate_pct ?? "—"}% match`
                        : `AI-extracted · ${p.provenance.match_rate_pct ?? "—"}% match · pending review`
                    }
                  />
                )}
                {!p.is_audited && (
                  <span
                    style={{
                      ...styles.unauditedDot,
                      background: isSelected ? "#FFFFFF" : "var(--color-rust)",
                    }}
                    title="Unaudited"
                  />
                )}
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Percentage change vs. the immediately prior period in `history`. */
function pctChange(history: HistoryPoint[], currentEndDate: string, key: keyof HistoryPoint): number | null {
  const idx = history.findIndex((h) => h.endDate === currentEndDate);
  if (idx <= 0) return null;
  const current = history[idx][key] as number;
  const prior = history[idx - 1][key] as number;
  if (prior === 0) return null;
  return ((current - prior) / Math.abs(prior)) * 100;
}

function TrendBadge({ value, invert }: { value: number | null; invert?: boolean }) {
  if (value === null) return null;
  // invert: for metrics like operating loss where a smaller (less
  // negative) number is actually GOOD news, so the up/down color
  // semantics need flipping relative to the raw sign of change
  const isGood = invert ? value > 0 : value > 0;
  const arrow = value > 0 ? "↑" : "↓";
  return (
    <span className={`trend-badge ${isGood ? "up" : "down"}`}>
      {arrow} {Math.abs(value).toFixed(0)}%
    </span>
  );
}

function Sparkline({ data, dataKey, color }: { data: HistoryPoint[]; dataKey: keyof HistoryPoint; color: string }) {
  if (data.length < 2) return <div style={{ height: 32 }} />;
  return (
    <ResponsiveContainer width="100%" height={32}>
      <LineChart data={data}>
        <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function HeroMetrics({ detail, history }: { detail: PeriodDetail; history: HistoryPoint[] }) {
  const pl = detail.pl_statement;
  const bs = detail.balance_sheet;
  const runwayMonths = bs?.cash_runway_months ?? null;
  const runwayFraction = runwayMonths !== null ? Math.min(runwayMonths / 18, 1) : 0;
  const runwayColor = runwayMonths === null
    ? "var(--color-grey)"
    : runwayMonths < 6
      ? "var(--color-rust)"
      : runwayMonths < 12
        ? "#C8862B"
        : "var(--color-forest)";

  const revenueChange = pctChange(history, detail.end_date, "revenue");
  const cashChange = pctChange(history, detail.end_date, "cash");
  // operating loss is stored negative; a LESS negative number (moving
  // toward zero) is improvement, so a positive delta here is good news
  const operatingLossChange = pctChange(history, detail.end_date, "operatingLoss");

  return (
    <section style={styles.hero}>
      <div className="card" style={styles.heroCard}>
        <div style={styles.heroCardHeader}>
          <p style={styles.heroLabel}>Revenue</p>
          <TrendBadge value={revenueChange} />
        </div>
        <p style={styles.heroNumber}>{pl ? formatEUR(pl.revenue) : "—"}</p>
        <Sparkline data={history} dataKey="revenue" color="var(--color-forest)" />
      </div>

      <div className="card" style={styles.heroCard}>
        <div style={styles.heroCardHeader}>
          <p style={styles.heroLabel}>Gross Margin</p>
        </div>
        <p style={styles.heroNumber}>{pl ? formatPct(pl.gross_margin_pct ?? undefined) : "—"}</p>
        <p style={styles.heroCaption}>of revenue retained after cost of sales</p>
      </div>

      <div className="card" style={styles.heroCard}>
        <div style={styles.heroCardHeader}>
          <p style={styles.heroLabel}>Operating Loss</p>
          <TrendBadge value={operatingLossChange} invert />
        </div>
        <p style={{ ...styles.heroNumber, color: "var(--color-rust)" }}>
          {pl ? formatEUR(pl.operating_loss) : "—"}
        </p>
        <Sparkline data={history} dataKey="operatingLoss" color="var(--color-rust)" />
      </div>

      <div className="card" style={styles.heroCard}>
        <div style={styles.heroCardHeader}>
          <p style={styles.heroLabel}>Cash Runway</p>
          <TrendBadge value={cashChange} />
        </div>
        <p style={styles.heroNumber}>
          {runwayMonths !== null ? `${runwayMonths} mo` : "—"}
        </p>
        <div style={styles.runwayTrack}>
          <div
            style={{
              ...styles.runwayFill,
              width: `${runwayFraction * 100}%`,
              background: runwayColor,
            }}
          />
        </div>
        <p style={styles.heroCaption}>{bs ? formatEUR(bs.cash) : "—"} cash on hand</p>
      </div>
    </section>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    maxWidth: 1200,
    margin: "0 auto",
    padding: "var(--space-6) var(--space-4)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    flexWrap: "wrap",
    gap: "var(--space-4)",
    marginBottom: "var(--space-5)",
  },
  eyebrow: {
    fontFamily: "var(--font-body)",
    fontSize: "var(--text-xs)",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "var(--color-grey)",
    margin: 0,
    fontWeight: 600,
  },
  title: {
    fontFamily: "var(--font-body)",
    fontWeight: 700,
    fontSize: "var(--text-xl)",
    color: "var(--color-ink)",
    margin: "var(--space-1) 0 0 0",
  },
  titleRow: {
    display: "flex",
    alignItems: "center",
    gap: "var(--space-3)",
    flexWrap: "wrap",
  },
  headerControls: {
    display: "flex",
    alignItems: "center",
    gap: "var(--space-3)",
    flexWrap: "wrap",
  },
  printButton: {
    display: "flex",
    alignItems: "center",
    gap: "var(--space-2)",
    fontFamily: "var(--font-body)",
    fontWeight: 600,
    fontSize: "var(--text-sm)",
    color: "var(--color-ink)",
    background: "var(--color-paper-raised)",
    border: "1px solid var(--color-grey-line)",
    borderRadius: "var(--radius-sm)",
    padding: "var(--space-2) var(--space-3)",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  printButtonDisabled: {
    opacity: 0.5,
    cursor: "not-allowed",
  },
  periodTabs: {
    display: "flex",
    gap: "var(--space-2)",
    background: "var(--color-paper-raised)",
    padding: 4,
    borderRadius: "var(--radius-sm)",
    boxShadow: "var(--shadow-card)",
  },
  periodTab: {
    fontFamily: "var(--font-body)",
    fontWeight: 500,
    fontSize: "var(--text-sm)",
    color: "var(--color-grey)",
    padding: "var(--space-2) var(--space-3)",
    border: "none",
    background: "transparent",
    borderRadius: 6,
    cursor: "pointer",
    position: "relative",
    display: "flex",
    alignItems: "center",
  },
  periodTabActive: {
    background: "var(--color-forest)",
    color: "#FFFFFF",
  },
  periodTabDisabled: {
    opacity: 0.5,
    cursor: "not-allowed",
  },
  unauditedDot: {
    display: "inline-block",
    width: 5,
    height: 5,
    borderRadius: "50%",
    marginLeft: "var(--space-2)",
  },
  provenanceDot: {
    display: "inline-block",
    width: 5,
    height: 5,
    borderRadius: "50%",
    marginLeft: "var(--space-2)",
  },
  tabSpinner: {
    width: 11,
    height: 11,
    borderRadius: "50%",
    border: "2px solid rgba(255,255,255,0.4)",
    borderTopColor: "#FFFFFF",
    marginLeft: "var(--space-2)",
  },
  hero: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "var(--space-4)",
    marginBottom: "var(--space-6)",
  },
  heroCard: {
    padding: "var(--space-4)",
  },
  heroCardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "var(--space-2)",
  },
  heroLabel: {
    fontSize: "var(--text-xs)",
    fontWeight: 600,
    color: "var(--color-grey)",
    margin: 0,
  },
  heroNumber: {
    fontFamily: "var(--font-display)",
    fontSize: "var(--text-hero)",
    color: "var(--color-ink)",
    margin: "0 0 var(--space-2) 0",
    lineHeight: 1,
  },
  heroCaption: {
    fontSize: "var(--text-xs)",
    color: "var(--color-grey)",
    margin: "var(--space-2) 0 0 0",
  },
  runwayTrack: {
    height: 5,
    background: "var(--color-grey-line)",
    borderRadius: 3,
    marginTop: "var(--space-1)",
    overflow: "hidden",
  },
  runwayFill: {
    height: "100%",
    transition: "width 0.4s ease",
  },
  sectionNav: {
    display: "flex",
    gap: "var(--space-2)",
    marginBottom: "var(--space-5)",
    flexWrap: "wrap",
  },
  sectionNavItem: {
    background: "var(--color-paper-raised)",
    border: "1px solid var(--color-grey-line)",
    borderRadius: 999,
    padding: "var(--space-2) var(--space-4)",
    fontFamily: "var(--font-body)",
    fontWeight: 500,
    fontSize: "var(--text-sm)",
    color: "var(--color-grey)",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  sectionNavItemActive: {
    background: "var(--color-forest)",
    border: "1px solid var(--color-forest)",
    color: "#FFFFFF",
  },
  sectionBody: {
    minHeight: 400,
  },
  errorState: {
    padding: "var(--space-8)",
    textAlign: "center",
  },
};