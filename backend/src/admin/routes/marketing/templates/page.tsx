import React, { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "@medusajs/ui"
import { defineRouteConfig } from "@medusajs/admin-sdk"
import { sdk } from "../../../lib/sdk"
import {
  MarketingShell,
  StatusBadge,
  useSelectedBrand,
  brandQs,
} from "../../../components/marketing/shared"

function TemplatesPage() {
  const qc = useQueryClient()
  const { brandId } = useSelectedBrand()
  const [statusFilter, setStatusFilter] = useState("")

  const qs = (() => {
    const params: string[] = []
    if (brandId) params.push(`brand_id=${encodeURIComponent(brandId)}`)
    if (statusFilter) params.push(`status=${encodeURIComponent(statusFilter)}`)
    return params.length ? `?${params.join("&")}` : ""
  })()

  const { data, isLoading } = useQuery({
    queryKey: ["mkt-templates", brandId, statusFilter],
    queryFn: () =>
      sdk.client.fetch<{ templates: any[] }>(`/admin/marketing/templates${qs}`, { method: "GET" }),
    enabled: !!brandId,
  })
  const templates: any[] = ((data as any)?.templates) || []

  const duplicateMut = useMutation({
    mutationFn: (id: string) =>
      sdk.client.fetch(`/admin/marketing/templates/${id}/duplicate`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mkt-templates"] })
      toast.success("Template duplicated")
    },
    onError: () => toast.error("Failed to duplicate template"),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) =>
      sdk.client.fetch(`/admin/marketing/templates/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mkt-templates"] })
      toast.success("Template deleted")
    },
    onError: () => toast.error("Failed to delete template"),
  })

  return (
    <MarketingShell
      title="Templates"
      subtitle="Reusable email templates"
      active="/marketing/templates"
      right={
        <a
          className="mkt-btn-primary"
          href="#/marketing/templates/new"
          style={{ padding: "7px 14px", borderRadius: "6px", fontSize: "13px", fontWeight: 500, border: "none", background: "#008060", color: "#FFF", textDecoration: "none" }}
        >
          + New Template
        </a>
      }
    >
      <div style={{ marginBottom: "12px", display: "flex", gap: "8px" }}>
        <select
          className="mkt-input"
          style={{ width: "auto", minWidth: "160px" }}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="ready">Ready</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      <div className="mkt-card" style={{ overflow: "hidden" }}>
        {isLoading ? (
          <div style={{ padding: "24px", color: "#8C9196", fontSize: "13px" }}>Loading…</div>
        ) : templates.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center", color: "#8C9196", fontSize: "13px" }}>
            No templates yet. Create your first template to get started.
          </div>
        ) : (
          <table className="mkt-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Subject</th>
                <th>Status</th>
                <th>Updated</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t: any) => (
                <tr key={t.id} className="mkt-row">
                  <td>
                    <a href={`#/marketing/templates/${t.id}`} className="mkt-link" style={{ fontWeight: 500 }}>
                      {t.name || "Untitled"}
                    </a>
                  </td>
                  <td style={{ color: "#6D7175" }}>{t.subject || "—"}</td>
                  <td><StatusBadge status={t.status || "draft"} /></td>
                  <td style={{ color: "#6D7175", fontSize: "12px" }}>
                    {t.updated_at ? new Date(t.updated_at).toLocaleString() : "—"}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <div style={{ display: "inline-flex", gap: "4px" }}>
                      <a href={`#/marketing/templates/${t.id}`} className="mkt-btn" style={{ padding: "4px 8px", borderRadius: "6px", fontSize: "11px", border: "1px solid #E1E3E5", background: "#FFF", color: "#1A1A1A", textDecoration: "none" }}>
                        Edit
                      </a>
                      <button
                        className="mkt-btn"
                        onClick={() => duplicateMut.mutate(t.id)}
                        style={{ padding: "4px 8px", borderRadius: "6px", fontSize: "11px", border: "1px solid #E1E3E5", background: "#FFF", color: "#1A1A1A" }}
                      >
                        Duplicate
                      </button>
                      <button
                        className="mkt-btn"
                        onClick={() => { if (confirm(`Delete template "${t.name}"?`)) deleteMut.mutate(t.id) }}
                        style={{ padding: "4px 8px", borderRadius: "6px", fontSize: "11px", border: "1px solid #FED3D1", background: "#FFF", color: "#D72C0D" }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </MarketingShell>
  )
}

export const config = defineRouteConfig({
  label: "Templates",
})

export default TemplatesPage
