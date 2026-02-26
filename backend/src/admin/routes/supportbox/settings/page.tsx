// @ts-nocheck
import { useState } from "react"
import { Link } from "react-router-dom"
import { Heading, Button, Input, Badge, Container } from "@medusajs/ui"
import { Trash } from "@medusajs/icons"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { sdk } from "../../../lib/sdk"

const SupportBoxSettingsPage = () => {
  const queryClient = useQueryClient()
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingConfig, setEditingConfig] = useState<any>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const { data: configs = [], error: listError } = useQuery({
    queryKey: ["supportbox-configs"],
    queryFn: async () => {
      const response = await sdk.client.fetch("/admin/supportbox/configs", { method: "GET" })
      return (response as any).configs || []
    },
  })

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return await sdk.client.fetch("/admin/supportbox/configs", {
        method: "POST",
        body: data,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supportbox-configs"] })
      setIsFormOpen(false)
      setErrorMessage(null)
      setSuccessMessage("Email account added successfully!")
      setTimeout(() => setSuccessMessage(null), 5000)
    },
    onError: (error: any) => {
      setErrorMessage(error?.message || error?.body?.message || "Failed to create email account. Check the server logs.")
    },
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      return await sdk.client.fetch(`/admin/supportbox/configs/${id}`, {
        method: "PUT",
        body: data,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supportbox-configs"] })
      setEditingConfig(null)
      setErrorMessage(null)
      setSuccessMessage("Email account updated successfully!")
      setTimeout(() => setSuccessMessage(null), 5000)
    },
    onError: (error: any) => {
      setErrorMessage(error?.message || error?.body?.message || "Failed to update email account.")
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (configId: string) => {
      return await sdk.client.fetch(`/admin/supportbox/configs/${configId}`, {
        method: "DELETE",
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supportbox-configs"] })
      setSuccessMessage("Email account deleted.")
      setTimeout(() => setSuccessMessage(null), 5000)
    },
    onError: (error: any) => {
      setErrorMessage(error?.message || error?.body?.message || "Failed to delete email account.")
    },
  })

  return (
    <div style={{ maxWidth: "1000px", margin: "0 auto", padding: "32px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "32px" }}>
        <div>
          <Link to="/supportbox">
            <Button variant="secondary" size="small" style={{ marginBottom: "16px" }}>
              &larr; Back to Dashboard
            </Button>
          </Link>
          <Heading level="h1">SupportBox Settings</Heading>
        </div>
        {!isFormOpen && !editingConfig && (
          <Button onClick={() => { setIsFormOpen(true); setErrorMessage(null) }}>Add Email Account</Button>
        )}
      </div>

      {/* Error message */}
      {errorMessage && (
        <div style={{
          padding: "12px 16px",
          marginBottom: "16px",
          backgroundColor: "#FEE2E2",
          border: "1px solid #FECACA",
          borderRadius: "8px",
          color: "#991B1B",
          fontSize: "13px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}>
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#991B1B", fontWeight: "bold" }}>&times;</button>
        </div>
      )}

      {/* Success message */}
      {successMessage && (
        <div style={{
          padding: "12px 16px",
          marginBottom: "16px",
          backgroundColor: "#D1FAE5",
          border: "1px solid #A7F3D0",
          borderRadius: "8px",
          color: "#065F46",
          fontSize: "13px",
        }}>
          {successMessage}
        </div>
      )}

      {/* List error */}
      {listError && (
        <div style={{
          padding: "12px 16px",
          marginBottom: "16px",
          backgroundColor: "#FEF3C7",
          border: "1px solid #FDE68A",
          borderRadius: "8px",
          color: "#92400E",
          fontSize: "13px",
        }}>
          Failed to load configs: {(listError as any)?.message || "Unknown error"}. The database table may not exist yet — check Railway deploy logs.
        </div>
      )}

      {/* Form */}
      {(isFormOpen || editingConfig) && (
        <ConfigFormInline
          initialData={editingConfig}
          onSubmit={async (data) => {
            setErrorMessage(null)
            try {
              if (editingConfig) {
                await updateMutation.mutateAsync({ id: editingConfig.id, ...data })
              } else {
                await createMutation.mutateAsync(data)
              }
            } catch (err: any) {
              // Error is handled by onError callback
            }
          }}
          onCancel={() => { setIsFormOpen(false); setEditingConfig(null); setErrorMessage(null) }}
          isLoading={createMutation.isPending || updateMutation.isPending}
          error={errorMessage}
        />
      )}

      {/* Config List */}
      {!listError && configs.length === 0 && !isFormOpen && !editingConfig ? (
        <Container>
          <div style={{ padding: "48px", textAlign: "center", color: "#6D7175" }}>
            No email accounts configured yet. Add one to get started.
          </div>
        </Container>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {configs.map((config: any) => (
            <Container key={config.id}>
              <div style={{ padding: "24px", display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                <div>
                  <div style={{ fontSize: "14px", fontWeight: "600", marginBottom: "4px" }}>{config.display_name}</div>
                  <div style={{ fontSize: "13px", color: "#6D7175", marginBottom: "12px" }}>{config.email_address}</div>
                  <Badge color={config.is_active ? "green" : "grey"}>
                    {config.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <Button variant="secondary" size="small" onClick={() => { setEditingConfig(config); setErrorMessage(null) }}>Edit</Button>
                  <Button
                    variant="secondary"
                    size="small"
                    onClick={() => {
                      if (confirm("Delete this email account?")) {
                        deleteMutation.mutate(config.id)
                      }
                    }}
                  >
                    <Trash />
                  </Button>
                </div>
              </div>
            </Container>
          ))}
        </div>
      )}
    </div>
  )
}

function ConfigFormInline({
  initialData,
  onSubmit,
  onCancel,
  isLoading,
  error,
}: {
  initialData?: any
  onSubmit: (data: any) => Promise<void>
  onCancel: () => void
  isLoading: boolean
  error?: string | null
}) {
  const [formData, setFormData] = useState({
    email_address: initialData?.email_address || "",
    display_name: initialData?.display_name || "",
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

  return (
    <Container>
      <div style={{ padding: "24px", marginBottom: "24px" }}>
        <Heading level="h2" style={{ marginBottom: "24px" }}>
          {initialData ? "Edit Email Account" : "Add Email Account"}
        </Heading>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div>
            <label style={{ display: "block", marginBottom: "8px", fontSize: "13px", fontWeight: "600" }}>Email Address *</label>
            <Input type="email" value={formData.email_address} onChange={(e) => handleChange("email_address", e.target.value)} placeholder="support@example.com" disabled={!!initialData} required />
          </div>
          <div>
            <label style={{ display: "block", marginBottom: "8px", fontSize: "13px", fontWeight: "600" }}>Display Name *</label>
            <Input value={formData.display_name} onChange={(e) => handleChange("display_name", e.target.value)} placeholder="Support Team" required />
          </div>
          <div>
            <label style={{ display: "block", marginBottom: "8px", fontSize: "13px", fontWeight: "600" }}>Resend API Key *</label>
            <Input type="password" value={formData.resend_api_key} onChange={(e) => handleChange("resend_api_key", e.target.value)} placeholder="re_xxxxx" required />
            <div style={{ fontSize: "12px", color: "#6D7175", marginTop: "4px" }}>Get your API key from resend.com</div>
          </div>
          <div>
            <label style={{ display: "block", marginBottom: "8px", fontSize: "13px", fontWeight: "600" }}>IMAP Host (Optional)</label>
            <Input value={formData.imap_host} onChange={(e) => handleChange("imap_host", e.target.value)} placeholder="imap.gmail.com" />
          </div>
          <div>
            <label style={{ display: "block", marginBottom: "8px", fontSize: "13px", fontWeight: "600" }}>IMAP Port (Optional)</label>
            <Input type="number" value={formData.imap_port} onChange={(e) => handleChange("imap_port", e.target.value)} placeholder="993" />
          </div>
          <div style={{ display: "flex", gap: "16px", paddingTop: "8px" }}>
            <Button type="submit" isLoading={isLoading}>{initialData ? "Update Account" : "Add Account"}</Button>
            <Button variant="secondary" type="button" onClick={onCancel} disabled={isLoading}>Cancel</Button>
          </div>
        </form>
      </div>
    </Container>
  )
}

export default SupportBoxSettingsPage
