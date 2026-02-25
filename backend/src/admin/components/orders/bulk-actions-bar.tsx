import React from "react"

interface BulkActionsBarProps {
  selectedCount: number
  onMarkFulfilled: () => void
  onAddTags: () => void
  onSendToDextrum: () => void
  onExport: () => void
}

const btnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  padding: "5px 10px",
  borderRadius: "6px",
  fontSize: "12px",
  fontWeight: 500,
  cursor: "pointer",
  border: "1px solid #E1E3E5",
  background: "#FFFFFF",
  color: "#1A1A1A",
  transition: "all 0.15s ease",
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
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "10px 16px",
        background: "#F2F7FE",
        borderBottom: "1px solid #C9DEFF",
        animation: "slideDown 0.2s ease",
      }}
    >
      <span
        style={{
          fontSize: "13px",
          fontWeight: 600,
          color: "#1A5DB4",
          marginRight: "8px",
        }}
      >
        {selectedCount} selected
      </span>
      <button style={btnStyle} onClick={onMarkFulfilled}>
        Mark Fulfilled
      </button>
      <button style={btnStyle} onClick={onAddTags}>
        Add Tags
      </button>
      <button style={btnStyle} onClick={onSendToDextrum}>
        Send to Dextrum WMS
      </button>
      <button style={btnStyle} onClick={onExport}>
        Export Selected
      </button>
    </div>
  )
}
