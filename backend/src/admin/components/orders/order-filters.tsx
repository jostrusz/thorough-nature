import React, { useEffect, useRef, useState } from "react"
import {
  colors,
  radii,
  fontStack,
  COUNTRY_OPTIONS,
  PROJECT_OPTIONS,
  PAYMENT_OPTIONS,
} from "./design-tokens"

// ═══════════════════════════════════════════
// Generic option shape for the dropdown
// ═══════════════════════════════════════════
interface Opt {
  value: string
  label: string
  prefix?: string // emoji flag / swatch
}

export interface OrderFiltersValue {
  countries: string[]
  projects: string[]
  payments: string[]
}

interface OrderFiltersProps {
  value: OrderFiltersValue
  onChange: (next: OrderFiltersValue) => void
}

// Catalog → dropdown options
const countryOpts: Opt[] = COUNTRY_OPTIONS.map((c) => ({
  value: c.code,
  label: c.label,
  prefix: c.flag,
}))
const projectOpts: Opt[] = PROJECT_OPTIONS.map((p) => ({
  value: p.id,
  label: p.label,
  prefix: p.flag,
}))
const paymentOpts: Opt[] = PAYMENT_OPTIONS.map((p) => ({
  value: p.value,
  label: p.label,
}))

// Lookups for chip labels
const countryLabel = (code: string) => {
  const o = COUNTRY_OPTIONS.find((c) => c.code === code)
  return o ? `${o.flag} ${o.code}` : code
}
const projectLabel = (id: string) => {
  const o = PROJECT_OPTIONS.find((p) => p.id === id)
  return o ? `${o.flag} ${o.label}` : id
}
const paymentLabel = (v: string) => {
  const o = PAYMENT_OPTIONS.find((p) => p.value === v)
  return o ? o.label : v
}

// ═══════════════════════════════════════════
// MULTI-SELECT DROPDOWN
// ═══════════════════════════════════════════
function MultiSelect({
  label,
  icon,
  options,
  selected,
  onChange,
}: {
  label: string
  icon: React.ReactNode
  options: Opt[]
  selected: string[]
  onChange: (next: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDoc)
    return () => document.removeEventListener("mousedown", onDoc)
  }, [open])

  const active = selected.length > 0

  function toggle(v: string) {
    if (selected.includes(v)) onChange(selected.filter((x) => x !== v))
    else onChange([...selected, v])
  }

  return (
    <div ref={ref} className="dash-filter-item" style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          padding: "7px 12px",
          borderRadius: radii.xs,
          fontSize: "13px",
          fontWeight: 500,
          cursor: "pointer",
          fontFamily: fontStack,
          border: `1px solid ${active ? colors.accent : colors.border}`,
          background: active ? colors.accentBg : colors.bgCard,
          color: active ? colors.accent : colors.textSec,
          transition: "all 0.15s",
          whiteSpace: "nowrap",
        }}
      >
        {icon}
        {label}
        {active && (
          <span
            style={{
              fontSize: "11px",
              fontWeight: 700,
              minWidth: "16px",
              height: "16px",
              padding: "0 5px",
              borderRadius: "8px",
              background: colors.accent,
              color: "#fff",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {selected.length}
          </span>
        )}
        <svg
          width="11"
          height="11"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}
        >
          <path d="M5 8l5 5 5-5" />
        </svg>
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            zIndex: 50,
            minWidth: "220px",
            maxHeight: "300px",
            overflowY: "auto",
            background: colors.bgCard,
            border: `1px solid ${colors.border}`,
            borderRadius: radii.sm,
            boxShadow: "0 8px 28px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)",
            padding: "6px",
          }}
        >
          {options.map((opt) => {
            const checked = selected.includes(opt.value)
            return (
              <div
                key={opt.value}
                onClick={() => toggle(opt.value)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "9px",
                  padding: "7px 9px",
                  borderRadius: radii.xs,
                  cursor: "pointer",
                  fontSize: "13px",
                  color: colors.text,
                  background: checked ? colors.accentBg : "transparent",
                  transition: "background 0.12s",
                }}
                onMouseEnter={(e) => {
                  if (!checked) (e.currentTarget as HTMLDivElement).style.background = colors.bgHover
                }}
                onMouseLeave={(e) => {
                  ;(e.currentTarget as HTMLDivElement).style.background = checked
                    ? colors.accentBg
                    : "transparent"
                }}
              >
                <span
                  style={{
                    width: "16px",
                    height: "16px",
                    borderRadius: "4px",
                    border: `2px solid ${checked ? colors.accent : "#C9CCCF"}`,
                    background: checked ? colors.accent : "#fff",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {checked && (
                    <svg width="9" height="9" viewBox="0 0 16 16" fill="#fff">
                      <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z" />
                    </svg>
                  )}
                </span>
                {opt.prefix && <span style={{ fontSize: "15px", lineHeight: 1 }}>{opt.prefix}</span>}
                <span style={{ flex: 1 }}>{opt.label}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════
// CHIP
// ═══════════════════════════════════════════
function Chip({ text, onRemove }: { text: string; onRemove: () => void }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "5px",
        padding: "3px 6px 3px 10px",
        borderRadius: "20px",
        fontSize: "12px",
        fontWeight: 600,
        background: colors.accentBg,
        color: colors.accent,
        whiteSpace: "nowrap",
      }}
    >
      {text}
      <button
        type="button"
        onClick={onRemove}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: "16px",
          height: "16px",
          borderRadius: "50%",
          border: "none",
          background: "rgba(108,92,231,0.18)",
          color: colors.accent,
          cursor: "pointer",
          padding: 0,
          fontFamily: fontStack,
        }}
        aria-label={`Remove ${text}`}
      >
        <svg width="9" height="9" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M4 4l8 8M12 4l-8 8" />
        </svg>
      </button>
    </span>
  )
}

