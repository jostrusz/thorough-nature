import React, { useState, useEffect } from "react"
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
  /** Shipping country code (lowercase, e.g. "nl", "cz", "pl") */
  shippingCountry?: string
  /** Shipping postal/zip code (e.g. "7731 RD") */
  shippingZip?: string
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

const errorStyle: React.CSSProperties = {
  fontSize: "11px",
  color: colors.red,
  marginTop: "2px",
  display: "block",
}

const CARRIERS = [
  { value: "", label: "Select carrier..." },
  { value: "gls", label: "GLS" },
  { value: "packeta", label: "Packeta (Zásilkovna)" },
  { value: "postnord", label: "PostNord" },
  { value: "inpost", label: "inPost" },
]

// Country → default carrier mapping
const COUNTRY_CARRIER_MAP: Record<string, string> = {
  nl: "gls",
  be: "gls",
  de: "gls",
  lu: "gls",
  at: "gls",
  cz: "packeta",
  sk: "packeta",
  pl: "packeta",
  hu: "packeta",
  se: "postnord",
}

// Packeta language codes per country
const PACKETA_LANG: Record<string, string> = {
  cz: "cs",
  sk: "sk",
  pl: "pl",
  hu: "hu",
}

/**
 * Build tracking URL from carrier, tracking number, country code, and postal code.
 * Exported so it can be reused by backend logic.
 */
export function buildTrackingUrl(
  carrier: string,
  trackingNumber: string,
  countryCode?: string,
  postalCode?: string,
): string {
  if (!trackingNumber) return ""
  const cc = (countryCode || "").toLowerCase()

  switch (carrier) {
    case "gls": {
      const zip = (postalCode || "").replace(/\s+/g, "+")
      return `https://gls-group.eu/CZ/en/parcel-tracking?match=${trackingNumber}${zip ? `&postalCode=${zip}` : ""}`
    }
    case "packeta": {
      const lang = PACKETA_LANG[cc] || "en"
      return `https://tracking.packeta.com/${lang}/${trackingNumber}`
    }
    case "postnord":
      return `https://tracking.postnord.com/tracking.html?id=${trackingNumber}`
    case "inpost":
      return `https://inpost.pl/sledzenie-przesylek?number=${trackingNumber}`
    default:
      return ""
  }
}

export function FulfillmentModal({
  open,
  onClose,
  onConfirm,
  isLoading,
  orderDisplayId,
  shippingCountry,
  shippingZip,
}: FulfillmentModalProps) {
  const [carrier, setCarrier] = useState("")
  const [trackingNumber, setTrackingNumber] = useState("")
  const [trackingUrl, setTrackingUrl] = useState("")
  const [errors, setErrors] = useState<{ carrier?: string; trackingNumber?: string }>({})

  const cc = (shippingCountry || "").toLowerCase()

  // Auto-select carrier based on shipping country when modal opens
  useEffect(() => {
    if (open && cc) {
      const autoCarrier = COUNTRY_CARRIER_MAP[cc] || ""
      if (autoCarrier) {
        setCarrier(autoCarrier)
      }
    }
  }, [open, cc])

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setTrackingNumber("")
      setTrackingUrl("")
      setErrors({})
    }
  }, [open])

  if (!open) return null

  const regenerateUrl = (c: string, tn: string) => {
    if (tn && c) {
      setTrackingUrl(buildTrackingUrl(c, tn, cc, shippingZip))
    }
  }

  const handleCarrierChange = (value: string) => {
    setCarrier(value)
    setErrors((e) => ({ ...e, carrier: undefined }))
    regenerateUrl(value, trackingNumber)
  }

  const handleTrackingNumberChange = (value: string) => {
    setTrackingNumber(value)
    setErrors((e) => ({ ...e, trackingNumber: undefined }))
    regenerateUrl(carrier, value)
  }

  const handleSubmit = () => {
    const newErrors: { carrier?: string; trackingNumber?: string } = {}
    if (!trackingNumber.trim()) {
      newErrors.trackingNumber = "Tracking number is required"
    }
    if (!carrier) {
      newErrors.carrier = "Please select a carrier"
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    // Final URL: use manually entered if user changed it, otherwise auto-generated
    const finalUrl = trackingUrl.trim() || buildTrackingUrl(carrier, trackingNumber.trim(), cc, shippingZip)

    onConfirm({
      trackingNumber: trackingNumber.trim(),
      trackingUrl: finalUrl,
      carrier,
    })
  }

  const detectedCarrierLabel = cc ? COUNTRY_CARRIER_MAP[cc] : null

  return (
    <div className="od-modal-overlay" style={overlayStyle} onClick={onClose}>
      <div style={cardStyle} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ fontSize: "16px", fontWeight: 600, color: colors.text, margin: "0 0 4px" }}>
          Fulfill order #{orderDisplayId}
        </h3>
        <p style={{ fontSize: "13px", color: colors.textMuted, lineHeight: 1.5, margin: "0 0 20px" }}>
          Enter shipping details. Carrier and tracking link are auto-detected from the shipping country
          {cc ? ` (${cc.toUpperCase()})` : ""}.
        </p>

        {/* Carrier */}
        <div style={{ marginBottom: "14px" }}>
          <label style={labelStyle}>Carrier</label>
          <select
            style={{
              ...selectStyle,
              borderColor: errors.carrier ? colors.red : colors.border,
            }}
            value={carrier}
            onChange={(e) => handleCarrierChange(e.target.value)}
          >
            {CARRIERS.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          {errors.carrier && <span style={errorStyle}>{errors.carrier}</span>}
          {detectedCarrierLabel && !errors.carrier && (
            <span style={{ fontSize: "11px", color: colors.textMuted, marginTop: "2px", display: "block" }}>
              Auto-selected based on shipping country ({cc.toUpperCase()})
            </span>
          )}
        </div>

        {/* Tracking Number */}
        <div style={{ marginBottom: "14px" }}>
          <label style={labelStyle}>Tracking Number</label>
          <input
            type="text"
            style={{
              ...inputStyle,
              borderColor: errors.trackingNumber ? colors.red : colors.border,
            }}
            placeholder="e.g. 90453222863"
            value={trackingNumber}
            onChange={(e) => handleTrackingNumberChange(e.target.value)}
          />
          {errors.trackingNumber && <span style={errorStyle}>{errors.trackingNumber}</span>}
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
            Auto-generated from carrier + tracking number. You can override it.
          </span>
        </div>

        {/* Buttons */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
          <button
            onClick={onClose}
            style={{ ...btnBase, background: "#FFFFFF", color: colors.text }}
          >
            Cancel
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
            {isLoading ? "Processing..." : "Fulfill order"}
          </button>
        </div>
      </div>
    </div>
  )
}
