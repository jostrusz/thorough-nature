import React, { useState, useCallback } from "react"
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
      @keyframes fkFadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
      .fk-card { transition: box-shadow 0.25s ease, border-color 0.25s ease; border: 1px solid #E1E3E5; border-radius: 10px; background: #FFF; }
      .fk-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.06); border-color: #D2D5D8; }
      .fk-btn { transition: all 0.15s ease; cursor: pointer; }
      .fk-btn:hover { background: #F6F6F7 !important; }
      .fk-btn:active { transform: scale(0.97); }
      .fk-btn-primary { transition: all 0.15s ease; cursor: pointer; }
      .fk-btn-primary:hover { filter: brightness(1.1); box-shadow: 0 2px 8px rgba(0,128,96,0.25); }
      .fk-input { transition: border-color 0.2s, box-shadow 0.2s; }
      .fk-input:focus { border-color: #2E7D32 !important; box-shadow: 0 0 0 3px rgba(46,125,50,0.12); outline: none; }
      .fk-toggle { width: 40px; height: 22px; border-radius: 11px; border: none; cursor: pointer; transition: background 0.2s ease; position: relative; }
      .fk-toggle::after { content: ''; width: 18px; height: 18px; border-radius: 50%; background: #FFF; position: absolute; top: 2px; transition: left 0.2s ease; box-shadow: 0 1px 3px rgba(0,0,0,0.2); }
      .fk-toggle-on { background: #2E7D32; }
      .fk-toggle-on::after { left: 20px; }
      .fk-toggle-off { background: #C9CCCF; }
      .fk-toggle-off::after { left: 2px; }
      .fk-section-enter { animation: fkFadeIn 0.3s ease; }
      .fk-row { transition: background 0.12s ease; border-radius: 8px; }
      .fk-row:hover { background: #F9FAFB; }
      .fk-badge { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 600; }
      .fk-badge-active { background: #D4EDDA; color: #155724; }
      .fk-badge-inactive { background: #F8D7DA; color: #721C24; }
      .fk-test-btn { transition: all 0.15s ease; cursor: pointer; }
      .fk-test-btn:hover { background: #E8F5E9 !important; border-color: #2E7D32 !important; }
    `}</style>
  )
}

// ═══════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════

interface FakturoidConfig {
  id: string
  project_id: string
  slug: string
  client_id: string
  client_secret: string
  user_agent_email: string
  access_token: string | null
  token_expires_at: string | null
  enabled: boolean
  default_language: string
  created_at: string
  updated_at: string
}

// ═══════════════════════════════════════════
// HOOKS
// ═══════════════════════════════════════════

function useFakturoidConfigs() {
  return useQuery({
    queryKey: ["fakturoid-configs"],
    queryFn: () =>
      sdk.client.fetch<{ fakturoid_configs: FakturoidConfig[] }>(
        "/admin/fakturoid",
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
      className={`fk-toggle ${checked ? "fk-toggle-on" : "fk-toggle-off"}`}
      onClick={onChange}
      disabled={disabled}
      style={{ opacity: disabled ? 0.5 : 1 }}
    />
  )
}

// ═══════════════════════════════════════════
// FAKTUROID ICON
// ═══════════════════════════════════════════

function FakturoidIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="18" height="18" rx="3" fill="#2E7D32" />
      <text
        x="12"
        y="16"
        textAnchor="middle"
        fill="#FFF"
        fontSize="12"
        fontWeight="700"
        fontFamily="Arial"
      >
        F
      </text>
    </svg>
  )
}

// ═══════════════════════════════════════════
// LANGUAGES
// ═══════════════════════════════════════════

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "cz", label: "Czech" },
  { code: "sk", label: "Slovak" },
  { code: "de", label: "German" },
  { code: "pl", label: "Polish" },
  { code: "hu", label: "Hungarian" },
  { code: "fr", label: "French" },
  { code: "es", label: "Spanish" },
  { code: "it", label: "Italian" },
  { code: "ro", label: "Romanian" },
  { code: "ru", label: "Russian" },
]

// ═══════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════

const FakturoidPage = () => {
  const queryClient = useQueryClient()
  const { data, isLoading, error } = useFakturoidConfigs()
  const configs = data?.fakturoid_configs || []

  // ── Form State ──
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({
    project_id: "",
    slug: "",
    client_id: "",
    client_secret: "",
    user_agent_email: "",
    default_language: "en",
    enabled: true,
  })

  // ── Test connection state ──
  const [testResult, setTestResult] = useState<{
    success?: boolean
    error?: string
  } | null>(null)

  // ── Mutations ──
  const createMutation = useMutation({
    mutationFn: (data: Record<string, any>) =>
      sdk.client.fetch("/admin/fakturoid", {
        method: "POST",
        body: data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fakturoid-configs"] })
      toast.success("Fakturoid configuration created")
      resetForm()
    },
    onError: (err: any) => toast.error(err.message || "Failed to create"),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: Record<string, any>) =>
      sdk.client.fetch(`/admin/fakturoid/${id}`, {
        method: "POST",
        body: data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fakturoid-configs"] })
      toast.success("Fakturoid configuration updated")
      resetForm()
    },
    onError: (err: any) => toast.error(err.message || "Failed to update"),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      sdk.client.fetch(`/admin/fakturoid/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fakturoid-configs"] })
      toast.success("Fakturoid configuration deleted")
    },
    onError: (err: any) => toast.error(err.message || "Failed to delete"),
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      sdk.client.fetch(`/admin/fakturoid/${id}`, {
        method: "POST",
        body: { enabled },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fakturoid-configs"] })
    },
    onError: (err: any) => toast.error(err.message || "Failed to toggle"),
  })

  const testMutation = useMutation({
    mutationFn: (data: Record<string, any>) =>
      sdk.client.fetch<{ success: boolean; error?: string }>(
        "/admin/fakturoid/test-connection",
        { method: "POST", body: data }
      ),
    onSuccess: (result) => {
      setTestResult(result)
      if (result.success) {
        toast.success("Connection successful!")
      } else {
        toast.error(result.error || "Connection failed")
      }
    },
    onError: (err: any) => {
      setTestResult({ success: false, error: err.message })
      toast.error(err.message || "Connection test failed")
    },
  })

  // ── Form helpers ──
  const resetForm = useCallback(() => {
    setShowForm(false)
    setEditingId(null)
    setTestResult(null)
    setForm({
      project_id: "",
      slug: "",
      client_id: "",
      client_secret: "",
      user_agent_email: "",
      default_language: "en",
      enabled: true,
    })
  }, [])

  const startEdit = useCallback((config: FakturoidConfig) => {
    setEditingId(config.id)
    setShowForm(true)
    setTestResult(null)
    setForm({
      project_id: config.project_id,
      slug: config.slug,
      client_id: config.client_id,
      client_secret: "",
      user_agent_email: config.user_agent_email,
      default_language: config.default_language || "en",
      enabled: config.enabled,
    })
  }, [])

  const handleSubmit = useCallback(() => {
    if (
      !form.project_id ||
      !form.slug ||
      !form.client_id ||
      !form.user_agent_email
    ) {
      toast.error(
        "Project ID, Slug, Client ID, and User Agent Email are required"
      )
      return
    }

    if (editingId) {
      const payload: Record<string, any> = { id: editingId }
      if (form.project_id) payload.project_id = form.project_id
      if (form.slug) payload.slug = form.slug
      if (form.client_id) payload.client_id = form.client_id
      if (form.client_secret) payload.client_secret = form.client_secret
      if (form.user_agent_email)
        payload.user_agent_email = form.user_agent_email
      payload.default_language = form.default_language
      payload.enabled = form.enabled
      updateMutation.mutate(payload)
    } else {
      if (!form.client_secret) {
        toast.error("Client Secret is required for new configurations")
        return
      }
      createMutation.mutate(form)
    }
  }, [form, editingId, createMutation, updateMutation])

  const handleTestConnection = useCallback(() => {
    if (!form.slug || !form.client_id || !form.client_secret || !form.user_agent_email) {
      toast.error("Fill in Slug, Client ID, Client Secret, and Email to test")
      return
    }
    setTestResult(null)
    testMutation.mutate({
      slug: form.slug,
      client_id: form.client_id,
      client_secret: form.client_secret,
      user_agent_email: form.user_agent_email,
    })
  }, [form, testMutation])

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
          <FakturoidIcon size={22} />
          <h1
            style={{
              fontSize: "20px",
              fontWeight: 600,
              color: "#1A1A1A",
              margin: 0,
            }}
          >
            Fakturoid
          </h1>
        </div>
        <button
          className="fk-btn-primary"
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
            background: "#2E7D32",
            color: "#FFF",
          }}
        >
          + Add Fakturoid Config
        </button>
      </div>

      {/* ── Description ── */}
      <div
        className="fk-card"
        style={{
          padding: "16px 20px",
          marginBottom: "20px",
          display: "flex",
          alignItems: "flex-start",
          gap: "12px",
          background: "#E8F5E9",
          borderColor: "#A5D6A7",
        }}
      >
        <span style={{ fontSize: "20px" }}>🧾</span>
        <div
          style={{ fontSize: "13px", color: "#1B5E20", lineHeight: "1.5" }}
        >
          <strong>How it works:</strong> Each project connects to a Fakturoid
          account via its slug. When a paid order is placed, an invoice is
          automatically created in Fakturoid, marked as paid, and the invoice
          link is stored on the order. The invoice language is set based on
          the customer's country, and OSS mode is enabled for non-CZ orders.
          <br />
          <span style={{ color: "#388E3C" }}>
            Find your API credentials in Fakturoid → Settings → API.
          </span>
        </div>
      </div>

      {/* ── Create / Edit Form ── */}
      {showForm && (
        <div
          className="fk-card fk-section-enter"
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
                ? "Edit Fakturoid Configuration"
                : "New Fakturoid Configuration"}
            </h2>
            <button
              className="fk-btn"
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
                className="fk-input"
                style={inputStyle}
                placeholder="e.g. performance-marketing"
                value={form.project_id}
                onChange={(e) =>
                  setForm({ ...form, project_id: e.target.value })
                }
              />
            </div>

            {/* Fakturoid Slug */}
            <div>
              <label style={labelStyle}>Fakturoid Account Slug</label>
              <input
                className="fk-input"
                style={inputStyle}
                placeholder="e.g. mycompany"
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
              />
            </div>

            {/* Client ID */}
            <div>
              <label style={labelStyle}>Client ID</label>
              <input
                className="fk-input"
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
                className="fk-input"
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

            {/* User Agent Email */}
            <div>
              <label style={labelStyle}>User Agent Email</label>
              <input
                className="fk-input"
                style={inputStyle}
                placeholder="e.g. admin@company.com"
                value={form.user_agent_email}
                onChange={(e) =>
                  setForm({ ...form, user_agent_email: e.target.value })
                }
              />
            </div>

            {/* Default Language */}
            <div>
              <label style={labelStyle}>Default Language</label>
              <select
                className="fk-input"
                style={inputStyle}
                value={form.default_language}
                onChange={(e) =>
                  setForm({ ...form, default_language: e.target.value })
                }
              >
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label} ({l.code})
                  </option>
                ))}
              </select>
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

          {/* Test connection result */}
          {testResult && (
            <div
              style={{
                padding: "10px 14px",
                borderRadius: "8px",
                marginBottom: "14px",
                background: testResult.success ? "#E8F5E9" : "#FFEBEE",
                border: `1px solid ${testResult.success ? "#A5D6A7" : "#EF9A9A"}`,
                fontSize: "13px",
                color: testResult.success ? "#1B5E20" : "#B71C1C",
              }}
            >
              {testResult.success
                ? "✓ Connection successful — OAuth token retrieved"
                : `✗ Connection failed: ${testResult.error}`}
            </div>
          )}

          <div
            style={{
              display: "flex",
              gap: "8px",
              justifyContent: "space-between",
            }}
          >
            <button
              className="fk-test-btn"
              onClick={handleTestConnection}
              disabled={testMutation.isPending}
              style={{
                padding: "8px 16px",
                borderRadius: "8px",
                fontSize: "13px",
                fontWeight: 500,
                border: "1px solid #A5D6A7",
                background: "#FFF",
                color: "#2E7D32",
                opacity: testMutation.isPending ? 0.7 : 1,
              }}
            >
              {testMutation.isPending ? "Testing..." : "🔗 Test Connection"}
            </button>

            <div style={{ display: "flex", gap: "8px" }}>
              <button
                className="fk-btn"
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
                className="fk-btn-primary"
                onClick={handleSubmit}
                disabled={
                  createMutation.isPending || updateMutation.isPending
                }
                style={{
                  padding: "8px 20px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: 600,
                  border: "none",
                  background: "#2E7D32",
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
        </div>
      )}

      {/* ── Configs List ── */}
      {isLoading ? (
        <div
          style={{ textAlign: "center", padding: "40px", color: "#8C9196" }}
        >
          Loading Fakturoid configurations...
        </div>
      ) : error ? (
        <div
          style={{ textAlign: "center", padding: "40px", color: "#9E2B25" }}
        >
          Error loading configurations
        </div>
      ) : configs.length === 0 ? (
        <div
          className="fk-card"
          style={{
            padding: "48px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "36px", marginBottom: "12px" }}>🧾</div>
          <h3
            style={{
              fontSize: "16px",
              fontWeight: 600,
              color: "#1A1A1A",
              marginBottom: "6px",
            }}
          >
            No Fakturoid configurations yet
          </h3>
          <p style={{ fontSize: "13px", color: "#8C9196", margin: 0 }}>
            Click "Add Fakturoid Config" to set up automatic invoicing for a
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
              className="fk-card fk-section-enter"
              style={{ padding: "0" }}
            >
              {/* Card Header */}
              <div
                className="fk-row"
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
                      background: config.enabled
                        ? "linear-gradient(135deg, #2E7D32, #43A047)"
                        : "#E1E3E5",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      color: "#FFF",
                      fontWeight: 700,
                      fontSize: "18px",
                    }}
                  >
                    F
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
                      {config.enabled ? (
                        <span className="fk-badge fk-badge-active">
                          ● Active
                        </span>
                      ) : (
                        <span className="fk-badge fk-badge-inactive">
                          ● Paused
                        </span>
                      )}
                    </div>
                    <div
                      style={{
                        fontSize: "12px",
                        color: "#8C9196",
                        marginTop: "2px",
                      }}
                    >
                      Slug:{" "}
                      <code
                        style={{
                          background: "#F6F6F7",
                          padding: "1px 5px",
                          borderRadius: "4px",
                        }}
                      >
                        {config.slug}
                      </code>
                      <span
                        style={{
                          margin: "0 8px",
                          color: "#D2D5D8",
                        }}
                      >
                        |
                      </span>
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
                      <span
                        style={{
                          margin: "0 8px",
                          color: "#D2D5D8",
                        }}
                      >
                        |
                      </span>
                      Lang:{" "}
                      <code
                        style={{
                          background: "#F6F6F7",
                          padding: "1px 5px",
                          borderRadius: "4px",
                        }}
                      >
                        {config.default_language}
                      </code>
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
                  <button
                    className="fk-btn"
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
                    className="fk-btn"
                    onClick={() => {
                      if (
                        confirm(
                          `Delete Fakturoid config for "${config.project_id}"?`
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
                  <strong style={{ color: "#6D7175" }}>Email:</strong>{" "}
                  {config.user_agent_email}
                </span>
                <span style={{ color: "#D2D5D8" }}>|</span>
                <span>
                  <strong style={{ color: "#6D7175" }}>Token:</strong>{" "}
                  {config.access_token || "Not cached"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Language Reference ── */}
      <div
        className="fk-card"
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
          🌍 Country → Invoice Language Mapping
        </h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: "8px",
            fontSize: "12px",
          }}
        >
          {[
            { country: "CZ", lang: "cz", oss: "disabled" },
            { country: "SK", lang: "sk", oss: "goods" },
            { country: "DE / AT", lang: "de", oss: "goods" },
            { country: "PL", lang: "pl", oss: "goods" },
            { country: "HU", lang: "hu", oss: "goods" },
            { country: "FR", lang: "fr", oss: "goods" },
            { country: "ES", lang: "es", oss: "goods" },
            { country: "IT", lang: "it", oss: "goods" },
            { country: "RO", lang: "ro", oss: "goods" },
            { country: "Other", lang: "en (default)", oss: "goods" },
          ].map((e) => (
            <div
              key={e.country}
              className="fk-row"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "6px 12px",
              }}
            >
              <span style={{ fontWeight: 600, color: "#1A1A1A" }}>
                {e.country}
              </span>
              <span style={{ color: "#6D7175" }}>
                {e.lang} / OSS: {e.oss}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default FakturoidPage

export const config = defineRouteConfig({
  label: "Fakturoid",
  rank: 5,
})
