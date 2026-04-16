import React, { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "@medusajs/ui"
import { defineRouteConfig } from "@medusajs/admin-sdk"
import { sdk } from "../../../lib/sdk"
import {
  MarketingShell,
  Modal,
  Toggle,
  EmptyState,
  PROJECT_SLUGS,
  tokens,
} from "../../../components/marketing/shared"

const emptyForm = {
  slug: "",
  display_name: "",
  project_id: "",
  marketing_from_email: "",
  marketing_from_name: "",
  marketing_reply_to: "",
  primary_color: "#15803D",
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
      primary_color: b.primary_color || "#15803D",
      logo_url: b.logo_url || "",
      locale: b.locale || "en",
      timezone: b.timezone || "Europe/Prague",
      double_opt_in_enabled: !!b.double_opt_in_enabled,
      enabled: !!b.enabled,
    })
  }

  const renderForm = () => (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
      <div>
        <label className="mkt-label">Slug *</label>
        <input className="mkt-input" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="loslatenboek" />
      </div>
      <div>
        <label className="mkt-label">Display name *</label>
        <input className="mkt-input" value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} placeholder="Laat los" />
      </div>
      <div>
        <label className="mkt-label">Project</label>
        <select className="mkt-input" value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value })}>
          <option value="">Select project</option>
          {PROJECT_SLUGS.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="mkt-label">From email *</label>
        <input className="mkt-input" type="email" value={form.marketing_from_email} onChange={(e) => setForm({ ...form, marketing_from_email: e.target.value })} placeholder="hello@laatlos.nl" />
      </div>
      <div>
        <label className="mkt-label">From name</label>
        <input className="mkt-input" value={form.marketing_from_name} onChange={(e) => setForm({ ...form, marketing_from_name: e.target.value })} placeholder="Laat los" />
      </div>
      <div>
        <label className="mkt-label">Reply-to</label>
        <input className="mkt-input" type="email" value={form.marketing_reply_to} onChange={(e) => setForm({ ...form, marketing_reply_to: e.target.value })} placeholder="reply@laatlos.nl" />
      </div>
      <div>
        <label className="mkt-label">Primary color</label>
        <div style={{ display: "flex", gap: "8px" }}>
          <input className="mkt-input" value={form.primary_color} onChange={(e) => setForm({ ...form, primary_color: e.target.value })} />
          <input type="color" value={form.primary_color} onChange={(e) => setForm({ ...form, primary_color: e.target.value })} style={{ width: "48px", height: "40px", border: `1px solid ${tokens.borderStrong}`, borderRadius: tokens.rMd, padding: "2px", cursor: "pointer", flexShrink: 0 }} />
        </div>
      </div>
      <div>
        <label className="mkt-label">Logo URL</label>
        <input className="mkt-input" value={form.logo_url} onChange={(e) => setForm({ ...form, logo_url: e.target.value })} placeholder="https://…" />
      </div>
      <div>
        <label className="mkt-label">Locale</label>
        <input className="mkt-input" value={form.locale} onChange={(e) => setForm({ ...form, locale: e.target.value })} placeholder="en, nl, cs, de, pl, sv" />
      </div>
      <div>
        <label className="mkt-label">Timezone</label>
        <input className="mkt-input" value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} placeholder="Europe/Prague" />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", gridColumn: "span 2", paddingTop: "8px" }}>
        <Toggle checked={form.double_opt_in_enabled} onChange={() => setForm({ ...form, double_opt_in_enabled: !form.double_opt_in_enabled })} />
        <span style={{ fontSize: "14px", color: tokens.fg }}>Double opt-in enabled</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", gridColumn: "span 2" }}>
        <Toggle checked={form.enabled} onChange={() => setForm({ ...form, enabled: !form.enabled })} />
        <span style={{ fontSize: "14px", color: tokens.fg }}>Brand enabled</span>
      </div>
    </div>
  )

  const canSave = !!(form.slug && form.display_name && form.marketing_from_email && form.marketing_from_name && form.project_id)

  return (
    <MarketingShell
      title="Brands"
      subtitle="Per-project sender identities, branding and opt-in settings"
      breadcrumbs={[
        { label: "Marketing", to: "/marketing" },
        { label: "Brands" },
      ]}
      right={
        <button className="mkt-btn-primary" onClick={() => { setForm(emptyForm); setShowForm(true) }}>
          New brand
        </button>
      }
    >
      {isLoading ? (
        <div className="mkt-card" style={{ padding: "24px", color: tokens.fgSecondary, fontSize: "13px", textAlign: "center" }}>
          Loading…
        </div>
      ) : brands.length === 0 ? (
        <div className="mkt-card">
          <EmptyState
            icon="🎨"
            title="No brands yet"
            description="Create your first brand to start sending marketing emails."
            action={
              <button className="mkt-btn-primary" onClick={() => { setForm(emptyForm); setShowForm(true) }}>
                Create brand
              </button>
            }
          />
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "16px" }}>
          {brands.map((b: any) => (
            <div key={b.id} className="mkt-card mkt-card-hover" style={{ padding: "20px" }}>
              <div style={{ display: "flex", gap: "14px", alignItems: "flex-start" }}>
                <div
                  style={{
                    width: "44px",
                    height: "44px",
                    borderRadius: tokens.rMd,
                    background: b.primary_color || tokens.borderSubtle,
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
                    <span style={{ color: "#FFFFFF", fontSize: "15px", fontWeight: 600 }}>
                      {(b.display_name || b.slug || "?").slice(0, 2).toUpperCase()}
                    </span>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "15px", fontWeight: 600, color: tokens.fg }}>{b.display_name || b.slug}</span>
                    <Toggle checked={!!b.enabled} onChange={() => toggleEnabled(b)} disabled={updateMut.isPending} />
                  </div>
                  <div style={{ fontSize: "13px", color: tokens.fgSecondary, marginTop: "4px", wordBreak: "break-all" }}>
                    {b.marketing_from_email || "—"}
                  </div>
                  {b.project_id && (
                    <div style={{ fontSize: "12px", color: tokens.fgMuted, marginTop: "4px" }}>Project: {b.project_id}</div>
                  )}
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "16px" }}>
                <button className="mkt-btn mkt-btn-sm" onClick={() => openEdit(b)}>
                  Edit
                </button>
                <button
                  className="mkt-btn-danger-ghost"
                  onClick={() => { if (confirm(`Delete brand "${b.display_name || b.slug}"?`)) deleteMut.mutate(b.id) }}
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
          title={editing ? `Edit brand` : "New brand"}
          onClose={() => { setShowForm(false); setEditing(null) }}
          width={720}
          footer={
            <>
              <button className="mkt-btn" onClick={() => { setShowForm(false); setEditing(null) }}>
                Cancel
              </button>
              <button
                className="mkt-btn-primary"
                disabled={!canSave || createMut.isPending || updateMut.isPending}
                onClick={() => {
                  if (editing) updateMut.mutate({ id: editing.id, body: form })
                  else createMut.mutate(form)
                }}
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
