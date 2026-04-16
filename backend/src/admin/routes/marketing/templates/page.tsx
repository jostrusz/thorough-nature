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
  tokens,
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
      breadcrumbs={[
        { label: "Marketing", to: "/marketing" },
        { label: "Templates" },
      ]}
      right={
        <Link className="mkt-btn-primary" to="/marketing/templates/new">
          New template
        </Link>
      }
    >
      <div style={{ marginBottom: "16px", display: "flex", gap: "12px" }}>
        <select
          className="mkt-input"
          style={{ width: "auto", minWidth: "180px", height: "36px", fontSize: "13px" }}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="ready">Ready</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      <div className="mkt-card" style={{ overflow: "hidden", padding: 0 }}>
        {isLoading ? (
          <div style={{ padding: "32px", color: tokens.fgSecondary, fontSize: "13px", textAlign: "center" }}>
            Loading…
          </div>
        ) : templates.length === 0 ? (
          <EmptyState
            icon="📧"
            title="No templates yet"
            description="Create your first email template to get started."
            action={
              <Link to="/marketing/templates/new" className="mkt-btn-primary">
                Create template
              </Link>
            }
          />
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
                    <Link to={`/marketing/templates/${t.id}`} className="mkt-link" style={{ fontWeight: 500 }}>
                      {t.name || "Untitled"}
                    </Link>
                  </td>
                  <td style={{ color: tokens.fgSecondary }}>{t.subject || "—"}</td>
                  <td><StatusBadge status={t.status || "draft"} /></td>
                  <td style={{ color: tokens.fgSecondary, fontSize: "13px" }}>
                    {t.updated_at ? new Date(t.updated_at).toLocaleString() : "—"}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <div style={{ display: "inline-flex", gap: "6px" }}>
                      <Link to={`/marketing/templates/${t.id}`} className="mkt-btn mkt-btn-xs">
                        Edit
                      </Link>
                      <button
                        className="mkt-btn mkt-btn-xs"
                        onClick={() => duplicateMut.mutate(t.id)}
                      >
                        Duplicate
                      </button>
                      <button
                        className="mkt-btn-danger-ghost"
                        onClick={() => { if (confirm(`Delete template "${t.name}"?`)) deleteMut.mutate(t.id) }}
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
