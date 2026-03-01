import React, { useState, useCallback } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "@medusajs/ui"
import { defineRouteConfig } from "@medusajs/admin-sdk"
import { sdk } from "../../lib/sdk"

// ═══════════════════════════════════════════
// EMAIL CATEGORIES
// ═══════════════════════════════════════════

const EMAIL_CATEGORIES = [
  { value: "all", label: "All (use for everything)" },
  { value: "notifications", label: "Customer notifications" },
  { value: "abandoned_checkout", label: "Cart abandonment" },
  { value: "newsletters", label: "Newsletter campaigns" },
  { value: "sequences", label: "Email sequences" },
]

// ═══════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════

function PageStyles() {
  return (
    <style>{`
      @keyframes rsFadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
      .rs-card { transition: box-shadow 0.25s ease, border-color 0.25s ease; border: 1px solid #E1E3E5; border-radius: 10px; background: #FFF; }
      .rs-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.06); border-color: #D2D5D8; }
      .rs-btn { transition: all 0.15s ease; cursor: pointer; }
      .rs-btn:hover { background: #F6F6F7 !important; }
      .rs-btn:active { transform: scale(0.97); }
      .rs-btn-primary { transition: all 0.15s ease; cursor: pointer; }
      .rs-btn-primary:hover { filter: brightness(1.1); box-shadow: 0 2px 8px rgba(0,0,0,0.2); }
      .rs-input { transition: border-color 0.2s, box-shadow 0.2s; }
      .rs-input:focus { border-color: #000 !important; box-shadow: 0 0 0 3px rgba(0,0,0,0.08); outline: none; }
      .rs-toggle { width: 40px; height: 22px; border-radius: 11px; border: none; cursor: pointer; transition: background 0.2s ease; position: relative; }
      .rs-toggle::after { content: ''; width: 18px; height: 18px; border-radius: 50%; background: #FFF; position: absolute; top: 2px; transition: left 0.2s ease; box-shadow: 0 1px 3px rgba(0,0,0,0.2); }
      .rs-toggle-on { background: #000; }
      .rs-toggle-on::after { left: 20px; }
      .rs-toggle-off { background: #C9CCCF; }
      .rs-toggle-off::after { left: 2px; }
      .rs-section-enter { animation: rsFadeIn 0.3s ease; }
      .rs-row { transition: background 0.12s ease; border-radius: 8px; }
      .rs-row:hover { background: #F9FAFB; }
      .rs-badge { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 600; }
      .rs-badge-active { background: #D4EDDA; color: #155724; }
      .rs-badge-inactive { background: #F8D7DA; color: #721C24; }
      .rs-badge-verified { background: #D4EDDA; color: #155724; }
      .rs-badge-pending { background: #FFF3CD; color: #856404; }
      .rs-badge-failed { background: #F8D7DA; color: #721C24; }
      .rs-test-btn { transition: all 0.15s ease; cursor: pointer; }
      .rs-test-btn:hover { background: #F5F5F5 !important; border-color: #000 !important; }
      .rs-copy-btn { transition: all 0.12s ease; cursor: pointer; font-size: 11px; }
      .rs-copy-btn:hover { background: #F0F0F0 !important; }
      .rs-category-chip { display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 500; cursor: pointer; transition: all 0.15s ease; border: 1px solid #E1E3E5; background: #FFF; color: #6D7175; }
      .rs-category-chip-selected { background: #000; color: #FFF; border-color: #000; }
    `}</style>
  )
}

// ═══════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════

interface ResendConfig {
  id: string
  project_id: string
  label: string
  api_key: string
  from_email: string
  from_name: string | null
  reply_to: string | null
  use_for: string[]
  enabled: boolean
  created_at: string
  updated_at: string
}

interface ResendDomain {
  id: string
  name: string
  status: string
  region: string
  records?: DnsRecord[]
  created_at: string
}

interface DnsRecord {
  record: string
  name: string
  type: string
  ttl: string
  status: string
  value: string
  priority?: number
}

// ═══════════════════════════════════════════
// HOOKS
// ═══════════════════════════════════════════

