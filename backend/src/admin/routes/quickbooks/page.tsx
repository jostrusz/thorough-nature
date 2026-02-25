import React, { useState, useCallback, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "@medusajs/ui"
import { defineRouteConfig } from "@medusajs/admin-sdk"
import { sdk } from "../../lib/sdk"

// ═══════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════

function PageStyles() {
  return (
    <style>{`
      @keyframes qbFadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
      .qb-card { transition: box-shadow 0.25s ease, border-color 0.25s ease; border: 1px solid #E1E3E5; border-radius: 10px; background: #FFF; }
      .qb-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.06); border-color: #D2D5D8; }
      .qb-btn { transition: all 0.15s ease; cursor: pointer; }
      .qb-btn:hover { background: #F6F6F7 !important; }
      .qb-btn:active { transform: scale(0.97); }
      .qb-btn-primary { transition: all 0.15s ease; cursor: pointer; }
      .qb-btn-primary:hover { filter: brightness(1.1); box-shadow: 0 2px 8px rgba(44,110,203,0.25); }
      .qb-input { transition: border-color 0.2s, box-shadow 0.2s; }
      .qb-input:focus { border-color: #2CA01C !important; box-shadow: 0 0 0 3px rgba(44,160,28,0.12); outline: none; }
      .qb-toggle { width: 40px; height: 22px; border-radius: 11px; border: none; cursor: pointer; transition: background 0.2s ease; position: relative; }
      .qb-toggle::after { content: ''; width: 18px; height: 18px; border-radius: 50%; background: #FFF; position: absolute; top: 2px; transition: left 0.2s ease; box-shadow: 0 1px 3px rgba(0,0,0,0.2); }
      .qb-toggle-on { background: #2CA01C; }
      .qb-toggle-on::after { left: 20px; }
      .qb-toggle-off { background: #C9CCCF; }
      .qb-toggle-off::after { left: 2px; }
      .qb-section-enter { animation: qbFadeIn 0.3s ease; }
      .qb-row { transition: background 0.12s ease; border-radius: 8px; }
      .qb-row:hover { background: #F9FAFB; }
      .qb-badge { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 600; }
      .qb-badge-connected { background: #D4EDDA; color: #155724; }
      .qb-badge-disconnected { background: #F8D7DA; color: #721C24; }
      .qb-badge-sandbox { background: #FFF3CD; color: #856404; }
      .qb-badge-production { background: #D4EDDA; color: #155724; }
      .qb-badge-active { background: #D4EDDA; color: #155724; }
      .qb-badge-inactive { background: #F8D7DA; color: #721C24; }
      .qb-connect-btn { transition: all 0.2s ease; cursor: pointer; }
      .qb-connect-btn:hover { box-shadow: 0 4px 12px rgba(44,160,28,0.3); transform: translateY(-1px); }
    `}</style>
  )
}

// ═══════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════

interface QuickBooksConfig {
  id: string
  project_id: string
  client_id: string
  client_secret: string
  environment: string
  access_token: string | null
  refresh_token: string | null
  access_token_expires_at: string | null
  refresh_token_expires_at: string | null
  realm_id: string | null
  default_item_id: string | null
  redirect_uri: string | null
  is_connected: boolean
  enabled: boolean
  created_at: string
  updated_at: string
}

// ═══════════════════════════════════════════
// HOOKS
// ═══════════════════════════════════════════

function useQuickBooksConfigs() {
  return useQuery({
    queryKey: ["quickbooks-configs"],
    queryFn: () =>
      sdk.client.fetch<{ quickbooks_configs: QuickBooksConfig[] }>(
        "/admin/quickbooks",
        { method: "GET" }
      ),
  })
}

// ═══════════════════════════════════════════
// TOGGLE COMPONENT
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
      className={`qb-toggle ${checked ? "qb-toggle-on" : "qb-toggle-off"}`}
      onClick={onChange}
      disabled={disabled}
      style={{ opacity: disabled ? 0.5 : 1 }}
    />
  )
}

// ═══════════════════════════════════════════
// QB ICON
// ═══════════════════════════════════════════

function QBIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="18" height="18" rx="3" fill="#2CA01C" />
      <text
        x="12"
        y="16"
        textAnchor="middle"
        fill="#FFF"
        fontSize="11"
        fontWeight="700"
        fontFamily="Arial"
      >
        QB
      </text>
    </svg>
  )
}

// ═══════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════

const QuickBooksPage = () => {
  const queryClient = useQueryClient()
  const { data, isLoading, error } = useQuickBooksConfigs()
  const configs = data?.quickbooks_configs || []

  // ── Form State ──
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({
    project_id: "",
    client_id: "",
    client_secret: "",
    environment: "sandbox",
    redirect_uri: "",
    default_item_id: "",
    enabled: true,
  })

  // ── Listen for OAuth popup message ──
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === "quickbooks-connected") {
        queryClient.invalidateQueries({ queryKey: ["quickbooks-configs"] })
        toast.success("QuickBooks connected successfully!")
      }
    }
    window.addEventListener("message", handler)
    return () => window.removeEventListener("message", handler)
  }, [queryClient])

  // ── Mutations ──
  const createMutation = useMutation({
    mutationFn: (data: Record<string, any>) =>
      sdk.client.fetch("/admin/quickbooks", {
        method: "POST",
        body: data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quickbooks-configs"] })
      toast.success("QuickBooks configuration created")
      resetForm()
    },
    onError: (err: any) => toast.error(err.message || "Failed to create"),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: Record<string, any>) =>
      sdk.client.fetch(`/admin/quickbooks/${id}`, {
        method: "POST",
        body: data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quickbooks-configs"] })
      toast.success("QuickBooks configuration updated")
      resetForm()
    },
    onError: (err: any) => toast.error(err.message || "Failed to update"),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      sdk.client.fetch(`/admin/quickbooks/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quickbooks-configs"] })
      toast.success("QuickBooks configuration deleted")
    },
    onError: (err: any) => toast.error(err.message || "Failed to delete"),
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      sdk.client.fetch(`/admin/quickbooks/${id}`, {
        method: "POST",
        body: { enabled },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quickbooks-configs"] })
    },
    onError: (err: any) => toast.error(err.message || "Failed to toggle"),
  })

  const connectMutation = useMutation({
    mutationFn: (configId: string) =>
      sdk.client.fetch<{ auth_url: string }>("/admin/quickbooks/auth-url", {
        method: "POST",
        body: { config_id: configId },
      }),
    onSuccess: (result) => {
      // Open OAuth popup
      const popup = window.open(
        result.auth_url,
        "quickbooks-oauth",
        "width=600,height=700,scrollbars=yes"
      )
      if (!popup) {
        toast.error("Popup blocked — please allow popups for this site")
      }
    },
    onError: (err: any) =>
      toast.error(err.message || "Failed to generate auth URL"),
  })

  const disconnectMutation = useMutation({
    mutationFn: (id: string) =>
      sdk.client.fetch(`/admin/quickbooks/${id}`, {
        method: "POST",
        body: {
          access_token: null,
          refresh_token: null,
          access_token_expires_at: null,
          refresh_token_expires_at: null,
          realm_id: null,
          is_connected: false,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quickbooks-configs"] })
      toast.success("QuickBooks disconnected")
    },
    onError: (err: any) =>
      toast.error(err.message || "Failed to disconnect"),
  })

  // ── Form helpers ──
  const resetForm = useCallback(() => {
    setShowForm(false)
    setEditingId(null)
    setForm({
      project_id: "",
      client_id: "",
      client_secret: "",
      environment: "sandbox",
      redirect_uri: "",
      default_item_id: "",
      enabled: true,
    })
  }, [])

  const startEdit = useCallback((config: QuickBooksConfig) => {
    setEditingId(config.id)
    setShowForm(true)
    setForm({
      project_id: config.project_id,
      client_id: config.client_id,
      client_secret: "",
      environment: config.environment,
      redirect_uri: config.redirect_uri || "",
      default_item_id: config.default_item_id || "",
      enabled: config.enabled,
    })
  }, [])

  const handleSubmit = useCallback(() => {
    if (!form.project_id || !form.client_id) {
      toast.error("Project ID and Client ID are required")
      return
    }

    if (editingId) {
      const payload: Record<string, any> = { id: editingId }
      if (form.project_id) payload.project_id = form.project_id
      if (form.client_id) payload.client_id = form.client_id
      if (form.client_secret) payload.client_secret = form.client_secret
      payload.environment = form.environment
      payload.redirect_uri = form.redirect_uri || null
      payload.default_item_id = form.default_item_id || null
      payload.enabled = form.enabled
      updateMutation.mutate(payload)
    } else {
      if (!form.client_secret) {
        toast.error("Client Secret is required for new configurations")
        return
      }
      createMutation.mutate({
        ...form,
        redirect_uri: form.redirect_uri || null,
        default_item_id: form.default_item_id || null,
      })
    }
  }, [form, editingId, createMutation, updateMutation])

  // ── Styles ──
  const pageStyle: React.CSSProperties = {
    width: "1000px",
    maxWidth: "calc(100vw - 280px)",
    margin: "0 auto",
    padding: "24px 32px",
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif",
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px 12px",
    borderRadius: "8px",
    border: "1px solid #E1E3E5",
    fontSize: "13px",
    color: "#1A1A1A",
    background: "#FFFFFF",
    boxSizing: "border-box",
  }

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "12px",
    fontWeight: 600,
    color: "#6D7175",
    marginBottom: "4px",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  }

  return (
    <div style={pageStyle}>
      <PageStyles />

      {/* ── Header ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "24px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <QBIcon size={22} />
          <h1
            style={{
              fontSize: "20px",
              fontWeight: 600,
              color: "#1A1A1A",
              margin: 0,
            }}
          >
            QuickBooks
          </h1>
        </div>
        <button
          className="qb-btn-primary"
          onClick={() => {
            resetForm()
            setShowForm(true)
          }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "8px 16px",
            borderRadius: "8px",
            fontSize: "13px",
            fontWeight: 600,
            border: "none",
            background: "#2CA01C",
            color: "#FFF",
          }}
        >
          + Add QuickBooks Config
        </button>
      </div>

      {/* ── Description ── */}
      <div
        className="qb-card"
        style={{
          padding: "16px 20px",
          marginBottom: "20px",
          display: "flex",
          alignItems: "flex-start",
          gap: "12px",
          background: "#F0FFF0",
          borderColor: "#A5D6A7",
        }}
      >
        <span style={{ fontSize: "20px" }}>📗</span>
        <div
          style={{ fontSize: "13px", color: "#1B5E20", lineHeight: "1.5" }}
        >
          <strong>How it works:</strong> Each project connects to a QuickBooks
          Online company via OAuth. When a paid order is placed, an invoice is
          automatically created in QuickBooks, a payment is recorded, and the
          invoice link is stored on the order. Click "Connect to QuickBooks"
          to authorize access.
          <br />
          <span style={{ color: "#388E3C" }}>
            Set up your app at{" "}
            <strong>developer.intuit.com</strong> → My Apps → create an app →
            copy Client ID & Secret.
          </span>
        </div>
      </div>

      {/* ── Create / Edit Form ── */}
      {showForm && (
        <div
          className="qb-card qb-section-enter"
          style={{ padding: "20px", marginBottom: "20px" }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "16px",
            }}
          >
            <h2
              style={{
                fontSize: "15px",
                fontWeight: 600,
                color: "#1A1A1A",
                margin: 0,
              }}
            >
              {editingId
                ? "Edit QuickBooks Configuration"
                : "New QuickBooks Configuration"}
            </h2>
            <button
              className="qb-btn"
              onClick={resetForm}
              style={{
                border: "none",
                background: "transparent",
                fontSize: "18px",
                color: "#8C9196",
                padding: "4px 8px",
                borderRadius: "6px",
              }}
            >
              ✕
            </button>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "14px",
              marginBottom: "16px",
            }}
          >
            {/* Project ID */}
            <div>
              <label style={labelStyle}>Project ID (slug)</label>
              <input
                className="qb-input"
                style={inputStyle}
                placeholder="e.g. everchapter"
                value={form.project_id}
                onChange={(e) =>
                  setForm({ ...form, project_id: e.target.value })
                }
              />
            </div>

            {/* Environment */}
            <div>
              <label style={labelStyle}>Environment</label>
              <select
                className="qb-input"
                style={inputStyle}
                value={form.environment}
                onChange={(e) =>
                  setForm({ ...form, environment: e.target.value })
                }
              >
                <option value="sandbox">Sandbox</option>
                <option value="production">Production</option>
              </select>
            </div>

            {/* Client ID */}
            <div>
              <label style={labelStyle}>Client ID</label>
              <input
                className="qb-input"
                style={inputStyle}
                placeholder="OAuth Client ID"
                value={form.client_id}
                onChange={(e) =>
                  setForm({ ...form, client_id: e.target.value })
                }
              />
            </div>

            {/* Client Secret */}
            <div>
              <label style={labelStyle}>
                Client Secret
                {editingId && (
                  <span
                    style={{
                      fontWeight: 400,
                      color: "#8C9196",
                      marginLeft: "6px",
                    }}
                  >
                    (leave empty to keep current)
                  </span>
                )}
              </label>
              <input
                className="qb-input"
                style={{
                  ...inputStyle,
                  fontFamily: "monospace",
                  fontSize: "12px",
                }}
                placeholder="OAuth Client Secret"
                type="password"
                value={form.client_secret}
                onChange={(e) =>
                  setForm({ ...form, client_secret: e.target.value })
                }
              />
            </div>

            {/* Redirect URI */}
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>
                OAuth Redirect URI
                <span
                  style={{
                    fontWeight: 400,
                    color: "#8C9196",
                    marginLeft: "6px",
                  }}
                >
                  (must match your Intuit app settings)
                </span>
              </label>
              <input
                className="qb-input"
                style={{ ...inputStyle, fontFamily: "monospace", fontSize: "12px" }}
                placeholder="e.g. https://yourstore.com/store/quickbooks/callback"
                value={form.redirect_uri}
                onChange={(e) =>
                  setForm({ ...form, redirect_uri: e.target.value })
                }
              />
            </div>

            {/* Default Item ID */}
            <div>
              <label style={labelStyle}>
                Default Item/Service ID
                <span
                  style={{
                    fontWeight: 400,
                    color: "#8C9196",
                    marginLeft: "6px",
                  }}
                >
                  (optional)
                </span>
              </label>
              <input
                className="qb-input"
                style={inputStyle}
                placeholder="e.g. 1"
                value={form.default_item_id}
                onChange={(e) =>
                  setForm({ ...form, default_item_id: e.target.value })
                }
              />
            </div>

            {/* Enabled toggle */}
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                gap: "10px",
                paddingBottom: "2px",
              }}
            >
              <Toggle
                checked={form.enabled}
                onChange={() => setForm({ ...form, enabled: !form.enabled })}
              />
              <span style={{ fontSize: "13px", color: "#6D7175" }}>
                {form.enabled ? "Invoicing active" : "Invoicing paused"}
              </span>
            </div>
          </div>

          <div
            style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}
          >
            <button
              className="qb-btn"
              onClick={resetForm}
              style={{
                padding: "8px 16px",
                borderRadius: "8px",
                fontSize: "13px",
                fontWeight: 500,
                border: "1px solid #E1E3E5",
                background: "#FFFFFF",
                color: "#6D7175",
              }}
            >
              Cancel
            </button>
            <button
              className="qb-btn-primary"
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
              style={{
                padding: "8px 20px",
                borderRadius: "8px",
                fontSize: "13px",
                fontWeight: 600,
                border: "none",
                background: "#2CA01C",
                color: "#FFF",
                opacity:
                  createMutation.isPending || updateMutation.isPending
                    ? 0.7
                    : 1,
              }}
            >
              {createMutation.isPending || updateMutation.isPending
                ? "Saving..."
                : editingId
                ? "Update"
                : "Create"}
            </button>
          </div>
        </div>
      )}

      {/* ── Configs List ── */}
      {isLoading ? (
        <div
          style={{ textAlign: "center", padding: "40px", color: "#8C9196" }}
        >
          Loading QuickBooks configurations...
        </div>
      ) : error ? (
        <div
          style={{ textAlign: "center", padding: "40px", color: "#9E2B25" }}
        >
          Error loading configurations
        </div>
      ) : configs.length === 0 ? (
        <div
          className="qb-card"
          style={{
            padding: "48px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "36px", marginBottom: "12px" }}>📗</div>
          <h3
            style={{
              fontSize: "16px",
              fontWeight: 600,
              color: "#1A1A1A",
              marginBottom: "6px",
            }}
          >
            No QuickBooks configurations yet
          </h3>
          <p style={{ fontSize: "13px", color: "#8C9196", margin: 0 }}>
            Click "Add QuickBooks Config" to set up automatic invoicing for a
            project.
          </p>
        </div>
      ) : (
        <div
          style={{ display: "flex", flexDirection: "column", gap: "12px" }}
        >
          {configs.map((config) => (
            <div
              key={config.id}
              className="qb-card qb-section-enter"
              style={{ padding: "0" }}
            >
              {/* Card Header */}
              <div
                className="qb-row"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "16px 20px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "14px",
                  }}
                >
                  <div
                    style={{
                      width: "40px",
                      height: "40px",
                      borderRadius: "10px",
                      background: config.is_connected
                        ? "linear-gradient(135deg, #2CA01C, #45B035)"
                        : "#E1E3E5",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      color: "#FFF",
                      fontWeight: 700,
                      fontSize: "12px",
                    }}
                  >
                    QB
                  </div>

                  <div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "15px",
                          fontWeight: 600,
                          color: "#1A1A1A",
                        }}
                      >
                        {config.project_id}
                      </span>
                      {config.is_connected ? (
                        <span className="qb-badge qb-badge-connected">
                          ● Connected
                        </span>
                      ) : (
                        <span className="qb-badge qb-badge-disconnected">
                          ● Not Connected
                        </span>
                      )}
                      {config.enabled ? (
                        <span className="qb-badge qb-badge-active">
                          Active
                        </span>
                      ) : (
                        <span className="qb-badge qb-badge-inactive">
                          Paused
                        </span>
                      )}
                      <span
                        className={`qb-badge ${
                          config.environment === "production"
                            ? "qb-badge-production"
                            : "qb-badge-sandbox"
                        }`}
                      >
                        {config.environment}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: "12px",
                        color: "#8C9196",
                        marginTop: "2px",
                      }}
                    >
                      Client ID:{" "}
                      <code
                        style={{
                          background: "#F6F6F7",
                          padding: "1px 5px",
                          borderRadius: "4px",
                        }}
                      >
                        {config.client_id}
                      </code>
                      {config.realm_id && (
                        <>
                          <span
                            style={{ margin: "0 8px", color: "#D2D5D8" }}
                          >
                            |
                          </span>
                          Realm:{" "}
                          <code
                            style={{
                              background: "#F6F6F7",
                              padding: "1px 5px",
                              borderRadius: "4px",
                            }}
                          >
                            {config.realm_id}
                          </code>
                        </>
                      )}
                      {config.default_item_id && (
                        <>
                          <span
                            style={{ margin: "0 8px", color: "#D2D5D8" }}
                          >
                            |
                          </span>
                          Item ID:{" "}
                          <code
                            style={{
                              background: "#F6F6F7",
                              padding: "1px 5px",
                              borderRadius: "4px",
                            }}
                          >
                            {config.default_item_id}
                          </code>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                  }}
                >
                  <Toggle
                    checked={config.enabled}
                    onChange={() =>
                      toggleMutation.mutate({
                        id: config.id,
                        enabled: !config.enabled,
                      })
                    }
                  />

                  {config.is_connected ? (
                    <button
                      className="qb-btn"
                      onClick={() => {
                        if (
                          confirm(
                            "Disconnect from QuickBooks? You'll need to reconnect to create invoices."
                          )
                        ) {
                          disconnectMutation.mutate(config.id)
                        }
                      }}
                      style={{
                        padding: "6px 12px",
                        borderRadius: "6px",
                        fontSize: "12px",
                        fontWeight: 500,
                        border: "1px solid #FED3D1",
                        background: "#FFF5F5",
                        color: "#9E2B25",
                      }}
                    >
                      Disconnect
                    </button>
                  ) : (
                    <button
                      className="qb-connect-btn"
                      onClick={() => connectMutation.mutate(config.id)}
                      disabled={connectMutation.isPending}
                      style={{
                        padding: "6px 16px",
                        borderRadius: "6px",
                        fontSize: "12px",
                        fontWeight: 600,
                        border: "none",
                        background: "#2CA01C",
                        color: "#FFF",
                        opacity: connectMutation.isPending ? 0.7 : 1,
                      }}
                    >
                      {connectMutation.isPending
                        ? "..."
                        : "Connect to QuickBooks"}
                    </button>
                  )}

                  <button
                    className="qb-btn"
                    onClick={() => startEdit(config)}
                    style={{
                      padding: "6px 12px",
                      borderRadius: "6px",
                      fontSize: "12px",
                      fontWeight: 500,
                      border: "1px solid #E1E3E5",
                      background: "#FFF",
                      color: "#6D7175",
                    }}
                  >
                    Edit
                  </button>
                  <button
                    className="qb-btn"
                    onClick={() => {
                      if (
                        confirm(
                          `Delete QuickBooks config for "${config.project_id}"?`
                        )
                      ) {
                        deleteMutation.mutate(config.id)
                      }
                    }}
                    style={{
                      padding: "6px 12px",
                      borderRadius: "6px",
                      fontSize: "12px",
                      fontWeight: 500,
                      border: "1px solid #FED3D1",
                      background: "#FFF5F5",
                      color: "#9E2B25",
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>

              {/* Info Strip */}
              <div
                style={{
                  borderTop: "1px solid #F1F1F1",
                  padding: "10px 20px",
                  display: "flex",
                  gap: "20px",
                  fontSize: "11px",
                  color: "#8C9196",
                }}
              >
                <span>
                  <strong style={{ color: "#6D7175" }}>Redirect URI:</strong>{" "}
                  {config.redirect_uri || "Not set"}
                </span>
                {config.access_token_expires_at && (
                  <>
                    <span style={{ color: "#D2D5D8" }}>|</span>
                    <span>
                      <strong style={{ color: "#6D7175" }}>
                        Token expires:
                      </strong>{" "}
                      {new Date(
                        config.access_token_expires_at
                      ).toLocaleString()}
                    </span>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Setup Reference ── */}
      <div
        className="qb-card"
        style={{
          marginTop: "24px",
          padding: "20px",
        }}
      >
        <h3
          style={{
            fontSize: "14px",
            fontWeight: 600,
            color: "#1A1A1A",
            marginBottom: "12px",
          }}
        >
          🔧 Setup Guide
        </h3>
        <div
          style={{
            fontSize: "12px",
            color: "#6D7175",
            lineHeight: "1.8",
          }}
        >
          <div style={{ marginBottom: "8px" }}>
            <strong>1.</strong> Go to{" "}
            <code
              style={{
                background: "#F6F6F7",
                padding: "1px 5px",
                borderRadius: "4px",
              }}
            >
              developer.intuit.com
            </code>{" "}
            → Create an app → get Client ID & Secret
          </div>
          <div style={{ marginBottom: "8px" }}>
            <strong>2.</strong> Set the Redirect URI in your Intuit app
            settings to:{" "}
            <code
              style={{
                background: "#F6F6F7",
                padding: "1px 5px",
                borderRadius: "4px",
              }}
            >
              https://yourstore.com/store/quickbooks/callback
            </code>
          </div>
          <div style={{ marginBottom: "8px" }}>
            <strong>3.</strong> Create a config here with the same Redirect
            URI
          </div>
          <div style={{ marginBottom: "8px" }}>
            <strong>4.</strong> Click "Connect to QuickBooks" to authorize
          </div>
          <div>
            <strong>5.</strong> Set the Default Item/Service ID (find it in
            QuickBooks → Sales → Products & Services)
          </div>
        </div>
      </div>
    </div>
  )
}

export default QuickBooksPage

export const config = defineRouteConfig({
  label: "QuickBooks",
})
