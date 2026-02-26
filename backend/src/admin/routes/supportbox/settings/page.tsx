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

  const { data: configs = [] } = useQuery({
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
    },
  })

  return (
    <div style={{ maxWidth: "1000px", margin: "0 auto", padding: "32px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "32px" }}>
        <div>
          <Link to="/supportbox">
            <Button variant="secondary" size="small" style={{ marginBottom: "16px" }}>
              ← Back to Dashboard
            </Button>
          </Link>
          <Heading level="h1">SupportBox Settings</Heading>
        </div>
        {!isFormOpen && !editingConfig && (
          <Button onClick={() => setIsFormOpen(true)}>Add Email Account</Button>
        )}
      </div>

      {/* Form */}
      {(isFormOpen || editingConfig) && (
        <ConfigFormInline
          initialData={editingConfig}
          onSubmit={async (data) => {
            if (editingConfig) {
              await updateMutation.mutateAsync({ id: editingConfig.id, ...data })
            } else {
              await createMutation.mutateAsync(data)
            }
          }}
          onCancel={() => { setIsFormOpen(false); setEditingConfig(null) }}
          isLoading={createMutation.isPending || updateMutation.isPending}
        />
      )}

      {/* Config List */}
      {configs.length === 0 ? (
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
                  <Button variant="secondary" size="small" onClick={() => setEditingConfig(config)}>Edit</Button>
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
}: {
  initialData?: any
  onSubmit: (data: any) => Promise<void>
  onCancel: () => void
  isLoading: boolean
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
            <Button variant="secondary" onClick={onCancel} disabled={isLoading}>Cancel</Button>
          </div>
        </form>
      </div>
    </Container>
  )
}

export default SupportBoxSettingsPage
