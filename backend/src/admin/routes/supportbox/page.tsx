// @ts-nocheck
import { defineRouteConfig } from "@medusajs/admin-sdk"
import { ChatBubbleLeftRight } from "@medusajs/icons"
import { Badge, Button, Input, Select } from "@medusajs/ui"
import { useState } from "react"
import { Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { sdk } from "../../lib/sdk"

// ═══════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════
function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 60) return "just now"
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`
  return new Date(date).toLocaleDateString()
}

function stripHtml(html: string): string {
  return html?.replace(/<[^>]*>/g, "") || ""
}

function getMessagePreview(ticket: any): string {
  const firstInbound = ticket.messages?.find((m: any) => m.direction === "inbound")
  if (!firstInbound) return ""
  const text = firstInbound.body_text || stripHtml(firstInbound.body_html) || ""
  return text.substring(0, 80) + (text.length > 80 ? "..." : "")
}

function isUnread(ticket: any): boolean {
  if (ticket.status !== "new") return false
  const msgs = ticket.messages || []
  if (msgs.length === 0) return true
  const sorted = [...msgs].sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  return sorted[0]?.direction === "inbound"
}

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
  greenBg: "#F0FDF4",
  blue: "#3B82F6",
  blueBg: "#EFF6FF",
  orange: "#F59E0B",
  orangeBg: "#FFFBEB",
  red: "#EF4444",
}

// ═══════════════════════════════════════════
// STAT CARD
// ═══════════════════════════════════════════
function StatCard({ label, count, color, bgColor, icon, isActive, onClick }: {
  label: string; count: number; color: string; bgColor: string; icon: string; isActive?: boolean; onClick?: () => void
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
      style={{
        padding: "16px 20px",
        backgroundColor: isActive ? bgColor : C.white,
        border: `1px solid ${isActive ? color : C.border}`,
        borderRadius: "12px",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: "14px",
        transform: hovered ? "translateY(-1px)" : "translateY(0)",
        boxShadow: hovered ? "0 4px 12px rgba(0,0,0,0.06)" : "0 1px 3px rgba(0,0,0,0.04)",
        transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
      }}
    >
      <div style={{
        width: "40px", height: "40px", borderRadius: "10px",
        backgroundColor: bgColor, display: "flex", alignItems: "center",
        justifyContent: "center", fontSize: "18px", flexShrink: 0,
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: "24px", fontWeight: 700, color: C.text, lineHeight: 1.1, marginBottom: "2px" }}>
          {count}
        </div>
        <div style={{ fontSize: "12px", fontWeight: 500, color: C.textSecondary }}>{label}</div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════
// INBOX ITEM
// ═══════════════════════════════════════════
function InboxItem({ label, email, newCount, isActive, isActiveStatus, onClick }: {
  label: string; email?: string; newCount?: number; isActive: boolean; isActiveStatus?: boolean; onClick: () => void
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: "100%",
        padding: "12px 14px",
        textAlign: "left",
        border: "none",
        borderLeft: isActive ? `3px solid ${C.green}` : "3px solid transparent",
        borderRadius: "0 8px 8px 0",
        backgroundColor: isActive ? C.greenBg : hovered ? "#F3F4F6" : C.white,
        cursor: "pointer",
        transition: "all 0.15s ease",
        display: "flex",
        alignItems: "center",
        gap: "10px",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: email ? "2px" : 0 }}>
          {isActiveStatus !== undefined && (
            <div style={{
              width: "7px", height: "7px", borderRadius: "50%",
              backgroundColor: isActiveStatus ? C.green : C.textMuted, flexShrink: 0,
            }} />
          )}
          <span style={{ fontSize: "13px", fontWeight: 600, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {label}
          </span>
        </div>
        {email && (
          <div style={{ fontSize: "11px", color: C.textSecondary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingLeft: "13px" }}>
            {email}
          </div>
        )}
      </div>
      {newCount != null && newCount > 0 && (
        <div style={{
          minWidth: "20px", height: "20px", borderRadius: "10px",
          backgroundColor: C.green, color: C.white,
          fontSize: "11px", fontWeight: 600,
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "0 6px", flexShrink: 0,
        }}>
          {newCount}
        </div>
      )}
    </button>
  )
}

// ═══════════════════════════════════════════
// TICKET CARD
// ═══════════════════════════════════════════
function TicketCard({ ticket }: { ticket: any }) {
  const [hovered, setHovered] = useState(false)
  const unread = isUnread(ticket)
  const preview = getMessagePreview(ticket)

  const statusColor = ticket.status === "new" ? C.green : ticket.status === "solved" ? C.textMuted : C.orange
  const statusLabel = ticket.status === "new" ? "New" : ticket.status === "solved" ? "Solved" : "Old"

  return (
    <Link to={`/supportbox/${ticket.id}`} style={{ textDecoration: "none", color: "inherit" }}>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          padding: "14px 20px",
          borderBottom: `1px solid ${C.borderLight}`,
          display: "flex",
          alignItems: "center",
          gap: "14px",
          cursor: "pointer",
          backgroundColor: hovered ? "#F9FAFB" : "transparent",
          transition: "background-color 0.15s ease",
        }}
      >
        {/* Status dot */}
        <div style={{
          width: "10px", height: "10px", borderRadius: "50%",
          backgroundColor: statusColor, flexShrink: 0,
        }} />

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "3px" }}>
            <span style={{
              fontSize: "13px", fontWeight: unread ? 700 : 500, color: C.text,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {ticket.subject}
            </span>
            <span style={{ fontSize: "11px", color: C.textMuted, flexShrink: 0, marginLeft: "12px" }}>
              {timeAgo(ticket.created_at)}
            </span>
          </div>
          <div style={{ fontSize: "12px", color: C.textSecondary, marginBottom: "2px" }}>
            {ticket.from_name || ticket.from_email}
          </div>
          {preview && (
            <div style={{
              fontSize: "12px", color: C.textMuted,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {preview}
            </div>
          )}
        </div>

        {/* Badges */}
        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexShrink: 0 }}>
          {unread && (
            <div style={{
              width: "8px", height: "8px", borderRadius: "50%",
              backgroundColor: C.blue,
            }} />
          )}
          <Badge color={ticket.status === "new" ? "green" : ticket.status === "solved" ? "grey" : "orange"}>
            {statusLabel}
          </Badge>
        </div>
      </div>
    </Link>
  )
}

// ═══════════════════════════════════════════
// MAIN DASHBOARD
// ═══════════════════════════════════════════
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
  const oldCount = tickets.filter((t: any) => t.status !== "new" && t.status !== "solved").length

  // Count new tickets per config
  const newPerConfig = (configId: string) =>
    tickets.filter((t: any) => t.config_id === configId && t.status === "new").length

  // Handle stat card click
  const handleStatClick = (status: string) => {
    setStatusFilter(statusFilter === status ? "all" : status)
  }

  return (
    <div style={{ maxWidth: "1400px", margin: "0 auto", padding: "24px 32px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <h1 style={{ fontSize: "20px", fontWeight: 600, color: C.text, margin: 0 }}>SupportBox</h1>
        <Link to="/supportbox/settings">
          <Button variant="secondary" size="small">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: "6px" }}>
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            Settings
          </Button>
        </Link>
      </div>

      <div style={{ display: "flex", gap: "24px" }}>
        {/* ═══ Left Sidebar — Inboxes ═══ */}
        <div style={{ width: "240px", flexShrink: 0 }}>
          <div style={{ fontSize: "11px", fontWeight: 600, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.5px", padding: "0 14px", marginBottom: "8px" }}>
            Inboxes
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <InboxItem
              label="All Inboxes"
              newCount={newCount}
              isActive={selectedConfigId === null}
              onClick={() => setSelectedConfigId(null)}
            />
            {configs.map((config: any) => (
              <InboxItem
                key={config.id}
                label={config.display_name}
                email={config.email_address}
                newCount={newPerConfig(config.id)}
                isActive={selectedConfigId === config.id}
                isActiveStatus={config.is_active}
                onClick={() => setSelectedConfigId(config.id)}
              />
            ))}
          </div>
        </div>

        {/* ═══ Main Content ═══ */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Stat Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "20px" }}>
            <StatCard label="New" count={newCount} color={C.green} bgColor={C.greenBg} icon="📩" isActive={statusFilter === "new"} onClick={() => handleStatClick("new")} />
            <StatCard label="Solved" count={solvedCount} color={C.blue} bgColor={C.blueBg} icon="✅" isActive={statusFilter === "solved"} onClick={() => handleStatClick("solved")} />
            <StatCard label="Old" count={oldCount} color={C.orange} bgColor={C.orangeBg} icon="📂" isActive={statusFilter === "old"} onClick={() => handleStatClick("old")} />
            <StatCard label="Total" count={tickets.length} color={C.textMuted} bgColor={C.bg} icon="📊" />
          </div>

          {/* Filters */}
          <div style={{
            display: "flex", gap: "12px", alignItems: "center", marginBottom: "16px",
            padding: "12px 16px", backgroundColor: C.white, border: `1px solid ${C.border}`,
            borderRadius: "12px 12px 0 0", borderBottom: "none",
          }}>
            <div style={{ flex: 1 }}>
              <Input
                placeholder="Search by subject or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                size="small"
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

          {/* Ticket List */}
          <div style={{
            backgroundColor: C.white, border: `1px solid ${C.border}`,
            borderRadius: "0 0 12px 12px", overflow: "hidden",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}>
            {isLoading ? (
              <div style={{ padding: "48px", textAlign: "center", color: C.textSecondary, fontSize: "13px" }}>
                Loading tickets...
              </div>
            ) : tickets.length === 0 ? (
              <div style={{ padding: "48px", textAlign: "center", color: C.textSecondary, fontSize: "13px" }}>
                No tickets found
              </div>
            ) : (
              tickets.map((ticket: any) => (
                <TicketCard key={ticket.id} ticket={ticket} />
              ))
            )}
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
