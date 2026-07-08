// src/sections/ReturnsSection.tsx
//
// Sixth and final dashboard section. Unlike the others, BusinessMetrics
// data is genuinely sparse across periods in the current seed data
// (market cap only exists from HY2026, the listing period; customer/ACV
// data only exists for FY2025 from the corporate presentation) — so
// this section is built to degrade gracefully rather than assume a
// full trend exists, same empty-state convention as AIInsightsSection.
//
// Two panels: "Market" (cap, share price — literal shareholder
// returns) and "Customers & Unit Economics" (ACV, revenue per
// customer, concentration — the underlying drivers of future returns).

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { boardApi, type PeriodDetail, num, formatEUR, formatPct } from "../api/client";
import { AIInsightCard } from "../components/AIInsightCard";
import { Skeleton } from "../components/Skeleton";

interface Props {
  detail: PeriodDetail;
}

interface MarketCapPoint {
  label: string;
  marketCap: number;
}

export function ReturnsSection({ detail }: Props) {
  const [trend, setTrend] = useState<MarketCapPoint[]>([]);
  const [trendLoading, setTrendLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadTrend() {
      setTrendLoading(true);
      const periods = await boardApi.listPeriods();
      const details = await Promise.all(periods.map((p) => boardApi.getPeriod(p.id)));
      if (cancelled) return;

      const points: MarketCapPoint[] = details
        .filter((d) => d.business_metrics?.market_cap != null)
        .map((d) => ({
          label: d.label,
          marketCap: num(d.business_metrics!.market_cap),
        }));
      setTrend(points);
      setTrendLoading(false);
    }

    loadTrend().catch(() => setTrendLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const bm = detail.business_metrics;

  if (!bm) {
    return (
      <div style={emptyState}>
        <p style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-lg)", color: "var(--color-ink)" }}>
          No business metrics available for {detail.label} yet.
        </p>
        <p style={{ color: "var(--color-grey)", fontSize: "var(--text-sm)", marginTop: "var(--space-2)" }}>
          Customer, ACV, and market data are typically sourced from a
          separate corporate presentation document, not the financial
          statements — run the extraction pipeline against that document
          for this period once available.
        </p>
      </div>
    );
  }

  const hasMarketData = bm.market_cap != null || bm.share_price != null;
  const hasCustomerData = bm.total_customers != null || bm.enterprise_customers != null;

  return (
    <div>
      <AIInsightCard insight={detail.ai_insights.find((i) => i.section === "returns")} />
      {trend.length >= 2 && (
        <div style={{ marginBottom: "var(--space-6)" }}>
          <h2 style={sectionTitle}>Market capitalisation trend</h2>
          {trendLoading ? (
            <Skeleton height={220} radius="var(--radius-md)" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={trend} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                <CartesianGrid stroke="var(--color-grey-line)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontFamily: "Inter, sans-serif", fontSize: 12, fill: "#8A8579" }}
                  axisLine={{ stroke: "var(--color-grey-line)" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontFamily: "Inter, sans-serif", fontSize: 12, fill: "#8A8579" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `€${(v / 1000000).toFixed(1)}m`}
                />
                <Tooltip
                  formatter={(value) => formatEUR(Number(value))}
                  contentStyle={{
                    fontFamily: "Inter, sans-serif",
                    fontSize: 13,
                    border: "1px solid #E3E0D8",
                    borderRadius: 4,
                  }}
                />
                <Line type="monotone" dataKey="marketCap" name="Market Cap" stroke="#2B4F45" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-5)" }}>
        <div>
          <h2 style={sectionTitle}>Market</h2>
          {hasMarketData ? (
            <div style={breakdownGrid}>
              <MetricRow label="Market Cap" value={bm.market_cap ? formatEUR(bm.market_cap) : null} bold />
              <MetricRow label="Share Price" value={bm.share_price ? formatEUR(bm.share_price) : null} />
            </div>
          ) : (
            <NoDataNote text="No market data recorded for this period." />
          )}
        </div>

        <div>
          <h2 style={sectionTitle}>Customers &amp; Unit Economics</h2>
          {hasCustomerData ? (
            <div style={breakdownGrid}>
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
        <div style={{ marginTop: "var(--space-5)" }}>
          <h2 style={sectionTitle}>Pipeline</h2>
          <div style={breakdownGrid}>
            <MetricRow label="Pipeline Value" value={bm.pipeline_value ? formatEUR(bm.pipeline_value) : null} bold />
            <MetricRow label="Pipeline Deals" value={bm.pipeline_deals_count?.toString() ?? null} />
          </div>
        </div>
      )}
    </div>
  );
}

function MetricRow({ label, value, muted, bold }: { label: string; value: string | null; muted?: boolean; bold?: boolean }) {
  return (
    <div style={row}>
      <span style={{ color: muted ? "var(--color-grey)" : "var(--color-ink)" }}>{label}</span>
      <span className="num" style={{ fontWeight: bold ? 600 : 400, color: value === null ? "var(--color-grey)" : "var(--color-ink)" }}>
        {value ?? "—"}
      </span>
    </div>
  );
}

function NoDataNote({ text }: { text: string }) {
  return (
    <div style={{ ...breakdownGrid, padding: "var(--space-4)", color: "var(--color-grey)", fontSize: "var(--text-sm)" }}>
      {text}
    </div>
  );
}

const sectionTitle: React.CSSProperties = {
  fontFamily: "var(--font-body)",
  fontWeight: 600,
  fontSize: "var(--text-lg)",
  color: "var(--color-ink)",
  marginBottom: "var(--space-4)",
};

const breakdownGrid: React.CSSProperties = {
  background: "var(--color-paper-raised)",
  border: "1px solid var(--color-grey-line)",
  borderRadius: "var(--radius-md)",
  boxShadow: "var(--shadow-card)",
  overflow: "hidden",
};

const row: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  padding: "var(--space-3) var(--space-4)",
  borderBottom: "1px solid var(--color-grey-line)",
  fontSize: "var(--text-base)",
};

const emptyState: React.CSSProperties = {
  padding: "var(--space-8)",
  textAlign: "center",
  border: "1px dashed var(--color-grey-line)",
  borderRadius: "var(--radius-md)",
};