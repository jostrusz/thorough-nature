import React, { useState, useCallback } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "@medusajs/ui"
import { defineRouteConfig } from "@medusajs/admin-sdk"
import { sdk } from "../../lib/sdk"
import {
  PaymentMethodIcon,
  PAYMENT_METHODS_BY_PROVIDER,
  SUPPORTED_PROVIDERS,
  SUPPORTED_CURRENCIES,
  type PaymentMethodDef,
} from "../../components/billing/payment-method-icons"

// ═══════════════════════════════════════════
// PAGE STYLES
// ═══════════════════════════════════════════

function PageStyles() {
  return (
    <style>{`
      @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
      .bp-card { transition: box-shadow 0.25s ease, border-color 0.25s ease; border: 1px solid #E1E3E5; border-radius: 10px; background: #FFF; }
      .bp-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.06); border-color: #D2D5D8; }
      .bp-btn { transition: all 0.15s ease; cursor: pointer; }
      .bp-btn:hover { background: #F6F6F7 !important; }
      .bp-btn:active { transform: scale(0.97); }
      .bp-btn-primary { transition: all 0.15s ease; cursor: pointer; }
      .bp-btn-primary:hover { filter: brightness(1.1); box-shadow: 0 2px 8px rgba(0,128,96,0.25); }
      .bp-input { transition: border-color 0.2s, box-shadow 0.2s; }
      .bp-input:focus { border-color: #008060 !important; box-shadow: 0 0 0 3px rgba(0,128,96,0.12); outline: none; }
      .bp-toggle { width: 40px; height: 22px; border-radius: 11px; border: none; cursor: pointer; transition: background 0.2s ease; position: relative; }
      .bp-toggle::after { content: ''; width: 18px; height: 18px; border-radius: 50%; background: #FFF; position: absolute; top: 2px; transition: left 0.2s ease; box-shadow: 0 1px 3px rgba(0,0,0,0.2); }
      .bp-toggle-on { background: #008060; }
      .bp-toggle-on::after { left: 20px; }
      .bp-toggle-off { background: #C9CCCF; }
      .bp-toggle-off::after { left: 2px; }
      .bp-section-enter { animation: fadeIn 0.3s ease; }
      .bp-method-row { transition: background 0.12s ease; border-radius: 6px; }
      .bp-method-row:hover { background: #F9FAFB; }
    `}</style>
  )
}

// ═══════════════════════════════════════════
// HOOKS
// ═══════════════════════════════════════════

function useBillingEntities() {
  return useQuery({
    queryKey: ["billing-entities"],
    queryFn: () =>
      sdk.client.fetch<{ billing_entities: any[] }>("/admin/billing-entities", {
        method: "GET",
      }),
  })
}

function useGatewayConfigs() {
  return useQuery({
    queryKey: ["gateway-configs"],
    queryFn: () =>
      sdk.client.fetch<{ gateway_configs: any[] }>("/admin/gateway-configs", {
        method: "GET",
      }),
  })
}

// ═══════════════════════════════════════════
// TOGGLE SWITCH COMPONENT
// ═══════════════════════════════════════════
function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean
  onChange: () => void
  disabled?: boolean
}) {
  return (
    <button
      className={`bp-toggle ${checked ? "bp-toggle-on" : "bp-toggle-off"}`}
      onClick={onChange}
      disabled={disabled}
      style={{ opacity: disabled ? 0.5 : 1 }}
    />
  )
}

// ═══════════════════════════════════════════
// TAB NAVIGATION
// ═══════════════════════════════════════════
type TabId = "companies" | "gateways" | "quickswitch"

function TabNav({
  active,
  onChange,
}: {
  active: TabId
  onChange: (id: TabId) => void
}) {
  const tabs: { id: TabId; label: string; icon: string }[] = [
    { id: "companies", label: "Companies", icon: "\uD83C\uDFE2" },
    { id: "gateways", label: "Payment Gateways", icon: "\uD83D\uDCB3" },
    { id: "quickswitch", label: "Quick Switch", icon: "\u26A1" },
  ]

  return (
    <div
      style={{
        display: "flex",
        gap: "2px",
        background: "#F6F6F7",
        borderRadius: "8px",
        padding: "3px",
        marginBottom: "24px",
      }}
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
            padding: "8px 16px",
            borderRadius: "6px",
            fontSize: "13px",
            fontWeight: active === tab.id ? 600 : 400,
            cursor: "pointer",
            border: "none",
            background: active === tab.id ? "#FFFFFF" : "transparent",
            color: active === tab.id ? "#1A1A1A" : "#6D7175",
            boxShadow: active === tab.id ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
            transition: "all 0.15s ease",
          }}
        >
          <span>{tab.icon}</span>
          {tab.label}
        </button>
      ))}
    </div>
  )
}

