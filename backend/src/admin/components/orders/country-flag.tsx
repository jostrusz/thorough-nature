import React from "react"

/**
 * Convert any ISO 3166-1 alpha-2 country code to its flag emoji.
 * Works by mapping each letter to a Unicode Regional Indicator Symbol.
 * E.g. "NL" → 🇳🇱, "CZ" → 🇨🇿, "FR" → 🇫🇷
 */
function countryCodeToFlag(code: string): string {
  const upper = code.toUpperCase()
  if (upper.length !== 2) return ""
  const offset = 0x1f1e6 - 65 // 'A' = 65, Regional Indicator A = 0x1F1E6
  return String.fromCodePoint(
    upper.charCodeAt(0) + offset,
    upper.charCodeAt(1) + offset
  )
}

export function CountryFlag({ code }: { code?: string }) {
  if (!code) return <span style={{ color: "#8C9196", fontSize: "12px" }}>&mdash;</span>
  const upper = code.toUpperCase()
  const flag = countryCodeToFlag(upper)
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        fontSize: "13px",
        fontWeight: 500,
      }}
    >
      <span style={{ fontSize: "16px" }}>{flag}</span>
      {upper}
    </span>
  )
}
