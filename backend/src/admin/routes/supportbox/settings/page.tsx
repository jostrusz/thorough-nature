// @ts-nocheck
import { useState } from "react"
import { Link } from "react-router-dom"
import { Heading, Button, Input, Badge } from "@medusajs/ui"
import { Trash } from "@medusajs/icons"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { sdk } from "../../../lib/sdk"

// ═══════════════════════════════════════════
// COLORS
// ═══════════════════════════════════════════
const C = {
  bg: "#F9FAFB",
  white: "#FFFFFF",
  border: "#E5E7EB",
  borderLight: "#F3F4F6",
  text: "#111827",
  textSecondary: "#6B7280",
  textMuted: "#9CA3AF",
  green: "#10B981",
  greenBg: "#D1FAE5",
  red: "#EF4444",
  redBg: "#FEE2E2",
  redBorder: "#FECACA",
  yellowBg: "#FEF3C7",
  yellowBorder: "#FDE68A",
}

// ═══════════════════════════════════════════
// TOAST MESSAGES
// ═══════════════════════════════════════════
function Toast({ message, type, onClose }: { message: string; type: "success" | "error" | "warning"; onClose: () => void }) {
  const colors = {
    success: { bg: "#D1FAE5", border: "#A7F3D0", text: "#065F46" },
    error: { bg: "#FEE2E2", border: "#FECACA", text: "#991B1B" },
    warning: { bg: "#FEF3C7", border: "#FDE68A", text: "#92400E" },
  }
  const c = colors[type]
  return (
    <div style={{
      padding: "12px 16px", marginBottom: "16px",
      backgroundColor: c.bg, border: `1px solid ${c.border}`,
      borderRadius: "8px", color: c.text, fontSize: "13px",
      display: "flex", justifyContent: "space-between", alignItems: "center",
      animation: "fadeIn 0.2s ease",
    }}>
      <span>{message}</span>
      <button onClick={onClose} style={{
        background: "none", border: "none", cursor: "pointer",
        color: c.text, fontWeight: "bold", fontSize: "16px", lineHeight: 1, padding: "0 0 0 12px",
      }}>&times;</button>
    </div>
  )
}

// ═══════════════════════════════════════════
// DELETE CONFIRMATION MODAL
// ═══════════════════════════════════════════
function ConfirmDeleteModal({ name, onConfirm, onCancel }: { name: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: "rgba(0,0,0,0.4)", display: "flex",
      alignItems: "center", justifyContent: "center", zIndex: 9999,
    }}>
      <div style={{
        backgroundColor: C.white, borderRadius: "12px", padding: "24px",
        width: "400px", boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
      }}>
        <h3 style={{ fontSize: "16px", fontWeight: 600, color: C.text, marginBottom: "8px", marginTop: 0 }}>
          Delete Email Account
        </h3>
        <p style={{ fontSize: "13px", color: C.textSecondary, marginBottom: "20px", lineHeight: 1.5 }}>
          Are you sure you want to delete <strong>{name}</strong>? This action cannot be undone.
        </p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
          <Button variant="secondary" size="small" onClick={onCancel}>Cancel</Button>
          <Button size="small" onClick={onConfirm} style={{ backgroundColor: C.red, borderColor: C.red }}>
            Delete
          </Button>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════
// CONFIG CARD
// ═══════════════════════════════════════════
function ConfigCard({ config, onEdit, onDelete }: { config: any; onEdit: () => void; onDelete: () => void }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: "20px",
        backgroundColor: C.white,
        border: `1px solid ${C.border}`,
        borderRadius: "12px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        transform: hovered ? "translateY(-1px)" : "translateY(0)",
        boxShadow: hovered ? "0 4px 12px rgba(0,0,0,0.06)" : "0 1px 3px rgba(0,0,0,0.04)",
        transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        {/* Status dot */}
        <div style={{
          width: "8px", height: "8px", borderRadius: "50%",
          backgroundColor: config.is_active ? C.green : C.textMuted,
          flexShrink: 0,
        }} />
        <div>
          <div style={{ fontSize: "14px", fontWeight: 600, color: C.text, marginBottom: "2px" }}>
            {config.display_name}
          </div>
          <div style={{ fontSize: "12px", color: C.textSecondary }}>{config.email_address}</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: "8px" }}>
        <Button variant="secondary" size="small" onClick={onEdit}>Edit</Button>
        <Button variant="secondary" size="small" onClick={onDelete}>
          <Trash />
        </Button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════