// ═══════════════════════════════════════════
// FILTER BAR
// ═══════════════════════════════════════════
export function OrderFilters({ value, onChange }: OrderFiltersProps) {
  const { countries, projects, payments } = value
  const anyActive = countries.length + projects.length + payments.length > 0

  const flagIcon = (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M5 17V4h9l-2 3 2 3H5" />
    </svg>
  )
  const projectIcon = (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M4 5h12v10H4zM4 8h12" />
    </svg>
  )
  const payIcon = (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="3" y="5" width="14" height="10" rx="2" />
      <path d="M3 9h14" />
    </svg>
  )

  return (
    <div
      className="dash-filter-bar"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        flexWrap: "wrap",
        padding: "10px 20px",
        borderBottom: `1px solid ${colors.border}`,
      }}
    >
      <MultiSelect
        label="Country"
        icon={flagIcon}
        options={countryOpts}
        selected={countries}
        onChange={(next) => onChange({ ...value, countries: next })}
      />
      <MultiSelect
        label="Project"
        icon={projectIcon}
        options={projectOpts}
        selected={projects}
        onChange={(next) => onChange({ ...value, projects: next })}
      />
      <MultiSelect
        label="Payment"
        icon={payIcon}
        options={paymentOpts}
        selected={payments}
        onChange={(next) => onChange({ ...value, payments: next })}
      />

      {anyActive && (
        <>
          <div style={{ width: "1px", height: "20px", background: colors.border, margin: "0 2px" }} />
          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", flex: 1 }}>
            {countries.map((c) => (
              <Chip
                key={`c-${c}`}
                text={countryLabel(c)}
                onRemove={() => onChange({ ...value, countries: countries.filter((x) => x !== c) })}
              />
            ))}
            {projects.map((p) => (
              <Chip
                key={`p-${p}`}
                text={projectLabel(p)}
                onRemove={() => onChange({ ...value, projects: projects.filter((x) => x !== p) })}
              />
            ))}
            {payments.map((p) => (
              <Chip
                key={`pay-${p}`}
                text={paymentLabel(p)}
                onRemove={() => onChange({ ...value, payments: payments.filter((x) => x !== p) })}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => onChange({ countries: [], projects: [], payments: [] })}
            style={{
              fontSize: "12px",
              fontWeight: 600,
              color: colors.textSec,
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: "4px 8px",
              fontFamily: fontStack,
              whiteSpace: "nowrap",
            }}
          >
            Clear all
          </button>
        </>
      )}
    </div>
  )
}
