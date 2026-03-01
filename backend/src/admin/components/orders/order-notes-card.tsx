import React, { useState } from "react"
import { colors, shadows, radii, cardStyle, fontStack, btnOutline, btnPrimary } from "./design-tokens"

interface OrderNotesCardProps {
  order: any
  onUpdateNote: (note: string) => void
  isLoading?: boolean
}

export function OrderNotesCard({ order, onUpdateNote, isLoading }: OrderNotesCardProps) {
  const [editing, setEditing] = useState(false)
  const currentNote = order?.metadata?.admin_note || ""
  const [noteValue, setNoteValue] = useState(currentNote)

  const handleSave = () => {
    onUpdateNote(noteValue)
    setEditing(false)
  }

  const handleCancel = () => {
    setNoteValue(currentNote)
    setEditing(false)
  }

  return (
    <div
      className="od-card"
      style={{
        ...cardStyle,
        padding: "16px 20px",
        transition: "box-shadow 0.25s ease, transform 0.25s ease",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "12px",
        }}
      >
        <span style={{ fontSize: "14px", fontWeight: 600, color: colors.text, fontFamily: fontStack }}>
          Notes
        </span>
        {!editing && (
          <button
            onClick={() => {
              setNoteValue(currentNote)
              setEditing(true)
            }}
            className="od-edit-btn"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "4px",
              color: colors.textSec,
              display: "flex",
              alignItems: "center",
              borderRadius: "4px",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              ;(e.currentTarget as HTMLButtonElement).style.color = colors.textMuted
            }}
            onMouseLeave={(e) => {
              ;(e.currentTarget as HTMLButtonElement).style.color = colors.textSec
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
              <path d="M13.586 3.586a2 2 0 112.828 2.828l-10 10L3 17.5l1.086-3.414 10-10z" />
            </svg>
          </button>
        )}
      </div>

      {editing ? (
        <div className="od-section-enter">
          <textarea
            value={noteValue}
            onChange={(e) => setNoteValue(e.target.value)}
            placeholder="Add a note..."
            rows={3}
            className="od-input"
            style={{
              width: "100%",
              padding: "8px 12px",
              border: `1px solid ${colors.border}`,
              borderRadius: radii.xs,
              fontSize: "13px",
              outline: "none",
              resize: "vertical",
              boxSizing: "border-box",
              fontFamily: fontStack,
              transition: "border-color 0.2s, box-shadow 0.2s",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = colors.accent
              e.currentTarget.style.boxShadow = "0 0 0 3px rgba(108,92,231,0.12)"
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = colors.border
              e.currentTarget.style.boxShadow = "none"
            }}
            autoFocus
          />
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "6px",
              marginTop: "8px",
            }}
          >
            <button
              onClick={handleCancel}
              className="od-btn"
              style={{
                padding: "5px 12px",
                borderRadius: radii.xs,
                fontSize: "12px",
                fontWeight: 500,
                cursor: "pointer",
                border: `1px solid ${colors.border}`,
                background: colors.bgCard,
                color: colors.text,
                fontFamily: fontStack,
                transition: "all 0.15s ease",
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isLoading}
              className="od-btn-primary"
              style={{
                padding: "5px 12px",
                borderRadius: radii.xs,
                fontSize: "12px",
                fontWeight: 500,
                cursor: isLoading ? "default" : "pointer",
                border: `1px solid ${colors.accent}`,
                background: colors.accent,
                color: "#FFFFFF",
                fontFamily: fontStack,
                opacity: isLoading ? 0.6 : 1,
                transition: "all 0.15s ease",
              }}
            >
              {isLoading ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      ) : (
        <p
          style={{
            fontSize: "13px",
            color: currentNote ? colors.text : colors.textMuted,
            lineHeight: 1.5,
            margin: 0,
            whiteSpace: "pre-wrap",
            fontFamily: fontStack,
          }}
        >
          {currentNote || "No notes from customer"}
        </p>
      )}
    </div>
  )
}
