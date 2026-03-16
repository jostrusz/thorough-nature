import React, { useState, useCallback } from "react"
import { defineRouteConfig } from "@medusajs/admin-sdk"
import { BuildingStorefront } from "@medusajs/icons"
import { toast } from "@medusajs/ui"
import {
  useDextrumConfig, useSaveDextrumConfig, useTestDextrumConnection,
  useDextrumDeliveryMappings, useSaveDextrumDeliveryMapping, useDeleteDextrumDeliveryMapping,
  useSalesChannels, useShippingOptions,
} from "../../hooks/use-dextrum"

// ═══════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════
const pageStyle: React.CSSProperties = {
  width: "800px",
  maxWidth: "calc(100vw - 280px)",
  margin: "0 auto",
  padding: "24px 32px",
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif",
}

const h1Style: React.CSSProperties = { fontSize: "20px", fontWeight: 600, color: "#1A1A1A", marginBottom: "24px" }

const cardStyle: React.CSSProperties = {
  background: "#FFFFFF",
  border: "1px solid #E1E3E5",
  borderRadius: "10px",
  marginBottom: "16px",
  overflow: "hidden",
}

const cardHeaderStyle: React.CSSProperties = {
  fontSize: "14px",
  fontWeight: 600,
  color: "#1A1A1A",
  padding: "16px 20px",
  borderBottom: "1px solid #E1E3E5",
}

const fieldRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  marginBottom: "12px",
}

const labelStyle: React.CSSProperties = { fontSize: "13px", color: "#6D7175", width: "180px", flexShrink: 0 }

const inputStyle: React.CSSProperties = {
  flex: 1,
  padding: "8px 12px",
  border: "1px solid #E1E3E5",
  borderRadius: "6px",
  fontSize: "13px",
  outline: "none",
  background: "#FFFFFF",
}

const btnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  padding: "8px 16px",
  borderRadius: "6px",
  fontSize: "13px",
  fontWeight: 500,
  cursor: "pointer",
  border: "1px solid #E1E3E5",
  background: "#FFFFFF",
  color: "#1A1A1A",
  transition: "all 0.15s ease",
}

const btnPrimaryStyle: React.CSSProperties = {
  ...btnStyle,
  background: "#008060",
  color: "#fff",
  borderColor: "#008060",
}

// ═══════════════════════════════════════════
// DELIVERY MAPPINGS SECTION
// ═══════════════════════════════════════════
const selectStyle: React.CSSProperties = {
  ...inputStyle,
  appearance: "auto" as any,
}

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: "12px",
}

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "8px 10px",
  borderBottom: "1px solid #E1E3E5",
  color: "#6D7175",
  fontWeight: 500,
  fontSize: "11px",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
}

const tdStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderBottom: "1px solid #F1F2F3",
  color: "#1A1A1A",
  fontSize: "12px",
}

const btnDangerStyle: React.CSSProperties = {
  ...btnStyle,
  color: "#9E2B25",
  borderColor: "#FED3D1",
  background: "#FFF4F4",
  fontSize: "11px",
  padding: "4px 10px",
}

