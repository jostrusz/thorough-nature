import React from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "@medusajs/ui"
import { defineRouteConfig } from "@medusajs/admin-sdk"
import { sdk } from "../../../lib/sdk"
import {
  MarketingShell,
  StatusBadge,
  useSelectedBrand,
  brandQs,
  fmt,
} from "../../../components/marketing/shared"

function CampaignsPage() {
  const qc = useQueryClient()
  const { brandId } = useSelectedBrand()
  const qs = brandQs(brandId)

  const { data, isLoading } = useQuery({
    queryKey: ["mkt-campaigns", brandId],
    queryFn: () =>
      sdk.client.fetch<{ campaigns: any[] }>(`/admin/marketing/campaigns${qs}`, { method: "GET" }),
  })
  const campaigns: any[] = ((data as any)?.campaigns) || []

  const duplicateMut = useMutation({
    mutationFn: (id: string) =>
      sdk.client.fetch(`/admin/marketing/campaigns/${id}/duplicate`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mkt-campaigns"] })
      toast.success("Campaign duplicated")
    },
    onError: () => toast.error("Failed to duplicate"),
  })

  const pauseMut = useMutation({
    mutationFn: (id: string) =>
      sdk.client.fetch(`/admin/marketing/campaigns/${id}/pause`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mkt-campaigns"] })
      toast.success("Campaign paused")
    },
    onError: () => toast.error("Failed to pause"),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) =>
      sdk.client.fetch(`/admin/marketing/campaigns/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mkt-campaigns"] })
      toast.success("Campaign deleted")
    },
    onError: () => toast.error("Failed to delete"),
  })

  return (
    <MarketingShell
      title="Campaigns"
      subtitle="One-off broadcasts to lists and segments"
      active="/marketing/campaigns"
      right={
        <a
          className="mkt-btn-primary"
          href="#/marketing/campaigns/new"
          style={{ padding: "7px 14px", borderRadius: "6px", fontSize: "13px", fontWeight: 500, border: "none", background: "#008060", color: "#FFF", textDecoration: "none" }}
        >
          + New Campaign
        </a>
      }
    >
      <div className="mkt-card" style={{ overflow: "hidden" }}>
        {isLoading ? (
          <div style={{ padding: "24px", color: "#8C9196", fontSize: "13px" }}>Loading…</div>
        ) : campaigns.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center", color: "#8C9196", fontSize: "13px" }}>
            No campaigns yet.
          </div>
        ) : (
          <table className="mkt-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Template</th>
                <th>Recipients</th>
                <th>Status</th>
                <th>Sent</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c: any) => {
                const m = c.metrics || {}
                return (
                  <tr key={c.id} className="mkt-row">
                    <td>
                      <a href={`#/marketing/campaigns/${c.id}`} className="mkt-link" style={{ fontWeight: 500 }}>
                        {c.name || "Untitled"}
                      </a>
                    </td>
                    <td style={{ color: "#6D7175" }}>{c.template?.name || c.template_name || "—"}</td>
                    <td>{fmt(m.recipients ?? m.sent)}</td>
                    <td><StatusBadge status={c.status || "draft"} /></td>
                    <td style={{ color: "#6D7175", fontSize: "12px" }}>
                      {c.sent_at ? new Date(c.sent_at).toLocaleString() : "—"}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: "4px" }}>
                        <a href={`#/marketing/campaigns/${c.id}`} className="mkt-btn" style={{ padding: "4px 8px", borderRadius: "6px", fontSize: "11px", border: "1px solid #E1E3E5", background: "#FFF", color: "#1A1A1A", textDecoration: "none" }}>
                          View
                        </a>
                        <button className="mkt-btn" onClick={() => duplicateMut.mutate(c.id)} style={{ padding: "4px 8px", borderRadius: "6px", fontSize: "11px", border: "1px solid #E1E3E5", background: "#FFF", color: "#1A1A1A" }}>
                          Duplicate
                        </button>
                        {(c.status === "sending" || c.status === "scheduled") && (
                          <button className="mkt-btn" onClick={() => pauseMut.mutate(c.id)} style={{ padding: "4px 8px", borderRadius: "6px", fontSize: "11px", border: "1px solid #E1E3E5", background: "#FFF", color: "#1A1A1A" }}>
                            Pause
                          </button>
                        )}
                        <button
                          className="mkt-btn"
                          onClick={() => { if (confirm(`Delete campaign "${c.name}"?`)) deleteMut.mutate(c.id) }}
                          style={{ padding: "4px 8px", borderRadius: "6px", fontSize: "11px", border: "1px solid #FED3D1", background: "#FFF", color: "#D72C0D" }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
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
  label: "Campaigns",
})

export default CampaignsPage
