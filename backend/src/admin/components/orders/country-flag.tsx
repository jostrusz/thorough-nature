import React from "react"

const FLAGS: Record<string, string> = {
  NL: "\u{1F1F3}\u{1F1F1}",
  BE: "\u{1F1E7}\u{1F1EA}",
  DE: "\u{1F1E9}\u{1F1EA}",
  AT: "\u{1F1E6}\u{1F1F9}",
  PL: "\u{1F1F5}\u{1F1F1}",
  CZ: "\u{1F1E8}\u{1F1FF}",
  SK: "\u{1F1F8}\u{1F1F0}",
  SE: "\u{1F1F8}\u{1F1EA}",
  HU: "\u{1F1ED}\u{1F1FA}",
  LU: "\u{1F1F1}\u{1F1FA}",
  DK: "\u{1F1E9}\u{1F1F0}",
}

export function CountryFlag({ code }: { code?: string }) {
  if (!code) return <span style={{ color: "#8C9196", fontSize: "12px" }}>&mdash;</span>
  const upper = code.toUpperCase()
  const flag = FLAGS[upper] || ""
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
