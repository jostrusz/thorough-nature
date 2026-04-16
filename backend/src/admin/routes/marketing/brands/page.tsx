import React, { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "@medusajs/ui"
import { defineRouteConfig } from "@medusajs/admin-sdk"
import { sdk } from "../../../lib/sdk"
import {
  MarketingShell,
  Modal,
  Toggle,
  lblStyle,
  PROJECT_SLUGS,
} from "../../../components/marketing/shared"

const emptyForm = {
  slug: "",
  display_name: "",
  project_id: "",
  marketing_from_email: "",
  marketing_from_name: "",
  marketing_reply_to: "",
  primary_color: "#008060",
  logo_url: "",
  locale: "en",
  timezone: "Europe/Prague",
  double_opt_in_enabled: true,
  enabled: true,
}

function BrandsPage() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<any | null>(null)
  const [form, setForm] = useState<any>(emptyForm)

  const { data, isLoading } = useQuery({
    queryKey: ["mkt-brands"],
    queryFn: () =>
      sdk.client.fetch<{ brands: any[] }>("/admin/marketing/brands", { method: "GET" }),
  })
  const brands: any[] = ((data as any)?.brands) || []

  const createMut = useMutation({
    mutationFn: (body: any) =>
      sdk.client.fetch("/admin/marketing/brands", { method: "POST", body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mkt-brands"] })
      toast.success("Brand created")
      setShowForm(false)
      setForm(emptyForm)
    },
    onError: (e: any) => toast.error("Failed: " + (e?.message || "unknown")),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: any }) =>
      sdk.client.fetch(`/admin/marketing/brands/${id}`, { method: "POST", body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mkt-brands"] })
      toast.success("Brand updated")
      setEditing(null)
    },
    onError: (e: any) => toast.error("Failed: " + (e?.message || "unknown")),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) =>
      sdk.client.fetch(`/admin/marketing/brands/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mkt-brands"] })
      toast.success("Brand deleted")
    },
    onError: () => toast.error("Failed to delete brand"),
  })

  const toggleEnabled = (b: any) =>
    updateMut.mutate({ id: b.id, body: { enabled: !b.enabled } })

  const openEdit = (b: any) => {
    setEditing(b)
    setForm({
      slug: b.slug || "",
      display_name: b.display_name || "",
      project_id: b.project_id || "",
      marketing_from_email: b.marketing_from_email || "",
      marketing_from_name: b.marketing_from_name || "",
      marketing_reply_to: b.marketing_reply_to || "",
      primary_color: b.primary_color || "#008060",
      logo_url: b.logo_url || "",
      locale: b.locale || "en",
      timezone: b.timezone || "Europe/Prague",
      double_opt_in_enabled: !!b.double_opt_in_enabled,
      enabled: !!b.enabled,
    })
  }

  const renderForm = () => (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
      <div>
        <label style={lblStyle}>Slug *</label>
        <input className="mkt-input" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="loslatenboek" />
      </div>
      <div>
        <label style={lblStyle}>Display name *</label>
        <input className="mkt-input" value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} placeholder="Laat los" />
      </div>
      <div>
        <label style={lblStyle}>Project</label>
        <select className="mkt-input" value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value })}>
          <option value="">— Select project —</option>
          {PROJECT_SLUGS.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>
      <div>
        <label style={lblStyle}>From email *</label>
        <input className="mkt-input" type="email" value={form.marketing_from_email} onChange={(e) => setForm({ ...form, marketing_from_email: e.target.value })} placeholder="hello@laatlos.nl" />
      </div>
      <div>
        <label style={lblStyle}>From name</label>
        <input className="mkt-input" value={form.marketing_from_name} onChange={(e) => setForm({ ...form, marketing_from_name: e.target.value })} placeholder="Laat los" />
      </div>
      <div>
        <label style={lblStyle}>Reply-to</label>
        <input className="mkt-input" type="email" value={form.marketing_reply_to} onChange={(e) => setForm({ ...form, marketing_reply_to: e.target.value })} placeholder="reply@laatlos.nl" />
      </div>
      <div>
        <label style={lblStyle}>Primary color</label>
        <div style={{ display: "flex", gap: "6px" }}>
          <input className="mkt-input" value={form.primary_color} onChange={(e) => setForm({ ...form, primary_color: e.target.value })} />
          <input type="color" value={form.primary_color} onChange={(e) => setForm({ ...form, primary_color: e.target.value })} style={{ width: "40px", height: "34px", border: "1px solid #E1E3E5", borderRadius: "6px", padding: 0 }} />
        </div>
      </div>
      <div>
        <label style={lblStyle}>Logo URL</label>
        <input className="mkt-input" value={form.logo_url} onChange={(e) => setForm({ ...form, logo_url: e.target.value })} placeholder="https://…" />
      </div>
      <div>
        <label style={lblStyle}>Locale</label>
        <input className="mkt-input" value={form.locale} onChange={(e) => setForm({ ...form, locale: e.target.value })} placeholder="en, nl, cs, de, pl, sv" />
      </div>
      <div>
        <label style={lblStyle}>Timezone</label>
        <input className="mkt-input" value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} placeholder="Europe/Prague" />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", gridColumn: "span 2", paddingTop: "4px" }}>
        <Toggle checked={form.double_opt_in_enabled} onChange={() => setForm({ ...form, double_opt_in_enabled: !form.double_opt_in_enabled })} />
        <span style={{ fontSize: "13px", color: "#1A1A1A" }}>Double opt-in enabled</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", gridColumn: "span 2" }}>
        <Toggle checked={form.enabled} onChange={() => setForm({ ...form, enabled: !form.enabled })} />
        <span style={{ fontSize: "13px", color: "#1A1A1A" }}>Brand enabled</span>
      </div>
    </div>
  )

  const canSave = !!(form.slug && form.display_name && form.marketing_from_email && form.marketing_from_name && form.project_id)

  return (
    <MarketingShell
      title="Brands"
      subtitle="Per-project sender identities, branding and opt-in settings"
      active="/marketing/brands"
      right={
        <button
          className="mkt-btn-primary"
          onClick={() => { setForm(emptyForm); setShowForm(true) }}
          style={{ padding: "7px 14px", borderRadius: "6px", fontSize: "13px", fontWeight: 500, border: "none", background: "#008060", color: "#FFF" }}
        >
          + New Brand
        </button>
      }
    >
      {isLoading ? (
        <p style={{ color: "#8C9196", fontSize: "13px" }}>Loading…</p>
      ) : brands.length === 0 ? (
        <div className="mkt-card" style={{ padding: "40px", textAlign: "center", color: "#8C9196" }}>
          <p style={{ fontSize: "14px" }}>No brands yet</p>
          <p style={{ fontSize: "12px" }}>Create your first brand to start sending marketing emails</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "12px" }}>
          {brands.map((b: any) => (
            <div key={b.id} className="mkt-card" style={{ padding: "16px 18px" }}>
              <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                <div
                  style={{
                    width: "42px",
                    height: "42px",
                    borderRadius: "8px",
                    background: b.primary_color || "#E4E5E7",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                    flexShrink: 0,
                  }}
                >
                  {b.logo_url ? (
                    <img src={b.logo_url} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
                  ) : (
                    <span style={{ color: "#FFF", fontSize: "16px", fontWeight: 700 }}>
                      {(b.display_name || b.slug || "?").slice(0, 2).toUpperCase()}
                    </span>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "14px", fontWeight: 600 }}>{b.display_name || b.slug}</span>
                    <Toggle checked={!!b.enabled} onChange={() => toggleEnabled(b)} disabled={updateMut.isPending} />
                  </div>
                  <div style={{ fontSize: "12px", color: "#6D7175", marginTop: "2px", wordBreak: "break-all" }}>
                    {b.marketing_from_email || "—"}
                  </div>
                  {b.project_id && (
                    <div style={{ fontSize: "11px", color: "#8C9196", marginTop: "2px" }}>Project: {b.project_id}</div>
                  )}
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "6px", marginTop: "12px" }}>
                <button
                  className="mkt-btn"
                  onClick={() => openEdit(b)}
                  style={{ padding: "4px 10px", borderRadius: "6px", fontSize: "12px", border: "1px solid #E1E3E5", background: "#FFF", color: "#1A1A1A" }}
                >
                  Edit
                </button>
                <button
                  className="mkt-btn"
                  onClick={() => { if (confirm(`Delete brand "${b.display_name || b.slug}"?`)) deleteMut.mutate(b.id) }}
                  style={{ padding: "4px 10px", borderRadius: "6px", fontSize: "12px", border: "1px solid #FED3D1", background: "#FFF", color: "#D72C0D" }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {(showForm || editing) && (
        <Modal
          title={editing ? `Edit brand: ${editing.display_name || editing.slug}` : "New brand"}
          onClose={() => { setShowForm(false); setEditing(null) }}
          width={640}
          footer={
            <>
              <button className="mkt-btn" onClick={() => { setShowForm(false); setEditing(null) }} style={{ padding: "6px 14px", borderRadius: "6px", fontSize: "13px", border: "1px solid #E1E3E5", background: "#FFF", color: "#6D7175" }}>
                Cancel
              </button>
              <button
                className="mkt-btn-primary"
                disabled={!canSave || createMut.isPending || updateMut.isPending}
                onClick={() => {
                  if (editing) updateMut.mutate({ id: editing.id, body: form })
                  else createMut.mutate(form)
                }}
                style={{ padding: "6px 14px", borderRadius: "6px", fontSize: "13px", fontWeight: 500, border: "none", background: "#008060", color: "#FFF", opacity: !canSave ? 0.5 : 1 }}
              >
                {editing ? (updateMut.isPending ? "Saving…" : "Save changes") : (createMut.isPending ? "Creating…" : "Create brand")}
              </button>
            </>
          }
        >
          {renderForm()}
        </Modal>
      )}
    </MarketingShell>
  )
}

export const config = defineRouteConfig({
  label: "Brands",
})

export default BrandsPage
