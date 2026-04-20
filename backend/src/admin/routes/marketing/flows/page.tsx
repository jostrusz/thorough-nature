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

function FlowsPage() {
  const qc = useQueryClient()
  const { brandId } = useSelectedBrand()
  const qs = brandQs(brandId)

  const { data, isLoading } = useQuery({
    queryKey: ["mkt-flows", brandId],
    queryFn: () =>
      sdk.client.fetch<{ flows: any[] }>(`/admin/marketing/flows${qs}`, { method: "GET" }),
    enabled: !!brandId,
  })
  const flows: any[] = ((data as any)?.flows) || []

  const deleteMut = useMutation({
    mutationFn: (id: string) =>
      sdk.client.fetch(`/admin/marketing/flows/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mkt-flows"] })
      toast.success("Flow deleted")
    },
    onError: () => toast.error("Failed to delete"),
  })

  const pauseMut = useMutation({
    mutationFn: (id: string) =>
      sdk.client.fetch(`/admin/marketing/flows/${id}/pause`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mkt-flows"] })
      toast.success("Flow paused")
    },
    onError: () => toast.error("Failed to pause"),
  })

  return (
    <MarketingShell
      title="Flows"
      subtitle="Automations triggered by events or schedules"
      breadcrumbs={[
        { label: "Marketing", to: "/marketing" },
        { label: "Flows" },
      ]}
      right={
        <Link className="mkt-btn-primary" to="/marketing/flows/new">
          New flow
        </Link>
      }
    >
      <div className="mkt-card" style={{ overflow: "hidden", padding: 0 }}>
        {isLoading ? (
          <div style={{ padding: "32px", color: tokens.fgSecondary, fontSize: "13px", textAlign: "center" }}>
            Loading…
          </div>
        ) : flows.length === 0 ? (
          <EmptyState
            icon="⚡"
            title="No flows yet"
            description="Automate drip sequences triggered by events or schedules."
            action={
              <Link to="/marketing/flows/new" className="mkt-btn-primary">
                Create flow
              </Link>
            }
          />
        ) : (
          <table className="mkt-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th>Version</th>
                <th>Trigger</th>
                <th>Runs</th>
                <th>Completed</th>
                <th>Errors</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {flows.map((f: any) => {
                const s = f.stats || {}
                return (
                  <tr key={f.id} className="mkt-row">
                    <td>
                      <Link to={`/marketing/flows/${f.id}`} className="mkt-link" style={{ fontWeight: 500 }}>
                        {f.name || "Untitled"}
                      </Link>
                    </td>
                    <td><StatusBadge status={f.status || "draft"} /></td>
                    <td style={{ color: tokens.fgSecondary, fontSize: "13px" }}>v{f.version ?? 1}</td>
                    <td style={{ color: tokens.fgSecondary, fontSize: "13px" }}>
                      {f.trigger?.type || f.trigger_type || "—"}
                      {f.trigger?.event ? `: ${f.trigger.event}` : ""}
                    </td>
                    <td>{fmt(s.runs_started)}</td>
                    <td>{fmt(s.runs_completed)}</td>
                    <td style={{ color: s.runs_errored ? tokens.dangerFg : undefined }}>{fmt(s.runs_errored)}</td>
                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: "6px" }}>
                        <Link to={`/marketing/flows/${f.id}`} className="mkt-btn mkt-btn-xs">
                          Edit
                        </Link>
                        {f.status === "live" && (
                          <button className="mkt-btn mkt-btn-xs" onClick={() => pauseMut.mutate(f.id)}>
                            Pause
                          </button>
                        )}
                        <button
                          className="mkt-btn-danger-ghost"
                          onClick={() => { if (confirm(`Delete flow "${f.name}"?`)) deleteMut.mutate(f.id) }}
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
  label: "Flows",
  rank: 30,
})

export default FlowsPage
