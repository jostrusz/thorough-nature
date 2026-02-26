// @ts-nocheck
import { useState } from "react"
import { useParams, Link } from "react-router-dom"
import { Button, Badge, Container, Heading, Textarea } from "@medusajs/ui"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { sdk } from "../../../lib/sdk"

const TicketDetailPage = () => {
  const { id: ticketId } = useParams()
  const queryClient = useQueryClient()
  const [replyText, setReplyText] = useState("")

  const { data, isLoading } = useQuery({
    queryKey: ["supportbox-ticket-detail", ticketId],
    queryFn: async () => {
      const response = await sdk.client.fetch(
        `/admin/supportbox/tickets/${ticketId}`,
        { method: "GET" }
      )
      return response as any
    },
    enabled: !!ticketId,
  })

  const ticket = data?.ticket
  const matchedOrder = data?.matchedOrder

  const replyMutation = useMutation({
    mutationFn: async (bodyHtml: string) => {
      return await sdk.client.fetch(
        `/admin/supportbox/tickets/${ticketId}/reply`,
        { method: "POST", body: { body_html: bodyHtml } }
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supportbox-ticket-detail", ticketId] })
      setReplyText("")
    },
  })

  const solveMutation = useMutation({
    mutationFn: async () => {
      return await sdk.client.fetch(
        `/admin/supportbox/tickets/${ticketId}/solve`,
        { method: "POST" }
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supportbox-ticket-detail", ticketId] })
      queryClient.invalidateQueries({ queryKey: ["supportbox-tickets"] })
    },
  })

  const reopenMutation = useMutation({
    mutationFn: async () => {
      return await sdk.client.fetch(
        `/admin/supportbox/tickets/${ticketId}/reopen`,
        { method: "POST" }
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supportbox-ticket-detail", ticketId] })
      queryClient.invalidateQueries({ queryKey: ["supportbox-tickets"] })
    },
  })

  const handleSendReply = async () => {
    if (!replyText.trim()) return
    const bodyHtml = replyText.split("\n").map((line) => `<p>${line}</p>`).join("")
    await replyMutation.mutateAsync(bodyHtml)
  }

  if (isLoading) {
    return <div style={{ padding: "32px" }}>Loading...</div>
  }

  if (!ticket) {
    return <div style={{ padding: "32px" }}>Ticket not found</div>
  }

  const messages = ticket.messages || []
  const sortedMessages = [...messages].sort(
    (a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )

  return (
    <div style={{ maxWidth: "1400px", margin: "0 auto", padding: "32px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "32px" }}>
        <div>
          <Link to="/supportbox">
            <Button variant="secondary" size="small" style={{ marginBottom: "16px" }}>
              ← Back to Tickets
            </Button>
          </Link>
          <Heading level="h1">{ticket.subject}</Heading>
          <div style={{ fontSize: "14px", color: "#6D7175", marginTop: "4px" }}>
            From: {ticket.from_name ? `${ticket.from_name} <${ticket.from_email}>` : ticket.from_email}
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <Badge color={ticket.status === "new" ? "green" : "grey"}>
            {ticket.status === "new" ? "New" : ticket.status === "solved" ? "Solved" : "Old"}
          </Badge>
          {ticket.status === "new" ? (
            <Button onClick={() => solveMutation.mutate()} isLoading={solveMutation.isPending}>
              Mark as Solved
            </Button>
          ) : (
            <Button variant="secondary" onClick={() => reopenMutation.mutate()} isLoading={reopenMutation.isPending}>
              Reopen
            </Button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div style={{ display: "flex", gap: "32px" }}>
        {/* Left - Conversation */}
        <div style={{ flex: "0 0 65%" }}>
          <Container>
            <div style={{ padding: "24px" }}>
              <div style={{ marginBottom: "16px", fontSize: "14px", fontWeight: "600" }}>Conversation</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {sortedMessages.map((message: any) => (
                  <div
                    key={message.id}
                    style={{
                      display: "flex",
                      justifyContent: message.direction === "inbound" ? "flex-start" : "flex-end",
                    }}
                  >
                    <div
                      style={{
                        maxWidth: "85%",
                        padding: "12px 16px",
                        borderRadius: "8px",
                        backgroundColor: message.direction === "inbound" ? "#F6F6F7" : "#E6F4F0",
                        borderLeft: message.direction === "inbound" ? "3px solid #008060" : "none",
                      }}
                    >
                      <div style={{ fontSize: "12px", fontWeight: "600", color: "#6D7175", marginBottom: "8px" }}>
                        {message.from_name ? `${message.from_name} <${message.from_email}>` : message.from_email}
                        {" "}
                        <span style={{ fontWeight: "400", color: "#8C9196" }}>
                          {new Date(message.created_at).toLocaleString()}
                        </span>
                      </div>
                      <div
                        style={{ fontSize: "13px", lineHeight: "1.6" }}
                        dangerouslySetInnerHTML={{ __html: message.body_html }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Container>

          {/* Reply Form */}
          <Container>
            <div style={{ padding: "24px", marginTop: "16px" }}>
              <div style={{ marginBottom: "8px", fontSize: "13px", fontWeight: "600" }}>Reply to Customer</div>
              <Textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Type your reply here..."
                style={{ minHeight: "120px", marginBottom: "12px" }}
              />
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                <Button variant="secondary" onClick={() => setReplyText("")} disabled={replyMutation.isPending || !replyText.trim()}>
                  Clear
                </Button>
                <Button onClick={handleSendReply} isLoading={replyMutation.isPending} disabled={!replyText.trim()}>
                  Send Reply
                </Button>
              </div>
            </div>
          </Container>
        </div>

        {/* Right - Sidebar */}
        <div style={{ flex: "0 0 35%" }}>
          {/* Customer Card */}
          <CustomerSidebar fromEmail={ticket.from_email} />

          {/* Order Card */}
          {matchedOrder && (
            <Container>
              <div style={{ padding: "24px", marginTop: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "16px" }}>
                  <div style={{ fontSize: "14px", fontWeight: "600" }}>Matched Order</div>
                  <Link to={`/orders/${matchedOrder.order_id}`}>
                    <Button variant="secondary" size="small">View Order</Button>
                  </Link>
                </div>
                <div style={{ marginBottom: "12px" }}>
                  <div style={{ fontSize: "12px", color: "#6D7175", marginBottom: "4px" }}>Order</div>
                  <div style={{ fontSize: "13px", fontWeight: "600" }}>#{matchedOrder.display_id}</div>
                </div>
                {matchedOrder.status && (
                  <div style={{ marginBottom: "12px" }}>
                    <div style={{ fontSize: "12px", color: "#6D7175", marginBottom: "4px" }}>Status</div>
                    <Badge color="blue">{matchedOrder.status}</Badge>
                  </div>
                )}
                {matchedOrder.total != null && (
                  <div style={{ marginBottom: "12px" }}>
                    <div style={{ fontSize: "12px", color: "#6D7175", marginBottom: "4px" }}>Total</div>
                    <div style={{ fontSize: "13px", fontWeight: "600" }}>
                      {new Intl.NumberFormat("en-US", { style: "currency", currency: matchedOrder.currency_code || "USD" }).format(matchedOrder.total)}
                    </div>
                  </div>
                )}
                {matchedOrder.items && matchedOrder.items.length > 0 && (
                  <div>
                    <div style={{ fontSize: "12px", color: "#6D7175", marginBottom: "8px", fontWeight: "600" }}>
                      Items ({matchedOrder.items.length})
                    </div>
                    {matchedOrder.items.map((item: any, idx: number) => (
                      <div key={idx} style={{ fontSize: "12px", marginBottom: "4px" }}>
                        {item.title} <span style={{ color: "#6D7175" }}>x{item.quantity}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Container>
          )}
        </div>
      </div>
    </div>
  )
}

function CustomerSidebar({ fromEmail }: { fromEmail: string }) {
  const { data: customer, isLoading } = useQuery({
    queryKey: ["customer-by-email", fromEmail],
    queryFn: async () => {
      try {
        const response = await sdk.client.fetch(
          `/admin/customers?q=${fromEmail}`,
          { method: "GET" }
        ) as any
        return response.customers?.[0] || null
      } catch {
        return null
      }
    },
  })

  return (
    <Container>
      <div style={{ padding: "24px" }}>
        <div style={{ fontSize: "14px", fontWeight: "600", marginBottom: "16px" }}>Customer</div>
        {isLoading ? (
          <div style={{ color: "#6D7175", fontSize: "13px" }}>Loading...</div>
        ) : !customer ? (
          <div style={{ color: "#6D7175", fontSize: "13px" }}>No customer record found</div>
        ) : (
          <>
            <div style={{ marginBottom: "12px" }}>
              <div style={{ fontSize: "12px", color: "#6D7175", marginBottom: "4px" }}>Name</div>
              <div style={{ fontSize: "13px", fontWeight: "500" }}>{customer.first_name} {customer.last_name}</div>
            </div>
            <div style={{ marginBottom: "12px" }}>
              <div style={{ fontSize: "12px", color: "#6D7175", marginBottom: "4px" }}>Email</div>
              <div style={{ fontSize: "13px", fontWeight: "500" }}>{customer.email}</div>
            </div>
            <div>
              <div style={{ fontSize: "12px", color: "#6D7175", marginBottom: "4px" }}>Phone</div>
              <div style={{ fontSize: "13px", fontWeight: "500" }}>{customer.phone || "N/A"}</div>
            </div>
          </>
        )}
      </div>
    </Container>
  )
}

export default TicketDetailPage
