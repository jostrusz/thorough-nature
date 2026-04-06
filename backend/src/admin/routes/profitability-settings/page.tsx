import React, { useState, useCallback } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "@medusajs/ui"
import { defineRouteConfig } from "@medusajs/admin-sdk"
import { sdk } from "../../lib/sdk"
import { colors, radii, shadows, fontStack, cardStyle, cardHeaderStyle, btnOutline, btnPrimary } from "../../components/orders/design-tokens"

// ═══════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════

function PageStyles() {
  return (
    <style>{`
      @keyframes pfFadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes pfPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
      .pf-card { transition: box-shadow 0.25s ease, border-color 0.25s ease; }
      .pf-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.06); }
      .pf-row { transition: background 0.12s ease; border-radius: 8px; }
      .pf-row:hover { background: #F9FAFB; }
      .pf-btn { transition: all 0.15s ease; cursor: pointer; }
      .pf-btn:hover { background: #F6F6F7 !important; }
      .pf-btn:active { transform: scale(0.97); }
      .pf-btn-primary { transition: all 0.15s ease; cursor: pointer; }
      .pf-btn-primary:hover { filter: brightness(1.1); box-shadow: 0 2px 8px rgba(99,91,255,0.25); }
      .pf-input { transition: border-color 0.2s, box-shadow 0.2s; }
      .pf-input:focus { border-color: #635BFF !important; box-shadow: 0 0 0 3px rgba(99,91,255,0.12); outline: none; }
      .pf-toggle { width: 44px; height: 24px; border-radius: 12px; border: none; cursor: pointer; transition: background 0.2s ease; position: relative; }
      .pf-toggle::after { content: ''; width: 20px; height: 20px; border-radius: 50%; background: #FFF; position: absolute; top: 2px; transition: left 0.2s ease; box-shadow: 0 1px 3px rgba(0,0,0,0.2); }
      .pf-toggle-on { background: #635BFF; }
      .pf-toggle-on::after { left: 22px; }
      .pf-toggle-off { background: #C9CCCF; }
      .pf-toggle-off::after { left: 2px; }
      .pf-badge { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 600; }
      .pf-badge-valid { background: #D4EDDA; color: #155724; }
      .pf-badge-expired { background: #FFF3CD; color: #856404; }
      .pf-badge-error { background: #F8D7DA; color: #721C24; }
      .pf-section { animation: pfFadeIn 0.3s ease; }
      .pf-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.4); z-index: 999; display: flex; align-items: center; justify-content: center; }
      .pf-modal { background: #FFF; border-radius: 14px; width: 560px; max-height: 80vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.2); padding: 24px; }
    `}</style>
  )
}

// ═══════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════

interface ProjectConfig {
  id: string
  project_name: string
  project_slug: string
  flag_emoji: string
  country_tag: string
  sales_channel_id: string | null
  book_cost_eur: number
  shipping_cost_eur: number
  pick_pack_cost_eur: number
  payment_fee_rate: number
  currency_code: string
  meta_ad_account_id: string | null
  domain: string | null
  is_active: boolean
  display_order: number
}

interface MetaAdsConfigResponse {
  config: {
    id: string
    access_token_masked: string | null
    token_status: string
    last_validated_at: string | null
  } | null
}

interface MetaAdAccount {
  id: string
  name: string
  currency: string
  account_status: number
}

// ═══════════════════════════════════════════
// HELPER COMPONENTS
// ═══════════════════════════════════════════

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      className={`pf-toggle ${checked ? "pf-toggle-on" : "pf-toggle-off"}`}
      onClick={onChange}
      disabled={disabled}
      style={{ opacity: disabled ? 0.5 : 1 }}
    />
  )
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  border: `1px solid ${colors.border}`,
  borderRadius: radii.xs,
  fontSize: "13px",
  fontFamily: fontStack,
  color: colors.text,
  background: "#FFF",
}

const labelStyle: React.CSSProperties = {
  fontSize: "12px",
  fontWeight: 600,
  color: colors.textSec,
  marginBottom: "4px",
  display: "block",
}

