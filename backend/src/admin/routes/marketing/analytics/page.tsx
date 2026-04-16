import React from "react"
import { useQuery } from "@tanstack/react-query"
import { defineRouteConfig } from "@medusajs/admin-sdk"
import { sdk } from "../../../lib/sdk"
import {
  MarketingShell,
  StatusBadge,
  useSelectedBrand,
  brandQs,
  useBrands,
  fmt,
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
      active="/marketing/analytics"
    >
      {isLoading ? (
        <p style={{ color: "#8C9196", fontSize: "13px" }}>Loading…</p>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="mkt-card" style={{ padding: "40px", textAlign: "center", color: "#8C9196" }}>
          <p style={{ fontSize: "14px" }}>No campaigns yet</p>
        </div>
      ) : (
        Object.keys(grouped).map((brandKey) => {
          const b = brandMap[brandKey]
          const label = b ? (b.display_name || b.slug) : brandKey
          const list = grouped[brandKey]
          const totals = agg(list)
          const max = Math.max(1, totals.sent, totals.delivered, totals.opened, totals.clicked, totals.bounced)
          const bars = [
            { k: "sent", label: "Sent", color: "#6D7175" },
            { k: "delivered", label: "Delivered", color: "#008060" },
            { k: "opened", label: "Opened", color: "#1D4ED8" },
            { k: "clicked", label: "Clicked", color: "#7C3AED" },
            { k: "bounced", label: "Bounced", color: "#D72C0D" },
          ]

          return (
            <div key={brandKey} className="mkt-card" style={{ padding: "0", marginBottom: "16px" }}>
              <div style={{ padding: "14px 20px", borderBottom: "1px solid #F1F2F4", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: "14px", fontWeight: 600 }}>{label}</div>
                  <div style={{ fontSize: "12px", color: "#8C9196" }}>{list.length} campaign{list.length !== 1 ? "s" : ""}</div>
                </div>
                <div style={{ flex: 1, maxWidth: "540px", display: "flex", flexDirection: "column", gap: "4px", marginLeft: "24px" }}>
                  {bars.map((bar) => {
                    const v = (totals as any)[bar.k] as number
                    const pc = (v / max) * 100
                    return (
                      <div key={bar.k} style={{ display: "grid", gridTemplateColumns: "70px 1fr 60px", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontSize: "11px", color: "#6D7175" }}>{bar.label}</span>
                        <div style={{ background: "#F1F2F4", borderRadius: "4px", overflow: "hidden", height: "10px" }}>
                          <div style={{ width: `${pc}%`, height: "100%", background: bar.color, transition: "width 0.3s" }} />
                        </div>
                        <span style={{ fontSize: "11px", textAlign: "right" }}>{fmt(v)}</span>
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
                          <a href={`#/marketing/campaigns/${c.id}`} className="mkt-link">{c.name || "Untitled"}</a>
                        </td>
                        <td><StatusBadge status={c.status || "draft"} /></td>
                        <td>{fmt(m.sent)}</td>
                        <td>{fmt(m.delivered)}</td>
                        <td>{fmt(m.opened)}</td>
                        <td>{fmt(m.clicked)}</td>
                        <td>{fmt(m.bounced)}</td>
                        <td style={{ color: "#6D7175", fontSize: "12px" }}>
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
