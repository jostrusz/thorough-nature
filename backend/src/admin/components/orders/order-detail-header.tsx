import React, { useState, useRef, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { PaymentBadge, FulfillmentBadge } from "./order-badges"
import { OrderActionsDropdown } from "./order-actions-dropdown"
import { colors, radii, fontStack, btnOutline, shadows, getOrderDisplayNumber } from "./design-tokens"

interface OrderDetailHeaderProps {
  order: any
  onRefund: () => void
  onEdit: () => void
  onCancel: () => void
  onDuplicate: () => void
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
}

function getPaymentStatus(order: any): string {
  // If metadata says captured, trust it (auto-capture or manual)
  if (order.metadata?.payment_captured) return "paid"

  // Check metadata refund log first (custom refund route sets this)
  const refundLog = order.metadata?.payment_refund_log
  if (Array.isArray(refundLog) && refundLog.length > 0) {
    const totalRefunded = refundLog.reduce((sum: number, r: any) => sum + (Number(r.amount) || 0), 0)
    const totalPaid = Number(order.total) || 0
    if (totalRefunded >= totalPaid) return "refunded"
    return "partially_refunded"
  }

  // COD orders: stay "pending" until explicitly marked as captured
  const isCOD = (order.payment_collections || []).some((pc: any) =>
    (pc.payments || []).some((p: any) => (p.provider_id || "").includes("cod"))
  )
  if (isCOD) return "pending"

  if (order.payment_collections?.length) {
    // After order edits, old PCs may be canceled. Find the most relevant one.
    const pcs = order.payment_collections as any[]
    const activePC = pcs.find((pc: any) =>
      pc.status === "captured" || pc.status === "completed"
    ) || pcs.find((pc: any) =>
      pc.status !== "canceled"
    ) || pcs[pcs.length - 1]

    if (activePC.status === "captured" || activePC.status === "completed") return "paid"
    if (activePC.status === "refunded") return "refunded"
    if (activePC.status === "partially_refunded") return "partially_refunded"
    return activePC.status || "pending"
  }
  if (order.metadata?.copied_payment_status) return order.metadata.copied_payment_status
  return "pending"
}

export function OrderDetailHeader({
  order,
  onRefund,
  onEdit,
  onCancel,
  onDuplicate,
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
}: OrderDetailHeaderProps) {
  const navigate = useNavigate()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownContainerRef = useRef<HTMLDivElement>(null)

  // Click-outside handler at the container level (covers both button + dropdown)
  useEffect(() => {
    if (!dropdownOpen) return
    const handler = (e: MouseEvent) => {
      if (dropdownContainerRef.current && !dropdownContainerRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [dropdownOpen])

  const paymentStatus = getPaymentStatus(order)
  const isRefunded = paymentStatus === "refunded" || paymentStatus === "partially_refunded"
  const hasFulfillments = order.fulfillments && order.fulfillments.length > 0
  const createdAt = new Date(order.created_at)
  const fakturoidInvoiceId = order.metadata?.fakturoid_invoice_id
  const fakturoidInvoiceUrl = order.metadata?.fakturoid_invoice_url
  const fakturoidCreditNoteId = order.metadata?.fakturoid_credit_note_id
  const qbInvoiceId = order.metadata?.quickbooks_invoice_id
  const qbInvoiceUrl = order.metadata?.quickbooks_invoice_url
  const qbCreditMemoId = order.metadata?.quickbooks_credit_memo_id
  const dextrumMystockId = order.metadata?.dextrum_mystock_id

  // Set the order ID for the status page link in dropdown
  if (typeof window !== "undefined") {
    ;(window as any).__orderIdForStatusPage = order.id
  }

  const actionBtnStyle: React.CSSProperties = {
    ...btnOutline,
    border: `1px solid rgba(0,0,0,0.10)`,
    color: colors.textSec,
    background: "linear-gradient(135deg, #FFFFFF 0%, #FAFBFF 100%)",
    whiteSpace: "nowrap" as const,
    boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
    transition: "all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)",
    fontWeight: 600,
  }

  return (
    <div style={{ marginBottom: "24px" }}>
      {/* Breadcrumb */}
      <button
        onClick={() => navigate("/custom-orders")}
        className="od-btn"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "4px",
          padding: "4px 8px",
          border: "none",
          background: "none",
          cursor: "pointer",
          fontSize: "13px",
          fontFamily: fontStack,
          color: colors.textSec,
          marginBottom: "16px",
          borderRadius: radii.xs,
          transition: "all 0.15s ease",
        }}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M12 4l-6 6 6 6" />
        </svg>
        Orders
      </button>

      {/* Title row with actions */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: "8px",
        }}
      >
        {/* Left: Order number + badges */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <h1
            style={{
              fontSize: "22px",
              fontWeight: 600,
              color: colors.text,
              fontFamily: fontStack,
              margin: 0,
            }}
          >
            <span style={{ color: colors.accent }}>{getOrderDisplayNumber(order)}</span>
          </h1>
          <span className="od-badge"><PaymentBadge status={paymentStatus} /></span>
          <span className="od-badge"><FulfillmentBadge fulfilled={hasFulfillments} /></span>
        </div>

        {/* Right: Action buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {!isRefunded && (
            <button
              onClick={onRefund}
              className="od-btn"
              style={actionBtnStyle}
            >
              Refund
            </button>
          )}
          <button
            onClick={onEdit}
            className="od-btn"
            style={actionBtnStyle}
          >
            Edit
          </button>

          {/* More actions dropdown */}
          <div ref={dropdownContainerRef} style={{ position: "relative" }}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="od-btn"
              style={{
                ...actionBtnStyle,
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              More actions
              <svg
                width="12"
                height="12"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                style={{
                  transition: "transform 0.2s ease",
                  transform: dropdownOpen ? "rotate(180deg)" : "rotate(0)",
                }}
              >
                <path d="M5 8l5 5 5-5" />
              </svg>
            </button>
            <OrderActionsDropdown
              open={dropdownOpen}
              onClose={() => setDropdownOpen(false)}
              onDuplicate={onDuplicate}
              onCancel={onCancel}
              onArchive={onArchive}
              onSendToDextrum={onSendToDextrum}
              onFakturoidCreate={onFakturoidCreate}
              onFakturoidOpen={onFakturoidOpen}
              onFakturoidDelete={onFakturoidDelete}
              onFakturoidCreditNote={onFakturoidCreditNote}
              onQBCreate={onQBCreate}
              onQBOpen={onQBOpen}
              onQBDelete={onQBDelete}
              onQBCreditMemo={onQBCreditMemo}
              fakturoidInvoiceId={fakturoidInvoiceId}
              fakturoidInvoiceUrl={fakturoidInvoiceUrl}
              fakturoidCreditNoteId={fakturoidCreditNoteId}
              qbInvoiceId={qbInvoiceId}
              qbInvoiceUrl={qbInvoiceUrl}
              qbCreditMemoId={qbCreditMemoId}
              dextrumMystockId={dextrumMystockId}
            />
          </div>
        </div>
      </div>

      {/* Date subtitle */}
      <p
        style={{
          fontSize: "14px",
          fontFamily: fontStack,
          color: colors.textSec,
          margin: 0,
        }}
      >
        {createdAt.toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })}{" "}
        at{" "}
        {createdAt.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        })}
        {order.metadata?.source && (
          <span style={{ color: colors.textMuted }}> from {order.metadata.source}</span>
        )}
      </p>
    </div>
  )
}
