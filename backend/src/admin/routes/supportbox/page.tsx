// @ts-nocheck
import { defineRouteConfig } from "@medusajs/admin-sdk"
import { ChatBubbleLeftRight } from "@medusajs/icons"
import { Badge, Button, Input, Select } from "@medusajs/ui"
import { useState, useEffect, useRef } from "react"
import { Link } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { sdk } from "../../lib/sdk"

// ═══════════════════════════════════════════
// FULL-WIDTH OVERRIDE
// ═══════════════════════════════════════════
const BG_COLOR = "#F9FAFB"

function useFullWidth(ref: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const originals: { el: HTMLElement; bg: string }[] = []
    let node: HTMLElement | null = el.parentElement
    while (node && node !== document.documentElement) {
      originals.push({ el: node, bg: node.style.background })
      node.style.setProperty("background", BG_COLOR, "important")
      node.style.setProperty("max-width", "none", "important")
      node.style.setProperty("width", "100%", "important")
      node = node.parentElement
    }
    return () => {
      originals.forEach(({ el: n, bg }) => {
        n.style.background = bg
        n.style.removeProperty("max-width")
        n.style.removeProperty("width")
      })
    }
  }, [ref])
}

function FullWidthStyles() {
  return null
}

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
  const firstMsg = ticket.messages?.find((m: any) => m.direction === "inbound") || ticket.messages?.[0]
  if (!firstMsg) return ""
  const text = firstMsg.body_text || stripHtml(firstMsg.body_html) || ""
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
  redBg: "#FEF2F2",
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
function InboxItem({ label, email, newCount, isActive, isActiveStatus, onClick, color }: {
  label: string; email?: string; newCount?: number; isActive: boolean; isActiveStatus?: boolean; onClick: () => void; color?: string
}) {
  const [hovered, setHovered] = useState(false)
  const activeColor = color || C.green
  const activeBg = color === C.red ? C.redBg : C.greenBg
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
        borderLeft: isActive ? `3px solid ${activeColor}` : "3px solid transparent",
        borderRadius: "0 8px 8px 0",
        backgroundColor: isActive ? activeBg : hovered ? "#F3F4F6" : C.white,
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
          backgroundColor: color || C.green, color: C.white,
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

  const statusColor = ticket.status === "new" ? C.green : ticket.status === "solved" ? C.textMuted : ticket.status === "spam" ? C.red : C.orange
  const statusLabel = ticket.status === "new" ? "New" : ticket.status === "solved" ? "Solved" : ticket.status === "spam" ? "Spam" : "Old"
  const badgeColor = ticket.status === "new" ? "green" : ticket.status === "solved" ? "grey" : ticket.status === "spam" ? "red" : "orange"

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
          <Badge color={badgeColor}>
            {statusLabel}
          </Badge>
        </div>
      </div>
    </Link>
  )
}

