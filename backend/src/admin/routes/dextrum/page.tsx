import React, { useState, useCallback } from "react"
import { defineRouteConfig } from "@medusajs/admin-sdk"
import { BuildingStorefront } from "@medusajs/icons"
import { toast } from "@medusajs/ui"
import { useDextrumConfig, useSaveDextrumConfig, useTestDextrumConnection } from "../../hooks/use-dextrum"

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
})

export default DextrumPage