// CONFIG FORM
// ═══════════════════════════════════════════
function ConfigForm({ initialData, onSubmit, onCancel, isLoading }: {
  initialData?: any; onSubmit: (data: any) => Promise<void>; onCancel: () => void; isLoading: boolean
}) {
  const [formData, setFormData] = useState({
    email_address: initialData?.email_address || "",
    display_name: initialData?.display_name || "",
    sender_name: initialData?.sender_name || "",
    resend_api_key: initialData?.resend_api_key || "",
    imap_host: initialData?.imap_host || "",
    imap_port: initialData?.imap_port || "",
    imap_user: initialData?.imap_user || "",
    imap_password: initialData?.imap_password || "",
    imap_tls: initialData?.imap_tls ?? true,
    is_active: initialData?.is_active ?? true,
  })

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await onSubmit(formData)
  }

  const labelStyle = { display: "block", marginBottom: "6px", fontSize: "13px", fontWeight: 600, color: C.text }

  return (
    <div style={{
      backgroundColor: C.white, border: `1px solid ${C.border}`,
      borderRadius: "12px", padding: "24px", marginBottom: "20px",
      boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
    }}>
      <h3 style={{ fontSize: "16px", fontWeight: 600, color: C.text, marginTop: 0, marginBottom: "20px" }}>
        {initialData ? "Edit Email Account" : "Add Email Account"}
      </h3>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          <div>
            <label style={labelStyle}>Email Address *</label>
            <Input type="email" value={formData.email_address} onChange={(e) => handleChange("email_address", e.target.value)} placeholder="support@example.com" disabled={!!initialData} required />
          </div>
          <div>
            <label style={labelStyle}>Display Name *</label>
            <Input value={formData.display_name} onChange={(e) => handleChange("display_name", e.target.value)} placeholder="Support Team" required />
            <div style={{ fontSize: "11px", color: C.textMuted, marginTop: "4px" }}>Internal label shown in sidebar</div>
          </div>
        </div>

        <div>
          <label style={labelStyle}>Sender Name</label>
          <Input value={formData.sender_name} onChange={(e) => handleChange("sender_name", e.target.value)} placeholder="e.g. De Hondenbijbel, Lass Los Buch" />
          <div style={{ fontSize: "11px", color: C.textMuted, marginTop: "4px" }}>Name shown to recipients in their inbox (e.g. "De Hondenbijbel &lt;support@dehondenbijbel.nl&gt;")</div>
        </div>

        <div>
          <label style={labelStyle}>Resend API Key *</label>
          <Input type="password" value={formData.resend_api_key} onChange={(e) => handleChange("resend_api_key", e.target.value)} placeholder="re_xxxxx" required />
          <div style={{ fontSize: "11px", color: C.textMuted, marginTop: "4px" }}>Get your API key from resend.com</div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          <div>
            <label style={labelStyle}>IMAP Host</label>
            <Input value={formData.imap_host} onChange={(e) => handleChange("imap_host", e.target.value)} placeholder="imap.gmail.com" />
          </div>
          <div>
            <label style={labelStyle}>IMAP Port</label>
            <Input type="number" value={formData.imap_port} onChange={(e) => handleChange("imap_port", e.target.value)} placeholder="993" />
          </div>
        </div>

        <div style={{ display: "flex", gap: "12px", paddingTop: "8px" }}>
          <Button type="submit" size="small" isLoading={isLoading}>
            {initialData ? "Update Account" : "Add Account"}
          </Button>
          <Button variant="secondary" size="small" type="button" onClick={onCancel} disabled={isLoading}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  )
}

