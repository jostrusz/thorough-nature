import React from "react"
import { colors, radii, shadows, btnOutline } from "./design-tokens"

interface BulkActionsBarProps {
  selectedCount: number
  onMarkFulfilled: () => void
  onAddTags: () => void
  onSendToDextrum: () => void
  onExport: () => void
}

const actionBtnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  padding: "6px 14px",
  borderRadius: "6px",
  fontSize: "12px",
  fontWeight: 500,
  cursor: "pointer",
  border: "1px solid rgba(0,0,0,0.07)",
  background: "#FFFFFF",
  color: "#6B7185",
  transition: "all 0.15s",
  whiteSpace: "nowrap",
}

export function BulkActionsBar({
  selectedCount,
  onMarkFulfilled,
  onAddTags,
  onSendToDextrum,
  onExport,
}: BulkActionsBarProps) {
  if (selectedCount === 0) return null

  return (
    <div
      style={{
        background: "rgba(108,92,231,0.06)",
        border: "1px solid rgba(108,92,231,0.15)",
        borderRadius: "10px",
        padding: "10px 16px",
        display: "flex",
        alignItems: "center",
        gap: "8px",
        marginBottom: "0",
        animation: "slideDown 0.2s ease",
      }}
    >
      <span
        style={{
          fontSize: "13px",
          fontWeight: 600,
          color: "#6C5CE7",
          marginRight: "8px",
        }}
      >
        {selectedCount} selected
      </span>
      <button style={actionBtnStyle} onClick={onMarkFulfilled}>
        Mark Fulfilled
      </button>
      <button style={actionBtnStyle} onClick={onAddTags}>
        Add Tags
      </button>
      <button style={actionBtnStyle} onClick={onSendToDextrum}>
        Send to Dextrum WMS
      </button>
      <button style={actionBtnStyle} onClick={onExport}>
        Export Selected
      </button>
    </div>
  )
}
