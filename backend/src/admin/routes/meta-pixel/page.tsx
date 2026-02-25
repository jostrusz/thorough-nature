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
      @keyframes mpFadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
      .mp-card { transition: box-shadow 0.25s ease, border-color 0.25s ease; border: 1px solid #E1E3E5; border-radius: 10px; background: #FFF; }
      .mp-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.06); border-color: #D2D5D8; }
      .mp-btn { transition: all 0.15s ease; cursor: pointer; }
      .mp-btn:hover { background: #F6F6F7 !important; }
      .mp-btn:active { transform: scale(0.97); }
      .mp-btn-primary { transition: all 0.15s ease; cursor: pointer; }
      .mp-btn-primary:hover { filter: brightness(1.1); box-shadow: 0 2px 8px rgba(0,128,96,0.25); }
      .mp-input { transition: border-color 0.2s, box-shadow 0.2s; }
      .mp-input:focus { border-color: #1877F2 !important; box-shadow: 0 0 0 3px rgba(24,119,242,0.12); outline: none; }
      .mp-toggle { width: 40px; height: 22px; border-radius: 11px; border: none; cursor: pointer; transition: background 0.2s ease; position: relative; }
      .mp-toggle::after { content: ''; width: 18px; height: 18px; border-radius: 50%; background: #FFF; position: absolute; top: 2px; transition: left 0.2s ease; box-shadow: 0 1px 3px rgba(0,0,0,0.2); }
      .mp-toggle-on { background: #1877F2; }
      .mp-toggle-on::after { left: 20px; }
      .mp-toggle-off { background: #C9CCCF; }
      .mp-toggle-off::after { left: 2px; }
      .mp-section-enter { animation: mpFadeIn 0.3s ease; }
      .mp-row { transition: background 0.12s ease; border-radius: 8px; }
      .mp-row:hover { background: #F9FAFB; }
      .mp-badge { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 600; }
      .mp-badge-active { background: #D4EDDA; color: #155724; }
      .mp-badge-inactive { background: #F8D7DA; color: #721C24; }
      .mp-badge-test { background: #FFF3CD; color: #856404; }
    `}</style>
  )
}

// ═══════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════

interface MetaPixelConfig {
  id: string
  project_id: string
  pixel_id: string
  access_token: string
  test_event_code: string | null
  enabled: boolean
  created_at: string
  updated_at: string
}

// ═══════════════════════════════════════════
// HOOKS
// ═══════════════════════════════════════════

function useMetaPixelConfigs() {
  return useQuery({
    queryKey: ["meta-pixel-configs"],
    queryFn: () =>
      sdk.client.fetch<{ meta_pixel_configs: MetaPixelConfig[] }>(
        "/admin/meta-pixel",
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
      className={`mp-toggle ${checked ? "mp-toggle-on" : "mp-toggle-off"}`}
      onClick={onChange}
      disabled={disabled}
      style={{ opacity: disabled ? 0.5 : 1 }}
    />
  )
}

// ═══════════════════════════════════════════
// META PIXEL ICON (SVG)
// ═══════════════════════════════════════════

function MetaIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M12 2C6.477 2 2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12c0-5.523-4.477-10-10-10z"
        fill="#1877F2"
      />
    </svg>
  )
}

// ═══════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════

const MetaPixelPage = () => {
  const queryClient = useQueryClient()
  const { data, isLoading, error } = useMetaPixelConfigs()
  const configs = data?.meta_pixel_configs || []

  // ── Form State ──
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({
    project_id: "",
    pixel_id: "",
    access_token: "",
    test_event_code: "",
    enabled: true,
  })

  // ── Mutations ──
  const createMutation = useMutation({
    mutationFn: (data: Record<string, any>) =>
      sdk.client.fetch("/admin/meta-pixel", {
        method: "POST",
        body: data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meta-pixel-configs"] })
      toast.success("Pixel configuration created")
      resetForm()
    },
    onError: (err: any) => toast.error(err.message || "Failed to create"),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: Record<string, any>) =>
      sdk.client.fetch(`/admin/meta-pixel/${id}`, {
        method: "POST",
        body: data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meta-pixel-configs"] })
      toast.success("Pixel configuration updated")
      resetForm()
    },
    onError: (err: any) => toast.error(err.message || "Failed to update"),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      sdk.client.fetch(`/admin/meta-pixel/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meta-pixel-configs"] })
      toast.success("Pixel configuration deleted")
    },
    onError: (err: any) => toast.error(err.message || "Failed to delete"),
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      sdk.client.fetch(`/admin/meta-pixel/${id}`, {
        method: "POST",
        body: { enabled },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meta-pixel-configs"] })
    },
    onError: (err: any) => toast.error(err.message || "Failed to toggle"),
  })

  // ── Form helpers ──
  const resetForm = useCallback(() => {
    setShowForm(false)
    setEditingId(null)
    setForm({
      project_id: "",
      pixel_id: "",
      access_token: "",
      test_event_code: "",
      enabled: true,
    })
  }, [])

  const startEdit = useCallback((config: MetaPixelConfig) => {
    setEditingId(config.id)
    setShowForm(true)
    setForm({
      project_id: config.project_id,
      pixel_id: config.pixel_id,
      access_token: "", // Don't pre-fill — it's masked
      test_event_code: config.test_event_code || "",
      enabled: config.enabled,
    })
  }, [])

  const handleSubmit = useCallback(() => {
    if (!form.project_id || !form.pixel_id) {
      toast.error("Project ID and Pixel ID are required")
      return
    }

    if (editingId) {
      // Update — only send non-empty fields
      const payload: Record<string, any> = { id: editingId }
      if (form.project_id) payload.project_id = form.project_id
      if (form.pixel_id) payload.pixel_id = form.pixel_id
      if (form.access_token) payload.access_token = form.access_token
      payload.test_event_code = form.test_event_code || null
      payload.enabled = form.enabled
      updateMutation.mutate(payload)
    } else {
      if (!form.access_token) {
        toast.error("Access Token is required for new configurations")
        return
      }
      createMutation.mutate({
        ...form,
        test_event_code: form.test_event_code || null,
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
          <MetaIcon size={22} />
          <h1 style={{ fontSize: "20px", fontWeight: 600, color: "#1A1A1A", margin: 0 }}>
            Meta Pixel & CAPI
          </h1>
        </div>
        <button
          className="mp-btn-primary"
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
            background: "#1877F2",
            color: "#FFF",
          }}
        >
          + Add Project Pixel
        </button>
      </div>

      {/* ── Description ── */}
      <div
        className="mp-card"
        style={{
          padding: "16px 20px",
          marginBottom: "20px",
          display: "flex",
          alignItems: "flex-start",
          gap: "12px",
          background: "#F0F7FF",
          borderColor: "#B3D7FF",
        }}
      >
        <span style={{ fontSize: "20px" }}>ℹ️</span>
        <div style={{ fontSize: "13px", color: "#2C4A6E", lineHeight: "1.5" }}>
          <strong>How it works:</strong> Each project (e.g. loslatenboek) has its own
          Facebook Pixel ID and CAPI Access Token. The browser pixel fires on every
          page view and event. The server-side CAPI sends the same events with an
          identical <code>event_id</code> for deduplication. A backup Purchase event
          fires automatically on every <code>order.placed</code> via subscriber.
          <br />
          <span style={{ color: "#5A7A9A" }}>
            Set <strong>Test Event Code</strong> to debug in Facebook Events Manager →
            Pixel → Test Events.
          </span>
        </div>
      </div>

      {/* ── Create / Edit Form ── */}
      {showForm && (
        <div
          className="mp-card mp-section-enter"
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
              {editingId ? "Edit Pixel Configuration" : "New Pixel Configuration"}
            </h2>
            <button
              className="mp-btn"
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
                className="mp-input"
                style={inputStyle}
                placeholder="e.g. loslatenboek"
                value={form.project_id}
                onChange={(e) => setForm({ ...form, project_id: e.target.value })}
              />
            </div>

            {/* Pixel ID */}
            <div>
              <label style={labelStyle}>Facebook Pixel ID</label>
              <input
                className="mp-input"
                style={inputStyle}
                placeholder="e.g. 123456789012345"
                value={form.pixel_id}
                onChange={(e) => setForm({ ...form, pixel_id: e.target.value })}
              />
            </div>

            {/* Access Token */}
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>
                CAPI Access Token
                {editingId && (
                  <span style={{ fontWeight: 400, color: "#8C9196", marginLeft: "6px" }}>
                    (leave empty to keep current)
                  </span>
                )}
              </label>
              <input
                className="mp-input"
                style={{ ...inputStyle, fontFamily: "monospace", fontSize: "12px" }}
                placeholder="EAAxxxxxxxxxxxxxxx..."
                value={form.access_token}
                onChange={(e) => setForm({ ...form, access_token: e.target.value })}
              />
            </div>

            {/* Test Event Code */}
            <div>
              <label style={labelStyle}>
                Test Event Code
                <span style={{ fontWeight: 400, color: "#8C9196", marginLeft: "6px" }}>
                  (optional)
                </span>
              </label>
              <input
                className="mp-input"
                style={inputStyle}
                placeholder="e.g. TEST12345"
                value={form.test_event_code}
                onChange={(e) => setForm({ ...form, test_event_code: e.target.value })}
              />
            </div>

            {/* Enabled toggle */}
            <div style={{ display: "flex", alignItems: "flex-end", gap: "10px", paddingBottom: "2px" }}>
              <Toggle
                checked={form.enabled}
                onChange={() => setForm({ ...form, enabled: !form.enabled })}
              />
              <span style={{ fontSize: "13px", color: "#6D7175" }}>
                {form.enabled ? "Tracking active" : "Tracking paused"}
              </span>
            </div>
          </div>

          <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
            <button
              className="mp-btn"
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
              className="mp-btn-primary"
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
              style={{
                padding: "8px 20px",
                borderRadius: "8px",
                fontSize: "13px",
                fontWeight: 600,
                border: "none",
                background: "#1877F2",
                color: "#FFF",
                opacity: createMutation.isPending || updateMutation.isPending ? 0.7 : 1,
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
        <div style={{ textAlign: "center", padding: "40px", color: "#8C9196" }}>
          Loading pixel configurations...
        </div>
      ) : error ? (
        <div style={{ textAlign: "center", padding: "40px", color: "#9E2B25" }}>
          Error loading configurations
        </div>
      ) : configs.length === 0 ? (
        <div
          className="mp-card"
          style={{
            padding: "48px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "36px", marginBottom: "12px" }}>📊</div>
          <h3 style={{ fontSize: "16px", fontWeight: 600, color: "#1A1A1A", marginBottom: "6px" }}>
            No pixel configurations yet
          </h3>
          <p style={{ fontSize: "13px", color: "#8C9196", margin: 0 }}>
            Click "Add Project Pixel" to set up Meta tracking for a project.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {configs.map((config) => (
            <div
              key={config.id}
              className="mp-card mp-section-enter"
              style={{ padding: "0" }}
            >
              {/* Card Header */}
              <div
                className="mp-row"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "16px 20px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                  {/* FB icon */}
                  <div
                    style={{
                      width: "40px",
                      height: "40px",
                      borderRadius: "10px",
                      background: config.enabled
                        ? "linear-gradient(135deg, #1877F2, #0D65D9)"
                        : "#E1E3E5",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M12 2C6.477 2 2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12c0-5.523-4.477-10-10-10z"
                        fill="#FFF"
                      />
                    </svg>
                  </div>

                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "15px", fontWeight: 600, color: "#1A1A1A" }}>
                        {config.project_id}
                      </span>
                      {config.enabled ? (
                        <span className="mp-badge mp-badge-active">● Active</span>
                      ) : (
                        <span className="mp-badge mp-badge-inactive">● Paused</span>
                      )}
                      {config.test_event_code && (
                        <span className="mp-badge mp-badge-test">🧪 Test Mode</span>
                      )}
                    </div>
                    <div style={{ fontSize: "12px", color: "#8C9196", marginTop: "2px" }}>
                      Pixel: <code style={{ background: "#F6F6F7", padding: "1px 5px", borderRadius: "4px" }}>{config.pixel_id}</code>
                      <span style={{ margin: "0 8px", color: "#D2D5D8" }}>|</span>
                      Token: <code style={{ background: "#F6F6F7", padding: "1px 5px", borderRadius: "4px" }}>{config.access_token}</code>
                      {config.test_event_code && (
                        <>
                          <span style={{ margin: "0 8px", color: "#D2D5D8" }}>|</span>
                          Test: <code style={{ background: "#FFF3CD", padding: "1px 5px", borderRadius: "4px" }}>{config.test_event_code}</code>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
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
                    className="mp-btn"
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
                    ✏️ Edit
                  </button>
                  <button
                    className="mp-btn"
                    onClick={() => {
                      if (confirm(`Delete pixel config for "${config.project_id}"?`)) {
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
                    🗑️
                  </button>
                </div>
              </div>

              {/* Events Info Strip */}
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
                  <strong style={{ color: "#6D7175" }}>Browser Events:</strong> PageView,
                  ViewContent, AddToCart, InitiateCheckout, AddPaymentInfo, Purchase
                </span>
                <span style={{ color: "#D2D5D8" }}>|</span>
                <span>
                  <strong style={{ color: "#6D7175" }}>CAPI:</strong> All events
                  deduplicated + server-side Purchase backup
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Events Reference ── */}
      <div
        className="mp-card"
        style={{
          marginTop: "24px",
          padding: "20px",
        }}
      >
        <h3 style={{ fontSize: "14px", fontWeight: 600, color: "#1A1A1A", marginBottom: "12px" }}>
          📋 Tracked Events Reference
        </h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "8px",
            fontSize: "12px",
          }}
        >
          {[
            { event: "PageView", where: "Every page load", icon: "👁️" },
            { event: "ViewContent", where: "Product / upsell page", icon: "📖" },
            { event: "AddToCart", where: "Add to cart button", icon: "🛒" },
            { event: "InitiateCheckout", where: "Checkout form submit", icon: "💳" },
            { event: "AddPaymentInfo", where: "Payment method selected", icon: "🔒" },
            { event: "Purchase", where: "Thank-you page + server backup", icon: "✅" },
          ].map((e) => (
            <div
              key={e.event}
              className="mp-row"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "8px 12px",
              }}
            >
              <span style={{ fontSize: "16px" }}>{e.icon}</span>
              <div>
                <code style={{ fontWeight: 600, color: "#1A1A1A" }}>{e.event}</code>
                <span style={{ color: "#8C9196", marginLeft: "8px" }}>{e.where}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default MetaPixelPage

export const config = defineRouteConfig({
  label: "Meta Pixel",
})
