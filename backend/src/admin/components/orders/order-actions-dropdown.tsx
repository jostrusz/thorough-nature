import React, { useEffect, useRef } from "react"

interface OrderActionsDropdownProps {
  open: boolean
  onClose: () => void
  onDuplicate: () => void
  onCancel: () => void
  onArchive: () => void
  onSendToDextrum: () => void
  onFakturoidCreate: () => void
  onFakturoidOpen: () => void
  onFakturoidDelete: () => void
  onFakturoidCreditNote: () => void
  onQBCreate: () => void
  onQBOpen: () => void
  onQBDelete: () => void
  onQBCreditMemo: () => void
  fakturoidInvoiceId?: string
  fakturoidInvoiceUrl?: string
  fakturoidCreditNoteId?: string
  qbInvoiceId?: string
  qbInvoiceUrl?: string
  qbCreditMemoId?: string
  dextrumMystockId?: string
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
  transition: "background 0.12s ease, padding-left 0.15s ease",
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
  onSendToDextrum,
  onFakturoidCreate,
  onFakturoidOpen,
  onFakturoidDelete,
  onFakturoidCreditNote,
  onQBCreate,
  onQBOpen,
  onQBDelete,
  onQBCreditMemo,
  fakturoidInvoiceId,
  fakturoidInvoiceUrl,
  fakturoidCreditNoteId,
  qbInvoiceId,
  qbInvoiceUrl,
  qbCreditMemoId,
  dextrumMystockId,
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

  return (
    <div
      ref={ref}
      className="od-section-enter"
      style={{
        position: "absolute",
        top: "100%",
        right: 0,
        marginTop: "4px",
        background: "#FFFFFF",
        border: "1px solid #E1E3E5",
        borderRadius: "10px",
        boxShadow: "0 8px 30px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)",
        minWidth: "240px",
        zIndex: 100,
        overflow: "hidden",
      }}
    >
      {/* Duplicate */}
      <button
        className="od-dropdown-item"
        style={itemStyle}
        onClick={() => { onDuplicate(); onClose() }}
      >
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke={iconColor} strokeWidth="1.5">
          <rect x="6" y="6" width="10" height="10" rx="2" />
          <path d="M14 6V4a2 2 0 00-2-2H4a2 2 0 00-2 2v8a2 2 0 002 2h2" />
        </svg>
        Duplicate
      </button>

      {/* Cancel order */}
      <button
        className="od-dropdown-item"
        style={{ ...itemStyle, color: "#D72C0D" }}
        onClick={() => { onCancel(); onClose() }}
      >
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="#D72C0D" strokeWidth="1.5">
          <line x1="5" y1="5" x2="15" y2="15" />
          <line x1="15" y1="5" x2="5" y2="15" />
        </svg>
        Cancel order
      </button>

      {/* Archive */}
      <button
        className="od-dropdown-item"
        style={itemStyle}
        onClick={() => { onArchive(); onClose() }}
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
        className="od-dropdown-item"
        style={itemStyle}
        onClick={() => {
          window.open(`/app/orders/${(window as any).__orderIdForStatusPage || ""}`, "_blank")
          onClose()
        }}
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
        <>
          <button
            className="od-dropdown-item"
            style={itemStyle}
            onClick={() => { onFakturoidOpen(); onClose() }}
          >
            <span style={{ fontSize: "14px", width: "16px", textAlign: "center", color: "#008060", fontWeight: 700 }}>fa</span>
            Fakturoid: Open invoice
          </button>
          {!fakturoidCreditNoteId && (
            <button
              className="od-dropdown-item"
              style={itemStyle}
              onClick={() => { onFakturoidCreditNote(); onClose() }}
            >
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="#B98900" strokeWidth="1.5">
                <path d="M4 4h12v12H4z" />
                <path d="M7 10h6M10 7v6" />
              </svg>
              <span style={{ color: "#B98900" }}>Fakturoid: Create credit note</span>
            </button>
          )}
          <button
            className="od-dropdown-item"
            style={{ ...itemStyle, color: "#D72C0D" }}
            onClick={() => { onFakturoidDelete(); onClose() }}
          >
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="#D72C0D" strokeWidth="1.5">
              <path d="M5 6h10M8 6V4h4v2M6 6v10a1 1 0 001 1h6a1 1 0 001-1V6" />
              <line x1="9" y1="9" x2="9" y2="14" />
              <line x1="11" y1="9" x2="11" y2="14" />
            </svg>
            Fakturoid: Delete invoice
          </button>
        </>
      ) : (
        <button
          className="od-dropdown-item"
          style={itemStyle}
          onClick={() => { onFakturoidCreate(); onClose() }}
        >
          <span style={{ fontSize: "14px", width: "16px", textAlign: "center", color: "#6D7175", fontWeight: 700 }}>fa</span>
          Fakturoid: Create invoice
        </button>
      )}

      <div style={dividerStyle} />

      {/* QuickBooks */}
      {qbInvoiceId ? (
        <>
          <button
            className="od-dropdown-item"
            style={itemStyle}
            onClick={() => { onQBOpen(); onClose() }}
          >
            <span style={{ fontSize: "12px", width: "16px", textAlign: "center", color: "#2CA01C", fontWeight: 700 }}>qb</span>
            QuickBooks: Open invoice
          </button>
          {!qbCreditMemoId && (
            <button
              className="od-dropdown-item"
              style={itemStyle}
              onClick={() => { onQBCreditMemo(); onClose() }}
            >
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="#B98900" strokeWidth="1.5">
                <path d="M4 4h12v12H4z" />
                <path d="M7 10h6M10 7v6" />
              </svg>
              <span style={{ color: "#B98900" }}>QuickBooks: Create credit memo</span>
            </button>
          )}
          <button
            className="od-dropdown-item"
            style={{ ...itemStyle, color: "#D72C0D" }}
            onClick={() => { onQBDelete(); onClose() }}
          >
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="#D72C0D" strokeWidth="1.5">
              <path d="M5 6h10M8 6V4h4v2M6 6v10a1 1 0 001 1h6a1 1 0 001-1V6" />
              <line x1="9" y1="9" x2="9" y2="14" />
              <line x1="11" y1="9" x2="11" y2="14" />
            </svg>
            QuickBooks: Delete invoice
          </button>
        </>
      ) : (
        <button
          className="od-dropdown-item"
          style={itemStyle}
          onClick={() => { onQBCreate(); onClose() }}
        >
          <span style={{ fontSize: "12px", width: "16px", textAlign: "center", color: "#6D7175", fontWeight: 700 }}>qb</span>
          QuickBooks: Create invoice
        </button>
      )}

      <div style={dividerStyle} />

      {/* Dextrum WMS */}
      {!dextrumMystockId && (
        <button
          className="od-dropdown-item"
          style={itemStyle}
          onClick={() => { onSendToDextrum(); onClose() }}
        >
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke={iconColor} strokeWidth="1.5">
            <rect x="2" y="4" width="16" height="12" rx="2" />
            <path d="M2 8h16M7 4v4M13 4v4" />
          </svg>
          Send to Dextrum WMS
        </button>
      )}
    </div>
  )
}
