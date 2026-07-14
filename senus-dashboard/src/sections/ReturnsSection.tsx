// src/sections/ReturnsSection.tsx
//
// Sixth and final dashboard section, for the CURRENTLY SELECTED
// period. Unlike the others, BusinessMetrics data is genuinely sparse
// across periods in the current seed data (market cap only exists from
// HY2026, the listing period; customer/ACV data only exists for FY2025
// from the corporate presentation) — so this section is built to
// degrade gracefully rather than assume every field exists, same
// empty-state convention as AIInsightsSection.
//
// Two panels: "Market" (cap, share price — literal shareholder
// returns) and "Customers & Unit Economics" (ACV, revenue per
// customer, concentration — the underlying drivers of future returns).
//
// The market capitalisation trend across all periods used to be
// embedded here too — it moved to the History tab
// (src/sections/HistorySection.tsx) since it already portrayed the
// full extracted history rather than this one period's snapshot.

import { type PeriodDetail, num, formatEUR, formatPct } from "../api/client";
import { AIInsightCard } from "../components/AIInsightCard";
import EmptyState from "../components/EmptyState";
import { sectionTitle, breakdownGrid, row } from "../styles/ReturnsSectionStyles";

interface Props {
  detail: PeriodDetail;
}

export function ReturnsSection({ detail }: Props) {
  const bm = detail.business_metrics;
  const hasMarketData = bm ? bm.market_cap != null || bm.share_price != null : false;
  const hasCustomerData = bm ? bm.total_customers != null || bm.enterprise_customers != null : false;

  return (
    <div>
      <AIInsightCard insight={detail.ai_insights.find((i) => i.section === "returns")} />

      {/* ROCE is a pl_statement + balance_sheet calculation, independent
          of BusinessMetrics — it renders regardless of whether the
          corporate-presentation-sourced customer/market data below is
          available for this period, unlike everything else in this
          section. */}
      <div className="print-keep-together" style={{ marginBottom: "var(--space-5)" }}>
        <h2 style={sectionTitle}>Capital Efficiency</h2>
        <div className="print-avoid-break" style={breakdownGrid}>
          <MetricRow
            label="ROCE (Return on Capital Employed)"
            value={detail.roce_pct !== null ? `${detail.roce_pct.toFixed(1)}%` : null}
            bold
          />
        </div>
        <p style={{ fontSize: "var(--text-xs)", color: "var(--color-grey-text)", marginTop: "var(--space-2)" }}>
          ROCE = operating result ÷ (total assets − current liabilities).
          Negative here reflects Senus's current pre-profitability growth
          stage, not an error — a company still investing ahead of
          revenue will show negative ROCE until operating losses narrow.
        </p>
      </div>

      {!bm && (
        <EmptyState>
          <p style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-lg)", color: "var(--color-ink)" }}>
            No business metrics available for {detail.label} yet.
          </p>
          <p style={{ color: "var(--color-grey-text)", fontSize: "var(--text-sm)", marginTop: "var(--space-2)" }}>
            Customer, ACV, and market data are typically sourced from a
            separate corporate presentation document, not the financial
            statements — run the extraction pipeline against that document
            for this period once available.
          </p>
        </EmptyState>
      )}

      {bm && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "var(--space-5)" }}>
            <div className="print-keep-together">
              <h2 style={sectionTitle}>Market</h2>
              {hasMarketData ? (
                <div className="print-avoid-break" style={breakdownGrid}>
                  <MetricRow label="Market Cap" value={bm.market_cap ? formatEUR(bm.market_cap) : null} bold />
                  <MetricRow label="Share Price" value={bm.share_price ? formatEUR(bm.share_price) : null} />
                </div>
              ) : (
                <NoDataNote text="No market data recorded for this period." />
              )}
            </div>

            <div className="print-keep-together">
              <h2 style={sectionTitle}>Customers &amp; Unit Economics</h2>
              {hasCustomerData ? (
                <div className="print-avoid-break" style={breakdownGrid}>
                  <MetricRow label="Total Customers" value={bm.total_customers?.toString() ?? null} bold />
                  <MetricRow label="Enterprise Customers" value={bm.enterprise_customers?.toString() ?? null} />
                  <MetricRow
                    label="ACV — Soil (per enterprise)"
                    value={bm.acv_soil_per_enterprise ? formatEUR(bm.acv_soil_per_enterprise) : null}
                    muted
                  />
                  <MetricRow
                    label="ACV — Era (per enterprise)"
                    value={bm.acv_era_per_enterprise ? formatEUR(bm.acv_era_per_enterprise) : null}
                    muted
                  />
                  <MetricRow
                    label="Revenue per Customer"
                    value={bm.revenue_per_customer ? formatEUR(bm.revenue_per_customer) : null}
                    bold
                  />
                  <MetricRow
                    label="Enterprise Revenue Concentration"
                    value={bm.enterprise_revenue_concentration != null ? formatPct(bm.enterprise_revenue_concentration) : null}
                  />
                  <MetricRow
                    label="Revenue — Ireland"
                    value={bm.revenue_ireland_pct ? formatPct(num(bm.revenue_ireland_pct)) : null}
                    muted
                  />
                  <MetricRow label="Employees" value={bm.employees?.toString() ?? null} muted />
                </div>
              ) : (
                <NoDataNote text="No customer/ACV data recorded for this period." />
              )}
            </div>
          </div>

          {(bm.pipeline_value || bm.pipeline_deals_count) && (
            <div className="print-keep-together" style={{ marginTop: "var(--space-5)" }}>
              <h2 style={sectionTitle}>Pipeline</h2>
              <div className="print-avoid-break" style={breakdownGrid}>
                <MetricRow label="Pipeline Value" value={bm.pipeline_value ? formatEUR(bm.pipeline_value) : null} bold />
                <MetricRow label="Pipeline Deals" value={bm.pipeline_deals_count?.toString() ?? null} />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function MetricRow({ label, value, muted, bold }: { label: string; value: string | null; muted?: boolean; bold?: boolean }) {
  return (
    <div style={row}>
      <span style={{ color: muted ? "var(--color-grey-text)" : "var(--color-ink)" }}>{label}</span>
      <span className="num" style={{ fontWeight: bold ? 600 : 400, color: value === null ? "var(--color-grey-text)" : "var(--color-ink)" }}>
        {value ?? "—"}
      </span>
    </div>
  );
}

function NoDataNote({ text }: { text: string }) {
  return (
    <div style={{ ...breakdownGrid, padding: "var(--space-4)", color: "var(--color-grey-text)", fontSize: "var(--text-sm)" }}>
      {text}
    </div>
  );
}