// ═══════════════════════════════════════════
// META ADS SECTION
// ═══════════════════════════════════════════

function MetaAdsSection() {
  const queryClient = useQueryClient()
  const [tokenInput, setTokenInput] = useState("")
  const [showTokenInput, setShowTokenInput] = useState(false)

  const { data: configData } = useQuery<MetaAdsConfigResponse>({
    queryKey: ["profitability-meta-ads-config"],
    queryFn: () => sdk.client.fetch("/admin/profitability/meta-ads-config"),
  })

  const { data: accountsData } = useQuery<{ accounts: MetaAdAccount[] }>({
    queryKey: ["profitability-meta-ads-accounts"],
    queryFn: () => sdk.client.fetch("/admin/profitability/meta-ads-accounts"),
    enabled: configData?.config?.token_status === "valid",
  })

  const saveToken = useMutation({
    mutationFn: () => sdk.client.fetch("/admin/profitability/meta-ads-config", {
      method: "POST",
      body: { access_token: tokenInput },
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profitability-meta-ads-config"] })
      queryClient.invalidateQueries({ queryKey: ["profitability-meta-ads-accounts"] })
      setShowTokenInput(false)
      setTokenInput("")
      toast.success("Meta Ads token saved")
    },
    onError: (err: any) => toast.error(err.message || "Failed to save token"),
  })

  const validateToken = useMutation({
    mutationFn: () => sdk.client.fetch("/admin/profitability/meta-ads-config/validate", { method: "POST" }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["profitability-meta-ads-config"] })
      queryClient.invalidateQueries({ queryKey: ["profitability-meta-ads-accounts"] })
      if (data.valid) {
        toast.success(`Token valid! ${data.account_count} ad accounts found.`)
      } else {
        toast.error(data.error || "Token validation failed")
      }
    },
    onError: (err: any) => toast.error(err.message || "Validation failed"),
  })

  const config = configData?.config
  const statusBadge = config?.token_status === "valid" ? "pf-badge-valid"
    : config?.token_status === "expired" ? "pf-badge-expired"
    : "pf-badge-error"

  return (
    <div style={cardStyle} className="pf-card pf-section">
      <div style={cardHeaderStyle}>
        <span>🔑 Meta Ads API Token</span>
        <div style={{ display: "flex", gap: "8px" }}>
          {config && (
            <button className="pf-btn" style={btnOutline} onClick={() => validateToken.mutate()}>
              {validateToken.isPending ? "Validating..." : "Validate"}
            </button>
          )}
          <button className="pf-btn" style={btnOutline} onClick={() => setShowTokenInput(!showTokenInput)}>
            {showTokenInput ? "Cancel" : config ? "Update Token" : "Add Token"}
          </button>
        </div>
      </div>

      <div style={{ padding: "16px 20px" }}>
        {config ? (
          <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
            <div>
              <span style={{ fontSize: "12px", color: colors.textMuted }}>Token: </span>
              <code style={{ fontSize: "12px", color: colors.textSec, background: "#F4F5F6", padding: "2px 6px", borderRadius: "4px" }}>
                {config.access_token_masked || "Not set"}
              </code>
            </div>
            <span className={`pf-badge ${statusBadge}`}>
              {config.token_status === "valid" ? "✅ Valid" : config.token_status === "expired" ? "⚠️ Expired" : "❌ Error"}
            </span>
            {config.last_validated_at && (
              <span style={{ fontSize: "11px", color: colors.textMuted }}>
                Last checked: {new Date(config.last_validated_at).toLocaleString()}
              </span>
            )}
            {accountsData?.accounts && (
              <span style={{ fontSize: "11px", color: colors.textMuted }}>
                {accountsData.accounts.length} account{accountsData.accounts.length !== 1 ? "s" : ""} available
              </span>
            )}
          </div>
        ) : (
          <div style={{ fontSize: "13px", color: colors.textMuted }}>
            No Meta Ads token configured. Add one to track ad spend.
          </div>
        )}

        {showTokenInput && (
          <div style={{ marginTop: "12px", display: "flex", gap: "8px" }}>
            <input
              type="password"
              className="pf-input"
              style={{ ...inputStyle, flex: 1 }}
              placeholder="Paste your Meta Ads long-lived access token..."
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
            />
            <button
              className="pf-btn-primary"
              style={btnPrimary}
              onClick={() => saveToken.mutate()}
              disabled={!tokenInput || saveToken.isPending}
            >
              {saveToken.isPending ? "Saving..." : "Save"}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════
// PROJECT EDIT MODAL
// ═══════════════════════════════════════════

function ProjectModal({
  project,
  onClose,
  salesChannels,
  adAccounts,
}: {
  project: ProjectConfig | null // null = create
  onClose: () => void
  salesChannels: any[]
  adAccounts: MetaAdAccount[]
}) {
  const queryClient = useQueryClient()
  const isCreate = !project

  const [form, setForm] = useState({
    project_name: project?.project_name || "",
    project_slug: project?.project_slug || "",
    flag_emoji: project?.flag_emoji || "🏳️",
    country_tag: project?.country_tag || "",
    sales_channel_id: project?.sales_channel_id || "",
    book_cost_eur: project?.book_cost_eur ?? 1.80,
    shipping_cost_eur: project?.shipping_cost_eur ?? 5.00,
    pick_pack_cost_eur: project?.pick_pack_cost_eur ?? 1.50,
    payment_fee_rate: project?.payment_fee_rate ?? 0.03,
    currency_code: project?.currency_code || "EUR",
    meta_ad_account_id: project?.meta_ad_account_id || "",
    domain: project?.domain || "",
    is_active: project?.is_active ?? true,
    display_order: project?.display_order ?? 0,
  })

  const mutation = useMutation({
    mutationFn: () => {
      const body = {
        ...form,
        payment_fee_rate: Number(form.payment_fee_rate),
        book_cost_eur: Number(form.book_cost_eur),
        shipping_cost_eur: Number(form.shipping_cost_eur),
        pick_pack_cost_eur: Number(form.pick_pack_cost_eur),
        currency_code: form.currency_code,
        display_order: Number(form.display_order),
        sales_channel_id: form.sales_channel_id || null,
        meta_ad_account_id: form.meta_ad_account_id || null,
        domain: form.domain || null,
      }
      if (isCreate) {
        return sdk.client.fetch("/admin/profitability/projects", { method: "POST", body })
      }
      return sdk.client.fetch(`/admin/profitability/projects/${project!.id}`, { method: "POST", body })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profitability-projects"] })
      toast.success(isCreate ? "Project created" : "Project updated")
      onClose()
    },
    onError: (err: any) => toast.error(err.message || "Failed to save project"),
  })

  const set = (key: string, val: any) => setForm((prev) => ({ ...prev, [key]: val }))

  return (
    <div className="pf-overlay" onClick={onClose}>
      <div className="pf-modal" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <h2 style={{ fontSize: "17px", fontWeight: 700, color: colors.text, margin: 0 }}>
            {isCreate ? "Add New Project" : `Edit ${project!.project_name}`}
          </h2>
          <button className="pf-btn" style={{ ...btnOutline, padding: "4px 12px" }} onClick={onClose}>✕</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          <div>
            <label style={labelStyle}>Project Name</label>
            <input className="pf-input" style={inputStyle} value={form.project_name} onChange={(e) => set("project_name", e.target.value)} placeholder="Laat Los" />
          </div>
          <div>
            <label style={labelStyle}>Slug (unique)</label>
            <input className="pf-input" style={inputStyle} value={form.project_slug} onChange={(e) => set("project_slug", e.target.value)} placeholder="laat-los-nl" />
          </div>
          <div>
            <label style={labelStyle}>Flag Emoji</label>
            <input className="pf-input" style={inputStyle} value={form.flag_emoji} onChange={(e) => set("flag_emoji", e.target.value)} placeholder="🇳🇱" />
          </div>
          <div>
            <label style={labelStyle}>Country Tag</label>
            <input className="pf-input" style={inputStyle} value={form.country_tag} onChange={(e) => set("country_tag", e.target.value)} placeholder="NL/BE" />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={labelStyle}>Sales Channel</label>
            <select className="pf-input" style={inputStyle} value={form.sales_channel_id} onChange={(e) => set("sales_channel_id", e.target.value)}>
              <option value="">— Select —</option>
              {salesChannels.map((sc: any) => (
                <option key={sc.id} value={sc.id}>{sc.name}</option>
              ))}
            </select>
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={labelStyle}>Domain</label>
            <input className="pf-input" style={inputStyle} value={form.domain} onChange={(e) => set("domain", e.target.value)} placeholder="e.g. loslatenboek.nl" />
          </div>
          <div>
            <label style={labelStyle}>Order Currency</label>
            <select className="pf-input" style={inputStyle} value={form.currency_code} onChange={(e) => set("currency_code", e.target.value)}>
              {["EUR", "CZK", "SEK", "PLN", "USD", "GBP", "HUF"].map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Book Cost (EUR)</label>
            <input className="pf-input" type="number" step="0.01" style={inputStyle} value={form.book_cost_eur} onChange={(e) => set("book_cost_eur", e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Shipping Cost (EUR)</label>
            <input className="pf-input" type="number" step="0.01" style={inputStyle} value={form.shipping_cost_eur} onChange={(e) => set("shipping_cost_eur", e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Pick & Pack (EUR)</label>
            <input className="pf-input" type="number" step="0.01" style={inputStyle} value={form.pick_pack_cost_eur} onChange={(e) => set("pick_pack_cost_eur", e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Payment Fee (%)</label>
            <input className="pf-input" type="number" step="0.01" style={inputStyle} value={(Number(form.payment_fee_rate) * 100).toFixed(1)} onChange={(e) => set("payment_fee_rate", Number(e.target.value) / 100)} />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={labelStyle}>Meta Ads Account</label>
            <select className="pf-input" style={inputStyle} value={form.meta_ad_account_id} onChange={(e) => set("meta_ad_account_id", e.target.value)}>
              <option value="">— None —</option>
              {adAccounts.map((acc) => (
                <option key={acc.id} value={acc.id}>{acc.name} ({acc.id})</option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Display Order</label>
            <input className="pf-input" type="number" style={inputStyle} value={form.display_order} onChange={(e) => set("display_order", e.target.value)} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", paddingTop: "18px" }}>
            <label style={{ ...labelStyle, marginBottom: 0 }}>Active</label>
            <Toggle checked={form.is_active} onChange={() => set("is_active", !form.is_active)} />
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "20px", paddingTop: "16px", borderTop: `1px solid ${colors.border}` }}>
          <button className="pf-btn" style={btnOutline} onClick={onClose}>Cancel</button>
          <button
            className="pf-btn-primary"
            style={{ ...btnPrimary, opacity: mutation.isPending ? 0.7 : 1 }}
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !form.project_name || !form.project_slug}
          >
            {mutation.isPending ? "Saving..." : isCreate ? "Create Project" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════
// PROJECTS LIST SECTION
// ═══════════════════════════════════════════

function ProjectsSection() {
  const queryClient = useQueryClient()
  const [editProject, setEditProject] = useState<ProjectConfig | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  const { data: projectsData, isLoading } = useQuery<{ projects: ProjectConfig[] }>({
    queryKey: ["profitability-projects"],
    queryFn: () => sdk.client.fetch("/admin/profitability/projects"),
  })

  const { data: channelsData } = useQuery<{ sales_channels: any[] }>({
    queryKey: ["sales-channels"],
    queryFn: () => sdk.client.fetch("/admin/sales-channels"),
  })

  const { data: accountsData } = useQuery<{ accounts: MetaAdAccount[] }>({
    queryKey: ["profitability-meta-ads-accounts"],
    queryFn: () => sdk.client.fetch("/admin/profitability/meta-ads-accounts"),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => sdk.client.fetch(`/admin/profitability/projects/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profitability-projects"] })
      toast.success("Project deleted")
    },
    onError: (err: any) => toast.error(err.message || "Delete failed"),
  })

  const projects = projectsData?.projects || []
  const salesChannels = channelsData?.sales_channels || []
  const adAccounts = accountsData?.accounts || []

  // Map sales channel ID to name
  const channelMap = new Map(salesChannels.map((sc: any) => [sc.id, sc.name]))

  return (
    <div style={cardStyle} className="pf-card pf-section">
      <div style={cardHeaderStyle}>
        <span>📊 Projects ({projects.length})</span>
        <button className="pf-btn-primary" style={btnPrimary} onClick={() => setShowCreate(true)}>
          + Add New
        </button>
      </div>

      <div style={{ padding: "8px 12px" }}>
        {isLoading ? (
          <div style={{ padding: "24px", textAlign: "center", color: colors.textMuted, fontSize: "13px" }}>
            Loading projects...
          </div>
        ) : projects.length === 0 ? (
          <div style={{ padding: "24px", textAlign: "center", color: colors.textMuted, fontSize: "13px" }}>
            No projects configured yet. Click "Add New" to create your first project.
          </div>
        ) : (
          projects.map((p) => (
            <div key={p.id} className="pf-row" style={{ display: "flex", alignItems: "center", padding: "12px 8px", borderBottom: `1px solid ${colors.border}` }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                  <span style={{ fontSize: "16px" }}>{p.flag_emoji}</span>
                  <span style={{ fontSize: "14px", fontWeight: 600, color: colors.text }}>{p.project_name}</span>
                  <span style={{ fontSize: "11px", color: colors.textMuted, background: "#F4F5F6", padding: "1px 6px", borderRadius: "4px" }}>
                    {p.country_tag}
                  </span>
                  {!p.is_active && (
                    <span className="pf-badge pf-badge-error">Inactive</span>
                  )}
                </div>
                <div style={{ display: "flex", gap: "16px", fontSize: "11px", color: colors.textMuted, paddingLeft: "28px" }}>
                  <span>Currency: {p.currency_code || "EUR"}</span>
                  <span>Sales: {channelMap.get(p.sales_channel_id || "") || "—"}</span>
                  <span>Book: {fmtEur(p.book_cost_eur)}</span>
                  <span>Ship: {fmtEur(p.shipping_cost_eur)}</span>
                  <span>P&P: {fmtEur(p.pick_pack_cost_eur)}</span>
                  <span>Fee: {(Number(p.payment_fee_rate) * 100).toFixed(1)}%</span>
                  <span>Ads: {p.meta_ad_account_id || "—"}</span>
                </div>
              </div>
              <div style={{ display: "flex", gap: "6px" }}>
                <button className="pf-btn" style={{ ...btnOutline, padding: "4px 12px", fontSize: "12px" }} onClick={() => setEditProject(p)}>Edit</button>
                <button
                  className="pf-btn"
                  style={{ ...btnOutline, padding: "4px 12px", fontSize: "12px", color: colors.red }}
                  onClick={() => {
                    if (confirm(`Delete ${p.project_name}?`)) {
                      deleteMutation.mutate(p.id)
                    }
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {(showCreate || editProject) && (
        <ProjectModal
          project={editProject}
          onClose={() => { setEditProject(null); setShowCreate(false) }}
          salesChannels={salesChannels}
          adAccounts={adAccounts}
        />
      )}
    </div>
  )
}

// ═══════════════════════════════════════════
// FORMAT HELPERS
// ═══════════════════════════════════════════

function fmtEur(value: number | string): string {
  const num = Number(value)
  if (isNaN(num)) return "—"
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(num)
}

// ═══════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════

const ProfitabilitySettingsPage = () => {
  return (
    <div style={{ maxWidth: "960px", margin: "0 auto", padding: "24px 16px", fontFamily: fontStack }}>
      <PageStyles />

      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "22px", fontWeight: 700, color: colors.text, margin: "0 0 4px 0" }}>
          Profitability Settings
        </h1>
        <p style={{ fontSize: "13px", color: colors.textMuted, margin: 0 }}>
          Configure project costs, Meta Ads integration, and profitability tracking.
        </p>
      </div>

      <MetaAdsSection />
      <ProjectsSection />
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Profitability",
})

export default ProfitabilitySettingsPage
