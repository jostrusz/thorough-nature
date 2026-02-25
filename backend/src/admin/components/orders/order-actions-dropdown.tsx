import React, { useEffect, useRef } from "react"

interface OrderActionsDropdownProps {
  open: boolean
  onClose: () => void
  onDuplicate: () => void
  onCancel: () => void
  onArchive: () => void
  onSendToBaseLinker: () => void
  onFakturoidCreate: () => void
  onFakturoidOpen: () => void
  fakturoidInvoiceId?: string
  fakturoidInvoiceUrl?: string
  baselinkerOrderId?: string
}

const dropdownStyle: React.CSSProperties = {
  position: "absolute",
  top: "100%",
  right: 0,
  marginTop: "4px",
  background: "#FFFFFF",
  border: "1px solid #E1E3E5",
  borderRadius: "10px",
  boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
  minWidth: "240px",
  zIndex: 100,
  overflow: "hidden",
}

const itemStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  padding: "10px 16px",
  fontSize: "13px",
  color: "#1A1A1A",
  cursor: "pointer",
  border: "none",
  background: "none",
  width: "100%",
  textAlign: "left",
  transition: "background 0.12s",
}

const dividerStyle: React.CSSProperties = {
  height: "1px",
  background: "#E1E3E5",
  margin: "4px 0",
}

const iconColor = "#6D7175"

export function OrderActionsDropdown({
  open,
  onClose,
  onDuplicate,
  onCancel,
  onArchive,
  onSendToBaseLinker,
  onFakturoidCreate,
  onFakturoidOpen,
  fakturoidInvoiceId,
  fakturoidInvoiceUrl,
  baselinkerOrderId,
}: OrderActionsDropdownProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [open, onClose])

  if (!open) return null

  const handleHover = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.background = "#F9FAFB"
  }
  const handleLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.background = "transparent"
  }

  return (
    <div ref={ref} style={dropdownStyle}>
      {/* Duplicate */}
      <button
        style={itemStyle}
        onClick={() => { onDuplicate(); onClose() }}
        onMouseEnter={handleHover}
        onMouseLeave={handleLeave}
      >
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke={iconColor} strokeWidth="1.5">
          <rect x="6" y="6" width="10" height="10" rx="2" />
          <path d="M14 6V4a2 2 0 00-2-2H4a2 2 0 00-2 2v8a2 2 0 002 2h2" />
        </svg>
        Duplicate
      </button>

      {/* Cancel order */}
      <button
        style={{ ...itemStyle, color: "#D72C0D" }}
        onClick={() => { onCancel(); onClose() }}
        onMouseEnter={handleHover}
        onMouseLeave={handleLeave}
      >
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="#D72C0D" strokeWidth="1.5">
          <line x1="5" y1="5" x2="15" y2="15" />
          <line x1="15" y1="5" x2="5" y2="15" />
        </svg>
        Cancel order
      </button>

      {/* Archive */}
      <button
        style={itemStyle}
        onClick={() => { onArchive(); onClose() }}
        onMouseEnter={handleHover}
        onMouseLeave={handleLeave}
      >
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke={iconColor} strokeWidth="1.5">
          <rect x="2" y="3" width="16" height="4" rx="1" />
          <path d="M4 7v8a2 2 0 002 2h8a2 2 0 002-2V7M8 11h4" />
        </svg>
        Archive
      </button>

      <div style={dividerStyle} />

      {/* View order status page */}
      <button
        style={itemStyle}
        onClick={() => {
          // Open in native Medusa admin
          window.open(`/app/orders/${(window as any).__orderIdForStatusPage || ""}`, "_blank")
          onClose()
        }}
        onMouseEnter={handleHover}
        onMouseLeave={handleLeave}
      >
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke={iconColor} strokeWidth="1.5">
          <circle cx="10" cy="10" r="8" />
          <path d="M10 6v4l3 3" />
        </svg>
        View order status page
      </button>

      <div style={dividerStyle} />

      {/* Fakturoid */}
      {fakturoidInvoiceId ? (
        <button
          style={itemStyle}
          onClick={() => { onFakturoidOpen(); onClose() }}
          onMouseEnter={handleHover}
          onMouseLeave={handleLeave}
        >
          <span style={{ fontSize: "14px", width: "16px", textAlign: "center", color: "#008060" }}>fa</span>
          Fakturoid: Open invoice
        </button>
      ) : (
        <button
          style={itemStyle}
          onClick={() => { onFakturoidCreate(); onClose() }}
          onMouseEnter={handleHover}
          onMouseLeave={handleLeave}
        >
          <span style={{ fontSize: "14px", width: "16px", textAlign: "center", color: "#6D7175" }}>fa</span>
          Fakturoid: Create invoice
        </button>
      )}

      <div style={dividerStyle} />

      {/* BaseLinker */}
      <button
        style={itemStyle}
        onClick={() => { onSendToBaseLinker(); onClose() }}
        onMouseEnter={handleHover}
        onMouseLeave={handleLeave}
      >
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke={iconColor} strokeWidth="1.5">
          <path d="M4 12l6-6 6 6M10 6v10" />
        </svg>
        {baselinkerOrderId ? "View in BaseLinker" : "Send to BaseLinker"}
      </button>
    </div>
  )
}
