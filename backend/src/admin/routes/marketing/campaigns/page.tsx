import React, { useState } from "react"
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

  // Status filter — client-side over already-loaded campaigns.
  // "scheduled" bucket also covers in-flight/paused states so nothing disappears.
  const STATUS_FILTERS: { key: string; label: string; match?: (s: string) => boolean }[] = [
    { key: "all", label: "All" },
    { key: "draft", label: "Draft", match: (s) => s === "draft" },
    {
      key: "scheduled",
      label: "Scheduled",
      match: (s) => s === "scheduled" || s === "sending" || s === "paused" || s === "ready",
    },
    { key: "sent", label: "Sent", match: (s) => s === "sent" },
  ]
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const activeFilter = STATUS_FILTERS.find((f) => f.key === statusFilter) || STATUS_FILTERS[0]
  const visibleCampaigns: any[] =
    statusFilter === "all" || !activeFilter.match
      ? campaigns
      : campaigns.filter((c: any) => activeFilter.match!((c.status || "draft").toLowerCase()))

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
      sdk.client.fetch<{ hidden?: boolean; deleted?: boolean }>(`/admin/marketing/campaigns/${id}`, { method: "DELETE" }),
    onSuccess: (resp: any) => {
      qc.invalidateQueries({ queryKey: ["mkt-campaigns"] })
      toast.success(resp?.hidden ? "Campaign hidden" : "Campaign deleted")
    },
    onError: (e: any) => toast.error("Failed: " + (e?.message || "unknown")),
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
      {!isLoading && campaigns.length > 0 && (
        <div
          role="tablist"
          aria-label="Filter campaigns by status"
          style={{
            display: "inline-flex",
            gap: "4px",
            padding: "4px",
            background: tokens.borderSubtle,
            borderRadius: tokens.rMd,
            marginBottom: "16px",
          }}
        >
          {STATUS_FILTERS.map((f) => {
            const isActive = statusFilter === f.key
            return (
              <button
                key={f.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setStatusFilter(f.key)}
                style={{
                  border: "none",
                  cursor: "pointer",
                  padding: "6px 14px",
                  borderRadius: tokens.rSm,
                  fontSize: "13px",
                  fontWeight: isActive ? 600 : 500,
                  fontFamily: "inherit",
                  color: isActive ? tokens.fg : tokens.fgSecondary,
                  background: isActive ? tokens.surface : "transparent",
                  boxShadow: isActive ? tokens.shadowSm : "none",
                  transition: "background 120ms ease-out, color 120ms ease-out",
                }}
              >
                {f.label}
              </button>
            )
          })}
        </div>
      )}

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
        ) : visibleCampaigns.length === 0 ? (
          <EmptyState
            icon="🔍"
            title={`No ${activeFilter.label.toLowerCase()} campaigns`}
            description="Try a different status filter."
            action={
              <button type="button" className="mkt-btn mkt-btn-sm" onClick={() => setStatusFilter("all")}>
                Show all
              </button>
            }
          />
        ) : (
          <table className="mkt-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Recipients</th>
                <th>Status</th>
                <th>Open / Click</th>
                <th>Sent</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleCampaigns.map((c: any) => {
                const m = c.metrics || {}
                return (
                  <tr key={c.id} className="mkt-row">
                    <td>
                      <Link to={`/marketing/campaigns/${c.id}`} className="mkt-link" style={{ fontWeight: 500 }}>
                        {c.name || "Untitled"}
                      </Link>
                    </td>
                    <td>{fmt(m.recipients ?? m.sent)}</td>
                    <td><StatusBadge status={c.status || "draft"} /></td>
                    <td style={{ color: tokens.fgSecondary, fontSize: "13px", fontVariantNumeric: "tabular-nums" }}>
                      {typeof m.open_rate === "number" || typeof m.click_rate === "number" ? (
                        <span>
                          {((Number(m.open_rate) || 0) * 100).toFixed(1)}%
                          <span style={{ color: tokens.fgMuted }}> / </span>
                          {((Number(m.click_rate) || 0) * 100).toFixed(1)}%
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
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
                          onClick={() => {
                            const isDraft = c.status === "draft"
                            const label = isDraft ? "Delete" : "Hide"
                            const msg = isDraft
                              ? `Delete draft "${c.name}"? This cannot be undone.`
                              : `Hide "${c.name}" from the list? Attribution and message history are preserved.`
                            if (confirm(msg)) deleteMut.mutate(c.id)
                          }}
                        >
                          {c.status === "draft" ? "Delete" : "Hide"}
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
