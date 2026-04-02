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
    const originals: { el: HTMLElement; s: Record<string, string> }[] = []
    let node: HTMLElement | null = el.parentElement
    while (node && node !== document.documentElement) {
      const parent = node.parentElement
      let isLayoutBoundary = false
      if (parent && parent !== document.documentElement) {
        const parentDisplay = getComputedStyle(parent).display
        if ((parentDisplay === "flex" || parentDisplay === "grid") && parent.children.length > 1) {
          isLayoutBoundary = true
        }
      }

      originals.push({
        el: node,
        s: {
          bg: node.style.background, mw: node.style.maxWidth, w: node.style.width,
          pl: node.style.paddingLeft, pr: node.style.paddingRight,
          flex: node.style.flex, minWidth: node.style.minWidth,
        },
      })
      node.style.setProperty("background", BG_COLOR, "important")
      node.style.setProperty("max-width", "none", "important")
      node.style.setProperty("width", "100%", "important")
      node.style.setProperty("padding-left", "0", "important")
      node.style.setProperty("padding-right", "0", "important")
      node.style.setProperty("min-width", "0", "important")

      if (isLayoutBoundary) {
        node.style.setProperty("flex", "1 1 0%", "important")
        break
      }

      node = node.parentElement
    }
    return () => {
      originals.forEach(({ el: n, s }) => {
        n.style.background = s.bg; n.style.maxWidth = s.mw; n.style.width = s.w
        n.style.paddingLeft = s.pl; n.style.paddingRight = s.pr
        n.style.flex = s.flex; n.style.minWidth = s.minWidth
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

function getCategoryColor(category: string): { color: string; bg: string } {
  const map: Record<string, { color: string; bg: string }> = {
    payment_issue: { color: "#DC2626", bg: "#FEF2F2" },
    shipping: { color: "#2563EB", bg: "#EFF6FF" },
    order_issue: { color: "#D97706", bg: "#FFFBEB" },
    product_feedback: { color: "#059669", bg: "#ECFDF5" },
    returns: { color: "#7C3AED", bg: "#F5F3FF" },
    account: { color: "#6B7280", bg: "#F3F4F6" },
    spam: { color: "#EF4444", bg: "#FEF2F2" },
    other: { color: "#6B7280", bg: "#F3F4F6" },
  }
  return map[category] || map.other
}

function formatCategory(category: string): string {
  const map: Record<string, string> = {
    payment_issue: "Payment",
    shipping: "Shipping",
    order_issue: "Order issue",
    product_feedback: "Feedback",
    returns: "Returns",
    account: "Account",
    spam: "Spam",
    other: "Other",
  }
  return map[category] || category
}

function getCategoryEmoji(category: string): string {
  const map: Record<string, string> = {
    payment_issue: "\uD83D\uDCB3",
    shipping: "\uD83D\uDE9A",
    order_issue: "\u26A0\uFE0F",
    product_feedback: "\uD83D\uDCAC",
    returns: "\uD83D\uDD04",
    account: "\uD83D\uDC64",
    spam: "\uD83D\uDEAB",
    other: "\uD83D\uDCCC",
  }
  return map[category] || "\uD83D\uDCCC"
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
        backgroundColor: isActive ? bgColor : hovered ? bgColor + "80" : C.white,
        border: `1px solid ${isActive ? color : hovered ? color + "60" : C.border}`,
        borderRadius: "14px",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: "14px",
        transform: hovered ? "translateY(-3px) scale(1.02)" : "translateY(0) scale(1)",
        boxShadow: hovered
          ? `0 8px 25px ${color}22, 0 4px 12px rgba(0,0,0,0.06)`
          : isActive
            ? `0 2px 8px ${color}18`
            : "0 1px 3px rgba(0,0,0,0.04)",
        transition: "all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
      }}
    >
      <div style={{
        width: "42px", height: "42px", borderRadius: "12px",
        backgroundColor: bgColor, display: "flex", alignItems: "center",
        justifyContent: "center", fontSize: "18px", flexShrink: 0,
        transform: hovered ? "scale(1.1) rotate(-3deg)" : "scale(1) rotate(0deg)",
        transition: "transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
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
        borderLeft: isActive ? `3px solid ${activeColor}` : `3px solid ${hovered ? activeColor + "40" : "transparent"}`,
        borderRadius: "0 10px 10px 0",
        backgroundColor: isActive ? activeBg : hovered ? "#F3F4F6" : C.white,
        cursor: "pointer",
        transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
        display: "flex",
        alignItems: "center",
        gap: "10px",
        transform: hovered && !isActive ? "translateX(4px)" : "translateX(0)",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: email ? "2px" : 0 }}>
          {isActiveStatus !== undefined && (
            <div style={{
              width: "7px", height: "7px", borderRadius: "50%",
              backgroundColor: isActiveStatus ? C.green : C.textMuted, flexShrink: 0,
              boxShadow: isActiveStatus ? `0 0 6px ${C.green}50` : "none",
              transition: "box-shadow 0.3s ease",
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
          boxShadow: `0 2px 6px ${color || C.green}40`,
          transform: hovered ? "scale(1.1)" : "scale(1)",
          transition: "transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)",
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

  // Get the timestamp of the most recent message (or ticket creation if no messages)
  const msgs = ticket.messages || []
  const latestMsgDate = msgs.length > 0
    ? msgs.reduce((latest: string, m: any) => m.created_at > latest ? m.created_at : latest, msgs[0].created_at)
    : ticket.created_at
  const msgCount = msgs.length

  const statusColor = ticket.status === "new" ? C.green : ticket.status === "solved" ? C.textMuted : ticket.status === "spam" ? C.red : ticket.status === "read" ? C.textSecondary : C.orange
  const statusLabel = ticket.status === "new" ? "New" : ticket.status === "solved" ? "Solved" : ticket.status === "spam" ? "Spam" : ticket.status === "read" ? "" : "Old"
  const badgeColor = ticket.status === "new" ? "green" : ticket.status === "solved" ? "grey" : ticket.status === "spam" ? "red" : ticket.status === "read" ? "" : "orange"

  return (
    <Link to={`/supportbox/${ticket.id}`} style={{ textDecoration: "none", color: "inherit" }}>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          padding: "14px 20px",
          borderBottom: `1px solid ${C.borderLight}`,
          borderLeft: hovered ? `3px solid ${statusColor}` : "3px solid transparent",
          display: "flex",
          alignItems: "center",
          gap: "14px",
          cursor: "pointer",
          backgroundColor: hovered ? `${statusColor}08` : "transparent",
          transform: hovered ? "translateX(2px)" : "translateX(0)",
          transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      >
        {/* Status dot */}
        <div style={{
          width: "10px", height: "10px", borderRadius: "50%",
          backgroundColor: statusColor, flexShrink: 0,
          boxShadow: hovered ? `0 0 8px ${statusColor}50` : "none",
          transform: hovered ? "scale(1.2)" : "scale(1)",
          transition: "all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)",
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
              {timeAgo(latestMsgDate)}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "2px" }}>
            <span style={{ fontSize: "12px", color: C.textSecondary }}>
              {ticket.from_name || ticket.from_email}
            </span>
            {msgCount > 1 && (
              <span style={{ fontSize: "10px", color: C.textMuted, backgroundColor: C.borderLight, padding: "1px 6px", borderRadius: "9999px" }}>
                {msgCount} msgs
              </span>
            )}
          </div>
          {/* AI Labels */}
          {ticket.metadata?.ai_labels && (
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px", flexWrap: "wrap" }}>
              {ticket.metadata.ai_labels.project && (
                <span style={{
                  fontSize: "11px", fontWeight: 600, color: "#4F46E5",
                  backgroundColor: "#EEF2FF", padding: "2px 10px",
                  borderRadius: "9999px", letterSpacing: "0.02em",
                }}>
                  {ticket.metadata.ai_labels.project}
                </span>
              )}
              {ticket.metadata.ai_labels.category && (
                <span style={{
                  fontSize: "11px", fontWeight: 600,
                  color: getCategoryColor(ticket.metadata.ai_labels.category).color,
                  backgroundColor: getCategoryColor(ticket.metadata.ai_labels.category).bg,
                  padding: "2px 10px", borderRadius: "9999px",
                }}>
                  {getCategoryEmoji(ticket.metadata.ai_labels.category)}{" "}{formatCategory(ticket.metadata.ai_labels.category)}
                </span>
              )}
            </div>
          )}
          {ticket.metadata?.ai_labels?.summary ? (
            <div style={{
              fontSize: "12px", color: "#6B7280", fontStyle: "italic",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {getCategoryEmoji(ticket.metadata.ai_labels.category || "other")}{" "}{ticket.metadata.ai_labels.summary}
            </div>
          ) : preview ? (
            <div style={{
              fontSize: "12px", color: C.textMuted,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {preview}
            </div>
          ) : null}
        </div>

        {/* Badges */}
        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexShrink: 0 }}>
          {unread && (
            <div style={{
              width: "8px", height: "8px", borderRadius: "50%",
              backgroundColor: C.blue,
              boxShadow: `0 0 6px ${C.blue}60`,
              animation: "pulse 2s ease-in-out infinite",
            }} />
          )}
          {statusLabel && (
            <Badge color={badgeColor}>
              {statusLabel}
            </Badge>
          )}
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
  const [attachments, setAttachments] = useState<{ file: File; base64: string }[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = Math.max(120, el.scrollHeight) + "px"
  }, [body])

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const newAttachments: { file: File; base64: string }[] = []
    for (const file of files) {
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onload = () => {
          const result = reader.result as string
          resolve(result.split(",")[1] || result)
        }
        reader.readAsDataURL(file)
      })
      newAttachments.push({ file, base64 })
    }
    setAttachments(prev => [...prev, ...newAttachments])
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const removeAttachment = (idx: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== idx))
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1048576).toFixed(1)} MB`
  }

  const composeMut = useMutation({
    mutationFn: async () => {
      const bodyHtml = body.split("\n").map(l => `<p>${l}</p>`).join("")
      const attPayload = attachments.map(a => ({
        filename: a.file.name,
        content: a.base64,
        content_type: a.file.type || "application/octet-stream",
        size: a.file.size,
      }))
      return sdk.client.fetch("/admin/supportbox/tickets/compose", {
        method: "POST",
        body: {
          config_id: configId,
          to_email: toEmail,
          subject,
          body_html: bodyHtml,
          body_text: body,
          ...(attPayload.length > 0 ? { attachments: attPayload } : {}),
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
          zIndex: 9998, backdropFilter: "blur(4px)",
          animation: "fadeInScale 0.2s ease-out",
        }}
      />

      {/* Modal */}
      <div style={{
        position: "fixed", top: "50%", left: "50%",
        transform: "translate(-50%, -50%)",
        width: "640px", maxWidth: "90vw", maxHeight: "90vh",
        backgroundColor: C.white, borderRadius: "20px",
        boxShadow: "0 25px 80px rgba(0,0,0,0.18), 0 8px 24px rgba(0,0,0,0.08)",
        zIndex: 9999, display: "flex", flexDirection: "column",
        overflow: "hidden",
        animation: "fadeInScale 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)",
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

          {/* Attachments */}
          <div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileSelect}
              style={{ display: "none" }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={{
                display: "inline-flex", alignItems: "center", gap: "6px",
                padding: "7px 14px", fontSize: "12px", fontWeight: 600,
                color: C.textSecondary, backgroundColor: C.bg,
                border: `1px solid ${C.border}`, borderRadius: "8px",
                cursor: "pointer", transition: "all 0.15s",
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = C.blue; e.currentTarget.style.color = C.blue }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.textSecondary }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M12.07 6.53L7.12 11.48a3.18 3.18 0 01-4.5-4.5l4.95-4.95a2.12 2.12 0 013 3L5.62 9.98a1.06 1.06 0 01-1.5-1.5l4.25-4.24" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Attach files
            </button>

            {attachments.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "10px" }}>
                {attachments.map((att, idx) => {
                  const icon = att.file.type.startsWith("image/") ? "🖼"
                    : att.file.type === "application/pdf" ? "📄"
                    : att.file.type.includes("spreadsheet") || att.file.type.includes("excel") ? "📊"
                    : att.file.type.includes("document") || att.file.type.includes("word") ? "📝"
                    : "📎"
                  return (
                    <div key={idx} style={{
                      display: "inline-flex", alignItems: "center", gap: "8px",
                      padding: "6px 12px", borderRadius: "10px",
                      backgroundColor: "#EFF6FF", border: "1px solid #DBEAFE",
                      fontSize: "12px", color: C.text, maxWidth: "240px",
                    }}>
                      <span style={{ fontSize: "14px", flexShrink: 0 }}>{icon}</span>
                      <span style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {att.file.name}
                      </span>
                      <span style={{ color: C.textMuted, fontSize: "11px", flexShrink: 0 }}>
                        {formatFileSize(att.file.size)}
                      </span>
                      <button
                        onClick={() => removeAttachment(idx)}
                        style={{
                          display: "flex", alignItems: "center", justifyContent: "center",
                          width: "18px", height: "18px", borderRadius: "50%",
                          border: "none", backgroundColor: "rgba(220,38,38,0.1)", color: C.red,
                          cursor: "pointer", fontSize: "11px", fontWeight: 700, flexShrink: 0,
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
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
              className={canSend ? "sb-compose-btn" : ""}
              onClick={() => composeMut.mutate()}
              disabled={!canSend || composeMut.isPending}
              style={{
                padding: "8px 20px", fontSize: "13px", fontWeight: 600, color: "#fff",
                background: canSend ? C.blue : C.textMuted,
                border: "none", borderRadius: "10px",
                cursor: canSend ? "pointer" : "not-allowed",
                boxShadow: canSend ? `0 2px 8px ${C.blue}35` : "none",
                transition: "all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
              }}
            >
              {composeMut.isPending ? "Sending..." : attachments.length > 0 ? `Send + ${attachments.length} file${attachments.length > 1 ? "s" : ""}` : "Send email"}
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

  const qc = useQueryClient()
  const [selectedConfigId, setSelectedConfigId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>("inbox")
  const [searchInput, setSearchInput] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [showCompose, setShowCompose] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [projectFilter, setProjectFilter] = useState<string>("all")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [backfilling, setBackfilling] = useState(false)
  const [backfillResult, setBackfillResult] = useState<string | null>(null)

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setSearchQuery(searchInput), 350)
    return () => clearTimeout(timer)
  }, [searchInput])

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
  const oldCount = countSource.filter((t: any) => t.status !== "new" && t.status !== "solved" && t.status !== "read").length
  const spamCount = allTickets.filter((t: any) => t.status === "spam").length

  // Filtered tickets for display
  const statusFiltered = statusFilter === "spam"
    ? allTickets // backend already filtered to spam only
    : statusFilter === "all"
      ? allTickets
      : statusFilter === "inbox"
        ? allTickets.filter((t: any) => t.status !== "solved")
        : allTickets.filter((t: any) => t.status === statusFilter)

  const filteredTickets = statusFiltered.filter((t: any) => {
    if (projectFilter !== "all") {
      if (t.metadata?.ai_labels?.project !== projectFilter) return false
    }
    if (categoryFilter !== "all") {
      if (t.metadata?.ai_labels?.category !== categoryFilter) return false
    }
    return true
  })

  // Sort tickets by most recent activity (latest message timestamp), newest first
  const tickets = [...filteredTickets].sort((a: any, b: any) => {
    const aMessages = a.messages || []
    const bMessages = b.messages || []
    const aLatest = aMessages.length > 0
      ? Math.max(...aMessages.map((m: any) => +new Date(m.created_at)))
      : +new Date(a.created_at)
    const bLatest = bMessages.length > 0
      ? Math.max(...bMessages.map((m: any) => +new Date(m.created_at)))
      : +new Date(b.created_at)
    return bLatest - aLatest
  })

  // Count new tickets per config (from full dataset)
  const newPerConfig = (configId: string) =>
    countSource.filter((t: any) => t.config_id === configId && t.status === "new").length

  // Handle stat card click — toggle filter, inbox is the "off" state
  const handleStatClick = (status: string) => {
    setStatusFilter(statusFilter === status ? "inbox" : status)
  }

  return (
    <div ref={pageRef} style={{ maxWidth: "1400px", margin: "0 auto", padding: "24px 32px", background: BG_COLOR }}>
      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.7; transform: scale(1.3); } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeInScale { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        @keyframes spin { to { transform: translateY(-50%) rotate(360deg); } }
        .sb-compose-btn:hover { transform: translateY(-2px) !important; box-shadow: 0 6px 20px rgba(59,130,246,0.35) !important; }
        .sb-refresh-btn:hover { background-color: #F3F4F6 !important; transform: scale(1.05) !important; }
        .sb-settings-btn:hover { transform: translateY(-1px) !important; }
        @media (max-width: 768px) {
          .sb-main-layout { flex-direction: column !important; }
          .sb-sidebar { width: 100% !important; min-width: 0 !important; max-width: 100% !important; margin-bottom: 16px !important; }
          .sb-ticket-list { min-height: auto !important; }
          .sb-stats-row { flex-wrap: wrap !important; }
          .sb-stats-row > * { flex: 1 1 45% !important; min-width: 120px !important; }
          .sb-header-row { flex-direction: column !important; gap: 12px !important; align-items: flex-start !important; }
          .sb-search-box { width: 100% !important; }
        }
        @media (max-width: 480px) {
          .sb-page-root { padding: 12px 12px !important; }
          .sb-stats-row > * { flex: 1 1 100% !important; }
        }
      `}</style>
      <FullWidthStyles />
      {/* Header */}
      <div className="sb-header-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <h1 style={{ fontSize: "20px", fontWeight: 600, color: C.text, margin: 0 }}>SupportBox</h1>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <div style={{ position: "relative", width: "280px" }}>
            <Input
              placeholder="Search subject, email, content..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              size="small"
            />
            {searchInput && searchInput !== searchQuery && (
              <div style={{
                position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)",
                width: "14px", height: "14px", borderRadius: "50%",
                border: "2px solid #D1D5DB", borderTopColor: C.blue,
                animation: "spin 0.6s linear infinite",
              }} />
            )}
          </div>
          <button
            onClick={async () => {
              setRefreshing(true)
              await qc.invalidateQueries({ queryKey: ["supportbox-tickets"] })
              await qc.invalidateQueries({ queryKey: ["supportbox-tickets-counts"] })
              setTimeout(() => setRefreshing(false), 600)
            }}
            className="sb-refresh-btn"
            style={{
              width: "36px", height: "36px", borderRadius: "8px",
              border: `1px solid ${C.border}`, backgroundColor: C.white,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
            }}
            title="Refresh"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.textSecondary} strokeWidth="2"
              style={{ transition: "transform 0.6s ease", transform: refreshing ? "rotate(360deg)" : "rotate(0deg)" }}>
              <path d="M21 2v6h-6M3 22v-6h6" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M21 13a9 9 0 0 1-15.36 5.64L3 16M3 11a9 9 0 0 1 15.36-5.64L21 8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            className="sb-compose-btn"
            onClick={() => setShowCompose(true)}
            style={{
              padding: "8px 16px", fontSize: "13px", fontWeight: 600, color: "#fff",
              backgroundColor: C.blue, border: "none", borderRadius: "10px",
              cursor: "pointer", display: "flex", alignItems: "center", gap: "6px",
              boxShadow: `0 2px 8px ${C.blue}35`, transition: "all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
            New Email
          </button>
          <button
            onClick={async () => {
              setBackfilling(true)
              setBackfillResult(null)
              try {
                const res = await sdk.client.fetch("/admin/supportbox/tickets/backfill-labels", { method: "POST" })
                const r = res as any
                setBackfillResult(`✅ ${r.processed || 0} labeled, ${r.failed || 0} failed`)
                qc.invalidateQueries({ queryKey: ["supportbox-tickets"] })
              } catch (e: any) {
                setBackfillResult(`❌ ${e.message}`)
              }
              setBackfilling(false)
            }}
            disabled={backfilling}
            style={{
              padding: "8px 12px", fontSize: "12px", fontWeight: 500,
              color: backfilling ? C.textMuted : "#4F46E5",
              backgroundColor: backfilling ? C.inset : "#EEF2FF",
              border: "1px solid #C7D2FE", borderRadius: "10px",
              cursor: backfilling ? "wait" : "pointer",
              display: "flex", alignItems: "center", gap: "6px",
            }}
            title="Generate AI labels for tickets without them"
          >
            ✨ {backfilling ? "Labeling..." : "AI Labels"}
          </button>
          {backfillResult && (
            <span style={{ fontSize: "11px", color: C.textMuted }}>{backfillResult}</span>
          )}
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

      <div className="sb-main-layout" style={{ display: "flex", gap: "28px" }}>
        {/* ═══ Left Sidebar — Inboxes ═══ */}
        <div className="sb-sidebar" style={{ width: "280px", minWidth: "280px", maxWidth: "280px", flexShrink: 0 }}>
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
          <div className="sb-stats-row" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "20px" }}>
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
            <div style={{ flex: 1 }} />
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              style={{
                padding: "6px 10px", fontSize: "12px", fontWeight: 500,
                border: `1px solid ${C.border}`, borderRadius: "8px",
                backgroundColor: C.white, color: C.text,
                outline: "none", cursor: "pointer",
                fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
              }}
            >
              <option value="all">All projects</option>
              <option value="loslatenboek">loslatenboek</option>
              <option value="dehondenbijbel">dehondenbijbel</option>
              <option value="lass-los">lass-los</option>
              <option value="psi-superzivot">psi-superzivot</option>
              <option value="odpusc-ksiazka">odpusc-ksiazka</option>
              <option value="slapp-taget">slapp-taget</option>
            </select>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              style={{
                padding: "6px 10px", fontSize: "12px", fontWeight: 500,
                border: `1px solid ${C.border}`, borderRadius: "8px",
                backgroundColor: C.white, color: C.text,
                outline: "none", cursor: "pointer",
                fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
              }}
            >
              <option value="all">All categories</option>
              <option value="payment_issue">Payment</option>
              <option value="shipping">Shipping</option>
              <option value="order_issue">Order issue</option>
              <option value="product_feedback">Feedback</option>
              <option value="returns">Returns</option>
              <option value="account">Account</option>
              <option value="spam">Spam</option>
              <option value="other">Other</option>
            </select>
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

// Sidebar badge is now handled globally by widgets/supportbox-badge.tsx

export const config = defineRouteConfig({
  label: "SupportBox",
  icon: ChatBubbleLeftRight,
  rank: 7,
})

export default SupportBoxDashboard