// ═══════════════════════════════════════════
// COMPANIES TAB
// ═══════════════════════════════════════════
function CompaniesTab() {
  const { data, isLoading } = useBillingEntities()
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const emptyForm = {
    name: "", legal_name: "", country_code: "", tax_id: "", vat_id: "",
    registration_id: "", email: "", invoicing_system: "", is_default: false,
  }
  const [form, setForm] = useState(emptyForm)
  const [editForm, setEditForm] = useState(emptyForm)

  const createMutation = useMutation({
    mutationFn: (data: Record<string, any>) =>
      sdk.client.fetch("/admin/billing-entities", { method: "POST", body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billing-entities"] })
      toast.success("Company created")
      setShowForm(false)
      setForm(emptyForm)
    },
    onError: () => toast.error("Failed to create company"),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, any> }) =>
      sdk.client.fetch(`/admin/billing-entities/${id}`, { method: "POST", body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billing-entities"] })
      toast.success("Company updated")
      setEditingId(null)
    },
    onError: () => toast.error("Failed to update company"),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      sdk.client.fetch(`/admin/billing-entities/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billing-entities"] })
      toast.success("Company deleted")
    },
  })

  const setDefaultMutation = useMutation({
    mutationFn: async (id: string) => {
      // Unset all others first, then set the selected one
      for (const e of entities) {
        if (e.id !== id && e.is_default) {
          await sdk.client.fetch(`/admin/billing-entities/${e.id}`, { method: "POST", body: { is_default: false } })
        }
      }
      await sdk.client.fetch(`/admin/billing-entities/${id}`, { method: "POST", body: { is_default: true } })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billing-entities"] })
      toast.success("Default company updated")
    },
  })

  const entities = (data as any)?.billing_entities || []

  const FLAGS: Record<string, string> = {
    cz: "\uD83C\uDDE8\uD83C\uDDFF", ee: "\uD83C\uDDEA\uD83C\uDDEA", nl: "\uD83C\uDDF3\uD83C\uDDF1",
    de: "\uD83C\uDDE9\uD83C\uDDEA", pl: "\uD83C\uDDF5\uD83C\uDDF1", sk: "\uD83C\uDDF8\uD83C\uDDF0",
    be: "\uD83C\uDDE7\uD83C\uDDEA", at: "\uD83C\uDDE6\uD83C\uDDF9", se: "\uD83C\uDDF8\uD83C\uDDEA",
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "7px 10px", border: "1px solid #E1E3E5",
    borderRadius: "6px", fontSize: "13px", boxSizing: "border-box", fontFamily: "inherit",
  }
  const lblStyle: React.CSSProperties = {
    fontSize: "11px", fontWeight: 600, color: "#6D7175", textTransform: "uppercase", marginBottom: "4px", display: "block",
  }

  function startEditing(entity: any) {
    setEditingId(entity.id)
    setEditForm({
      name: entity.name || "",
      legal_name: entity.legal_name || "",
      country_code: entity.country_code || "",
      tax_id: entity.tax_id || "",
      vat_id: entity.vat_id || "",
      registration_id: entity.registration_id || "",
      email: entity.email || "",
      invoicing_system: entity.invoicing_system || "",
      is_default: entity.is_default || false,
    })
  }

  function renderForm(f: any, setF: (v: any) => void, isEdit = false) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        <div>
          <label style={lblStyle}>Company Name *</label>
          <input className="bp-input" style={inputStyle} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Performance Marketing Solution s.r.o." />
        </div>
        <div>
          <label style={lblStyle}>Legal Name</label>
          <input className="bp-input" style={inputStyle} value={f.legal_name} onChange={(e) => setF({ ...f, legal_name: e.target.value })} placeholder="Same as company name" />
        </div>
        <div>
          <label style={lblStyle}>Country *</label>
          <select className="bp-input" style={{ ...inputStyle, background: "#FFF" }} value={f.country_code} onChange={(e) => setF({ ...f, country_code: e.target.value })}>
            <option value="">Select country</option>
            <option value="cz">Czech Republic</option>
            <option value="ee">Estonia</option>
            <option value="nl">Netherlands</option>
            <option value="de">Germany</option>
            <option value="pl">Poland</option>
            <option value="sk">Slovakia</option>
            <option value="be">Belgium</option>
            <option value="at">Austria</option>
            <option value="se">Sweden</option>
          </select>
        </div>
        <div>
          <label style={lblStyle}>Email</label>
          <input className="bp-input" style={inputStyle} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} type="email" placeholder="info@company.com" />
        </div>
        <div>
          <label style={lblStyle}>Tax ID (Reg. No.)</label>
          <input className="bp-input" style={inputStyle} value={f.tax_id} onChange={(e) => setF({ ...f, tax_id: e.target.value })} placeholder="06259928" />
        </div>
        <div>
          <label style={lblStyle}>VAT ID</label>
          <input className="bp-input" style={inputStyle} value={f.vat_id} onChange={(e) => setF({ ...f, vat_id: e.target.value })} placeholder="CZ06259928" />
        </div>
        <div>
          <label style={lblStyle}>Invoicing System *</label>
          <select className="bp-input" style={{ ...inputStyle, background: "#FFF" }} value={f.invoicing_system} onChange={(e) => setF({ ...f, invoicing_system: e.target.value })}>
            <option value="">None</option>
            <option value="fakturoid">Fakturoid</option>
            <option value="quickbooks">QuickBooks</option>
          </select>
        </div>
        <div>
          <label style={lblStyle}>Registration ID</label>
          <input className="bp-input" style={inputStyle} value={f.registration_id} onChange={(e) => setF({ ...f, registration_id: e.target.value })} placeholder="Optional" />
        </div>
      </div>
    )
  }

  return (
    <div className="bp-section-enter">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <h2 style={{ fontSize: "16px", fontWeight: 600, margin: 0 }}>Companies (Billing Entities)</h2>
        <button
          onClick={() => { setShowForm(!showForm); setEditingId(null) }}
          className="bp-btn-primary"
          style={{ padding: "7px 14px", borderRadius: "6px", fontSize: "13px", fontWeight: 500, border: "none", background: "#008060", color: "#FFF" }}
        >
          {showForm ? "Cancel" : "+ Add Company"}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bp-card bp-section-enter" style={{ padding: "20px", marginBottom: "16px" }}>
          {renderForm(form, setForm)}
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "16px" }}>
            <button
              onClick={() => createMutation.mutate(form)}
              disabled={!form.name || createMutation.isPending}
              className="bp-btn-primary"
              style={{ padding: "7px 16px", borderRadius: "6px", fontSize: "13px", fontWeight: 500, border: "none", background: "#008060", color: "#FFF", opacity: !form.name ? 0.5 : 1 }}
            >
              {createMutation.isPending ? "Creating..." : "Create Company"}
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <p style={{ color: "#8C9196", fontSize: "13px" }}>Loading...</p>
      ) : entities.length === 0 ? (
        <div className="bp-card" style={{ padding: "40px", textAlign: "center", color: "#8C9196" }}>
          <p style={{ fontSize: "14px" }}>No companies configured yet</p>
          <p style={{ fontSize: "12px" }}>Add your billing entities to start configuring payment gateways</p>
        </div>
      ) : (
        entities.map((entity: any) => {
          const isEditing = editingId === entity.id
          return (
            <div key={entity.id} className="bp-card" style={{ padding: "16px 20px", marginBottom: "12px" }}>
              {isEditing ? (
                /* ═══ EDIT MODE ═══ */
                <div className="bp-section-enter">
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
                    <span style={{ fontSize: "18px" }}>{FLAGS[editForm.country_code] || "\uD83C\uDFF3\uFE0F"}</span>
                    <span style={{ fontSize: "14px", fontWeight: 600, color: "#1A1A1A" }}>Editing: {entity.name}</span>
                  </div>
                  {renderForm(editForm, setEditForm, true)}
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "16px" }}>
                    <button onClick={() => setEditingId(null)} className="bp-btn" style={{ padding: "5px 14px", borderRadius: "6px", fontSize: "12px", border: "1px solid #E1E3E5", background: "#FFF", color: "#6D7175" }}>
                      Cancel
                    </button>
                    <button
                      onClick={() => updateMutation.mutate({ id: entity.id, data: editForm })}
                      disabled={!editForm.name || updateMutation.isPending}
                      className="bp-btn-primary"
                      style={{ padding: "5px 14px", borderRadius: "6px", fontSize: "12px", fontWeight: 500, border: "none", background: "#008060", color: "#FFF", opacity: !editForm.name ? 0.5 : 1 }}
                    >
                      {updateMutation.isPending ? "Saving..." : "Save Changes"}
                    </button>
                  </div>
                </div>
              ) : (
                /* ═══ VIEW MODE ═══ */
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "18px" }}>{FLAGS[entity.country_code] || "\uD83C\uDFF3\uFE0F"}</span>
                      <span style={{ fontSize: "14px", fontWeight: 600, color: "#1A1A1A" }}>{entity.name}</span>
                      {entity.is_default && (
                        <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "10px", background: "#AEE9D1", color: "#0D5740", fontWeight: 600 }}>DEFAULT</span>
                      )}
                    </div>
                    <div style={{ fontSize: "12px", color: "#6D7175", marginTop: "4px", display: "flex", flexWrap: "wrap", gap: "4px 12px", alignItems: "center" }}>
                      {entity.tax_id && <span>Reg. No: {entity.tax_id}</span>}
                      {entity.vat_id && <span>VAT: {entity.vat_id}</span>}
                      {entity.email && <span>{entity.email}</span>}
                      {entity.invoicing_system && (
                        <span style={{ padding: "1px 8px", borderRadius: "10px", fontSize: "11px", fontWeight: 600, background: entity.invoicing_system === "fakturoid" ? "#DBEAFE" : "#E0E7FF", color: entity.invoicing_system === "fakturoid" ? "#1D4ED8" : "#4338CA" }}>
                          {entity.invoicing_system === "fakturoid" ? "Fakturoid" : "QuickBooks"}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    {!entity.is_default && (
                      <button
                        onClick={() => setDefaultMutation.mutate(entity.id)}
                        disabled={setDefaultMutation.isPending}
                        className="bp-btn"
                        style={{ padding: "4px 10px", borderRadius: "6px", fontSize: "12px", border: "1px solid #008060", background: "#FFF", color: "#008060" }}
                      >
                        Set Default
                      </button>
                    )}
                    <button
                      onClick={() => startEditing(entity)}
                      className="bp-btn"
                      style={{ padding: "4px 10px", borderRadius: "6px", fontSize: "12px", border: "1px solid #E1E3E5", background: "#FFF", color: "#1A1A1A" }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => { if (confirm(`Delete ${entity.name}?`)) deleteMutation.mutate(entity.id) }}
                      className="bp-btn"
                      style={{ padding: "4px 10px", borderRadius: "6px", fontSize: "12px", border: "1px solid #FED3D1", background: "#FFF", color: "#D72C0D" }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })
      )}
    </div>
  )
}

// ═══════════════════════════════════════════
// GATEWAYS TAB
// ═══════════════════════════════════════════
function GatewaysTab() {
  const { data: gwData, isLoading: gwLoading } = useGatewayConfigs()
  const { data: beData } = useBillingEntities()
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [expandedGw, setExpandedGw] = useState<string | null>(null)
  const [editingGw, setEditingGw] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<any>({})

  const [form, setForm] = useState({
    provider: "",
    display_name: "",
    billing_entity_id: "",
    mode: "test",
    priority: 1,
    supported_currencies: [] as string[],
    live_keys: { api_key: "", secret_key: "", webhook_secret: "" },
    test_keys: { api_key: "", secret_key: "", webhook_secret: "" },
    selected_methods: [] as string[],
    project_slugs: "",
  })

  const createMutation = useMutation({
    mutationFn: (data: Record<string, any>) =>
      sdk.client.fetch("/admin/gateway-configs", { method: "POST", body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gateway-configs"] })
      toast.success("Payment gateway created")
      setShowForm(false)
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error || err?.message || "Unknown error"
      toast.error(`Failed to create gateway: ${msg}`)
      console.error("[Gateway Create Error]", err?.response?.data || err)
    },
  })

  const toggleMutation = useMutation({
    mutationFn: (id: string) =>
      sdk.client.fetch(`/admin/gateway-configs/${id}/toggle`, { method: "POST" }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["gateway-configs"] })
      toast.success((data as any)?.message || "Gateway toggled")
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      sdk.client.fetch(`/admin/gateway-configs/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gateway-configs"] })
      toast.success("Gateway deleted")
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, any> }) =>
      sdk.client.fetch(`/admin/gateway-configs/${id}`, { method: "POST", body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gateway-configs"] })
      toast.success("Gateway updated")
      setEditingGw(null)
    },
    onError: () => toast.error("Failed to update gateway"),
  })

  const startEditing = (gw: any) => {
    setEditingGw(gw.id)
    setEditForm({
      provider: gw.provider,
      display_name: gw.display_name || "",
      billing_entity_id: gw.billing_entity_id || "",
      mode: gw.mode || "test",
      priority: gw.priority || 1,
      supported_currencies: gw.supported_currencies || [],
      live_keys: gw.live_keys || { api_key: "", secret_key: "", webhook_secret: "" },
      test_keys: gw.test_keys || { api_key: "", secret_key: "", webhook_secret: "" },
      selected_methods: (gw.payment_methods || [])
        .filter((m: any) => m.is_active)
        .sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0))
        .map((m: any) => m.code),
      project_slugs: (gw.project_slugs || []).join(", "),
      metadata: gw.metadata || {},
    })
  }

  const handleUpdate = async (gwId: string) => {
    try {
      // 1. Update gateway config fields (excluding selected_methods and project_slugs string)
      const { selected_methods, project_slugs, metadata, provider: _provider, ...gatewayData } = editForm

      // Parse project_slugs from comma-separated string to JSON array
      const slugsArray = project_slugs
        ? (project_slugs as string).split(",").map((s: string) => s.trim()).filter(Boolean)
        : []

      await sdk.client.fetch(`/admin/gateway-configs/${gwId}`, {
        method: "POST",
        body: {
          ...gatewayData,
          project_slugs: slugsArray.length > 0 ? slugsArray : null,
          metadata: metadata && Object.keys(metadata).length > 0 ? metadata : null,
        },
      })

      // 2. Update payment methods via the methods endpoint
      if (selected_methods && selected_methods.length > 0) {
        const gw = gateways.find((g: any) => g.id === gwId)
        const providerMethods: PaymentMethodDef[] = PAYMENT_METHODS_BY_PROVIDER[gw?.provider] || []
        const methods = selected_methods.map((code: string, i: number) => {
          const methodDef = providerMethods.find((m) => m.code === code)
          return {
            code,
            display_name: methodDef?.name || code,
            icon: methodDef?.icon || code,
            is_active: true,
            sort_order: i,
            available_countries: methodDef?.available_countries || [],
            supported_currencies: methodDef?.supported_currencies || [],
            config: code === "creditcard" ? { type: "embedded" } : null,
          }
        })

        await sdk.client.fetch(`/admin/gateway-configs/${gwId}/methods`, {
          method: "POST",
          body: { methods },
        })
      }

      queryClient.invalidateQueries({ queryKey: ["gateway-configs"] })
      toast.success("Gateway updated")
      setEditingGw(null)
    } catch {
      toast.error("Failed to update gateway")
    }
  }

  const gateways = (gwData as any)?.gateway_configs || []
  const billingEntities = (beData as any)?.billing_entities || []
  const availableMethods = PAYMENT_METHODS_BY_PROVIDER[form.provider] || []

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "7px 10px",
    border: "1px solid #E1E3E5",
    borderRadius: "6px",
    fontSize: "13px",
    boxSizing: "border-box",
    fontFamily: "inherit",
  }

  function handleCreate() {
    const methods = form.selected_methods.map((code, i) => {
      const methodDef = availableMethods.find((m) => m.code === code)
      return {
        code,
        display_name: methodDef?.name || code,
        icon: methodDef?.icon || code,
        is_active: true,
        sort_order: i,
        supported_currencies: form.supported_currencies,
        available_countries: methodDef?.available_countries || [],
        // Mark creditcard as embedded type for inline card fields
        config: code === "creditcard" ? { type: "embedded" } : null,
      }
    })

    // Parse project_slugs from comma-separated string to JSON array
    const slugsArray = form.project_slugs
      ? form.project_slugs.split(",").map((s) => s.trim()).filter(Boolean)
      : []

    createMutation.mutate({
      provider: form.provider,
      display_name: form.display_name,
      billing_entity_id: form.billing_entity_id || null,
      mode: form.mode,
      priority: Number(form.priority) || 1,
      supported_currencies: form.supported_currencies,
      is_active: false,
      live_keys: form.live_keys,
      test_keys: form.test_keys,
      payment_methods: methods,
      project_slugs: slugsArray.length > 0 ? slugsArray : null,
    })
  }

  function toggleCurrency(c: string) {
    setForm((f) => ({
      ...f,
      supported_currencies: f.supported_currencies.includes(c)
        ? f.supported_currencies.filter((x) => x !== c)
        : [...f.supported_currencies, c],
    }))
  }

  function toggleMethod(code: string) {
    setForm((f) => ({
      ...f,
      selected_methods: f.selected_methods.includes(code)
        ? f.selected_methods.filter((x) => x !== code)
        : [...f.selected_methods, code],
    }))
  }

  return (
    <div className="bp-section-enter">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <h2 style={{ fontSize: "16px", fontWeight: 600, margin: 0 }}>Payment Gateways</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bp-btn-primary"
          style={{ padding: "7px 14px", borderRadius: "6px", fontSize: "13px", fontWeight: 500, border: "none", background: "#008060", color: "#FFF" }}
        >
          {showForm ? "Cancel" : "+ Add Gateway"}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bp-card bp-section-enter" style={{ padding: "20px", marginBottom: "16px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            {/* Provider */}
            <div>
              <label style={{ fontSize: "11px", fontWeight: 600, color: "#6D7175", textTransform: "uppercase" }}>Provider</label>
              <select className="bp-input" style={{ ...inputStyle, background: "#FFF" }} value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value, selected_methods: [], display_name: SUPPORTED_PROVIDERS.find((p) => p.code === e.target.value)?.name || "" })}>
                <option value="">Select provider</option>
                {SUPPORTED_PROVIDERS.map((p) => (
                  <option key={p.code} value={p.code}>{p.name}</option>
                ))}
              </select>
            </div>
            {/* Display name */}
            <div>
              <label style={{ fontSize: "11px", fontWeight: 600, color: "#6D7175", textTransform: "uppercase" }}>Display Name</label>
              <input className="bp-input" style={inputStyle} value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} placeholder="Stripe EU" />
            </div>
            {/* Company */}
            <div>
              <label style={{ fontSize: "11px", fontWeight: 600, color: "#6D7175", textTransform: "uppercase" }}>Billing Company</label>
              <select className="bp-input" style={{ ...inputStyle, background: "#FFF" }} value={form.billing_entity_id} onChange={(e) => setForm({ ...form, billing_entity_id: e.target.value })}>
                <option value="">None</option>
                {billingEntities.map((be: any) => (
                  <option key={be.id} value={be.id}>{be.name}</option>
                ))}
              </select>
            </div>
            {/* Priority */}
            <div>
              <label style={{ fontSize: "11px", fontWeight: 600, color: "#6D7175", textTransform: "uppercase" }}>Priority (1 = primary)</label>
              <input className="bp-input" style={inputStyle} type="number" min={1} value={form.priority} onChange={(e) => setForm({ ...form, priority: parseInt(e.target.value) || 1 })} />
            </div>
            {/* Mode */}
            <div>
              <label style={{ fontSize: "11px", fontWeight: 600, color: "#6D7175", textTransform: "uppercase" }}>Mode</label>
              <select className="bp-input" style={{ ...inputStyle, background: "#FFF" }} value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}>
                <option value="test">Test</option>
                <option value="live">Live</option>
              </select>
            </div>
          </div>

          {/* Project Slugs */}
          <div style={{ marginTop: "12px" }}>
            <label style={{ fontSize: "11px", fontWeight: 600, color: "#6D7175", textTransform: "uppercase", marginBottom: "4px", display: "block" }}>Project Slugs</label>
            <input className="bp-input" style={inputStyle} value={form.project_slugs} onChange={(e) => setForm({ ...form, project_slugs: e.target.value })} placeholder="loslatenboek, other-project (comma-separated, empty = all projects)" />
            <span style={{ fontSize: "11px", color: "#8C9196", marginTop: "2px", display: "block" }}>Leave empty to make available for all projects</span>
          </div>

          {/* Currencies */}
          <div style={{ marginTop: "16px" }}>
            <label style={{ fontSize: "11px", fontWeight: 600, color: "#6D7175", textTransform: "uppercase", marginBottom: "8px", display: "block" }}>Supported Currencies</label>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {SUPPORTED_CURRENCIES.map((c) => (
                <button
                  key={c}
                  onClick={() => toggleCurrency(c)}
                  style={{
                    padding: "4px 12px",
                    borderRadius: "16px",
                    fontSize: "12px",
                    fontWeight: 500,
                    cursor: "pointer",
                    border: form.supported_currencies.includes(c) ? "1px solid #008060" : "1px solid #E1E3E5",
                    background: form.supported_currencies.includes(c) ? "#D1FAE5" : "#FFF",
                    color: form.supported_currencies.includes(c) ? "#0D5740" : "#6D7175",
                    transition: "all 0.15s ease",
                  }}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Payment Methods Selection */}
          {form.provider && (
            <div style={{ marginTop: "16px" }}>
              <label style={{ fontSize: "11px", fontWeight: 600, color: "#6D7175", textTransform: "uppercase", marginBottom: "8px", display: "block" }}>
                Payment Methods ({form.selected_methods.length} selected)
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px" }}>
                {availableMethods.map((method) => {
                  const selected = form.selected_methods.includes(method.code)
                  return (
                    <button
                      key={method.code}
                      onClick={() => toggleMethod(method.code)}
                      className="bp-method-row"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "8px 10px",
                        border: selected ? "1.5px solid #008060" : "1px solid #E1E3E5",
                        borderRadius: "6px",
                        background: selected ? "#F0FFF8" : "#FFF",
                        cursor: "pointer",
                        fontSize: "12px",
                        fontWeight: selected ? 600 : 400,
                        color: "#1A1A1A",
                        textAlign: "left",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <PaymentMethodIcon code={method.icon} size={20} />
                      {method.name}
                    </button>
                  )
                })}
              </div>

              {/* Reorder selected methods */}
              {form.selected_methods.length > 1 && (
                <div style={{ marginTop: "10px" }}>
                  <label style={{ fontSize: "10px", color: "#8C9196", marginBottom: "4px", display: "block" }}>Display order (drag to reorder)</label>
                  {form.selected_methods.map((code: string, idx: number) => {
                    const methodDef = availableMethods.find((m: any) => m.code === code)
                    return (
                      <div key={code} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "5px 8px", background: idx % 2 === 0 ? "#FAFAFA" : "#FFF", borderRadius: "4px", marginBottom: "2px" }}>
                        <span style={{ fontSize: "11px", color: "#8C9196", minWidth: "18px" }}>{idx + 1}.</span>
                        <PaymentMethodIcon code={methodDef?.icon || code} size={16} />
                        <span style={{ fontSize: "12px", flex: 1 }}>{methodDef?.name || code}</span>
                        <button disabled={idx === 0} onClick={() => { const arr = [...form.selected_methods]; [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]]; setForm({ ...form, selected_methods: arr }); }} style={{ border: "none", background: "none", cursor: idx === 0 ? "default" : "pointer", opacity: idx === 0 ? 0.3 : 1, fontSize: "14px", padding: "2px 4px" }}>▲</button>
                        <button disabled={idx === form.selected_methods.length - 1} onClick={() => { const arr = [...form.selected_methods]; [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]]; setForm({ ...form, selected_methods: arr }); }} style={{ border: "none", background: "none", cursor: idx === form.selected_methods.length - 1 ? "default" : "pointer", opacity: idx === form.selected_methods.length - 1 ? 0.3 : 1, fontSize: "14px", padding: "2px 4px" }}>▼</button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* API Keys */}
          <div style={{ marginTop: "16px" }}>
            <label style={{ fontSize: "11px", fontWeight: 600, color: "#6D7175", textTransform: "uppercase", marginBottom: "8px", display: "block" }}>
              {form.mode === "live" ? "Live" : "Test"} API Keys
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              <div>
                <label style={{ fontSize: "10px", color: "#8C9196" }}>{form.provider === "paypal" || form.provider === "airwallex" ? "Client ID" : form.provider === "stripe" ? "Secret Key (sk_...)" : "API Key"}</label>
                <input
                  className="bp-input"
                  style={{ ...inputStyle, fontFamily: "monospace", fontSize: "12px" }}
                  value={form.mode === "live" ? form.live_keys.api_key : form.test_keys.api_key}
                  onChange={(e) => {
                    const keys = form.mode === "live" ? "live_keys" : "test_keys"
                    setForm({ ...form, [keys]: { ...form[keys], api_key: e.target.value } })
                  }}
                  placeholder={form.provider === "paypal" ? (form.mode === "live" ? "AeLj..." : "AeSb...") : form.provider === "airwallex" ? "TdKbaP15STeWzSwX..." : form.provider === "stripe" ? (form.mode === "live" ? "sk_live_..." : "sk_test_...") : (form.mode === "live" ? "live_..." : "test_...")}
                />
              </div>
              <div>
                <label style={{ fontSize: "10px", color: "#8C9196" }}>{form.provider === "paypal" ? "Client Secret" : form.provider === "airwallex" ? "API Key" : form.provider === "stripe" ? "Webhook Secret (whsec_...)" : "Secret Key"}</label>
                <input
                  className="bp-input"
                  style={{ ...inputStyle, fontFamily: "monospace", fontSize: "12px" }}
                  type="password"
                  value={form.mode === "live" ? form.live_keys.secret_key : form.test_keys.secret_key}
                  onChange={(e) => {
                    const keys = form.mode === "live" ? "live_keys" : "test_keys"
                    setForm({ ...form, [keys]: { ...form[keys], secret_key: e.target.value } })
                  }}
                  placeholder={form.provider === "paypal" ? "EKd8..." : form.provider === "airwallex" ? "e310add9dc32..." : form.provider === "stripe" ? "whsec_..." : "whsec_..."}
                />
              </div>
            </div>
            {form.provider === "airwallex" && (
              <div style={{ marginTop: "8px" }}>
                <label style={{ fontSize: "10px", color: "#8C9196" }}>Account ID <span style={{ color: "#B0B7BF" }}>(Airwallex → Account Settings → Account ID)</span></label>
                <input
                  className="bp-input"
                  style={{ ...inputStyle, fontFamily: "monospace", fontSize: "12px" }}
                  value={form.mode === "live" ? (form.live_keys as any).account_id || "" : (form.test_keys as any).account_id || ""}
                  onChange={(e) => {
                    const keys = form.mode === "live" ? "live_keys" : "test_keys"
                    setForm({ ...form, [keys]: { ...form[keys], account_id: e.target.value } })
                  }}
                  placeholder="acct_xxxxxxxxxxxxxxxx"
                />
              </div>
            )}
            {form.provider === "stripe" && (
              <div style={{ marginTop: "8px" }}>
                <label style={{ fontSize: "10px", color: "#8C9196" }}>Publishable Key <span style={{ color: "#B0B7BF" }}>(Stripe Dashboard → API Keys → Publishable key)</span></label>
                <input
                  className="bp-input"
                  style={{ ...inputStyle, fontFamily: "monospace", fontSize: "12px" }}
                  value={form.mode === "live" ? (form.live_keys as any).publishable_key || "" : (form.test_keys as any).publishable_key || ""}
                  onChange={(e) => {
                    const keys = form.mode === "live" ? "live_keys" : "test_keys"
                    setForm({ ...form, [keys]: { ...form[keys], publishable_key: e.target.value } })
                  }}
                  placeholder={form.mode === "live" ? "pk_live_..." : "pk_test_..."}
                />
              </div>
            )}
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "16px" }}>
            <button
              onClick={handleCreate}
              disabled={!form.provider || !form.display_name || createMutation.isPending}
              className="bp-btn-primary"
              style={{ padding: "7px 16px", borderRadius: "6px", fontSize: "13px", fontWeight: 500, border: "none", background: "#008060", color: "#FFF", opacity: !form.provider ? 0.5 : 1 }}
            >
              {createMutation.isPending ? "Creating..." : "Create Gateway"}
            </button>
          </div>
        </div>
      )}

      {/* Gateway list */}
      {gwLoading ? (
        <p style={{ color: "#8C9196" }}>Loading...</p>
      ) : gateways.length === 0 ? (
        <div className="bp-card" style={{ padding: "40px", textAlign: "center", color: "#8C9196" }}>
          <p style={{ fontSize: "14px" }}>No payment gateways configured</p>
          <p style={{ fontSize: "12px" }}>Add a gateway to start accepting payments</p>
        </div>
      ) : (
        gateways.map((gw: any) => {
          const isExpanded = expandedGw === gw.id
          const methods = gw.payment_methods || []
          const activeMethods = methods.filter((m: any) => m.is_active)
          const be = billingEntities.find((b: any) => b.id === gw.billing_entity_id)

          return (
            <div key={gw.id} className="bp-card" style={{ marginBottom: "12px", overflow: "hidden" }}>
              <div
                style={{ padding: "16px 20px", cursor: "pointer" }}
                onClick={() => setExpandedGw(isExpanded ? null : gw.id)}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <span style={{ fontSize: "18px" }}>{"\uD83D\uDCB3"}</span>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontSize: "14px", fontWeight: 600 }}>{gw.display_name}</span>
                        <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "10px", background: gw.mode === "live" ? "#AEE9D1" : "#FFD79D", color: gw.mode === "live" ? "#0D5740" : "#7A4F01", fontWeight: 600 }}>
                          {gw.mode.toUpperCase()}
                        </span>
                        <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "10px", background: gw.is_active ? "#AEE9D1" : "#FED3D1", color: gw.is_active ? "#0D5740" : "#9E2B25", fontWeight: 600 }}>
                          {gw.is_active ? "Active" : "Inactive"}
                        </span>
                        <span style={{ fontSize: "12px", color: "#8C9196" }}>Priority: {gw.priority}</span>
                      </div>
                      <div style={{ fontSize: "12px", color: "#6D7175", marginTop: "2px" }}>
                        {be ? `Company: ${be.name}` : "No company assigned"}
                        {activeMethods.length > 0 && (
                          <span style={{ marginLeft: "8px" }}>
                            {"\u2022"} {activeMethods.length} method{activeMethods.length !== 1 ? "s" : ""}
                          </span>
                        )}
                        {gw.project_slugs && gw.project_slugs.length > 0 && (
                          <span style={{ marginLeft: "8px" }}>
                            {"\u2022"} Projects: {gw.project_slugs.join(", ")}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    {/* Payment method icons preview */}
                    <div style={{ display: "flex", gap: "3px" }}>
                      {activeMethods.slice(0, 5).map((m: any) => (
                        <PaymentMethodIcon key={m.id} code={m.icon || m.code} size={18} />
                      ))}
                      {activeMethods.length > 5 && (
                        <span style={{ fontSize: "11px", color: "#8C9196", alignSelf: "center" }}>+{activeMethods.length - 5}</span>
                      )}
                    </div>
                    <Toggle
                      checked={gw.is_active}
                      onChange={() => toggleMutation.mutate(gw.id)}
                      disabled={toggleMutation.isPending}
                    />
                    <svg
                      width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="#6D7175" strokeWidth="2"
                      style={{ transition: "transform 0.2s", transform: isExpanded ? "rotate(180deg)" : "rotate(0)" }}
                    >
                      <path d="M5 8l5 5 5-5" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Expanded details */}
              {isExpanded && (
                <div className="bp-section-enter" style={{ borderTop: "1px solid #E1E3E5", padding: "16px 20px" }}>
                  {/* Currencies */}
                  <div style={{ marginBottom: "12px" }}>
                    <span style={{ fontSize: "11px", fontWeight: 600, color: "#6D7175", textTransform: "uppercase" }}>Currencies: </span>
                    {(gw.supported_currencies || []).map((c: string) => (
                      <span key={c} style={{ fontSize: "12px", marginRight: "6px", padding: "2px 6px", borderRadius: "4px", background: "#F6F6F7" }}>{c}</span>
                    ))}
                  </div>

                  {/* Payment methods */}
                  <div style={{ marginBottom: "12px" }}>
                    <span style={{ fontSize: "11px", fontWeight: 600, color: "#6D7175", textTransform: "uppercase" }}>Payment Methods</span>
                    <div style={{ marginTop: "8px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px" }}>
                      {methods.map((m: any) => (
                        <div key={m.id} className="bp-method-row" style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 8px" }}>
                          <PaymentMethodIcon code={m.icon || m.code} size={18} />
                          <span style={{ fontSize: "12px", flex: 1, color: m.is_active ? "#1A1A1A" : "#8C9196" }}>{m.display_name}</span>
                          <span style={{ fontSize: "10px", color: m.is_active ? "#0D5740" : "#9E2B25" }}>{m.is_active ? "ON" : "OFF"}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {editingGw === gw.id ? (
                    /* ═══ EDIT MODE ═══ */
                    <div style={{ borderTop: "1px solid #E1E3E5", paddingTop: "12px" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "12px" }}>
                        <div>
                          <label style={{ fontSize: "10px", color: "#8C9196" }}>Display Name</label>
                          <input className="bp-input" style={inputStyle} value={editForm.display_name} onChange={(e) => setEditForm({ ...editForm, display_name: e.target.value })} />
                        </div>
                        <div>
                          <label style={{ fontSize: "10px", color: "#8C9196" }}>Billing Company</label>
                          <select className="bp-input" style={{ ...inputStyle, background: "#FFF" }} value={editForm.billing_entity_id || ""} onChange={(e) => setEditForm({ ...editForm, billing_entity_id: e.target.value || null })}>
                            <option value="">None</option>
                            {billingEntities.map((be: any) => (
                              <option key={be.id} value={be.id}>
                                {be.name}{be.invoicing_system ? ` (${be.invoicing_system})` : ""}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label style={{ fontSize: "10px", color: "#8C9196" }}>Mode</label>
                          <select className="bp-input" style={{ ...inputStyle, background: "#FFF" }} value={editForm.mode} onChange={(e) => setEditForm({ ...editForm, mode: e.target.value })}>
                            <option value="test">Test</option>
                            <option value="live">Live</option>
                          </select>
                        </div>
                        <div>
                          <label style={{ fontSize: "10px", color: "#8C9196" }}>Priority</label>
                          <input className="bp-input" style={inputStyle} type="number" min={1} value={editForm.priority} onChange={(e) => setEditForm({ ...editForm, priority: parseInt(e.target.value) || 1 })} />
                        </div>
                      </div>

                      {/* Project Slugs */}
                      <div style={{ marginBottom: "12px" }}>
                        <label style={{ fontSize: "11px", fontWeight: 600, color: "#6D7175", textTransform: "uppercase", marginBottom: "4px", display: "block" }}>Project Slugs</label>
                        <input className="bp-input" style={inputStyle} value={editForm.project_slugs || ""} onChange={(e) => setEditForm({ ...editForm, project_slugs: e.target.value })} placeholder="loslatenboek, other-project (comma-separated)" />
                        <span style={{ fontSize: "11px", color: "#8C9196", marginTop: "2px", display: "block" }}>Leave empty to make available for all projects</span>
                      </div>

                      {/* Supported Currencies */}
                      <div style={{ marginBottom: "12px" }}>
                        <label style={{ fontSize: "11px", fontWeight: 600, color: "#6D7175", textTransform: "uppercase", marginBottom: "8px", display: "block" }}>Supported Currencies</label>
                        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                          {SUPPORTED_CURRENCIES.map((c) => {
                            const selected = (editForm.supported_currencies || []).includes(c)
                            return (
                              <button
                                key={c}
                                onClick={() => {
                                  const current = editForm.supported_currencies || []
                                  setEditForm({
                                    ...editForm,
                                    supported_currencies: selected
                                      ? current.filter((x: string) => x !== c)
                                      : [...current, c],
                                  })
                                }}
                                style={{
                                  padding: "4px 12px",
                                  borderRadius: "16px",
                                  fontSize: "12px",
                                  fontWeight: 500,
                                  cursor: "pointer",
                                  border: selected ? "1px solid #008060" : "1px solid #E1E3E5",
                                  background: selected ? "#D1FAE5" : "#FFF",
                                  color: selected ? "#0D5740" : "#6D7175",
                                  transition: "all 0.15s ease",
                                }}
                              >
                                {c}
                              </button>
                            )
                          })}
                        </div>
                      </div>

                      {/* Payment Methods Selection */}
                      <div style={{ marginBottom: "12px" }}>
                        <label style={{ fontSize: "11px", fontWeight: 600, color: "#6D7175", textTransform: "uppercase", marginBottom: "8px", display: "block" }}>
                          Payment Methods ({(editForm.selected_methods || []).length} selected)
                        </label>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px" }}>
                          {(PAYMENT_METHODS_BY_PROVIDER[gw.provider] || []).map((method: any) => {
                            const selected = (editForm.selected_methods || []).includes(method.code)
                            return (
                              <button
                                key={method.code}
                                onClick={() => {
                                  const current = editForm.selected_methods || []
                                  setEditForm({
                                    ...editForm,
                                    selected_methods: selected
                                      ? current.filter((x: string) => x !== method.code)
                                      : [...current, method.code],
                                  })
                                }}
                                className="bp-method-row"
                                style={{
                                  display: "flex", alignItems: "center", gap: "8px",
                                  padding: "8px 10px",
                                  border: selected ? "1.5px solid #008060" : "1px solid #E1E3E5",
                                  borderRadius: "6px",
                                  background: selected ? "#F0FFF8" : "#FFF",
                                  cursor: "pointer", fontSize: "12px",
                                  fontWeight: selected ? 600 : 400,
                                  color: "#1A1A1A", textAlign: "left" as const,
                                  transition: "all 0.15s ease",
                                }}
                              >
                                <PaymentMethodIcon code={method.icon} size={20} />
                                {method.name}
                              </button>
                            )
                          })}
                        </div>

                        {/* Reorder selected methods */}
                        {(editForm.selected_methods || []).length > 1 && (
                          <div style={{ marginTop: "10px" }}>
                            <label style={{ fontSize: "10px", color: "#8C9196", marginBottom: "4px", display: "block" }}>Display order (use arrows to reorder)</label>
                            {(editForm.selected_methods || []).map((code: string, idx: number) => {
                              const editProviderMethods: PaymentMethodDef[] = PAYMENT_METHODS_BY_PROVIDER[gw.provider] || []
                              const methodDef = editProviderMethods.find((m: any) => m.code === code)
                              return (
                                <div key={code} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "5px 8px", background: idx % 2 === 0 ? "#FAFAFA" : "#FFF", borderRadius: "4px", marginBottom: "2px" }}>
                                  <span style={{ fontSize: "11px", color: "#8C9196", minWidth: "18px" }}>{idx + 1}.</span>
                                  <PaymentMethodIcon code={methodDef?.icon || code} size={16} />
                                  <span style={{ fontSize: "12px", flex: 1 }}>{methodDef?.name || code}</span>
                                  <button disabled={idx === 0} onClick={() => { const arr = [...(editForm.selected_methods || [])]; [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]]; setEditForm({ ...editForm, selected_methods: arr }); }} style={{ border: "none", background: "none", cursor: idx === 0 ? "default" : "pointer", opacity: idx === 0 ? 0.3 : 1, fontSize: "14px", padding: "2px 4px" }}>▲</button>
                                  <button disabled={idx === (editForm.selected_methods || []).length - 1} onClick={() => { const arr = [...(editForm.selected_methods || [])]; [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]]; setEditForm({ ...editForm, selected_methods: arr }); }} style={{ border: "none", background: "none", cursor: idx === (editForm.selected_methods || []).length - 1 ? "default" : "pointer", opacity: idx === (editForm.selected_methods || []).length - 1 ? 0.3 : 1, fontSize: "14px", padding: "2px 4px" }}>▼</button>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                      <div style={{ marginBottom: "12px" }}>
                        <label style={{ fontSize: "11px", fontWeight: 600, color: "#6D7175", textTransform: "uppercase", marginBottom: "6px", display: "block" }}>
                          {editForm.mode === "live" ? "Live" : "Test"} API Keys
                        </label>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
                          <div>
                            <label style={{ fontSize: "10px", color: "#8C9196" }}>{editForm.provider === "paypal" || editForm.provider === "airwallex" ? "Client ID" : editForm.provider === "stripe" ? "Secret Key (sk_...)" : "API Key"}</label>
                            <input className="bp-input" style={{ ...inputStyle, fontFamily: "monospace", fontSize: "12px" }}
                              value={editForm.mode === "live" ? editForm.live_keys.api_key : editForm.test_keys.api_key}
                              onChange={(e) => {
                                const k = editForm.mode === "live" ? "live_keys" : "test_keys"
                                setEditForm({ ...editForm, [k]: { ...editForm[k], api_key: e.target.value } })
                              }}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: "10px", color: "#8C9196" }}>{editForm.provider === "paypal" ? "Client Secret" : editForm.provider === "airwallex" ? "API Key" : editForm.provider === "stripe" ? "Webhook Secret (whsec_...)" : "Secret Key"}</label>
                            <input className="bp-input" style={{ ...inputStyle, fontFamily: "monospace", fontSize: "12px" }}
                              value={editForm.mode === "live" ? editForm.live_keys.secret_key : editForm.test_keys.secret_key}
                              onChange={(e) => {
                                const k = editForm.mode === "live" ? "live_keys" : "test_keys"
                                setEditForm({ ...editForm, [k]: { ...editForm[k], secret_key: e.target.value } })
                              }}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: "10px", color: "#8C9196" }}>{editForm.provider === "paypal" ? "Webhook ID" : "Webhook Secret"}</label>
                            <input className="bp-input" style={{ ...inputStyle, fontFamily: "monospace", fontSize: "12px" }}
                              value={editForm.mode === "live" ? editForm.live_keys.webhook_secret : editForm.test_keys.webhook_secret}
                              onChange={(e) => {
                                const k = editForm.mode === "live" ? "live_keys" : "test_keys"
                                setEditForm({ ...editForm, [k]: { ...editForm[k], webhook_secret: e.target.value } })
                              }}
                            />
                          </div>
                        </div>
                        {editForm.provider === "airwallex" && (
                          <div style={{ marginTop: "8px", gridColumn: "1 / -1" }}>
                            <label style={{ fontSize: "10px", color: "#8C9196" }}>Account ID <span style={{ color: "#B0B7BF" }}>(Airwallex → Account Settings → Account ID)</span></label>
                            <input className="bp-input" style={{ ...inputStyle, fontFamily: "monospace", fontSize: "12px" }}
                              value={editForm.mode === "live" ? (editForm.live_keys as any).account_id || "" : (editForm.test_keys as any).account_id || ""}
                              onChange={(e) => {
                                const k = editForm.mode === "live" ? "live_keys" : "test_keys"
                                setEditForm({ ...editForm, [k]: { ...editForm[k], account_id: e.target.value } })
                              }}
                              placeholder="acct_xxxxxxxxxxxxxxxx"
                            />
                          </div>
                        )}
                        {editForm.provider === "stripe" && (
                          <div style={{ marginTop: "8px", gridColumn: "1 / -1" }}>
                            <label style={{ fontSize: "10px", color: "#8C9196" }}>Publishable Key <span style={{ color: "#B0B7BF" }}>(Stripe Dashboard → API Keys → Publishable key)</span></label>
                            <input className="bp-input" style={{ ...inputStyle, fontFamily: "monospace", fontSize: "12px" }}
                              value={editForm.mode === "live" ? (editForm.live_keys as any).publishable_key || "" : (editForm.test_keys as any).publishable_key || ""}
                              onChange={(e) => {
                                const k = editForm.mode === "live" ? "live_keys" : "test_keys"
                                setEditForm({ ...editForm, [k]: { ...editForm[k], publishable_key: e.target.value } })
                              }}
                              placeholder={editForm.mode === "live" ? "pk_live_..." : "pk_test_..."}
                            />
                          </div>
                        )}
                      </div>
                      {/* Apple Pay Domain Verification (only for Mollie) */}
                      {editForm.provider === "mollie" && (editForm.selected_methods || []).includes("applepay") && (
                        <div style={{ marginBottom: "12px", padding: "10px", background: "#F6F6F7", borderRadius: "8px" }}>
                          <span style={{ fontSize: "11px", fontWeight: 600, color: "#6D7175", textTransform: "uppercase" }}>Apple Pay Domain Verification</span>
                          <p style={{ fontSize: "11px", color: "#8C9196", marginTop: "2px", marginBottom: "6px" }}>Paste the content from Mollie Dashboard → Apple Pay → Domain verification file</p>
                          <textarea
                            className="bp-input"
                            style={{ ...inputStyle, minHeight: "60px", resize: "vertical", fontFamily: "monospace", fontSize: "11px" }}
                            value={(editForm as any).metadata?.apple_pay_verification_file || ""}
                            onChange={(e) => setEditForm({ ...editForm, metadata: { ...(editForm as any).metadata, apple_pay_verification_file: e.target.value } } as any)}
                            placeholder="Paste Apple developer domain association file content here"
                          />
                        </div>
                      )}
                      <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                        <button onClick={() => setEditingGw(null)} className="bp-btn" style={{ padding: "5px 14px", borderRadius: "6px", fontSize: "12px", border: "1px solid #E1E3E5", background: "#FFF", color: "#6D7175" }}>
                          Cancel
                        </button>
                        <button onClick={() => handleUpdate(gw.id)} disabled={updateMutation.isPending} className="bp-btn-primary" style={{ padding: "5px 14px", borderRadius: "6px", fontSize: "12px", fontWeight: 500, border: "none", background: "#008060", color: "#FFF" }}>
                          {updateMutation.isPending ? "Saving..." : "Save Changes"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* ═══ VIEW MODE ═══ */
                    <>
                      {/* API Keys (masked) */}
                      <div style={{ marginBottom: "12px" }}>
                        <span style={{ fontSize: "11px", fontWeight: 600, color: "#6D7175", textTransform: "uppercase" }}>API Keys ({gw.mode})</span>
                        <div style={{ fontSize: "12px", color: "#6D7175", marginTop: "4px" }}>
                          {gw.mode === "live" && gw.live_keys ? (
                            Object.entries(gw.live_keys).map(([k, v]) => (
                              <div key={k}><code style={{ fontFamily: "monospace", fontSize: "11px" }}>{k}: {v as string}</code></div>
                            ))
                          ) : gw.test_keys ? (
                            Object.entries(gw.test_keys).map(([k, v]) => (
                              <div key={k}><code style={{ fontFamily: "monospace", fontSize: "11px" }}>{k}: {v as string}</code></div>
                            ))
                          ) : (
                            <span>No keys configured</span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                        <button
                          onClick={() => startEditing(gw)}
                          className="bp-btn"
                          style={{ padding: "4px 10px", borderRadius: "6px", fontSize: "12px", border: "1px solid #008060", background: "#FFF", color: "#008060" }}
                        >
                          Edit Gateway
                        </button>
                        <button
                          onClick={() => { if (confirm(`Delete ${gw.display_name}?`)) deleteMutation.mutate(gw.id) }}
                          className="bp-btn"
                          style={{ padding: "4px 10px", borderRadius: "6px", fontSize: "12px", border: "1px solid #FED3D1", background: "#FFF", color: "#D72C0D" }}
                        >
                          Delete Gateway
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )
        })
      )}
    </div>
  )
}

// ═══════════════════════════════════════════
// QUICK SWITCH TAB
// ═══════════════════════════════════════════
function QuickSwitchTab() {
  const { data: gwData, isLoading } = useGatewayConfigs()
  const queryClient = useQueryClient()

  const toggleMutation = useMutation({
    mutationFn: (id: string) =>
      sdk.client.fetch(`/admin/gateway-configs/${id}/toggle`, { method: "POST" }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["gateway-configs"] })
      toast.success((data as any)?.message || "Gateway toggled")
    },
  })

  const gateways = (gwData as any)?.gateway_configs || []
  const activeGateways = gateways.filter((gw: any) => gw.is_active)
  const inactiveGateways = gateways.filter((gw: any) => !gw.is_active)

  return (
    <div className="bp-section-enter">
      <h2 style={{ fontSize: "16px", fontWeight: 600, marginBottom: "8px" }}>{"\u26A1"} Quick Gateway Switch</h2>
      <p style={{ fontSize: "13px", color: "#6D7175", marginBottom: "20px" }}>
        Emergency panel \u2014 toggle gateways on/off for checkout in one click.
        Changes take effect immediately.
      </p>

      {isLoading ? (
        <p style={{ color: "#8C9196" }}>Loading...</p>
      ) : gateways.length === 0 ? (
        <div className="bp-card" style={{ padding: "40px", textAlign: "center", color: "#8C9196" }}>
          <p>No gateways configured. Add gateways in the Payment Gateways tab first.</p>
        </div>
      ) : (
        <>
          {/* Active gateways */}
          {activeGateways.length > 0 && (
            <div style={{ marginBottom: "20px" }}>
              <div style={{ fontSize: "12px", fontWeight: 600, color: "#0D5740", textTransform: "uppercase", marginBottom: "8px" }}>
                {"\uD83D\uDFE2"} Active on checkout ({activeGateways.length})
              </div>
              {activeGateways.map((gw: any) => (
                <div key={gw.id} className="bp-card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", marginBottom: "8px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#008060" }} />
                    <span style={{ fontSize: "14px", fontWeight: 600 }}>{gw.display_name}</span>
                    <span style={{ fontSize: "12px", color: "#8C9196" }}>Priority {gw.priority}</span>
                    <div style={{ display: "flex", gap: "3px", marginLeft: "8px" }}>
                      {(gw.payment_methods || []).filter((m: any) => m.is_active).slice(0, 4).map((m: any) => (
                        <PaymentMethodIcon key={m.id} code={m.icon || m.code} size={16} />
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={() => toggleMutation.mutate(gw.id)}
                    disabled={toggleMutation.isPending}
                    className="bp-btn"
                    style={{ padding: "6px 14px", borderRadius: "6px", fontSize: "12px", fontWeight: 500, border: "1px solid #FED3D1", background: "#FFF", color: "#D72C0D" }}
                  >
                    {"\u26D4"} Deactivate
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Inactive gateways */}
          {inactiveGateways.length > 0 && (
            <div>
              <div style={{ fontSize: "12px", fontWeight: 600, color: "#9E2B25", textTransform: "uppercase", marginBottom: "8px" }}>
                {"\uD83D\uDD34"} Inactive ({inactiveGateways.length})
              </div>
              {inactiveGateways.map((gw: any) => (
                <div key={gw.id} className="bp-card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", marginBottom: "8px", opacity: 0.7 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#D72C0D" }} />
                    <span style={{ fontSize: "14px", fontWeight: 500 }}>{gw.display_name}</span>
                    <span style={{ fontSize: "12px", color: "#8C9196" }}>Priority {gw.priority}</span>
                  </div>
                  <button
                    onClick={() => toggleMutation.mutate(gw.id)}
                    disabled={toggleMutation.isPending}
                    className="bp-btn-primary"
                    style={{ padding: "6px 14px", borderRadius: "6px", fontSize: "12px", fontWeight: 500, border: "none", background: "#008060", color: "#FFF" }}
                  >
                    {"\u2705"} Activate
                  </button>
                </div>
              ))}
            </div>
          )}

          <div style={{ marginTop: "16px", padding: "12px 16px", background: "#FEF3C7", borderRadius: "8px", border: "1px solid #FCD34D" }}>
            <p style={{ fontSize: "12px", color: "#92400E", margin: 0 }}>
              {"\u26A0\uFE0F"} Deactivating a gateway immediately removes it from checkout.
              Customers in active checkout sessions will see the next available gateway by priority.
            </p>
          </div>
        </>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════
const BillingSettingsPage = () => {
  const [activeTab, setActiveTab] = useState<TabId>("companies")

  return (
    <div
      style={{
        width: "1000px",
        maxWidth: "calc(100vw - 280px)",
        margin: "0 auto",
        padding: "24px 32px",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif",
      }}
    >
      <PageStyles />

      <h1 style={{ fontSize: "20px", fontWeight: 600, color: "#1A1A1A", marginBottom: "4px" }}>
        Billing & Payments
      </h1>
      <p style={{ fontSize: "13px", color: "#6D7175", marginBottom: "20px" }}>
        Manage billing companies, payment gateways, and checkout configuration
      </p>

      <TabNav active={activeTab} onChange={setActiveTab} />

      {activeTab === "companies" && <CompaniesTab />}
      {activeTab === "gateways" && <GatewaysTab />}
      {activeTab === "quickswitch" && <QuickSwitchTab />}
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Payment Gateways",
  icon: undefined,
  rank: 9,
})

export default BillingSettingsPage
