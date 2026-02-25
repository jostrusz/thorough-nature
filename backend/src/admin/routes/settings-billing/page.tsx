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
  const [form, setForm] = useState({
    name: "",
    legal_name: "",
    country_code: "",
    tax_id: "",
    vat_id: "",
    registration_id: "",
    email: "",
    is_default: false,
  })

  const createMutation = useMutation({
    mutationFn: (data: Record<string, any>) =>
      sdk.client.fetch("/admin/billing-entities", { method: "POST", body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billing-entities"] })
      toast.success("Company created")
      setShowForm(false)
      setForm({ name: "", legal_name: "", country_code: "", tax_id: "", vat_id: "", registration_id: "", email: "", is_default: false })
    },
    onError: () => toast.error("Failed to create company"),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      sdk.client.fetch(`/admin/billing-entities/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billing-entities"] })
      toast.success("Company deleted")
    },
  })

  const entities = (data as any)?.billing_entities || []

  const FLAGS: Record<string, string> = { cz: "\uD83C\uDDE8\uD83C\uDDFF", ee: "\uD83C\uDDEA\uD83C\uDDEA", nl: "\uD83C\uDDF3\uD83C\uDDF1", de: "\uD83C\uDDE9\uD83C\uDDEA", pl: "\uD83C\uDDF5\uD83C\uDDF1" }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "7px 10px",
    border: "1px solid #E1E3E5",
    borderRadius: "6px",
    fontSize: "13px",
    boxSizing: "border-box",
    fontFamily: "inherit",
  }

  return (
    <div className="bp-section-enter">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <h2 style={{ fontSize: "16px", fontWeight: 600, margin: 0 }}>Companies (Billing Entities)</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bp-btn-primary"
          style={{ padding: "7px 14px", borderRadius: "6px", fontSize: "13px", fontWeight: 500, border: "none", background: "#008060", color: "#FFF" }}
        >
          {showForm ? "Cancel" : "+ Add Company"}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bp-card bp-section-enter" style={{ padding: "20px", marginBottom: "16px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={{ fontSize: "11px", fontWeight: 600, color: "#6D7175", textTransform: "uppercase" }}>Company Name</label>
              <input className="bp-input" style={inputStyle} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="EverChapter OU" />
            </div>
            <div>
              <label style={{ fontSize: "11px", fontWeight: 600, color: "#6D7175", textTransform: "uppercase" }}>Legal Name</label>
              <input className="bp-input" style={inputStyle} value={form.legal_name} onChange={(e) => setForm({ ...form, legal_name: e.target.value })} placeholder="EverChapter O\u00DC" />
            </div>
            <div>
              <label style={{ fontSize: "11px", fontWeight: 600, color: "#6D7175", textTransform: "uppercase" }}>Country</label>
              <select className="bp-input" style={{ ...inputStyle, background: "#FFF" }} value={form.country_code} onChange={(e) => setForm({ ...form, country_code: e.target.value })}>
                <option value="">Select</option>
                <option value="cz">Czech Republic</option>
                <option value="ee">Estonia</option>
                <option value="nl">Netherlands</option>
                <option value="de">Germany</option>
                <option value="pl">Poland</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: "11px", fontWeight: 600, color: "#6D7175", textTransform: "uppercase" }}>Tax ID (I\u010CO)</label>
              <input className="bp-input" style={inputStyle} value={form.tax_id} onChange={(e) => setForm({ ...form, tax_id: e.target.value })} placeholder="12345678" />
            </div>
            <div>
              <label style={{ fontSize: "11px", fontWeight: 600, color: "#6D7175", textTransform: "uppercase" }}>VAT ID (DI\u010C)</label>
              <input className="bp-input" style={inputStyle} value={form.vat_id} onChange={(e) => setForm({ ...form, vat_id: e.target.value })} placeholder="CZ12345678" />
            </div>
            <div>
              <label style={{ fontSize: "11px", fontWeight: 600, color: "#6D7175", textTransform: "uppercase" }}>Email</label>
              <input className="bp-input" style={inputStyle} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} type="email" placeholder="info@company.com" />
            </div>
          </div>
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
        entities.map((entity: any) => (
          <div key={entity.id} className="bp-card" style={{ padding: "16px 20px", marginBottom: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "18px" }}>{FLAGS[entity.country_code] || "\uD83C\uDFF3\uFE0F"}</span>
                  <span style={{ fontSize: "14px", fontWeight: 600, color: "#1A1A1A" }}>{entity.name}</span>
                  {entity.is_default && (
                    <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "10px", background: "#AEE9D1", color: "#0D5740", fontWeight: 600 }}>DEFAULT</span>
                  )}
                </div>
                <div style={{ fontSize: "12px", color: "#6D7175", marginTop: "4px" }}>
                  {entity.tax_id && <span>I\u010CO: {entity.tax_id}</span>}
                  {entity.vat_id && <span style={{ marginLeft: "12px" }}>DI\u010C: {entity.vat_id}</span>}
                  {entity.email && <span style={{ marginLeft: "12px" }}>{entity.email}</span>}
                </div>
              </div>
              <button
                onClick={() => {
                  if (confirm(`Delete ${entity.name}?`)) {
                    deleteMutation.mutate(entity.id)
                  }
                }}
                className="bp-btn"
                style={{ padding: "4px 10px", borderRadius: "6px", fontSize: "12px", border: "1px solid #E1E3E5", background: "#FFF", color: "#D72C0D" }}
              >
                Delete
              </button>
            </div>
          </div>
        ))
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
  })

  const createMutation = useMutation({
    mutationFn: (data: Record<string, any>) =>
      sdk.client.fetch("/admin/gateway-configs", { method: "POST", body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gateway-configs"] })
      toast.success("Payment gateway created")
      setShowForm(false)
    },
    onError: () => toast.error("Failed to create gateway"),
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
      }
    })

    createMutation.mutate({
      provider: form.provider,
      display_name: form.display_name,
      billing_entity_id: form.billing_entity_id || null,
      mode: form.mode,
      priority: form.priority,
      supported_currencies: form.supported_currencies,
      is_active: false,
      live_keys: form.live_keys,
      test_keys: form.test_keys,
      payment_methods: methods,
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
            </div>
          )}

          {/* API Keys */}
          <div style={{ marginTop: "16px" }}>
            <label style={{ fontSize: "11px", fontWeight: 600, color: "#6D7175", textTransform: "uppercase", marginBottom: "8px", display: "block" }}>
              {form.mode === "live" ? "Live" : "Test"} API Keys
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              <div>
                <label style={{ fontSize: "10px", color: "#8C9196" }}>API Key</label>
                <input
                  className="bp-input"
                  style={{ ...inputStyle, fontFamily: "monospace", fontSize: "12px" }}
                  value={form.mode === "live" ? form.live_keys.api_key : form.test_keys.api_key}
                  onChange={(e) => {
                    const keys = form.mode === "live" ? "live_keys" : "test_keys"
                    setForm({ ...form, [keys]: { ...form[keys], api_key: e.target.value } })
                  }}
                  placeholder={form.mode === "live" ? "sk_live_..." : "sk_test_..."}
                />
              </div>
              <div>
                <label style={{ fontSize: "10px", color: "#8C9196" }}>Secret Key</label>
                <input
                  className="bp-input"
                  style={{ ...inputStyle, fontFamily: "monospace", fontSize: "12px" }}
                  type="password"
                  value={form.mode === "live" ? form.live_keys.secret_key : form.test_keys.secret_key}
                  onChange={(e) => {
                    const keys = form.mode === "live" ? "live_keys" : "test_keys"
                    setForm({ ...form, [keys]: { ...form[keys], secret_key: e.target.value } })
                  }}
                  placeholder="whsec_..."
                />
              </div>
            </div>
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

                  {/* Delete */}
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button
                      onClick={() => { if (confirm(`Delete ${gw.display_name}?`)) deleteMutation.mutate(gw.id) }}
                      className="bp-btn"
                      style={{ padding: "4px 10px", borderRadius: "6px", fontSize: "12px", border: "1px solid #FED3D1", background: "#FFF", color: "#D72C0D" }}
                    >
                      Delete Gateway
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
  label: "Billing & Payments",
  icon: undefined,
})

export default BillingSettingsPage
