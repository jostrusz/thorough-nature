import React from "react"

const TAG_COLORS: Record<string, { bg: string; text: string }> = {
  // NL products
  "Laat los wat je kapotmaakt": { bg: "#FFF3E0", text: "#E65100" },
  "De Hondenbijbel": { bg: "#FFF3E0", text: "#E65100" },
  // DE products
  "Lass los was dich kaputt macht": { bg: "#FFF8E1", text: "#F57F17" },
  // CZ products
  "Ps\u00ed superzivot": { bg: "#E3F2FD", text: "#1565C0" },
  "Ko\u010di\u010d\u00ed bible": { bg: "#E3F2FD", text: "#1565C0" },
  // PL products
  "Odpu\u015b\u0107 to co ci\u0119 niszczy": { bg: "#FCE4EC", text: "#C62828" },
  // SE products
  "Sl\u00e4pp taget om det som f\u00f6rst\u00f6r dig": { bg: "#E0F7FA", text: "#00695C" },
  // HU products
  "Engedd el, ami t\u00f6nkretesz": { bg: "#F3E5F5", text: "#7B1FA2" },
}

// Map country codes to default tag colors
const COUNTRY_TAG_COLORS: Record<string, { bg: string; text: string }> = {
  NL: { bg: "#FFF3E0", text: "#E65100" },
  BE: { bg: "#FFF3E0", text: "#E65100" },
  DE: { bg: "#FFF8E1", text: "#F57F17" },
  AT: { bg: "#FFF8E1", text: "#F57F17" },
  CZ: { bg: "#E3F2FD", text: "#1565C0" },
  SK: { bg: "#E3F2FD", text: "#1565C0" },
  PL: { bg: "#FCE4EC", text: "#C62828" },
  SE: { bg: "#E0F7FA", text: "#00695C" },
  HU: { bg: "#F3E5F5", text: "#7B1FA2" },
  LU: { bg: "#FFF8E1", text: "#F57F17" },
}

interface OrderTagProps {
  tag?: string
  countryCode?: string
}

export function OrderTag({ tag, countryCode }: OrderTagProps) {
  if (!tag) {
    return <span style={{ color: "#8C9196", fontSize: "12px" }}>&mdash;</span>
  }

  const colors =
    TAG_COLORS[tag] ||
    (countryCode ? COUNTRY_TAG_COLORS[countryCode.toUpperCase()] : null) ||
    { bg: "#F3F3F3", text: "#6D7175" }

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        padding: "3px 10px",
        borderRadius: "6px",
        fontSize: "11px",
        fontWeight: 600,
        whiteSpace: "nowrap",
        background: colors.bg,
        color: colors.text,
        maxWidth: "180px",
        overflow: "hidden",
        textOverflow: "ellipsis",
      }}
      title={tag}
    >
      {tag}
    </span>
  )
}
