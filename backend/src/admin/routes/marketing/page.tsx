import React from "react"
import { useQuery } from "@tanstack/react-query"
import { defineRouteConfig } from "@medusajs/admin-sdk"
import { sdk } from "../../lib/sdk"
import {
  MarketingShell,
  StatusBadge,
  useSelectedBrand,
  brandQs,
  fmt,
  pct,
} from "../../components/marketing/shared"

function SummaryCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="mkt-card" style={{ padding: "16px 20px", flex: 1 }}>
      <div style={{ fontSize: "11px", fontWeight: 600, color: "#6D7175", textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: "24px", fontWeight: 600, color: "#1A1A1A", marginTop: "6px" }}>{value}</div>
      {sub && <div style={{ fontSize: "12px", color: "#8C9196", marginTop: "2px" }}>{sub}</div>}
    </div>
  )
}

function MarketingDashboardPage() {
  const { brandId } = useSelectedBrand()
  const qs = brandQs(brandId)

  const summary = useQuery({
    queryKey: ["mkt-summary", brandId],
    queryFn: () =>
      sdk.client
        .fetch<any>(`/admin/marketing/summary${qs}`, { method: "GET" })
        .catch(() => ({ summary: null })),
    enabled: !!brandId,
  })

  const recentCampaigns = useQuery({
    queryKey: ["mkt-recent-campaigns", brandId],
    queryFn: () =>
      sdk.client
        .fetch<{ campaigns: any[] }>(
          `/admin/marketing/campaigns${qs}${qs ? "&" : "?"}limit=10&order=-sent_at`,
          { method: "GET" }
        )
        .catch(() => ({ campaigns: [] })),
    enabled: !!brandId,
  })

  const s: any = (summary.data as any)?.summary || {}
  const campaigns: any[] = ((recentCampaigns.data as any)?.campaigns) || []

  return (
    <MarketingShell
      title="Marketing"
      subtitle="Email campaigns, contacts, flows, forms and analytics"
      active="/marketing"
    >
      <div style={{ display: "flex", gap: "12px", marginBottom: "20px", flexWrap: "wrap" }}>
        <SummaryCard label="Total contacts" value={fmt(s.total_contacts)} sub="all statuses" />
        <SummaryCard label="Campaigns sent (30d)" value={fmt(s.campaigns_sent_30d)} />
        <SummaryCard label="Avg open rate" value={pct(s.avg_open_rate)} />
        <SummaryCard label="Avg click rate" value={pct(s.avg_click_rate)} />
      </div>

      <div className="mkt-card" style={{ padding: "0 0 12px 0", marginBottom: "16px" }}>
        <div
          style={{
            padding: "14px 20px",
            borderBottom: "1px solid #F1F2F4",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h2 style={{ fontSize: "14px", fontWeight: 600, margin: 0 }}>Recent campaigns</h2>
          <a href="#/marketing/campaigns" className="mkt-link" style={{ fontSize: "12px" }}>
            View all
          </a>
        </div>
        {recentCampaigns.isLoading ? (
          <div style={{ padding: "20px", color: "#8C9196", fontSize: "13px" }}>Loading…</div>
        ) : campaigns.length === 0 ? (
          <div style={{ padding: "24px", textAlign: "center", color: "#8C9196", fontSize: "13px" }}>
            No campaigns yet.
          </div>
        ) : (
          <table className="mkt-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th>Sent</th>
                <th>Opens</th>
                <th>Clicks</th>
                <th>Bounces</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c: any) => {
                const m = c.metrics || {}
                return (
                  <tr key={c.id} className="mkt-row">
                    <td>
                      <a href={`#/marketing/campaigns/${c.id}`} className="mkt-link">
                        {c.name || "Untitled"}
                      </a>
                    </td>
                    <td>
                      <StatusBadge status={c.status || "draft"} />
                    </td>
                    <td>{fmt(m.sent)}</td>
                    <td>{fmt(m.opened)}</td>
                    <td>{fmt(m.clicked)}</td>
                    <td>{fmt(m.bounced)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </MarketingShell>
  )
}

export const config = defineRouteConfig({
  label: "Marketing",
})

export default MarketingDashboardPage