function useResendConfigs() {
  return useQuery({
    queryKey: ["resend-configs"],
    queryFn: () =>
      sdk.client.fetch<{ resend_configs: ResendConfig[] }>(
        "/admin/resend-config",
        { method: "GET" }
      ),
  })
}

function useResendDomains(configId: string | null) {
  return useQuery({
    queryKey: ["resend-domains", configId],
    queryFn: () =>
      sdk.client.fetch<{ domains: ResendDomain[] }>(
        `/admin/resend-config/domains?configId=${configId}`,
        { method: "GET" }
      ),
    enabled: !!configId,
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
      className={`rs-toggle ${checked ? "rs-toggle-on" : "rs-toggle-off"}`}
      onClick={onChange}
      disabled={disabled}
      style={{ opacity: disabled ? 0.5 : 1 }}
    />
  )
}

// ═══════════════════════════════════════════
// RESEND ICON
// ═══════════════════════════════════════════

function ResendIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="18" height="18" rx="3" fill="#000" />
      <text
        x="12"
        y="16"
        textAnchor="middle"
        fill="#FFF"
        fontSize="12"
        fontWeight="700"
        fontFamily="Arial"
      >
        R
      </text>
    </svg>
  )
}

// ═══════════════════════════════════════════
// CATEGORY CHIPS COMPONENT
// ═══════════════════════════════════════════

function CategoryChips({
  selected,
  onChange,
}: {
  selected: string[]
  onChange: (categories: string[]) => void
}) {
  const toggle = (value: string) => {
    if (value === "all") {
      onChange(["all"])
      return
    }
    let next = selected.filter((s) => s !== "all")
    if (next.includes(value)) {
      next = next.filter((s) => s !== value)
    } else {
      next.push(value)
    }
    if (next.length === 0) next = ["all"]
    onChange(next)
  }

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
      {EMAIL_CATEGORIES.map((cat) => (
        <button
          key={cat.value}
          className={`rs-category-chip ${
            selected.includes(cat.value) ? "rs-category-chip-selected" : ""
          }`}
          onClick={() => toggle(cat.value)}
          type="button"
        >
          {selected.includes(cat.value) ? "✓ " : ""}
          {cat.label}
        </button>
      ))}
    </div>
  )
}

// ═══════════════════════════════════════════
// DNS RECORDS TABLE
// ═══════════════════════════════════════════

