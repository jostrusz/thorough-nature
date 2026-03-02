// @ts-nocheck
import { defineRouteConfig } from "@medusajs/admin-sdk"
import { ChatBubbleLeftRight } from "@medusajs/icons"
import {
  Container,
  Heading,
  Button,
  Select,
  Input,
  Badge,
} from "@medusajs/ui"
import { useState } from "react"
import { Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { sdk } from "../../lib/sdk"

const SupportBoxDashboard = () => {
  const [selectedConfigId, setSelectedConfigId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")

  const { data: configs = [] } = useQuery({
    queryKey: ["supportbox-configs"],
    queryFn: async () => {
      const response = await sdk.client.fetch("/admin/supportbox/configs", { method: "GET" })
      return (response as any).configs || []
    },
  })

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ["supportbox-tickets", selectedConfigId, statusFilter, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (selectedConfigId) params.append("config_id", selectedConfigId)
      if (statusFilter !== "all") params.append("status", statusFilter)
      if (searchQuery) params.append("q", searchQuery)
      const response = await sdk.client.fetch(
        `/admin/supportbox/tickets?${params.toString()}`,
        { method: "GET" }
      )
      return (response as any).tickets || []
    },
  })

  const newCount = tickets.filter((t: any) => t.status === "new").length
  const solvedCount = tickets.filter((t: any) => t.status === "solved").length

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "32px" }}>
      <div style={{ display: "flex", gap: "24px" }}>
        {/* Left Panel - Inbox List */}
        <div style={{ width: "280px", flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <div style={{ fontSize: "14px", fontWeight: "600" }}>Email Inboxes</div>
            <Link to="/supportbox/settings">
              <Button variant="secondary" size="small">Add</Button>
            </Link>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <button
              onClick={() => setSelectedConfigId(null)}
              style={{
                padding: "12px 16px",
                textAlign: "left",
                border: "1px solid #E1E3E5",
                borderRadius: "8px",
                backgroundColor: selectedConfigId === null ? "#F6F6F7" : "white",
                cursor: "pointer",
                fontSize: "13px",
                fontWeight: "600",
              }}
            >
              All Inboxes
            </button>
            {configs.map((config: any) => (
              <button
                key={config.id}
                onClick={() => setSelectedConfigId(config.id)}
                style={{
                  padding: "12px 16px",
                  textAlign: "left",
                  border: "1px solid",
                  borderColor: selectedConfigId === config.id ? "#008060" : "#E1E3E5",
                  borderRadius: "8px",
                  backgroundColor: selectedConfigId === config.id ? "#F6F6F7" : "white",
                  cursor: "pointer",
                }}
              >
                <div style={{ fontSize: "13px", fontWeight: "600", marginBottom: "4px" }}>
                  {config.display_name}
                </div>
                <div style={{ fontSize: "12px", color: "#6D7175" }}>
                  {config.email_address}
                </div>
                <div style={{ marginTop: "8px" }}>
                  <Badge color={config.is_active ? "green" : "grey"}>
                    {config.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Main Content */}
        <div style={{ flex: 1 }}>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
            <Heading level="h1">SupportBox</Heading>
            <Link to="/supportbox/settings">
              <Button variant="secondary">Settings</Button>
            </Link>
          </div>

          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", marginBottom: "24px" }}>
            <Container>
              <div style={{ padding: "16px" }}>
                <div style={{ color: "#6D7175", fontSize: "13px", fontWeight: "500", marginBottom: "8px" }}>New Tickets</div>
                <div style={{ fontSize: "32px", fontWeight: "600" }}>{newCount}</div>
              </div>
            </Container>
            <Container>
              <div style={{ padding: "16px" }}>
                <div style={{ color: "#6D7175", fontSize: "13px", fontWeight: "500", marginBottom: "8px" }}>Solved</div>
                <div style={{ fontSize: "32px", fontWeight: "600" }}>{solvedCount}</div>
              </div>
            </Container>
            <Container>
              <div style={{ padding: "16px" }}>
                <div style={{ color: "#6D7175", fontSize: "13px", fontWeight: "500", marginBottom: "8px" }}>Total</div>
                <div style={{ fontSize: "32px", fontWeight: "600" }}>{tickets.length}</div>
              </div>
            </Container>
          </div>

          {/* Filters */}
          <Container>
            <div style={{ padding: "16px", display: "flex", gap: "16px", alignItems: "center" }}>
              <div style={{ flex: 1 }}>
                <Input
                  placeholder="Search by subject or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v)}>
                <Select.Trigger>
                  <Select.Value placeholder="All Status" />
                </Select.Trigger>
                <Select.Content>
                  <Select.Item value="all">All Status</Select.Item>
                  <Select.Item value="new">New</Select.Item>
                  <Select.Item value="solved">Solved</Select.Item>
                </Select.Content>
              </Select>
            </div>
          </Container>

          {/* Ticket Table */}
          <div style={{ marginTop: "16px" }}>
            <Container>
              {isLoading ? (
                <div style={{ padding: "48px", textAlign: "center", color: "#6D7175" }}>Loading...</div>
              ) : tickets.length === 0 ? (
                <div style={{ padding: "48px", textAlign: "center", color: "#6D7175" }}>No tickets found</div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #E1E3E5" }}>
                      <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "12px", fontWeight: "600", color: "#6D7175" }}>Status</th>
                      <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "12px", fontWeight: "600", color: "#6D7175" }}>Subject</th>
                      <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "12px", fontWeight: "600", color: "#6D7175" }}>From</th>
                      <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "12px", fontWeight: "600", color: "#6D7175" }}>Order</th>
                      <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "12px", fontWeight: "600", color: "#6D7175" }}>Date</th>
                      <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "12px", fontWeight: "600", color: "#6D7175" }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tickets.map((ticket: any) => (
                      <tr key={ticket.id} style={{ borderBottom: "1px solid #E1E3E5" }}>
                        <td style={{ padding: "16px" }}>
                          <Badge color={ticket.status === "new" ? "green" : ticket.status === "solved" ? "grey" : "orange"}>
                            {ticket.status === "new" ? "New" : ticket.status === "solved" ? "Solved" : "Old"}
                          </Badge>
                        </td>
                        <td style={{ padding: "16px", fontSize: "13px", fontWeight: "500" }}>{ticket.subject}</td>
                        <td style={{ padding: "16px", fontSize: "13px", color: "#6D7175" }}>
                          {ticket.from_name ? `${ticket.from_name} <${ticket.from_email}>` : ticket.from_email}
                        </td>
                        <td style={{ padding: "16px", fontSize: "13px", color: "#6D7175" }}>
                          {ticket.order_id ? (
                            <Link to={`/orders/${ticket.order_id}`} style={{ color: "#008060" }}>View Order</Link>
                          ) : "N/A"}
                        </td>
                        <td style={{ padding: "16px", fontSize: "13px", color: "#6D7175" }}>
                          {new Date(ticket.created_at).toLocaleDateString()}
                        </td>
                        <td style={{ padding: "16px" }}>
                          <Link to={`/supportbox/${ticket.id}`}>
                            <Button variant="secondary" size="small">View</Button>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Container>
          </div>
        </div>
      </div>
    </div>
  )
}

export const config = defineRouteConfig({
  label: "SupportBox",
  icon: ChatBubbleLeftRight,
  rank: 7,
})

export default SupportBoxDashboard
