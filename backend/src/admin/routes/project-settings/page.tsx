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
      @keyframes psFadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
      .ps-card { transition: box-shadow 0.25s ease, border-color 0.25s ease; border: 1px solid #E1E3E5; border-radius: 10px; background: #FFF; }
      .ps-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.06); border-color: #D2D5D8; }
      .ps-btn { transition: all 0.15s ease; cursor: pointer; }
      .ps-btn:hover { background: #F6F6F7 !important; }
      .ps-btn:active { transform: scale(0.97); }
      .ps-btn-primary { transition: all 0.15s ease; cursor: pointer; }
      .ps-btn-primary:hover { filter: brightness(1.1); box-shadow: 0 2px 8px rgba(99,91,255,0.25); }
      .ps-input { transition: border-color 0.2s, box-shadow 0.2s; }
      .ps-input:focus { border-color: #635BFF !important; box-shadow: 0 0 0 3px rgba(99,91,255,0.12); outline: none; }
      .ps-toggle { width: 44px; height: 24px; border-radius: 12px; border: none; cursor: pointer; transition: background 0.2s ease; position: relative; }
      .ps-toggle::after { content: ''; width: 20px; height: 20px; border-radius: 50%; background: #FFF; position: absolute; top: 2px; transition: left 0.2s ease; box-shadow: 0 1px 3px rgba(0,0,0,0.2); }
      .ps-toggle-on { background: #635BFF; }
      .ps-toggle-on::after { left: 22px; }
      .ps-toggle-off { background: #C9CCCF; }
      .ps-toggle-off::after { left: 2px; }
      .ps-section-enter { animation: psFadeIn 0.3s ease; }
      .ps-row { transition: background 0.12s ease; border-radius: 8px; }
      .ps-row:hover { background: #F9FAFB; }
      .ps-badge { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 600; }
      .ps-badge-on { background: #D4EDDA; color: #155724; }
      .ps-badge-off { background: #F8D7DA; color: #721C24; }
      .ps-setting-row { display: flex; align-items: center; justify-content: space-between; padding: 14px 0; }
      .ps-setting-row + .ps-setting-row { border-top: 1px solid #F1F1F1; }
    `}</style>
  )
}

// ═══════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════

interface ProjectSettingsType {
  id: string
  project_id: string
  order_bump_enabled: boolean
  upsell_enabled: boolean
  foxentry_api_key: string | null
  created_at: string
  updated_at: string
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
      className={`ps-toggle ${checked ? "ps-toggle-on" : "ps-toggle-off"}`}
      onClick={onChange}
      disabled={disabled}
      style={{ opacity: disabled ? 0.5 : 1 }}
    />
  )
}

// ═══════════════════════════════════════════
// FOXENTRY KEY INPUT
// ═══════════════════════════════════════════

function FoxentryKeyInput({
  currentKey,
  onSave,
  disabled,
}: {
  currentKey: string | null
  onSave: (key: string) => void
  disabled?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState("")

  if (!editing && currentKey) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginLeft: "28px" }}>
        <code
          style={{
            flex: 1,
            padding: "6px 10px",
            borderRadius: "6px",
            background: "#F6F6F7",
            fontSize: "12px",
            fontFamily: "monospace",
            color: "#6D7175",
          }}
        >
          {currentKey.slice(0, 8)}{"····"}{currentKey.slice(-4)}
        </code>
        <button
          className="ps-btn"
          onClick={() => { setEditing(true); setValue("") }}
          style={{
            padding: "5px 10px",
            borderRadius: "6px",
            fontSize: "11px",
            fontWeight: 500,
            border: "1px solid #E1E3E5",
            background: "#FFF",
            color: "#6D7175",
          }}
        >
          Change
        </button>
        <button
          className="ps-btn"
          onClick={() => onSave("")}
          disabled={disabled}
          style={{
            padding: "5px 10px",
            borderRadius: "6px",
            fontSize: "11px",
            fontWeight: 500,
            border: "1px solid #FED3D1",
            background: "#FFF5F5",
            color: "#9E2B25",
          }}
        >
          Remove
        </button>
      </div>
    )
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginLeft: "28px" }}>
      <input
        className="ps-input"
        style={{
          flex: 1,
          padding: "6px 10px",
          borderRadius: "6px",
          border: "1px solid #E1E3E5",
          fontSize: "12px",
          fontFamily: "monospace",
          color: "#1A1A1A",
        }}
        placeholder="Enter Foxentry API key..."
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <button
        className="ps-btn-primary"
        onClick={() => {
          if (value.trim()) {
            onSave(value.trim())
            setEditing(false)
          }
        }}
        disabled={disabled || !value.trim()}
        style={{
          padding: "5px 14px",
          borderRadius: "6px",
          fontSize: "11px",
          fontWeight: 600,
          border: "none",
          background: "#635BFF",
          color: "#FFF",
          opacity: disabled || !value.trim() ? 0.5 : 1,
        }}
      >
        Save
      </button>
      {currentKey && (
        <button
          className="ps-btn"
          onClick={() => setEditing(false)}
          style={{
            padding: "5px 10px",
            borderRadius: "6px",
            fontSize: "11px",
            fontWeight: 500,
            border: "1px solid #E1E3E5",
            background: "#FFF",
            color: "#6D7175",
          }}
        >
          Cancel
        </button>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════

const ProjectSettingsPage = () => {
  const queryClient = useQueryClient()

  const { data, isLoading, error } = useQuery({
    queryKey: ["project-settings"],
    queryFn: () =>
      sdk.client.fetch<{ project_settings: ProjectSettingsType[] }>(
        "/admin/project-settings",
        { method: "GET" }
      ),
  })

  const settings = data?.project_settings || []

  // ── Form State ──
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ project_id: "" })

  // ── Mutations ──
  const createMutation = useMutation({
    mutationFn: (data: Record<string, any>) =>
      sdk.client.fetch("/admin/project-settings", {
        method: "POST",
        body: data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-settings"] })
      toast.success("Project settings created")
      setShowForm(false)
      setForm({ project_id: "" })
    },
    onError: (err: any) => toast.error(err.message || "Failed to create"),
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: string; [key: string]: any }) =>
      sdk.client.fetch(`/admin/project-settings/${id}`, {
        method: "POST",
        body: data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-settings"] })
    },
    onError: (err: any) => toast.error(err.message || "Failed to update"),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      sdk.client.fetch(`/admin/project-settings/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-settings"] })
      toast.success("Project settings deleted")
    },
    onError: (err: any) => toast.error(err.message || "Failed to delete"),
  })

  // ── Styles ──
  const pageStyle: React.CSSProperties = {
    width: "900px",
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
          <span style={{ fontSize: "22px" }}>⚙️</span>
          <h1 style={{ fontSize: "20px", fontWeight: 600, color: "#1A1A1A", margin: 0 }}>
            Project Settings
          </h1>
        </div>
        <button
          className="ps-btn-primary"
          onClick={() => setShowForm(true)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "8px 16px",
            borderRadius: "8px",
            fontSize: "13px",
            fontWeight: 600,
            border: "none",
            background: "#635BFF",
            color: "#FFF",
          }}
        >
          + Add Project
        </button>
      </div>

      {/* ── Info Box ── */}
      <div
        className="ps-card"
        style={{
          padding: "16px 20px",
          marginBottom: "20px",
          display: "flex",
          alignItems: "flex-start",
          gap: "12px",
          background: "#F5F3FF",
          borderColor: "#D9D2FF",
        }}
      >
        <span style={{ fontSize: "20px" }}>ℹ️</span>
        <div style={{ fontSize: "13px", color: "#3D2E7C", lineHeight: "1.5" }}>
          <strong>Checkout feature toggles per project.</strong> Control which features
          are shown on each project's checkout page.
          <br />
          <strong>Order Bump:</strong> The upsell product offer shown in the checkout sidebar
          (e.g. "Add Het Leven Dat Je Verdient for €23").
          <br />
          <strong>Post-Purchase Upsell:</strong> After successful payment, redirect to an upsell page
          instead of the thank-you page. When disabled, customers go straight to thank-you.
        </div>
      </div>

      {/* ── Create Form ── */}
      {showForm && (
        <div
          className="ps-card ps-section-enter"
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
            <h2 style={{ fontSize: "15px", fontWeight: 600, color: "#1A1A1A", margin: 0 }}>
              Add Project Settings
            </h2>
            <button
              className="ps-btn"
              onClick={() => {
                setShowForm(false)
                setForm({ project_id: "" })
              }}
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

          <div style={{ marginBottom: "16px" }}>
            <label
              style={{
                display: "block",
                fontSize: "12px",
                fontWeight: 600,
                color: "#6D7175",
                marginBottom: "4px",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              Project ID (slug)
            </label>
            <input
              className="ps-input"
              style={inputStyle}
              placeholder="e.g. loslatenboek"
              value={form.project_id}
              onChange={(e) => setForm({ project_id: e.target.value })}
            />
          </div>

          <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
            <button
              className="ps-btn"
              onClick={() => {
                setShowForm(false)
                setForm({ project_id: "" })
              }}
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
              className="ps-btn-primary"
              onClick={() => {
                if (!form.project_id) {
                  toast.error("Project ID is required")
                  return
                }
                createMutation.mutate({
                  project_id: form.project_id,
                  order_bump_enabled: true,
                  upsell_enabled: true,
                })
              }}
              disabled={createMutation.isPending}
              style={{
                padding: "8px 20px",
                borderRadius: "8px",
                fontSize: "13px",
                fontWeight: 600,
                border: "none",
                background: "#635BFF",
                color: "#FFF",
                opacity: createMutation.isPending ? 0.7 : 1,
              }}
            >
              {createMutation.isPending ? "Creating..." : "Create"}
            </button>
          </div>
        </div>
      )}

      {/* ── Settings List ── */}
      {isLoading ? (
        <div style={{ textAlign: "center", padding: "40px", color: "#8C9196" }}>
          Loading project settings...
        </div>
      ) : error ? (
        <div style={{ textAlign: "center", padding: "40px", color: "#9E2B25" }}>
          Error loading settings
        </div>
      ) : settings.length === 0 ? (
        <div
          className="ps-card"
          style={{ padding: "48px", textAlign: "center" }}
        >
          <div style={{ fontSize: "36px", marginBottom: "12px" }}>📦</div>
          <h3
            style={{
              fontSize: "16px",
              fontWeight: 600,
              color: "#1A1A1A",
              marginBottom: "6px",
            }}
          >
            No project settings yet
          </h3>
          <p style={{ fontSize: "13px", color: "#8C9196", margin: 0 }}>
            Click "Add Project" to configure checkout features for a project.
            <br />
            By default, order bump and upsell are enabled.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {settings.map((s) => (
            <div
              key={s.id}
              className="ps-card ps-section-enter"
              style={{ padding: "20px" }}
            >
              {/* Project Header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "16px",
                  paddingBottom: "12px",
                  borderBottom: "1px solid #F1F1F1",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "8px",
                      background: "linear-gradient(135deg, #635BFF, #4840CC)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#FFF",
                      fontWeight: 700,
                      fontSize: "14px",
                    }}
                  >
                    {s.project_id.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <span style={{ fontSize: "15px", fontWeight: 600, color: "#1A1A1A" }}>
                      {s.project_id}
                    </span>
                    <div style={{ fontSize: "11px", color: "#8C9196", marginTop: "1px" }}>
                      Project checkout settings
                    </div>
                  </div>
                </div>

                <button
                  className="ps-btn"
                  onClick={() => {
                    if (confirm(`Delete settings for "${s.project_id}"?`)) {
                      deleteMutation.mutate(s.id)
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

              {/* ── Order Bump Toggle ── */}
              <div className="ps-setting-row">
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "16px" }}>🛒</span>
                    <span style={{ fontSize: "14px", fontWeight: 600, color: "#1A1A1A" }}>
                      Order Bump
                    </span>
                    <span className={`ps-badge ${s.order_bump_enabled ? "ps-badge-on" : "ps-badge-off"}`}>
                      {s.order_bump_enabled ? "● ON" : "● OFF"}
                    </span>
                  </div>
                  <div style={{ fontSize: "12px", color: "#8C9196", marginTop: "4px", marginLeft: "28px" }}>
                    Show the upsell product offer in checkout sidebar.
                    When OFF, the order bump section is completely hidden.
                  </div>
                </div>
                <Toggle
                  checked={s.order_bump_enabled}
                  onChange={() =>
                    toggleMutation.mutate({
                      id: s.id,
                      order_bump_enabled: !s.order_bump_enabled,
                    })
                  }
                  disabled={toggleMutation.isPending}
                />
              </div>

              {/* ── Upsell Toggle ── */}
              <div className="ps-setting-row">
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "16px" }}>🎯</span>
                    <span style={{ fontSize: "14px", fontWeight: 600, color: "#1A1A1A" }}>
                      Post-Purchase Upsell
                    </span>
                    <span className={`ps-badge ${s.upsell_enabled ? "ps-badge-on" : "ps-badge-off"}`}>
                      {s.upsell_enabled ? "● ON" : "● OFF"}
                    </span>
                  </div>
                  <div style={{ fontSize: "12px", color: "#8C9196", marginTop: "4px", marginLeft: "28px" }}>
                    After payment, redirect to upsell page before thank-you.
                    When OFF, customers go directly to the thank-you page.
                  </div>
                </div>
                <Toggle
                  checked={s.upsell_enabled}
                  onChange={() =>
                    toggleMutation.mutate({
                      id: s.id,
                      upsell_enabled: !s.upsell_enabled,
                    })
                  }
                  disabled={toggleMutation.isPending}
                />
              </div>

              {/* ── Foxentry API Key ── */}
              <div className="ps-setting-row" style={{ flexDirection: "column", alignItems: "stretch", gap: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "16px" }}>🔍</span>
                  <span style={{ fontSize: "14px", fontWeight: 600, color: "#1A1A1A" }}>
                    Foxentry API Key
                  </span>
                  <span className={`ps-badge ${s.foxentry_api_key ? "ps-badge-on" : "ps-badge-off"}`}>
                    {s.foxentry_api_key ? "● Connected" : "● Not set"}
                  </span>
                </div>
                <div style={{ fontSize: "12px", color: "#8C9196", marginLeft: "28px", marginBottom: "4px" }}>
                  Smart address autocomplete, email/phone validation, and company lookup (KVK/BTW).
                  Powered by Foxentry AI. Get your key at{" "}
                  <a href="https://app.foxentry.com" target="_blank" rel="noopener" style={{ color: "#635BFF" }}>
                    app.foxentry.com
                  </a>
                </div>
                <FoxentryKeyInput
                  currentKey={s.foxentry_api_key}
                  onSave={(key) =>
                    toggleMutation.mutate({
                      id: s.id,
                      foxentry_api_key: key || null,
                    })
                  }
                  disabled={toggleMutation.isPending}
                />
              </div>

              {/* ── Promo Codes ── */}
              <div className="ps-setting-row" style={{ flexDirection: "column", alignItems: "stretch", gap: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "16px" }}>🏷️</span>
                  <span style={{ fontSize: "14px", fontWeight: 600, color: "#1A1A1A" }}>
                    Promo Codes
                  </span>
                </div>
                <div style={{ fontSize: "12px", color: "#8C9196", marginLeft: "28px", marginBottom: "4px" }}>
                  Promo codes worden beheerd via Medusa Promotions. Checkout valideert codes automatisch via de Medusa API.
                </div>
                <div style={{ marginLeft: "28px" }}>
                  <a
                    href="/app/promotions"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "6px 14px",
                      borderRadius: "6px",
                      fontSize: "12px",
                      fontWeight: 600,
                      background: "#F0EDFF",
                      color: "#3D2E7C",
                      textDecoration: "none",
                      transition: "all 0.15s ease",
                    }}
                  >
                    Promotions beheren →
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default ProjectSettingsPage

export const config = defineRouteConfig({
  label: "Project Settings",
  rank: 10,
})
