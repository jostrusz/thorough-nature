import React, { useState } from "react"
import { formatCurrency } from "../../lib/format-currency"

interface RefundModalProps {
  open: boolean
  onClose: () => void
  onConfirm: (amount: number, note: string) => void
  isLoading: boolean
  order: any
  maxRefundable: number
  currency: string
}

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: "rgba(0,0,0,0.5)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
}

const cardStyle: React.CSSProperties = {
  background: "#FFFFFF",
  borderRadius: "12px",
  padding: "24px",
  maxWidth: "480px",
  width: "100%",
  boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  border: "1px solid #E1E3E5",
  borderRadius: "6px",
  fontSize: "13px",
  outline: "none",
  boxSizing: "border-box",
}

const labelStyle: React.CSSProperties = {
  fontSize: "12px",
  fontWeight: 600,
  color: "#6D7175",
  marginBottom: "6px",
  display: "block",
}

const btnBase: React.CSSProperties = {
  padding: "8px 16px",
  borderRadius: "6px",
  fontSize: "13px",
  fontWeight: 500,
  cursor: "pointer",
  border: "1px solid #E1E3E5",
  transition: "all 0.15s ease",
}

export function RefundModal({
  open,
  onClose,
  onConfirm,
  isLoading,
  order,
  maxRefundable,
  currency,
}: RefundModalProps) {
  const [amount, setAmount] = useState(String(maxRefundable))
  const [note, setNote] = useState("")

  if (!open) return null

  const numAmount = parseFloat(amount) || 0
  const isValid = numAmount > 0 && numAmount <= maxRefundable

  // Get payment provider info
  const payments = order?.payment_collections?.flatMap((pc: any) => pc.payments || []) || []
  const provider = payments[0]?.provider_id?.replace("pp_", "").replace(/_/g, " ") || "Payment provider"

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={cardStyle} onClick={(e) => e.stopPropagation()}>
        <h3
          style={{
            fontSize: "16px",
            fontWeight: 600,
            color: "#1A1A1A",
            margin: "0 0 16px",
          }}
        >
          Refund order {order?.metadata?.custom_order_number || `#${order?.display_id}`}
        </h3>

        <div
          style={{
            background: "#F6F6F7",
            borderRadius: "8px",
            padding: "12px",
            marginBottom: "16px",
            fontSize: "13px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "#6D7175" }}>Paid via {provider}</span>
            <span style={{ fontWeight: 600, color: "#1A1A1A" }}>
              {formatCurrency(Number(order?.total) || 0, currency)}
            </span>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: "4px",
            }}
          >
            <span style={{ color: "#6D7175" }}>Maximum refundable</span>
            <span style={{ fontWeight: 600, color: "#1A1A1A" }}>
              {formatCurrency(maxRefundable, currency)}
            </span>
          </div>
        </div>

        <div style={{ marginBottom: "16px" }}>
          <label style={labelStyle}>Refund amount</label>
          <div style={{ position: "relative" }}>
            <span
              style={{
                position: "absolute",
                left: "12px",
                top: "50%",
                transform: "translateY(-50%)",
                color: "#6D7175",
                fontSize: "13px",
              }}
            >
              {currency.toUpperCase() === "EUR" ? "\u20AC" : currency}
            </span>
            <input
              type="number"
              step="0.01"
              min="0"
              max={maxRefundable}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              style={{ ...inputStyle, paddingLeft: "28px" }}
            />
          </div>
          {!isValid && numAmount > 0 && (
            <p style={{ fontSize: "12px", color: "#D72C0D", marginTop: "4px" }}>
              Amount exceeds maximum refundable
            </p>
          )}
        </div>

        <div style={{ marginBottom: "20px" }}>
          <label style={labelStyle}>Reason (optional)</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add a reason for this refund..."
            rows={3}
            style={{ ...inputStyle, resize: "vertical" }}
          />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
          <button
            onClick={onClose}
            style={{ ...btnBase, background: "#FFFFFF", color: "#1A1A1A" }}
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(numAmount, note)}
            disabled={isLoading || !isValid}
            style={{
              ...btnBase,
              background: "#D72C0D",
              color: "#FFFFFF",
              borderColor: "#D72C0D",
              opacity: isLoading || !isValid ? 0.6 : 1,
            }}
          >
            {isLoading ? "Refunding..." : `Refund ${formatCurrency(numAmount, currency)}`}
          </button>
        </div>
      </div>
    </div>
  )
}
