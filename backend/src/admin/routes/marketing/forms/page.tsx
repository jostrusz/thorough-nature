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
  Modal,
  lblStyle,
  fmt,
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
        try { window.location.hash = `#/marketing/forms/${resp.form.id}` } catch { /* ignore */ }
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
      active="/marketing/forms"
      right={
        <button className="mkt-btn-primary" onClick={() => setShowNew(true)} style={{ padding: "7px 14px", borderRadius: "6px", fontSize: "13px", fontWeight: 500, border: "none", background: "#008060", color: "#FFF" }}>
          + New Form
        </button>
      }
    >
      {isLoading ? (
        <p style={{ color: "#8C9196", fontSize: "13px" }}>Loading…</p>
      ) : forms.length === 0 ? (
        <div className="mkt-card" style={{ padding: "40px", textAlign: "center", color: "#8C9196" }}>
          <p style={{ fontSize: "14px" }}>No forms yet</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "12px" }}>
          {forms.map((f: any) => {
            const m = f.metrics || {}
            return (
              <div key={f.id} className="mkt-card" style={{ padding: "16px 18px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <a href={`#/marketing/forms/${f.id}`} className="mkt-link" style={{ fontSize: "14px", fontWeight: 600 }}>
                      {f.name}
                    </a>
                    <div style={{ fontSize: "12px", color: "#6D7175", marginTop: "2px" }}>
                      Type: <strong>{f.type || "—"}</strong>
                      {f.slug && <span> · /{f.slug}</span>}
                    </div>
                  </div>
                  <StatusBadge status={f.status || "draft"} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px", marginTop: "12px", fontSize: "12px" }}>
                  <div><div style={{ color: "#8C9196" }}>Views</div><div style={{ fontWeight: 600 }}>{fmt(m.views)}</div></div>
                  <div><div style={{ color: "#8C9196" }}>Submits</div><div style={{ fontWeight: 600 }}>{fmt(m.submits)}</div></div>
                  <div><div style={{ color: "#8C9196" }}>Rate</div><div style={{ fontWeight: 600 }}>{m.views ? `${((m.submits || 0) / m.views * 100).toFixed(1)}%` : "—"}</div></div>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "6px", marginTop: "12px" }}>
                  <a href={`#/marketing/forms/${f.id}`} className="mkt-btn" style={{ padding: "4px 10px", borderRadius: "6px", fontSize: "11px", border: "1px solid #E1E3E5", background: "#FFF", color: "#1A1A1A", textDecoration: "none" }}>
                    Edit
                  </a>
                  <button
                    className="mkt-btn"
                    onClick={() => { if (confirm(`Delete form "${f.name}"?`)) deleteMut.mutate(f.id) }}
                    style={{ padding: "4px 10px", borderRadius: "6px", fontSize: "11px", border: "1px solid #FED3D1", background: "#FFF", color: "#D72C0D" }}
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
              <button className="mkt-btn" onClick={() => setShowNew(false)} style={{ padding: "6px 14px", borderRadius: "6px", fontSize: "13px", border: "1px solid #E1E3E5", background: "#FFF", color: "#6D7175" }}>
                Cancel
              </button>
              <button
                className="mkt-btn-primary"
                disabled={!newName || createMut.isPending}
                onClick={() => {
                  const slug = newName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
                  createMut.mutate({ brand_id: brandId || undefined, name: newName, slug, type: newType })
                }}
                style={{ padding: "6px 14px", borderRadius: "6px", fontSize: "13px", fontWeight: 500, border: "none", background: "#008060", color: "#FFF", opacity: !newName ? 0.5 : 1 }}
              >
                {createMut.isPending ? "Creating…" : "Create"}
              </button>
            </>
          }
        >
          <label style={lblStyle}>Name *</label>
          <input className="mkt-input" value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus />
          <label style={{ ...lblStyle, marginTop: "10px" }}>Type *</label>
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
})

export default FormsPage