// ═══════════════════════════════════════════
// MAIN SETTINGS PAGE
// ═══════════════════════════════════════════
const SupportBoxSettingsPage = () => {
  const queryClient = useQueryClient()
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingConfig, setEditingConfig] = useState<any>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<any>(null)

  const { data: configs = [], error: listError } = useQuery({
    queryKey: ["supportbox-configs"],
    queryFn: async () => {
      const response = await sdk.client.fetch("/admin/supportbox/configs", { method: "GET" })
      return (response as any).configs || []
    },
  })

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return await sdk.client.fetch("/admin/supportbox/configs", { method: "POST", body: data })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supportbox-configs"] })
      setIsFormOpen(false)
      setErrorMessage(null)
      setSuccessMessage("Email account added successfully!")
      setTimeout(() => setSuccessMessage(null), 5000)
    },
    onError: (error: any) => {
      setErrorMessage(error?.message || "Failed to create email account.")
    },
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      return await sdk.client.fetch(`/admin/supportbox/configs/${id}`, { method: "PUT", body: data })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supportbox-configs"] })
      setEditingConfig(null)
      setErrorMessage(null)
      setSuccessMessage("Email account updated successfully!")
      setTimeout(() => setSuccessMessage(null), 5000)
    },
    onError: (error: any) => {
      setErrorMessage(error?.message || "Failed to update email account.")
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (configId: string) => {
      return await sdk.client.fetch(`/admin/supportbox/configs/${configId}`, { method: "DELETE" })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supportbox-configs"] })
      setDeleteTarget(null)
      setSuccessMessage("Email account deleted.")
      setTimeout(() => setSuccessMessage(null), 5000)
    },
    onError: (error: any) => {
      setDeleteTarget(null)
      setErrorMessage(error?.message || "Failed to delete email account.")
    },
  })

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto", padding: "24px 32px" }}>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <ConfirmDeleteModal
          name={deleteTarget.display_name}
          onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <div>
          <Link to="/supportbox" style={{ textDecoration: "none" }}>
            <Button variant="secondary" size="small" style={{ marginBottom: "12px" }}>
              &larr; Back to Dashboard
            </Button>
          </Link>
          <h1 style={{ fontSize: "20px", fontWeight: 600, color: C.text, margin: 0 }}>
            SupportBox Settings
          </h1>
        </div>
        {!isFormOpen && !editingConfig && (
          <Button size="small" onClick={() => { setIsFormOpen(true); setErrorMessage(null) }}>
            Add Email Account
          </Button>
        )}
      </div>

      {/* Toasts */}
      {errorMessage && <Toast message={errorMessage} type="error" onClose={() => setErrorMessage(null)} />}
      {successMessage && <Toast message={successMessage} type="success" onClose={() => setSuccessMessage(null)} />}
      {listError && (
        <Toast
          message={`Failed to load configs: ${(listError as any)?.message || "Unknown error"}. The database table may not exist yet.`}
          type="warning"
          onClose={() => {}}
        />
      )}

      {/* Form */}
      {(isFormOpen || editingConfig) && (
        <ConfigForm
          initialData={editingConfig}
          onSubmit={async (data) => {
            setErrorMessage(null)
            try {
              if (editingConfig) {
                await updateMutation.mutateAsync({ id: editingConfig.id, ...data })
              } else {
                await createMutation.mutateAsync(data)
              }
            } catch {}
          }}
          onCancel={() => { setIsFormOpen(false); setEditingConfig(null); setErrorMessage(null) }}
          isLoading={createMutation.isPending || updateMutation.isPending}
        />
      )}

      {/* Config List */}
      {!listError && configs.length === 0 && !isFormOpen && !editingConfig ? (
        <div style={{
          padding: "48px", textAlign: "center", color: C.textSecondary, fontSize: "13px",
          backgroundColor: C.white, border: `1px solid ${C.border}`, borderRadius: "12px",
        }}>
          No email accounts configured yet. Add one to get started.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {configs.map((config: any) => (
            <ConfigCard
              key={config.id}
              config={config}
              onEdit={() => { setEditingConfig(config); setErrorMessage(null) }}
              onDelete={() => setDeleteTarget(config)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default SupportBoxSettingsPage
