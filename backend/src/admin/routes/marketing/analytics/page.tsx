import React from "react"
import { Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { defineRouteConfig } from "@medusajs/admin-sdk"
import { sdk } from "../../../lib/sdk"
import {
  MarketingShell,
  StatusBadge,
  EmptyState,
  useSelectedBrand,
  brandQs,
  useBrands,
  fmt,
  tokens,
} from "../../../components/marketing/shared"

function AnalyticsPage() {
  const { brandId } = useSelectedBrand()
  const qs = brandQs(brandId)

  const { data: brandsData } = useBrands()
  const brands: any[] = ((brandsData as any)?.brands) || []
  const brandMap: Record<string, any> = Object.fromEntries(brands.map((b) => [b.id, b]))

  const { data, isLoading } = useQuery({
    queryKey: ["mkt-analytics", brandId],
    queryFn: () =>
      sdk.client.fetch<{ campaigns: any[] }>(`/admin/marketing/campaigns${qs}${qs ? "&" : "?"}limit=50&order=-sent_at`, { method: "GET" }),
    enabled: !!brandId,
  })
  const campaigns: any[] = ((data as any)?.campaigns) || []

  // Group by brand
  const grouped: Record<string, any[]> = {}
  campaigns.forEach((c: any) => {
    const key = c.brand_id || "unknown"
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(c)
  })

  // Aggregate totals per brand
  function agg(list: any[]) {
    return list.reduce(
      (acc, c) => {
        const m = c.metrics || {}
        acc.sent += Number(m.sent) || 0
        acc.delivered += Number(m.delivered) || 0
        acc.opened += Number(m.opened) || 0
        acc.clicked += Number(m.clicked) || 0
        acc.bounced += Number(m.bounced) || 0
        return acc
      },
      { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0 }
    )
  }

  return (
    <MarketingShell
      title="Analytics"
      subtitle="Campaign performance grouped by brand"
      breadcrumbs={[
        { label: "Marketing", to: "/marketing" },
        { label: "Analytics" },
      ]}
    >
      {isLoading ? (
        <div className="mkt-card" style={{ padding: "32px", color: tokens.fgSecondary, fontSize: "13px", textAlign: "center" }}>
          Loading…
        </div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="mkt-card">
          <EmptyState
            icon="📊"
            title="No campaigns yet"
            description="Send your first campaign to see analytics here."
          />
        </div>
      ) : (
        Object.keys(grouped).map((brandKey) => {
          const b = brandMap[brandKey]
          const label = b ? (b.display_name || b.slug) : brandKey
          const list = grouped[brandKey]
          const totals = agg(list)
          const max = Math.max(1, totals.sent, totals.delivered, totals.opened, totals.clicked, totals.bounced)
          const bars = [
            { k: "sent", label: "Sent", color: tokens.fgSecondary },
            { k: "delivered", label: "Delivered", color: tokens.primary },
            { k: "opened", label: "Opened", color: tokens.info },
            { k: "clicked", label: "Clicked", color: tokens.purple },
            { k: "bounced", label: "Bounced", color: tokens.dangerFg },
          ]

          return (
            <div key={brandKey} className="mkt-card" style={{ padding: 0, marginBottom: "20px", overflow: "hidden" }}>
              <div
                style={{
                  padding: "20px 24px",
                  borderBottom: `1px solid ${tokens.borderSubtle}`,
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: "24px",
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <div style={{ fontSize: "16px", fontWeight: 600, color: tokens.fg, letterSpacing: "-0.005em" }}>{label}</div>
                  <div style={{ fontSize: "13px", color: tokens.fgSecondary, marginTop: "4px" }}>
                    {list.length} campaign{list.length !== 1 ? "s" : ""}
                  </div>
                </div>
                <div style={{ flex: 1, maxWidth: "600px", minWidth: "300px", display: "flex", flexDirection: "column", gap: "6px" }}>
                  {bars.map((bar) => {
                    const v = (totals as any)[bar.k] as number
                    const pc = (v / max) * 100
                    return (
                      <div key={bar.k} style={{ display: "grid", gridTemplateColumns: "80px 1fr 70px", alignItems: "center", gap: "12px" }}>
                        <span style={{ fontSize: "12px", color: tokens.fgSecondary, fontWeight: 500 }}>{bar.label}</span>
                        <div style={{ background: tokens.borderSubtle, borderRadius: "6px", overflow: "hidden", height: "10px" }}>
                          <div
                            style={{
                              width: `${pc}%`,
                              height: "100%",
                              background: bar.color,
                              transition: "width 300ms ease-out",
                              borderRadius: "6px",
                            }}
                          />
                        </div>
                        <span style={{ fontSize: "13px", textAlign: "right", color: tokens.fg, fontVariantNumeric: "tabular-nums" }}>{fmt(v)}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
              <table className="mkt-table">
                <thead>
                  <tr>
                    <th>Campaign</th>
                    <th>Status</th>
                    <th>Sent</th>
                    <th>Delivered</th>
                    <th>Opened</th>
                    <th>Clicked</th>
                    <th>Bounced</th>
                    <th>Sent at</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((c: any) => {
                    const m = c.metrics || {}
                    return (
                      <tr key={c.id} className="mkt-row">
                        <td>
                          <Link to={`/marketing/campaigns/${c.id}`} className="mkt-link" style={{ fontWeight: 500 }}>
                            {c.name || "Untitled"}
                          </Link>
                        </td>
                        <td><StatusBadge status={c.status || "draft"} /></td>
                        <td>{fmt(m.sent)}</td>
                        <td>{fmt(m.delivered)}</td>
                        <td>{fmt(m.opened)}</td>
                        <td>{fmt(m.clicked)}</td>
                        <td>{fmt(m.bounced)}</td>
                        <td style={{ color: tokens.fgSecondary, fontSize: "13px" }}>
                          {c.sent_at ? new Date(c.sent_at).toLocaleString() : "—"}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )
        })
      )}
    </MarketingShell>
  )
}

export const config = defineRouteConfig({
  label: "Analytics",
})

export default AnalyticsPage
