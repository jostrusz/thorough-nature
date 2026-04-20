import React, { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
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
  Modal,
  fmt,
  tokens,
} from "../../../components/marketing/shared"

const FORM_TYPES = [
  { value: "popup", label: "Popup" },
  { value: "embedded", label: "Embedded" },
  { value: "flyout", label: "Flyout" },
  { value: "banner", label: "Banner" },
  { value: "landing", label: "Landing page" },
]

function FormsPage() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { brandId } = useSelectedBrand()
  const qs = brandQs(brandId)
  const [showNew, setShowNew] = useState(false)
  const [newName, setNewName] = useState("")
  const [newType, setNewType] = useState("popup")

  const { data, isLoading } = useQuery({
    queryKey: ["mkt-forms", brandId],
    queryFn: () =>
      sdk.client.fetch<{ forms: any[] }>(`/admin/marketing/forms${qs}`, { method: "GET" }),
    enabled: !!brandId,
  })
  const forms: any[] = ((data as any)?.forms) || []

  const createMut = useMutation({
    mutationFn: (body: any) =>
      sdk.client.fetch<{ form: any }>("/admin/marketing/forms", { method: "POST", body }),
    onSuccess: (resp: any) => {
      qc.invalidateQueries({ queryKey: ["mkt-forms"] })
      toast.success("Form created")
      setShowNew(false)
      setNewName("")
      setNewType("popup")
      if (resp?.form?.id) {
        navigate(`/marketing/forms/${resp.form.id}`)
      }
    },
    onError: (e: any) => toast.error("Failed: " + (e?.message || "unknown")),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) =>
      sdk.client.fetch(`/admin/marketing/forms/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mkt-forms"] })
      toast.success("Form deleted")
    },
    onError: () => toast.error("Failed to delete"),
  })

  return (
    <MarketingShell
      title="Forms"
      subtitle="Signup forms, landing pages and capture widgets"
      breadcrumbs={[
        { label: "Marketing", to: "/marketing" },
        { label: "Forms" },
      ]}
      right={
        <button className="mkt-btn-primary" onClick={() => setShowNew(true)}>
          New form
        </button>
      }
    >
      {isLoading ? (
        <div className="mkt-card" style={{ padding: "32px", color: tokens.fgSecondary, fontSize: "13px", textAlign: "center" }}>
          Loading…
        </div>
      ) : forms.length === 0 ? (
        <div className="mkt-card">
          <EmptyState
            icon="📝"
            title="No forms yet"
            description="Create a signup form, popup or landing page to capture subscribers."
            action={
              <button className="mkt-btn-primary" onClick={() => setShowNew(true)}>
                Create form
              </button>
            }
          />
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "16px" }}>
          {forms.map((f: any) => {
            const m = f.metrics || {}
            return (
              <div key={f.id} className="mkt-card mkt-card-hover" style={{ padding: "20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px" }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <Link to={`/marketing/forms/${f.id}`} className="mkt-link" style={{ fontSize: "15px", fontWeight: 600, letterSpacing: "-0.005em" }}>
                      {f.name}
                    </Link>
                    <div style={{ fontSize: "13px", color: tokens.fgSecondary, marginTop: "4px" }}>
                      {f.type || "—"}
                      {f.slug && <span> · /{f.slug}</span>}
                    </div>
                  </div>
                  <StatusBadge status={f.status || "draft"} />
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: "12px",
                    marginTop: "16px",
                    paddingTop: "16px",
                    borderTop: `1px solid ${tokens.borderSubtle}`,
                    fontSize: "13px",
                  }}
                >
                  <div>
                    <div style={{ color: tokens.fgMuted, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600 }}>Views</div>
                    <div style={{ fontWeight: 600, fontSize: "16px", marginTop: "2px", color: tokens.fg }}>{fmt(m.views)}</div>
                  </div>
                  <div>
                    <div style={{ color: tokens.fgMuted, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600 }}>Submits</div>
                    <div style={{ fontWeight: 600, fontSize: "16px", marginTop: "2px", color: tokens.fg }}>{fmt(m.submits)}</div>
                  </div>
                  <div>
                    <div style={{ color: tokens.fgMuted, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600 }}>Rate</div>
                    <div style={{ fontWeight: 600, fontSize: "16px", marginTop: "2px", color: tokens.fg }}>{m.views ? `${((m.submits || 0) / m.views * 100).toFixed(1)}%` : "—"}</div>
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "16px" }}>
                  <Link to={`/marketing/forms/${f.id}`} className="mkt-btn mkt-btn-sm">
                    Edit
                  </Link>
                  <button
                    className="mkt-btn-danger-ghost"
                    onClick={() => { if (confirm(`Delete form "${f.name}"?`)) deleteMut.mutate(f.id) }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showNew && (
        <Modal
          title="New form"
          onClose={() => setShowNew(false)}
          footer={
            <>
              <button className="mkt-btn" onClick={() => setShowNew(false)}>Cancel</button>
              <button
                className="mkt-btn-primary"
                disabled={!newName || createMut.isPending}
                onClick={() => {
                  const slug = newName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
                  createMut.mutate({ brand_id: brandId || undefined, name: newName, slug, type: newType })
                }}
              >
                {createMut.isPending ? "Creating…" : "Create"}
              </button>
            </>
          }
        >
          <label className="mkt-label">Name *</label>
          <input className="mkt-input" value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus />
          <label className="mkt-label" style={{ marginTop: "16px" }}>Type *</label>
          <select className="mkt-input" value={newType} onChange={(e) => setNewType(e.target.value)}>
            {FORM_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </Modal>
      )}
    </MarketingShell>
  )
}

export const config = defineRouteConfig({
  label: "Forms",
  rank: 70,
})

export default FormsPage
