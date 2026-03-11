import React, { useState } from "react"
import { colors, fontStack } from "./design-tokens"

interface FulfillmentModalProps {
  open: boolean
  onClose: () => void
  onConfirm: (data: {
    trackingNumber: string
    trackingUrl: string
    carrier: string
  }) => void
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
  maxWidth: "480px",
  width: "100%",
  boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
  fontFamily: fontStack,
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  borderRadius: "6px",
  border: `1px solid ${colors.border}`,
  fontSize: "13px",
  fontFamily: fontStack,
  color: colors.text,
  outline: "none",
  transition: "border-color 0.15s",
  boxSizing: "border-box",
}

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  appearance: "none" as const,
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%239CA3B8' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 10px center",
  paddingRight: "30px",
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "12px",
  fontWeight: 600,
  color: colors.textSec,
  marginBottom: "4px",
}

const btnBase: React.CSSProperties = {
  padding: "8px 16px",
  borderRadius: "6px",
  fontSize: "13px",
  fontWeight: 500,
  cursor: "pointer",
  border: "1px solid #E1E3E5",
  transition: "all 0.15s ease",
  fontFamily: fontStack,
}

const CARRIERS = [
  { value: "", label: "Vyberte kurýra..." },
  { value: "gls", label: "GLS" },
  { value: "packeta", label: "Packeta (Zásilkovna)" },
  { value: "postnord", label: "PostNord" },
  { value: "inpost", label: "inPost" },
]

const TRACKING_URL_TEMPLATES: Record<string, (n: string) => string> = {
  gls: (n) => `https://gls-group.eu/GROUP/en/parcel-tracking?match=${n}`,
  packeta: (n) => `https://tracking.packeta.com/cs/?id=${n}`,
  postnord: (n) => `https://tracking.postnord.com/tracking.html?id=${n}`,
  inpost: (n) => `https://inpost.pl/sledzenie-przesylek?number=${n}`,
}

export function FulfillmentModal({
  open,
  onClose,
  onConfirm,
  isLoading,
  orderDisplayId,
}: FulfillmentModalProps) {
  const [carrier, setCarrier] = useState("")
  const [trackingNumber, setTrackingNumber] = useState("")
  const [trackingUrl, setTrackingUrl] = useState("")

  if (!open) return null

  const handleCarrierChange = (value: string) => {
    setCarrier(value)
    // Auto-generate tracking URL if we have a tracking number
    if (trackingNumber && TRACKING_URL_TEMPLATES[value]) {
      setTrackingUrl(TRACKING_URL_TEMPLATES[value](trackingNumber))
    }
  }

  const handleTrackingNumberChange = (value: string) => {
    setTrackingNumber(value)
    // Auto-generate tracking URL if we have a carrier
    if (carrier && TRACKING_URL_TEMPLATES[carrier]) {
      setTrackingUrl(TRACKING_URL_TEMPLATES[carrier](value))
    }
  }

  const handleSubmit = () => {
    onConfirm({
      trackingNumber: trackingNumber.trim(),
      trackingUrl: trackingUrl.trim(),
      carrier,
    })
  }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={cardStyle} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ fontSize: "16px", fontWeight: 600, color: colors.text, margin: "0 0 4px" }}>
          Fulfill order #{orderDisplayId}
        </h3>
        <p style={{ fontSize: "13px", color: colors.textMuted, lineHeight: 1.5, margin: "0 0 20px" }}>
          Zadejte informace o doručení. Tracking link se vygeneruje automaticky podle kurýra.
        </p>

        {/* Carrier */}
        <div style={{ marginBottom: "14px" }}>
          <label style={labelStyle}>Kurýr</label>
          <select
            style={selectStyle}
            value={carrier}
            onChange={(e) => handleCarrierChange(e.target.value)}
          >
            {CARRIERS.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>

        {/* Tracking Number */}
        <div style={{ marginBottom: "14px" }}>
          <label style={labelStyle}>Tracking Number</label>
          <input
            type="text"
            style={inputStyle}
            placeholder="Např. 123456789"
            value={trackingNumber}
            onChange={(e) => handleTrackingNumberChange(e.target.value)}
          />
        </div>

        {/* Tracking URL */}
        <div style={{ marginBottom: "20px" }}>
          <label style={labelStyle}>Tracking Link</label>
          <input
            type="text"
            style={inputStyle}
            placeholder="https://..."
            value={trackingUrl}
            onChange={(e) => setTrackingUrl(e.target.value)}
          />
          <span style={{ fontSize: "11px", color: colors.textMuted, marginTop: "2px", display: "block" }}>
            Automaticky generováno podle kurýra. Můžete přepsat.
          </span>
        </div>

        {/* Buttons */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
          <button
            onClick={onClose}
            style={{ ...btnBase, background: "#FFFFFF", color: colors.text }}
          >
            Zrušit
          </button>
          <button
            onClick={handleSubmit}
            disabled={isLoading}
            style={{
              ...btnBase,
              background: colors.accent,
              color: "#FFFFFF",
              borderColor: colors.accent,
              opacity: isLoading ? 0.6 : 1,
            }}
          >
            {isLoading ? "Zpracovávám..." : "Fulfill objednávku"}
          </button>
        </div>
      </div>
    </div>
  )
}