const DeliveryMappingsSection = () => {
  const { data: mappings, isLoading: loadingMappings } = useDextrumDeliveryMappings()
  const { data: salesChannels } = useSalesChannels()
  const { data: shippingOptions } = useShippingOptions()
  const saveMapping = useSaveDextrumDeliveryMapping()
  const deleteMapping = useDeleteDextrumDeliveryMapping()

  const [showForm, setShowForm] = useState(false)
  const [editForm, setEditForm] = useState<Record<string, any>>({
    sales_channel_id: "",
    shipping_option_id: "",
    is_cod: false,
    delivery_type: "home",
    delivery_method_id: "",
    external_carrier_code: "",
    payment_method_id: "",
  })

  const resetForm = () => {
    setEditForm({
      sales_channel_id: "",
      shipping_option_id: "",
      is_cod: false,
      delivery_type: "home",
      delivery_method_id: "",
      external_carrier_code: "",
      payment_method_id: "",
    })
    setShowForm(false)
  }

  const handleSaveMapping = () => {
    if (!editForm.sales_channel_id || !editForm.shipping_option_id || !editForm.delivery_method_id || !editForm.payment_method_id) {
      toast.error("Please fill in all required fields")
      return
    }

    // Cache names for display
    const sc = salesChannels?.find((s: any) => s.id === editForm.sales_channel_id)
    const so = shippingOptions?.find((s: any) => s.id === editForm.shipping_option_id)

    saveMapping.mutate(
      {
        ...editForm,
        sales_channel_name: sc?.name || "",
        shipping_option_name: so?.name || "",
      },
      {
        onSuccess: () => {
          toast.success("Delivery mapping saved")
          resetForm()
        },
        onError: (err: any) => toast.error(err?.message || "Failed to save mapping"),
      }
    )
  }

  const handleDelete = (id: string) => {
    if (!confirm("Delete this mapping?")) return
    deleteMapping.mutate(id, {
      onSuccess: () => toast.success("Mapping deleted"),
      onError: (err: any) => toast.error(err?.message || "Failed to delete"),
    })
  }

  const handleEdit = (m: any) => {
    setEditForm({
      id: m.id,
      sales_channel_id: m.sales_channel_id,
      shipping_option_id: m.shipping_option_id,
      is_cod: m.is_cod,
      delivery_type: m.delivery_type,
      delivery_method_id: m.delivery_method_id,
      external_carrier_code: m.external_carrier_code || "",
      payment_method_id: m.payment_method_id,
    })
    setShowForm(true)
  }

  return (
    <div style={cardStyle}>
      <div style={{ ...cardHeaderStyle, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>Delivery Mappings</span>
        <button style={{ ...btnStyle, fontSize: "12px", padding: "4px 12px" }} onClick={() => { resetForm(); setShowForm(!showForm) }}>
          {showForm ? "Cancel" : "+ Add Mapping"}
        </button>
      </div>
      <div style={{ padding: "16px 20px" }}>
        <p style={{ fontSize: "12px", color: "#8C9196", marginBottom: "16px" }}>
          Map each Sales Channel + Shipping Option + Payment type to mySTOCK delivery and payment codes.
        </p>

        {/* Add/Edit Form */}
        {showForm && (
          <div style={{ background: "#F6F6F7", padding: "16px", borderRadius: "8px", marginBottom: "16px" }}>
            <div style={fieldRow}>
              <span style={{ ...labelStyle, width: "160px" }}>Sales Channel *</span>
              <select style={selectStyle} value={editForm.sales_channel_id} onChange={(e) => setEditForm(prev => ({ ...prev, sales_channel_id: e.target.value }))}>
                <option value="">-- Select --</option>
                {salesChannels?.map((sc: any) => (
                  <option key={sc.id} value={sc.id}>{sc.name}</option>
                ))}
              </select>
            </div>
            <div style={fieldRow}>
              <span style={{ ...labelStyle, width: "160px" }}>Shipping Option *</span>
              <select style={selectStyle} value={editForm.shipping_option_id} onChange={(e) => setEditForm(prev => ({ ...prev, shipping_option_id: e.target.value }))}>
                <option value="">-- Select --</option>
                {shippingOptions?.map((so: any) => (
                  <option key={so.id} value={so.id}>{so.name}</option>
                ))}
              </select>
            </div>
            <div style={fieldRow}>
              <span style={{ ...labelStyle, width: "160px" }}>Cash on Delivery?</span>
              <div
                onClick={() => setEditForm(prev => ({ ...prev, is_cod: !prev.is_cod }))}
                style={{
                  width: "44px", height: "24px", borderRadius: "12px",
                  background: editForm.is_cod ? "#008060" : "#E1E3E5",
                  cursor: "pointer", position: "relative", transition: "background 0.2s",
                }}
              >
                <div style={{
                  width: "20px", height: "20px", borderRadius: "50%", background: "#FFFFFF",
                  position: "absolute", top: "2px", left: editForm.is_cod ? "22px" : "2px",
                  transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                }} />
              </div>
              <span style={{ fontSize: "12px", color: "#6D7175" }}>{editForm.is_cod ? "Yes (dobírka)" : "No (prepaid)"}</span>
            </div>
            <div style={fieldRow}>
              <span style={{ ...labelStyle, width: "160px" }}>Delivery Type</span>
              <select style={{ ...selectStyle, maxWidth: "180px" }} value={editForm.delivery_type} onChange={(e) => setEditForm(prev => ({ ...prev, delivery_type: e.target.value }))}>
                <option value="home">Home delivery</option>
                <option value="pickup">Pickup point</option>
              </select>
            </div>
            <div style={fieldRow}>
              <span style={{ ...labelStyle, width: "160px" }}>Delivery Code *</span>
              <input style={inputStyle} value={editForm.delivery_method_id} onChange={(e) => setEditForm(prev => ({ ...prev, delivery_method_id: e.target.value }))} placeholder="e.g. U0123_GLS_API" />
            </div>
            <div style={fieldRow}>
              <span style={{ ...labelStyle, width: "160px" }}>Ext. Carrier Code</span>
              <input style={inputStyle} value={editForm.external_carrier_code} onChange={(e) => setEditForm(prev => ({ ...prev, external_carrier_code: e.target.value }))} placeholder="e.g. 106 (inPost), 151 (Magyar Posta)" />
            </div>
            <div style={fieldRow}>
              <span style={{ ...labelStyle, width: "160px" }}>Payment Code *</span>
              <input style={inputStyle} value={editForm.payment_method_id} onChange={(e) => setEditForm(prev => ({ ...prev, payment_method_id: e.target.value }))} placeholder="e.g. U0123_OSTATNI" />
            </div>
            <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
              <button style={btnPrimaryStyle} onClick={handleSaveMapping} disabled={saveMapping.isPending}>
                {saveMapping.isPending ? "Saving..." : editForm.id ? "Update Mapping" : "Add Mapping"}
              </button>
              <button style={btnStyle} onClick={resetForm}>Cancel</button>
            </div>
          </div>
        )}

        {/* Existing Mappings Table */}
        {loadingMappings ? (
          <p style={{ color: "#8C9196", fontSize: "12px" }}>Loading mappings...</p>
        ) : !mappings?.length ? (
          <p style={{ color: "#8C9196", fontSize: "12px" }}>No delivery mappings configured yet.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Sales Channel</th>
                  <th style={thStyle}>Shipping Option</th>
                  <th style={thStyle}>COD</th>
                  <th style={thStyle}>Type</th>
                  <th style={thStyle}>Delivery Code</th>
                  <th style={thStyle}>Carrier</th>
                  <th style={thStyle}>Payment Code</th>
                  <th style={thStyle}></th>
                </tr>
              </thead>
              <tbody>
                {mappings.map((m: any) => (
                  <tr key={m.id}>
                    <td style={tdStyle}>{m.sales_channel_name || m.sales_channel_id}</td>
                    <td style={tdStyle}>{m.shipping_option_name || m.shipping_option_id}</td>
                    <td style={tdStyle}>
                      <span style={{
                        display: "inline-block", padding: "2px 6px", borderRadius: "4px", fontSize: "11px",
                        background: m.is_cod ? "#FFF3CD" : "#D4EDDA", color: m.is_cod ? "#856404" : "#155724",
                      }}>
                        {m.is_cod ? "COD" : "Prepaid"}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <span style={{
                        display: "inline-block", padding: "2px 6px", borderRadius: "4px", fontSize: "11px",
                        background: m.delivery_type === "pickup" ? "#E8F4FD" : "#F6F6F7",
                        color: m.delivery_type === "pickup" ? "#0B5394" : "#6D7175",
                      }}>
                        {m.delivery_type === "pickup" ? "Pickup" : "Home"}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: "11px" }}>{m.delivery_method_id}</td>
                    <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: "11px" }}>{m.external_carrier_code || "—"}</td>
                    <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: "11px" }}>{m.payment_method_id}</td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>
                      <div style={{ display: "flex", gap: "4px", justifyContent: "flex-end" }}>
                        <button style={{ ...btnStyle, fontSize: "11px", padding: "3px 8px" }} onClick={() => handleEdit(m)}>Edit</button>
                        <button style={btnDangerStyle} onClick={() => handleDelete(m.id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

const DextrumPage = () => {
  const { data: config, isLoading } = useDextrumConfig()
  const saveConfig = useSaveDextrumConfig()
  const testConnection = useTestDextrumConnection()

  const [form, setForm] = useState<Record<string, any>>({})
  const [initialized, setInitialized] = useState(false)

  // Initialize form from config
  React.useEffect(() => {
    if (config && !initialized) {
      setForm({
        api_url: config.api_url || "",
        api_username: config.api_username || "",
        api_password: config.api_password || "",
        default_warehouse_code: config.default_warehouse_code || "MAIN",
        partner_id: config.partner_id || "",
        partner_code: config.partner_code || "",
        default_delivery_method_id: config.default_delivery_method_id || "",
        default_pickup_delivery_method_id: config.default_pickup_delivery_method_id || "",
        default_payment_method_cod: config.default_payment_method_cod || "",
        default_payment_method_paid: config.default_payment_method_paid || "",
        webhook_secret: config.webhook_secret || "",
        order_hold_minutes: config.order_hold_minutes ?? 15,
        inventory_sync_interval_minutes: config.inventory_sync_interval_minutes ?? 15,
        low_stock_threshold: config.low_stock_threshold ?? 10,
        enabled: config.enabled ?? true,
      })
      setInitialized(true)
    }
  }, [config, initialized])

  const handleChange = useCallback((field: string, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }, [])

  const handleSave = useCallback(() => {
    saveConfig.mutate(form, {
      onSuccess: () => toast.success("Configuration saved"),
      onError: (err: any) => toast.error(err?.message || "Failed to save"),
    })
  }, [form, saveConfig])

  const handleTest = useCallback(() => {
    testConnection.mutate(undefined, {
      onSuccess: (data: any) => {
        if (data.ok) {
          toast.success("Connection successful!")
        } else {
          toast.error(`Connection failed: ${data.message}`)
        }
      },
      onError: (err: any) => toast.error(err?.message || "Connection test failed"),
    })
  }, [testConnection])

  if (isLoading) {
    return (
      <div style={pageStyle}>
        <h1 style={h1Style}>Dextrum — Warehouse Management</h1>
        <p style={{ color: "#8C9196" }}>Loading configuration...</p>
      </div>
    )
  }

  return (
    <div style={pageStyle}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
        <h1 style={{ ...h1Style, marginBottom: 0 }}>Dextrum — Warehouse Management</h1>
        <button style={btnPrimaryStyle} onClick={handleSave} disabled={saveConfig.isPending}>
          {saveConfig.isPending ? "Saving..." : "Save Configuration"}
        </button>
      </div>

      {/* API Connection */}
      <div style={cardStyle}>
        <div style={cardHeaderStyle}>API Connection</div>
        <div style={{ padding: "16px 20px" }}>
          <div style={fieldRow}>
            <span style={labelStyle}>API URL</span>
            <input style={inputStyle} value={form.api_url || ""} onChange={(e) => handleChange("api_url", e.target.value)} placeholder="https://customer.mystock.cz" />
          </div>
          <div style={fieldRow}>
            <span style={labelStyle}>Username</span>
            <input style={inputStyle} value={form.api_username || ""} onChange={(e) => handleChange("api_username", e.target.value)} placeholder="api_user" />
          </div>
          <div style={fieldRow}>
            <span style={labelStyle}>Password</span>
            <input style={inputStyle} type="password" value={form.api_password || ""} onChange={(e) => handleChange("api_password", e.target.value)} placeholder="••••••••" />
          </div>
          <div style={fieldRow}>
            <span style={labelStyle}>Warehouse Code</span>
            <input style={inputStyle} value={form.default_warehouse_code || ""} onChange={(e) => handleChange("default_warehouse_code", e.target.value)} placeholder="MAIN" />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "8px" }}>
            <button style={btnStyle} onClick={handleTest} disabled={testConnection.isPending}>
              {testConnection.isPending ? "Testing..." : "Test Connection"}
            </button>
            {config?.connection_status === "connected" && (
              <span style={{ fontSize: "12px", color: "#008060" }}>
                ✓ Connected
                {config.last_connection_test && ` (last: ${new Date(config.last_connection_test).toLocaleString()})`}
              </span>
            )}
            {config?.connection_status === "error" && (
              <span style={{ fontSize: "12px", color: "#9E2B25" }}>✗ Connection error</span>
            )}
          </div>
        </div>
      </div>

      {/* Partner */}
      <div style={cardStyle}>
        <div style={cardHeaderStyle}>Partner & Operating Unit</div>
        <div style={{ padding: "16px 20px" }}>
          <div style={fieldRow}>
            <span style={labelStyle}>Partner ID (UUID)</span>
            <input style={inputStyle} value={form.partner_id || ""} onChange={(e) => handleChange("partner_id", e.target.value)} placeholder="a1b2c3d4-e5f6-7890-..." />
          </div>
          <div style={fieldRow}>
            <span style={labelStyle}>Partner Code</span>
            <input style={inputStyle} value={form.partner_code || ""} onChange={(e) => handleChange("partner_code", e.target.value)} placeholder="EVERCHAPTER" />
          </div>
        </div>
      </div>

      {/* Delivery & Payment Defaults (fallback) */}
      <div style={cardStyle}>
        <div style={cardHeaderStyle}>Default Delivery & Payment (fallback)</div>
        <div style={{ padding: "16px 20px" }}>
          <p style={{ fontSize: "12px", color: "#8C9196", marginBottom: "12px" }}>
            Used only when no delivery mapping matches the order's sales channel + shipping option.
          </p>
          <div style={fieldRow}>
            <span style={labelStyle}>Delivery — to address</span>
            <input style={inputStyle} value={form.default_delivery_method_id || ""} onChange={(e) => handleChange("default_delivery_method_id", e.target.value)} placeholder="e.g. U0123_GLS_API" />
          </div>
          <div style={fieldRow}>
            <span style={labelStyle}>Delivery — pickup point</span>
            <input style={inputStyle} value={form.default_pickup_delivery_method_id || ""} onChange={(e) => handleChange("default_pickup_delivery_method_id", e.target.value)} placeholder="e.g. U0123_GLS_API_VYD" />
          </div>
          <div style={fieldRow}>
            <span style={labelStyle}>Payment — COD</span>
            <input style={inputStyle} value={form.default_payment_method_cod || ""} onChange={(e) => handleChange("default_payment_method_cod", e.target.value)} placeholder="e.g. U0123_DOBIRKA" />
          </div>
          <div style={fieldRow}>
            <span style={labelStyle}>Payment — prepaid</span>
            <input style={inputStyle} value={form.default_payment_method_paid || ""} onChange={(e) => handleChange("default_payment_method_paid", e.target.value)} placeholder="e.g. U0123_OSTATNI" />
          </div>
        </div>
      </div>

      {/* Delivery Mappings */}
      <DeliveryMappingsSection />

      {/* Order Settings */}
      <div style={cardStyle}>
        <div style={cardHeaderStyle}>Order Settings</div>
        <div style={{ padding: "16px 20px" }}>
          <div style={fieldRow}>
            <span style={labelStyle}>Hold time before WMS (min)</span>
            <input style={{ ...inputStyle, maxWidth: "100px" }} type="number" value={form.order_hold_minutes ?? 15} onChange={(e) => handleChange("order_hold_minutes", parseInt(e.target.value) || 15)} />
          </div>
          <div style={fieldRow}>
            <span style={labelStyle}>Inventory sync interval (min)</span>
            <input style={{ ...inputStyle, maxWidth: "100px" }} type="number" value={form.inventory_sync_interval_minutes ?? 15} onChange={(e) => handleChange("inventory_sync_interval_minutes", parseInt(e.target.value) || 15)} />
          </div>
          <div style={fieldRow}>
            <span style={labelStyle}>Low stock threshold</span>
            <input style={{ ...inputStyle, maxWidth: "100px" }} type="number" value={form.low_stock_threshold ?? 10} onChange={(e) => handleChange("low_stock_threshold", parseInt(e.target.value) || 10)} />
          </div>
        </div>
      </div>

      {/* Webhook */}
      <div style={cardStyle}>
        <div style={cardHeaderStyle}>Webhook</div>
        <div style={{ padding: "16px 20px" }}>
          <div style={fieldRow}>
            <span style={labelStyle}>Webhook URL</span>
            <div style={{ flex: 1 }}>
              <code style={{ fontSize: "12px", color: "#3730A3", background: "#F6F6F7", padding: "6px 10px", borderRadius: "4px", display: "block" }}>
                {typeof window !== "undefined" ? `${window.location.origin}/webhooks/mystock` : "/webhooks/mystock"}
              </code>
              <span style={{ fontSize: "11px", color: "#8C9196", marginTop: "4px", display: "block" }}>
                Give this URL to mySTOCK as your event endpoint
              </span>
            </div>
          </div>
          <div style={fieldRow}>
            <span style={labelStyle}>Webhook Secret</span>
            <input style={inputStyle} value={form.webhook_secret || ""} onChange={(e) => handleChange("webhook_secret", e.target.value)} placeholder="shared-secret" />
          </div>
        </div>
      </div>

      {/* Enable/Disable */}
      <div style={cardStyle}>
        <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: "14px", fontWeight: 600, color: "#1A1A1A" }}>Enable Dextrum</div>
            <div style={{ fontSize: "12px", color: "#6D7175", marginTop: "4px" }}>When enabled, new orders will automatically be queued and sent to the warehouse after the hold period.</div>
          </div>
          <div
            onClick={() => handleChange("enabled", !form.enabled)}
            style={{
              width: "44px",
              height: "24px",
              borderRadius: "12px",
              background: form.enabled ? "#008060" : "#E1E3E5",
              cursor: "pointer",
              position: "relative",
              transition: "background 0.2s",
            }}
          >
            <div
              style={{
                width: "20px",
                height: "20px",
                borderRadius: "50%",
                background: "#FFFFFF",
                position: "absolute",
                top: "2px",
                left: form.enabled ? "22px" : "2px",
                transition: "left 0.2s",
                boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Dextrum",
  icon: BuildingStorefront,
  rank: 3,
})

export default DextrumPage