function DnsRecordsTable({ records }: { records: DnsRecord[] }) {
  const [copied, setCopied] = useState<string | null>(null)

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div
      style={{
        borderRadius: "8px",
        border: "1px solid #E1E3E5",
        overflow: "hidden",
        marginTop: "10px",
      }}
    >
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: "12px",
        }}
      >
        <thead>
          <tr style={{ background: "#F9FAFB" }}>
            <th
              style={{
                padding: "8px 12px",
                textAlign: "left",
                fontWeight: 600,
                color: "#6D7175",
                borderBottom: "1px solid #E1E3E5",
              }}
            >
              Type
            </th>
            <th
              style={{
                padding: "8px 12px",
                textAlign: "left",
                fontWeight: 600,
                color: "#6D7175",
                borderBottom: "1px solid #E1E3E5",
              }}
            >
              Name
            </th>
            <th
              style={{
                padding: "8px 12px",
                textAlign: "left",
                fontWeight: 600,
                color: "#6D7175",
                borderBottom: "1px solid #E1E3E5",
              }}
            >
              Value
            </th>
            <th
              style={{
                padding: "8px 12px",
                textAlign: "left",
                fontWeight: 600,
                color: "#6D7175",
                borderBottom: "1px solid #E1E3E5",
                width: "80px",
              }}
            >
              Status
            </th>
            <th
              style={{
                padding: "8px 12px",
                textAlign: "center",
                fontWeight: 600,
                color: "#6D7175",
                borderBottom: "1px solid #E1E3E5",
                width: "60px",
              }}
            >
              Copy
            </th>
          </tr>
        </thead>
        <tbody>
          {records.map((rec, i) => (
            <tr key={i}>
              <td
                style={{
                  padding: "8px 12px",
                  borderBottom: "1px solid #F1F1F1",
                  fontFamily: "monospace",
                  fontWeight: 600,
                }}
              >
                {rec.type}
                {rec.priority != null ? ` (${rec.priority})` : ""}
              </td>
              <td
                style={{
                  padding: "8px 12px",
                  borderBottom: "1px solid #F1F1F1",
                  fontFamily: "monospace",
                  fontSize: "11px",
                  wordBreak: "break-all",
                }}
              >
                {rec.name}
              </td>
              <td
                style={{
                  padding: "8px 12px",
                  borderBottom: "1px solid #F1F1F1",
                  fontFamily: "monospace",
                  fontSize: "11px",
                  wordBreak: "break-all",
                  maxWidth: "300px",
                }}
              >
                {rec.value}
              </td>
              <td
                style={{
                  padding: "8px 12px",
                  borderBottom: "1px solid #F1F1F1",
                }}
              >
                <span
                  className={`rs-badge ${
                    rec.status === "verified"
                      ? "rs-badge-verified"
                      : rec.status === "failed"
                      ? "rs-badge-failed"
                      : "rs-badge-pending"
                  }`}
                >
                  {rec.status}
                </span>
              </td>
              <td
                style={{
                  padding: "8px 12px",
                  borderBottom: "1px solid #F1F1F1",
                  textAlign: "center",
                }}
              >
                <button
                  className="rs-copy-btn"
                  onClick={() => copyToClipboard(rec.value, `${i}`)}
                  style={{
                    padding: "3px 8px",
                    borderRadius: "4px",
                    border: "1px solid #E1E3E5",
                    background: "#FFF",
                    color: "#6D7175",
                  }}
                >
                  {copied === `${i}` ? "Copied!" : "Copy"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ═══════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════

const ResendPage = () => {
  const queryClient = useQueryClient()
  const { data, isLoading, error } = useResendConfigs()
  const configs = data?.resend_configs || []

  // ── Config Form State ──
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({
    project_id: "",
    label: "",
    api_key: "",
    from_email: "",
    from_name: "",
    reply_to: "",
    use_for: ["all"] as string[],
    enabled: true,
  })

  // ── Test connection state ──
  const [testResult, setTestResult] = useState<{
    success?: boolean
    error?: string
    domains_count?: number
  } | null>(null)

  // ── Domain state ──
  const [selectedConfigId, setSelectedConfigId] = useState<string | null>(null)
  const [showDomainForm, setShowDomainForm] = useState(false)
  const [newDomain, setNewDomain] = useState("")
  const [expandedDomainId, setExpandedDomainId] = useState<string | null>(null)
  const [domainDetail, setDomainDetail] = useState<ResendDomain | null>(null)

  const { data: domainsData, isLoading: domainsLoading } =
    useResendDomains(selectedConfigId)
  const domains = domainsData?.domains || []

  // ── Config Mutations ──
  const createMutation = useMutation({
    mutationFn: (data: Record<string, any>) =>
      sdk.client.fetch("/admin/resend-config", {
        method: "POST",
        body: data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resend-configs"] })
      toast.success("Resend configuration created")
      resetForm()
    },
    onError: (err: any) => toast.error(err.message || "Failed to create"),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: Record<string, any>) =>
      sdk.client.fetch(`/admin/resend-config/${id}`, {
        method: "POST",
        body: data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resend-configs"] })
      toast.success("Resend configuration updated")
      resetForm()
    },
    onError: (err: any) => toast.error(err.message || "Failed to update"),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      sdk.client.fetch(`/admin/resend-config/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resend-configs"] })
      toast.success("Resend configuration deleted")
    },
    onError: (err: any) => toast.error(err.message || "Failed to delete"),
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      sdk.client.fetch(`/admin/resend-config/${id}`, {
        method: "POST",
        body: { enabled },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resend-configs"] })
    },
    onError: (err: any) => toast.error(err.message || "Failed to toggle"),
  })

  const testMutation = useMutation({
    mutationFn: (data: Record<string, any>) =>
      sdk.client.fetch<{ success: boolean; error?: string; domains_count?: number }>(
        "/admin/resend-config/test-connection",
        { method: "POST", body: data }
      ),
    onSuccess: (result) => {
      setTestResult(result)
      if (result.success) {
        toast.success(`API key valid — ${result.domains_count ?? 0} domain(s) found`)
      } else {
        toast.error(result.error || "Connection failed")
      }
    },
    onError: (err: any) => {
      setTestResult({ success: false, error: err.message })
      toast.error(err.message || "Connection test failed")
    },
  })

  // ── Domain Mutations ──
  const addDomainMutation = useMutation({
    mutationFn: (data: { configId: string; domain: string }) =>
      sdk.client.fetch<{ domain: ResendDomain }>(
        "/admin/resend-config/domains",
        { method: "POST", body: data }
      ),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["resend-domains"] })
      toast.success(`Domain "${newDomain}" added`)
      setNewDomain("")
      setShowDomainForm(false)
      if (result.domain) {
        setExpandedDomainId(result.domain.id)
        setDomainDetail(result.domain)
      }
    },
    onError: (err: any) => toast.error(err.message || "Failed to add domain"),
  })

  const verifyDomainMutation = useMutation({
    mutationFn: (domainId: string) =>
      sdk.client.fetch(
        `/admin/resend-config/domains/${domainId}/verify`,
        { method: "POST", body: { configId: selectedConfigId } }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resend-domains"] })
      toast.success("Verification triggered — check status in a moment")
    },
    onError: (err: any) => toast.error(err.message || "Verification failed"),
  })

  const deleteDomainMutation = useMutation({
    mutationFn: (domainId: string) =>
      sdk.client.fetch(
        `/admin/resend-config/domains/${domainId}?configId=${selectedConfigId}`,
        { method: "DELETE" }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resend-domains"] })
      toast.success("Domain removed")
    },
    onError: (err: any) => toast.error(err.message || "Failed to remove domain"),
  })

  const fetchDomainDetail = useCallback(
    async (domainId: string) => {
      try {
        const result = await sdk.client.fetch<{ domain: ResendDomain }>(
          `/admin/resend-config/domains/${domainId}?configId=${selectedConfigId}`,
          { method: "GET" }
        )
        setDomainDetail(result.domain)
      } catch {
        toast.error("Failed to load domain details")
      }
    },
    [selectedConfigId]
  )

  // ── Form helpers ──
  const resetForm = useCallback(() => {
    setShowForm(false)
    setEditingId(null)
    setTestResult(null)
    setForm({
      project_id: "",
      label: "",
      api_key: "",
      from_email: "",
      from_name: "",
      reply_to: "",
      use_for: ["all"],
      enabled: true,
    })
  }, [])

  const startEdit = useCallback((config: ResendConfig) => {
    setEditingId(config.id)
    setShowForm(true)
    setTestResult(null)
    setForm({
      project_id: config.project_id,
      label: config.label,
      api_key: "",
      from_email: config.from_email,
      from_name: config.from_name || "",
      reply_to: config.reply_to || "",
      use_for: config.use_for || ["all"],
      enabled: config.enabled,
    })
  }, [])

  const handleSubmit = useCallback(() => {
    if (!form.project_id || !form.label || !form.from_email) {
      toast.error("Project ID, Label, and From Email are required")
      return
    }

    if (editingId) {
      const payload: Record<string, any> = { id: editingId }
      payload.project_id = form.project_id
      payload.label = form.label
      if (form.api_key) payload.api_key = form.api_key
      payload.from_email = form.from_email
      payload.from_name = form.from_name || null
      payload.reply_to = form.reply_to || null
      payload.use_for = form.use_for
      payload.enabled = form.enabled
      updateMutation.mutate(payload)
    } else {
      if (!form.api_key) {
        toast.error("API Key is required for new configurations")
        return
      }
      createMutation.mutate({
        ...form,
        from_name: form.from_name || null,
        reply_to: form.reply_to || null,
      })
    }
  }, [form, editingId, createMutation, updateMutation])

  const handleTestConnection = useCallback(() => {
    if (!form.api_key) {
      toast.error("Enter an API Key to test")
      return
    }
    setTestResult(null)
    testMutation.mutate({ api_key: form.api_key })
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

  const usedForLabel = (cats: string[]) =>
    cats
      .map((c) => EMAIL_CATEGORIES.find((e) => e.value === c)?.label || c)
      .join(", ")

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
          <ResendIcon size={22} />
          <h1
            style={{
              fontSize: "20px",
              fontWeight: 600,
              color: "#1A1A1A",
              margin: 0,
            }}
          >
            Resend
          </h1>
        </div>
        <button
          className="rs-btn-primary"
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
            background: "#000",
            color: "#FFF",
          }}
        >
          + Add Config
        </button>
      </div>

      {/* ── Description ── */}
      <div
        className="rs-card"
        style={{
          padding: "16px 20px",
          marginBottom: "20px",
          display: "flex",
          alignItems: "flex-start",
          gap: "12px",
          background: "#F5F5F5",
          borderColor: "#E0E0E0",
        }}
      >
        <span style={{ fontSize: "20px" }}>
          <ResendIcon size={20} />
        </span>
        <div
          style={{ fontSize: "13px", color: "#333", lineHeight: "1.5" }}
        >
          <strong>How it works:</strong> Each project connects to a Resend
          account via its API key. You can assign each configuration to
          specific email types — customer notifications, abandoned checkout
          emails, newsletter campaigns, or sequences. Add your sending
          domains below and configure DNS records to start sending.
          <br />
          <span style={{ color: "#666" }}>
            Get your API keys at{" "}
            <a
              href="https://resend.com/api-keys"
              target="_blank"
              rel="noreferrer"
              style={{ color: "#000", fontWeight: 500 }}
            >
              resend.com/api-keys
            </a>
          </span>
        </div>
      </div>

      {/* ── Create / Edit Form ── */}
      {showForm && (
        <div
          className="rs-card rs-section-enter"
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
                ? "Edit Resend Configuration"
                : "New Resend Configuration"}
            </h2>
            <button
              className="rs-btn"
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
              <label style={labelStyle}>Project ID</label>
              <input
                className="rs-input"
                style={inputStyle}
                placeholder="e.g. loslatenboek"
                value={form.project_id}
                onChange={(e) =>
                  setForm({ ...form, project_id: e.target.value })
                }
              />
            </div>

            {/* Label */}
            <div>
              <label style={labelStyle}>Label</label>
              <input
                className="rs-input"
                style={inputStyle}
                placeholder="e.g. Loslatenboek"
                value={form.label}
                onChange={(e) =>
                  setForm({ ...form, label: e.target.value })
                }
              />
            </div>

            {/* API Key */}
            <div>
              <label style={labelStyle}>
                API Key
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
                className="rs-input"
                style={{
                  ...inputStyle,
                  fontFamily: "monospace",
                  fontSize: "12px",
                }}
                placeholder="re_xxxxxxxxxx"
                type="password"
                value={form.api_key}
                onChange={(e) =>
                  setForm({ ...form, api_key: e.target.value })
                }
              />
            </div>

            {/* From Email */}
            <div>
              <label style={labelStyle}>From Email</label>
              <input
                className="rs-input"
                style={inputStyle}
                placeholder="e.g. noreply@loslatenboek.nl"
                value={form.from_email}
                onChange={(e) =>
                  setForm({ ...form, from_email: e.target.value })
                }
              />
            </div>

            {/* From Name */}
            <div>
              <label style={labelStyle}>From Name (optional)</label>
              <input
                className="rs-input"
                style={inputStyle}
                placeholder="e.g. Loslatenboek"
                value={form.from_name}
                onChange={(e) =>
                  setForm({ ...form, from_name: e.target.value })
                }
              />
            </div>

            {/* Reply-To */}
            <div>
              <label style={labelStyle}>Reply-To (optional)</label>
              <input
                className="rs-input"
                style={inputStyle}
                placeholder="e.g. support@loslatenboek.nl"
                value={form.reply_to}
                onChange={(e) =>
                  setForm({ ...form, reply_to: e.target.value })
                }
              />
            </div>
          </div>

          {/* Use For chips */}
          <div style={{ marginBottom: "16px" }}>
            <label style={labelStyle}>Use For</label>
            <CategoryChips
              selected={form.use_for}
              onChange={(cats) => setForm({ ...form, use_for: cats })}
            />
          </div>

          {/* Enabled toggle */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              marginBottom: "16px",
            }}
          >
            <Toggle
              checked={form.enabled}
              onChange={() => setForm({ ...form, enabled: !form.enabled })}
            />
            <span style={{ fontSize: "13px", color: "#6D7175" }}>
              {form.enabled ? "Active" : "Paused"}
            </span>
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
                ? `API key valid — ${testResult.domains_count ?? 0} domain(s) found`
                : `Connection failed: ${testResult.error}`}
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
              className="rs-test-btn"
              onClick={handleTestConnection}
              disabled={testMutation.isPending}
              style={{
                padding: "8px 16px",
                borderRadius: "8px",
                fontSize: "13px",
                fontWeight: 500,
                border: "1px solid #D2D5D8",
                background: "#FFF",
                color: "#333",
                opacity: testMutation.isPending ? 0.7 : 1,
              }}
            >
              {testMutation.isPending ? "Testing..." : "Test API Key"}
            </button>

            <div style={{ display: "flex", gap: "8px" }}>
              <button
                className="rs-btn"
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
                className="rs-btn-primary"
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
                  background: "#000",
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
          Loading Resend configurations...
        </div>
      ) : error ? (
        <div
          style={{ textAlign: "center", padding: "40px", color: "#9E2B25" }}
        >
          Error loading configurations
        </div>
      ) : configs.length === 0 ? (
        <div
          className="rs-card"
          style={{
            padding: "48px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "36px", marginBottom: "12px" }}>
            <ResendIcon size={36} />
          </div>
          <h3
            style={{
              fontSize: "16px",
              fontWeight: 600,
              color: "#1A1A1A",
              marginBottom: "6px",
            }}
          >
            No Resend configurations yet
          </h3>
          <p style={{ fontSize: "13px", color: "#8C9196", margin: 0 }}>
            Click "Add Config" to set up email sending for a project.
          </p>
        </div>
      ) : (
        <div
          style={{ display: "flex", flexDirection: "column", gap: "12px" }}
        >
          {configs.map((config) => (
            <div
              key={config.id}
              className="rs-card rs-section-enter"
              style={{ padding: "0" }}
            >
              {/* Card Header */}
              <div
                className="rs-row"
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
                        ? "linear-gradient(135deg, #000, #333)"
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
                    R
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
                        {config.label}
                      </span>
                      {config.enabled ? (
                        <span className="rs-badge rs-badge-active">
                          Active
                        </span>
                      ) : (
                        <span className="rs-badge rs-badge-inactive">
                          Paused
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
                      Project:{" "}
                      <code
                        style={{
                          background: "#F6F6F7",
                          padding: "1px 5px",
                          borderRadius: "4px",
                        }}
                      >
                        {config.project_id}
                      </code>
                      <span
                        style={{
                          margin: "0 8px",
                          color: "#D2D5D8",
                        }}
                      >
                        |
                      </span>
                      From:{" "}
                      <code
                        style={{
                          background: "#F6F6F7",
                          padding: "1px 5px",
                          borderRadius: "4px",
                        }}
                      >
                        {config.from_name
                          ? `${config.from_name} <${config.from_email}>`
                          : config.from_email}
                      </code>
                      <span
                        style={{
                          margin: "0 8px",
                          color: "#D2D5D8",
                        }}
                      >
                        |
                      </span>
                      API Key:{" "}
                      <code
                        style={{
                          background: "#F6F6F7",
                          padding: "1px 5px",
                          borderRadius: "4px",
                          fontFamily: "monospace",
                        }}
                      >
                        {config.api_key}
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
                    className="rs-btn"
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
                    className="rs-btn"
                    onClick={() => {
                      if (
                        confirm(
                          `Delete Resend config "${config.label}"?`
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
                  flexWrap: "wrap",
                }}
              >
                {config.reply_to && (
                  <>
                    <span>
                      <strong style={{ color: "#6D7175" }}>Reply-to:</strong>{" "}
                      {config.reply_to}
                    </span>
                    <span style={{ color: "#D2D5D8" }}>|</span>
                  </>
                )}
                <span>
                  <strong style={{ color: "#6D7175" }}>Use for:</strong>{" "}
                  {usedForLabel(config.use_for)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* DOMAINS SECTION */}
      {/* ═══════════════════════════════════════════ */}
      {configs.length > 0 && (
        <div style={{ marginTop: "32px" }}>
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
                fontSize: "17px",
                fontWeight: 600,
                color: "#1A1A1A",
                margin: 0,
              }}
            >
              Sending Domains
            </h2>
            {selectedConfigId && (
              <button
                className="rs-btn-primary"
                onClick={() => setShowDomainForm(true)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "7px 14px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: 600,
                  border: "none",
                  background: "#000",
                  color: "#FFF",
                }}
              >
                + Add Domain
              </button>
            )}
          </div>

          {/* Config selector */}
          <div style={{ marginBottom: "16px" }}>
            <label style={{ ...labelStyle, marginBottom: "6px" }}>
              Select Configuration
            </label>
            <select
              className="rs-input"
              style={{ ...inputStyle, maxWidth: "400px" }}
              value={selectedConfigId || ""}
              onChange={(e) => {
                setSelectedConfigId(e.target.value || null)
                setExpandedDomainId(null)
                setDomainDetail(null)
              }}
            >
              <option value="">-- Select a config --</option>
              {configs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label} ({c.project_id})
                </option>
              ))}
            </select>
          </div>

          {/* Add domain form */}
          {showDomainForm && selectedConfigId && (
            <div
              className="rs-card rs-section-enter"
              style={{
                padding: "16px 20px",
                marginBottom: "16px",
                display: "flex",
                alignItems: "flex-end",
                gap: "12px",
              }}
            >
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Domain Name</label>
                <input
                  className="rs-input"
                  style={inputStyle}
                  placeholder="e.g. loslatenboek.nl"
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value)}
                />
              </div>
              <button
                className="rs-btn-primary"
                onClick={() => {
                  if (!newDomain) {
                    toast.error("Enter a domain name")
                    return
                  }
                  addDomainMutation.mutate({
                    configId: selectedConfigId,
                    domain: newDomain,
                  })
                }}
                disabled={addDomainMutation.isPending}
                style={{
                  padding: "8px 20px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: 600,
                  border: "none",
                  background: "#000",
                  color: "#FFF",
                  whiteSpace: "nowrap",
                  opacity: addDomainMutation.isPending ? 0.7 : 1,
                }}
              >
                {addDomainMutation.isPending ? "Adding..." : "Add"}
              </button>
              <button
                className="rs-btn"
                onClick={() => {
                  setShowDomainForm(false)
                  setNewDomain("")
                }}
                style={{
                  padding: "8px 14px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: 500,
                  border: "1px solid #E1E3E5",
                  background: "#FFF",
                  color: "#6D7175",
                  whiteSpace: "nowrap",
                }}
              >
                Cancel
              </button>
            </div>
          )}

          {/* Domain list */}
          {!selectedConfigId ? (
            <div
              className="rs-card"
              style={{
                padding: "32px",
                textAlign: "center",
                color: "#8C9196",
                fontSize: "13px",
              }}
            >
              Select a configuration above to manage its domains.
            </div>
          ) : domainsLoading ? (
            <div
              style={{
                textAlign: "center",
                padding: "32px",
                color: "#8C9196",
              }}
            >
              Loading domains...
            </div>
          ) : domains.length === 0 ? (
            <div
              className="rs-card"
              style={{
                padding: "32px",
                textAlign: "center",
              }}
            >
              <h3
                style={{
                  fontSize: "14px",
                  fontWeight: 600,
                  color: "#1A1A1A",
                  marginBottom: "6px",
                }}
              >
                No domains configured
              </h3>
              <p style={{ fontSize: "13px", color: "#8C9196", margin: 0 }}>
                Add a sending domain to start delivering emails.
              </p>
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              }}
            >
              {domains.map((domain) => {
                const isExpanded = expandedDomainId === domain.id
                return (
                  <div
                    key={domain.id}
                    className="rs-card rs-section-enter"
                    style={{ padding: "0" }}
                  >
                    <div
                      className="rs-row"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "14px 20px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "12px",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "15px",
                            fontWeight: 600,
                            color: "#1A1A1A",
                          }}
                        >
                          {domain.name}
                        </span>
                        <span
                          className={`rs-badge ${
                            domain.status === "verified"
                              ? "rs-badge-verified"
                              : domain.status === "failed"
                              ? "rs-badge-failed"
                              : "rs-badge-pending"
                          }`}
                        >
                          {domain.status === "verified"
                            ? "Verified"
                            : domain.status === "failed"
                            ? "Failed"
                            : "Pending"}
                        </span>
                        {domain.region && (
                          <span
                            style={{
                              fontSize: "11px",
                              color: "#8C9196",
                            }}
                          >
                            Region: {domain.region}
                          </span>
                        )}
                      </div>

                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                        }}
                      >
                        <button
                          className="rs-btn"
                          onClick={() => {
                            if (isExpanded) {
                              setExpandedDomainId(null)
                              setDomainDetail(null)
                            } else {
                              setExpandedDomainId(domain.id)
                              fetchDomainDetail(domain.id)
                            }
                          }}
                          style={{
                            padding: "5px 10px",
                            borderRadius: "6px",
                            fontSize: "12px",
                            fontWeight: 500,
                            border: "1px solid #E1E3E5",
                            background: "#FFF",
                            color: "#6D7175",
                          }}
                        >
                          {isExpanded ? "Hide DNS" : "View DNS"}
                        </button>
                        {domain.status !== "verified" && (
                          <button
                            className="rs-btn"
                            onClick={() =>
                              verifyDomainMutation.mutate(domain.id)
                            }
                            disabled={verifyDomainMutation.isPending}
                            style={{
                              padding: "5px 10px",
                              borderRadius: "6px",
                              fontSize: "12px",
                              fontWeight: 500,
                              border: "1px solid #A5D6A7",
                              background: "#FFF",
                              color: "#2E7D32",
                              opacity: verifyDomainMutation.isPending
                                ? 0.7
                                : 1,
                            }}
                          >
                            Verify
                          </button>
                        )}
                        <button
                          className="rs-btn"
                          onClick={() => {
                            if (
                              confirm(
                                `Remove domain "${domain.name}"?`
                              )
                            ) {
                              deleteDomainMutation.mutate(domain.id)
                            }
                          }}
                          style={{
                            padding: "5px 10px",
                            borderRadius: "6px",
                            fontSize: "12px",
                            fontWeight: 500,
                            border: "1px solid #FED3D1",
                            background: "#FFF5F5",
                            color: "#9E2B25",
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    </div>

                    {/* DNS Records (expanded) */}
                    {isExpanded && (
                      <div
                        className="rs-section-enter"
                        style={{
                          borderTop: "1px solid #F1F1F1",
                          padding: "14px 20px",
                        }}
                      >
                        {domainDetail?.records ? (
                          <>
                            <p
                              style={{
                                fontSize: "12px",
                                color: "#6D7175",
                                margin: "0 0 8px",
                              }}
                            >
                              Add these DNS records to your domain registrar to
                              verify ownership and enable email sending:
                            </p>
                            <DnsRecordsTable
                              records={domainDetail.records}
                            />
                          </>
                        ) : (
                          <div
                            style={{
                              textAlign: "center",
                              padding: "16px",
                              color: "#8C9196",
                              fontSize: "13px",
                            }}
                          >
                            Loading DNS records...
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default ResendPage

export const config = defineRouteConfig({
  label: "Resend",
})