// ═══════════════════════════════════════════
// COMPOSE EMAIL MODAL
// ═══════════════════════════════════════════
function ComposeModal({ configs, onClose, defaultConfigId }: {
  configs: any[]; onClose: () => void; defaultConfigId?: string | null
}) {
  const qc = useQueryClient()
  const [configId, setConfigId] = useState(defaultConfigId || configs[0]?.id || "")
  const [toEmail, setToEmail] = useState("")
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = Math.max(120, el.scrollHeight) + "px"
  }, [body])

  const composeMut = useMutation({
    mutationFn: async () => {
      const bodyHtml = body.split("\n").map(l => `<p>${l}</p>`).join("")
      return sdk.client.fetch("/admin/supportbox/tickets/compose", {
        method: "POST",
        body: {
          config_id: configId,
          to_email: toEmail,
          subject,
          body_html: bodyHtml,
          body_text: body,
        },
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["supportbox-tickets"] })
      onClose()
    },
  })

  const canSend = configId && toEmail.trim() && subject.trim() && body.trim()

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.4)",
          zIndex: 9998, backdropFilter: "blur(2px)",
        }}
      />

      {/* Modal */}
      <div style={{
        position: "fixed", top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        width: "640px", maxWidth: "90vw", maxHeight: "90vh",
        backgroundColor: C.white, borderRadius: "16px",
        boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
        zIndex: 9999, display: "flex", flexDirection: "column",
        overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "20px 24px", borderBottom: `1px solid ${C.border}`,
        }}>
          <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: C.text }}>New Email</h2>
          <button
            onClick={onClose}
            style={{
              width: "32px", height: "32px", borderRadius: "8px",
              border: `1px solid ${C.border}`, backgroundColor: C.white,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: C.textSecondary,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: "16px", overflowY: "auto", flex: 1 }}>
          {/* From (account selector) */}
          <div>
            <label style={{ fontSize: "12px", fontWeight: 600, color: C.textSecondary, display: "block", marginBottom: "6px" }}>
              From
            </label>
            <select
              value={configId}
              onChange={(e) => setConfigId(e.target.value)}
              style={{
                width: "100%", padding: "8px 12px", fontSize: "13px",
                border: `1px solid ${C.border}`, borderRadius: "8px",
                backgroundColor: C.white, color: C.text,
                outline: "none", cursor: "pointer",
                fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
              }}
            >
              {configs.map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.sender_name ? `${c.sender_name} (${c.email_address})` : `${c.display_name} (${c.email_address})`}
                </option>
              ))}
            </select>
          </div>

          {/* To */}
          <div>
            <label style={{ fontSize: "12px", fontWeight: 600, color: C.textSecondary, display: "block", marginBottom: "6px" }}>
              To
            </label>
            <Input
              placeholder="recipient@example.com"
              value={toEmail}
              onChange={(e) => setToEmail(e.target.value)}
              size="small"
              type="email"
            />
          </div>

          {/* Subject */}
          <div>
            <label style={{ fontSize: "12px", fontWeight: 600, color: C.textSecondary, display: "block", marginBottom: "6px" }}>
              Subject
            </label>
            <Input
              placeholder="Email subject..."
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              size="small"
            />
          </div>

          {/* Body */}
          <div>
            <label style={{ fontSize: "12px", fontWeight: 600, color: C.textSecondary, display: "block", marginBottom: "6px" }}>
              Message
            </label>
            <textarea
              ref={textareaRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your email..."
              style={{
                width: "100%", minHeight: "120px", maxHeight: "300px",
                padding: "12px 14px", fontSize: "14px", lineHeight: 1.7,
                color: C.text, backgroundColor: C.bg,
                border: `1px solid ${C.border}`, borderRadius: "8px",
                resize: "none", outline: "none",
                fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Error */}
          {composeMut.isError && (
            <div style={{
              padding: "10px 14px", backgroundColor: C.redBg,
              border: `1px solid ${C.red}30`, borderRadius: "8px",
              fontSize: "13px", color: C.red,
            }}>
              Failed to send: {(composeMut.error as any)?.message || "Unknown error"}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "16px 24px", borderTop: `1px solid ${C.border}`,
          backgroundColor: "#FAFBFC",
        }}>
          <span style={{ fontSize: "11px", color: C.textMuted }}>
            {body.trim() ? `${body.trim().length} chars` : ""}
          </span>
          <div style={{ display: "flex", gap: "10px" }}>
            <Button variant="secondary" size="small" onClick={onClose}>
              Cancel
            </Button>
            <button
              onClick={() => composeMut.mutate()}
              disabled={!canSend || composeMut.isPending}
              style={{
                padding: "8px 20px", fontSize: "13px", fontWeight: 600, color: "#fff",
                background: canSend ? C.blue : C.textMuted,
                border: "none", borderRadius: "8px",
                cursor: canSend ? "pointer" : "not-allowed",
                boxShadow: canSend ? `0 1px 3px ${C.blue}44` : "none",
                transition: "all 0.15s ease",
              }}
            >
              {composeMut.isPending ? "Sending..." : "Send email"}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// ═══════════════════════════════════════════
// MAIN DASHBOARD
// ═══════════════════════════════════════════
const SupportBoxDashboard = () => {
  const pageRef = useRef<HTMLDivElement>(null)
  useFullWidth(pageRef)

  const [selectedConfigId, setSelectedConfigId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>("inbox")
  const [searchQuery, setSearchQuery] = useState("")
  const [showCompose, setShowCompose] = useState(false)

  const { data: configs = [] } = useQuery({
    queryKey: ["supportbox-configs"],
    queryFn: async () => {
      const response = await sdk.client.fetch("/admin/supportbox/configs", { method: "GET" })
      return (response as any).configs || []
    },
  })

  // Fetch tickets — for spam view, pass status=spam so backend returns spam tickets
  const { data: allTickets = [], isLoading } = useQuery({
    queryKey: ["supportbox-tickets", selectedConfigId, searchQuery, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (selectedConfigId) params.append("config_id", selectedConfigId)
      if (searchQuery) params.append("q", searchQuery)
      // When viewing spam, tell backend to return spam tickets
      if (statusFilter === "spam") params.append("status", "spam")
      const response = await sdk.client.fetch(
        `/admin/supportbox/tickets?${params.toString()}`,
        { method: "GET" }
      )
      return (response as any).tickets || []
    },
    refetchInterval: 10000,
  })

  // For spam view we also need non-spam tickets for counts
  const { data: nonSpamTickets = [] } = useQuery({
    queryKey: ["supportbox-tickets-counts", selectedConfigId, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (selectedConfigId) params.append("config_id", selectedConfigId)
      if (searchQuery) params.append("q", searchQuery)
      const response = await sdk.client.fetch(
        `/admin/supportbox/tickets?${params.toString()}`,
        { method: "GET" }
      )
      return (response as any).tickets || []
    },
    refetchInterval: 10000,
    enabled: statusFilter === "spam",
  })

  // Use correct source for counts (non-spam always)
  const countSource = statusFilter === "spam" ? nonSpamTickets : allTickets

  // Counts always from non-spam dataset
  const newCount = countSource.filter((t: any) => t.status === "new").length
  const solvedCount = countSource.filter((t: any) => t.status === "solved").length
  const oldCount = countSource.filter((t: any) => t.status !== "new" && t.status !== "solved").length
  const spamCount = allTickets.filter((t: any) => t.status === "spam").length

  // Filtered tickets for display
  const tickets = statusFilter === "spam"
    ? allTickets // backend already filtered to spam only
    : statusFilter === "all"
      ? allTickets
      : statusFilter === "inbox"
        ? allTickets.filter((t: any) => t.status !== "solved")
        : allTickets.filter((t: any) => t.status === statusFilter)

  // Count new tickets per config (from full dataset)
  const newPerConfig = (configId: string) =>
    countSource.filter((t: any) => t.config_id === configId && t.status === "new").length

  // Handle stat card click — toggle filter, inbox is the "off" state
  const handleStatClick = (status: string) => {
    setStatusFilter(statusFilter === status ? "inbox" : status)
  }

  return (
    <div ref={pageRef} style={{ maxWidth: "1140px", margin: "0 auto", padding: "24px 32px", background: BG_COLOR }}>
      <FullWidthStyles />
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <h1 style={{ fontSize: "20px", fontWeight: 600, color: C.text, margin: 0 }}>SupportBox</h1>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <button
            onClick={() => setShowCompose(true)}
            style={{
              padding: "8px 16px", fontSize: "13px", fontWeight: 600, color: "#fff",
              backgroundColor: C.blue, border: "none", borderRadius: "8px",
              cursor: "pointer", display: "flex", alignItems: "center", gap: "6px",
              boxShadow: `0 1px 3px ${C.blue}44`, transition: "all 0.15s ease",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
            New Email
          </button>
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
      </div>

      <div style={{ display: "flex", gap: "28px" }}>
        {/* ═══ Left Sidebar — Inboxes ═══ */}
        <div style={{ width: "280px", minWidth: "280px", maxWidth: "280px", flexShrink: 0 }}>
          <div style={{ fontSize: "11px", fontWeight: 600, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.5px", padding: "0 14px", marginBottom: "8px" }}>
            Inboxes
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <InboxItem
              label="All Inboxes"
              newCount={newCount}
              isActive={selectedConfigId === null && statusFilter !== "spam"}
              onClick={() => { setSelectedConfigId(null); if (statusFilter === "spam") setStatusFilter("inbox") }}
            />
            {configs.map((config: any) => (
              <InboxItem
                key={config.id}
                label={config.display_name}
                email={config.email_address}
                newCount={newPerConfig(config.id)}
                isActive={selectedConfigId === config.id && statusFilter !== "spam"}
                isActiveStatus={config.is_active}
                onClick={() => { setSelectedConfigId(config.id); if (statusFilter === "spam") setStatusFilter("inbox") }}
              />
            ))}
          </div>

          {/* Spam folder */}
          <div style={{ marginTop: "20px" }}>
            <div style={{ fontSize: "11px", fontWeight: 600, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.5px", padding: "0 14px", marginBottom: "8px" }}>
              Other
            </div>
            <InboxItem
              label="Spam"
              newCount={statusFilter === "spam" ? allTickets.length : undefined}
              isActive={statusFilter === "spam"}
              onClick={() => {
                setStatusFilter(statusFilter === "spam" ? "inbox" : "spam")
                setSelectedConfigId(null)
              }}
              color={C.red}
            />
          </div>
        </div>

        {/* ═══ Main Content ═══ */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Stat Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "20px" }}>
            <StatCard label="New" count={newCount} color={C.green} bgColor={C.greenBg} icon="📩" isActive={statusFilter === "new"} onClick={() => handleStatClick("new")} />
            <StatCard label="Solved" count={solvedCount} color={C.blue} bgColor={C.blueBg} icon="✅" isActive={statusFilter === "solved"} onClick={() => handleStatClick("solved")} />
            <StatCard label="Old" count={oldCount} color={C.orange} bgColor={C.orangeBg} icon="📂" isActive={statusFilter === "old"} onClick={() => handleStatClick("old")} />
            <StatCard label="Total" count={countSource.length} color={C.textMuted} bgColor={C.bg} icon="📊" isActive={statusFilter === "all"} onClick={() => setStatusFilter(statusFilter === "all" ? "inbox" : "all")} />
          </div>

          {/* Filters */}
          <div style={{
            display: "flex", gap: "12px", alignItems: "center",
            padding: "14px 20px", backgroundColor: C.white, border: `1px solid ${C.border}`,
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
                <Select.Value placeholder="Inbox" />
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="inbox">Inbox</Select.Item>
                <Select.Item value="new">New</Select.Item>
                <Select.Item value="solved">Solved</Select.Item>
                <Select.Item value="spam">Spam</Select.Item>
                <Select.Item value="all">All</Select.Item>
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
                {statusFilter === "spam" ? "No spam tickets" : "No tickets found"}
              </div>
            ) : (
              tickets.map((ticket: any) => (
                <TicketCard key={ticket.id} ticket={ticket} />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Compose Modal */}
      {showCompose && (
        <ComposeModal
          configs={configs}
          onClose={() => setShowCompose(false)}
          defaultConfigId={selectedConfigId}
        />
      )}
    </div>
  )
}

export const config = defineRouteConfig({
  label: "SupportBox",
  icon: ChatBubbleLeftRight,
  rank: 7,
})

export default SupportBoxDashboard
