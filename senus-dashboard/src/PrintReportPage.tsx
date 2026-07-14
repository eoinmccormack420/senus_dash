// src/PrintReportPage.tsx
//
// Reached via /print/report/:specId — NOT meant for a person to browse
// to directly. This is what board/extraction/report_pdf.py's headless
// Chromium navigates to and calls page.pdf() against, so it reuses the
// exact print-only CSS classes (print-cover/print-section-eyebrow/
// print-section-heading in tokens.css) Dashboard.tsx's old "Download
// Board Pack" already relied on — hidden on a normal screen view,
// shown once print media is emulated. Sets data-report-ready="true"
// once loaded (success OR error) so report_pdf.py knows when to
// snapshot rather than racing the fetch.
//
// Reuses the same section components Dashboard.tsx does, completely
// unmodified. When a section has an approved tailored narrative, that
// narrative REPLACES the section's standard board commentary (rather
// than both appearing) — achieved by stripping that section's entry
// out of the ai_insights array passed to the component, so its own
// <AIInsightCard> lookup simply finds nothing and renders null. No
// changes needed to any of the section components themselves.

import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { boardApi, reportSpecsApi, type PeriodDetail, type ReportSpec } from "./api/client";
import { RevenueGrowthSection } from "./sections/RevenueGrowthSection";
import { ProfitabilitySection } from "./sections/ProfitabilitySection";
import { CashLiquiditySection } from "./sections/CashLiquiditySection";
import { SolvencyLeverageSection } from "./sections/SolvencyLeverageSection";
import { ReturnsSection } from "./sections/ReturnsSection";
import { AIInsightsSection } from "./sections/AIInsightsSection";
import "./styles/tokens.css";

const SECTIONS: {
  key: string;
  field: keyof ReportSpec;
  label: string;
  Component: React.ComponentType<{ detail: PeriodDetail }>;
}[] = [
  { key: "revenue_growth", field: "include_revenue_growth", label: "Revenue & Growth", Component: RevenueGrowthSection },
  { key: "profitability", field: "include_profitability", label: "Profitability", Component: ProfitabilitySection },
  { key: "cash_liquidity", field: "include_cash_liquidity", label: "Cash & Liquidity", Component: CashLiquiditySection },
  { key: "solvency_leverage", field: "include_solvency_leverage", label: "Solvency & Leverage", Component: SolvencyLeverageSection },
  { key: "returns", field: "include_returns", label: "Returns", Component: ReturnsSection },
  { key: "outlook", field: "include_outlook", label: "Outlook & Strategy", Component: AIInsightsSection },
];

export default function PrintReportPage() {
  const { specId } = useParams<{ specId: string }>();
  const [spec, setSpec] = useState<ReportSpec | null>(null);
  const [detail, setDetail] = useState<PeriodDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!specId) return;
    reportSpecsApi
      .get(Number(specId))
      .then((s) => Promise.all([s, boardApi.getPeriod(s.period)]))
      .then(([s, d]) => {
        setSpec(s);
        setDetail(d);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't load this report."))
      .finally(() => setReady(true));
  }, [specId]);

  if (!ready) return null;

  if (error || !spec || !detail) {
    return (
      <div data-report-ready="true" style={{ padding: "var(--space-6)" }}>
        <p>{error || "This report couldn't be loaded."}</p>
      </div>
    );
  }

  const showTailored = spec.use_tailored_narrative && spec.narrative_approved && spec.tailored_narrative;
  const dateOpts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };
  const dateRange = `${new Date(detail.start_date).toLocaleDateString("en-IE", dateOpts)} – ${new Date(
    detail.end_date
  ).toLocaleDateString("en-IE", dateOpts)}`;

  return (
    <div data-report-ready="true">
      <div className="print-cover">
        <div className="print-cover-bar" />
        <p className="print-cover-eyebrow">Senus PLC</p>
        <h1 className="print-cover-title">{spec.title || `${detail.label} Financial Report`}</h1>
        <p className="print-cover-period">Prepared for {spec.audience_label}</p>
        <p className="print-cover-daterange">
          {detail.label} ({dateRange})
        </p>
        {showTailored && spec.tailored_narrative?.cover && (
          <p style={{ fontSize: "var(--text-sm)", color: "var(--color-ink)", maxWidth: 560, margin: "var(--space-4) auto 0" }}>
            {spec.tailored_narrative.cover}
          </p>
        )}
        {spec.context_note && (
          <p style={{ fontSize: "var(--text-xs)", color: "var(--color-grey-text)", fontStyle: "italic", maxWidth: 560, margin: "var(--space-2) auto 0" }}>
            {spec.context_note}
          </p>
        )}
        <p className="print-cover-footer">
          Generated {new Date().toLocaleDateString("en-IE", { day: "numeric", month: "long", year: "numeric" })}
          {" · "}Confidential
        </p>
      </div>

      {SECTIONS.filter((s) => spec[s.field]).map(({ key, label, Component }) => {
        const tailoredText = showTailored ? spec.tailored_narrative?.[key] : undefined;
        // Drop this section's own AIInsight when a tailored one is
        // taking its place — AIInsightCard renders null when it can't
        // find a matching insight, so this is enough to suppress it.
        const sectionDetail = tailoredText
          ? { ...detail, ai_insights: detail.ai_insights.filter((i) => i.section !== key) }
          : detail;

        return (
          <div key={key} className="board-section">
            <p className="print-section-eyebrow">
              Senus PLC · Report for {spec.audience_label} · {detail.label}
            </p>
            <h2 className="print-section-heading">{label}</h2>
            {tailoredText && (
              <div
                className="print-avoid-break"
                style={{
                  background: "var(--color-forest-soft)",
                  borderRadius: "var(--radius-sm)",
                  padding: "var(--space-3)",
                  marginBottom: "var(--space-3)",
                }}
              >
                <p style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--color-forest)", margin: "0 0 var(--space-1) 0" }}>
                  Prepared for {spec.audience_label}
                </p>
                <p style={{ fontSize: "var(--text-sm)", color: "var(--color-ink)", margin: 0 }}>{tailoredText}</p>
              </div>
            )}
            <Component detail={sectionDetail} />
          </div>
        );
      })}
    </div>
  );
}
