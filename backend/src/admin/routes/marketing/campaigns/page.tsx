import React from "react"
import { Link } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "@medusajs/ui"
import { defineRouteConfig } from "@medusajs/admin-sdk"
import { sdk } from "../../../lib/sdk"
import {
  MarketingShell,
  StatusBadge,
  EmptyState,
  useSelectedBrand,
  brandQs,
  fmt,
  tokens,
} from "../../../components/marketing/shared"

function CampaignsPage() {
  const qc = useQueryClient()
  const { brandId } = useSelectedBrand()
  const qs = brandQs(brandId)

  const { data, isLoading } = useQuery({
    queryKey: ["mkt-campaigns", brandId],
    queryFn: () =>
      sdk.client.fetch<{ campaigns: any[] }>(`/admin/marketing/campaigns${qs}`, { method: "GET" }),
    enabled: !!brandId,
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
      breadcrumbs={[
        { label: "Marketing", to: "/marketing" },
        { label: "Campaigns" },
      ]}
      right={
        <Link className="mkt-btn-primary" to="/marketing/campaigns/new">
          New campaign
        </Link>
      }
    >
      <div className="mkt-card" style={{ overflow: "hidden", padding: 0 }}>
        {isLoading ? (
          <div style={{ padding: "32px", color: tokens.fgSecondary, fontSize: "13px", textAlign: "center" }}>
            Loading…
          </div>
        ) : campaigns.length === 0 ? (
          <EmptyState
            icon="🚀"
            title="No campaigns yet"
            description="Create your first campaign to broadcast to lists or segments."
            action={
              <Link to="/marketing/campaigns/new" className="mkt-btn-primary">
                Create campaign
              </Link>
            }
          />
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
                      <Link to={`/marketing/campaigns/${c.id}`} className="mkt-link" style={{ fontWeight: 500 }}>
                        {c.name || "Untitled"}
                      </Link>
                    </td>
                    <td style={{ color: tokens.fgSecondary }}>{c.template?.name || c.template_name || "—"}</td>
                    <td>{fmt(m.recipients ?? m.sent)}</td>
                    <td><StatusBadge status={c.status || "draft"} /></td>
                    <td style={{ color: tokens.fgSecondary, fontSize: "13px" }}>
                      {c.sent_at ? new Date(c.sent_at).toLocaleString() : "—"}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: "6px" }}>
                        <Link to={`/marketing/campaigns/${c.id}`} className="mkt-btn mkt-btn-xs">
                          View
                        </Link>
                        <button className="mkt-btn mkt-btn-xs" onClick={() => duplicateMut.mutate(c.id)}>
                          Duplicate
                        </button>
                        {(c.status === "sending" || c.status === "scheduled") && (
                          <button className="mkt-btn mkt-btn-xs" onClick={() => pauseMut.mutate(c.id)}>
                            Pause
                          </button>
                        )}
                        <button
                          className="mkt-btn-danger-ghost"
                          onClick={() => { if (confirm(`Delete campaign "${c.name}"?`)) deleteMut.mutate(c.id) }}
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
  rank: 10,
})

export default CampaignsPage
