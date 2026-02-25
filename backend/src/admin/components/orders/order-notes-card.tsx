import React, { useState } from "react"

interface OrderNotesCardProps {
  order: any
  onUpdateNote: (note: string) => void
  isLoading?: boolean
}

const sectionStyle: React.CSSProperties = {
  background: "#FFFFFF",
  border: "1px solid #E1E3E5",
  borderRadius: "10px",
  padding: "16px 20px",
  marginBottom: "16px",
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
    <div style={sectionStyle}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "12px",
        }}
      >
        <span style={{ fontSize: "14px", fontWeight: 600, color: "#1A1A1A" }}>
          Notes
        </span>
        {!editing && (
          <button
            onClick={() => {
              setNoteValue(currentNote)
              setEditing(true)
            }}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "4px",
              color: "#6D7175",
              display: "flex",
              alignItems: "center",
              transition: "color 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#1A1A1A")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#6D7175")}
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
        <div>
          <textarea
            value={noteValue}
            onChange={(e) => setNoteValue(e.target.value)}
            placeholder="Add a note..."
            rows={3}
            style={{
              width: "100%",
              padding: "8px 12px",
              border: "1px solid #E1E3E5",
              borderRadius: "6px",
              fontSize: "13px",
              outline: "none",
              resize: "vertical",
              boxSizing: "border-box",
              fontFamily: "inherit",
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
              style={{
                padding: "5px 12px",
                borderRadius: "6px",
                fontSize: "12px",
                fontWeight: 500,
                cursor: "pointer",
                border: "1px solid #E1E3E5",
                background: "#FFFFFF",
                color: "#1A1A1A",
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isLoading}
              style={{
                padding: "5px 12px",
                borderRadius: "6px",
                fontSize: "12px",
                fontWeight: 500,
                cursor: "pointer",
                border: "1px solid #008060",
                background: "#008060",
                color: "#FFFFFF",
                opacity: isLoading ? 0.6 : 1,
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
            color: currentNote ? "#1A1A1A" : "#8C9196",
            lineHeight: 1.5,
            margin: 0,
            whiteSpace: "pre-wrap",
          }}
        >
          {currentNote || "No notes from customer"}
        </p>
      )}
    </div>
  )
}
