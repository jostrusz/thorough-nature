import React from "react"

interface CancelOrderModalProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  isLoading: boolean
  orderDisplayId: number | string
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
  maxWidth: "440px",
  width: "100%",
  boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
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

export function CancelOrderModal({
  open,
  onClose,
  onConfirm,
  isLoading,
  orderDisplayId,
}: CancelOrderModalProps) {
  if (!open) return null

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={cardStyle} onClick={(e) => e.stopPropagation()}>
        <h3
          style={{
            fontSize: "16px",
            fontWeight: 600,
            color: "#1A1A1A",
            margin: "0 0 12px",
          }}
        >
          Cancel order #{orderDisplayId}?
        </h3>
        <p
          style={{
            fontSize: "13px",
            color: "#6D7175",
            lineHeight: 1.5,
            margin: "0 0 20px",
          }}
        >
          This action cannot be undone. The order will be marked as canceled.
          If there are captured payments or unfulfilled fulfillments, cancellation may fail.
        </p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
          <button
            onClick={onClose}
            style={{ ...btnBase, background: "#FFFFFF", color: "#1A1A1A" }}
          >
            Keep order
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            style={{
              ...btnBase,
              background: "#D72C0D",
              color: "#FFFFFF",
              borderColor: "#D72C0D",
              opacity: isLoading ? 0.6 : 1,
            }}
          >
            {isLoading ? "Canceling..." : "Cancel order"}
          </button>
        </div>
      </div>
    </div>
  )
}
