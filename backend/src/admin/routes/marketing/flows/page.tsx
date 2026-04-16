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
      active="/marketing/flows"
      right={
        <a className="mkt-btn-primary" href="#/marketing/flows/new" style={{ padding: "7px 14px", borderRadius: "6px", fontSize: "13px", fontWeight: 500, border: "none", background: "#008060", color: "#FFF", textDecoration: "none" }}>
          + New Flow
        </a>
      }
    >
      <div className="mkt-card" style={{ overflow: "hidden" }}>
        {isLoading ? (
          <div style={{ padding: "24px", color: "#8C9196", fontSize: "13px" }}>Loading…</div>
        ) : flows.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center", color: "#8C9196", fontSize: "13px" }}>
            No flows yet.
          </div>
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
                      <a href={`#/marketing/flows/${f.id}`} className="mkt-link" style={{ fontWeight: 500 }}>
                        {f.name || "Untitled"}
                      </a>
                    </td>
                    <td><StatusBadge status={f.status || "draft"} /></td>
                    <td style={{ color: "#6D7175" }}>v{f.version ?? 1}</td>
                    <td style={{ color: "#6D7175", fontSize: "12px" }}>
                      {f.trigger?.type || f.trigger_type || "—"}
                      {f.trigger?.event ? `: ${f.trigger.event}` : ""}
                    </td>
                    <td>{fmt(s.runs_started)}</td>
                    <td>{fmt(s.runs_completed)}</td>
                    <td>{fmt(s.runs_errored)}</td>
                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: "4px" }}>
                        <a href={`#/marketing/flows/${f.id}`} className="mkt-btn" style={{ padding: "4px 8px", borderRadius: "6px", fontSize: "11px", border: "1px solid #E1E3E5", background: "#FFF", color: "#1A1A1A", textDecoration: "none" }}>
                          Edit
                        </a>
                        {f.status === "live" && (
                          <button className="mkt-btn" onClick={() => pauseMut.mutate(f.id)} style={{ padding: "4px 8px", borderRadius: "6px", fontSize: "11px", border: "1px solid #E1E3E5", background: "#FFF", color: "#1A1A1A" }}>
                            Pause
                          </button>
                        )}
                        <button
                          className="mkt-btn"
                          onClick={() => { if (confirm(`Delete flow "${f.name}"?`)) deleteMut.mutate(f.id) }}
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
  label: "Flows",
})

export default FlowsPage
