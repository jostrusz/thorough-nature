import React, { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { defineRouteConfig } from "@medusajs/admin-sdk"
import { sdk } from "../../../lib/sdk"
import {
  MarketingShell,
  EmptyState,
  ProjectBadge,
  useSelectedBrand,
  brandQs,
  fmt,
  tokens,
} from "../../../components/marketing/shared"

// ═══════════════════════════════════════════
// Types
// ═══════════════════════════════════════════
type DailyRow = { date: string; brand_slug: string; brand_name: string; count: number }
type ProjectRow = {
  brand_slug: string
  brand_name: string
  today: number
  d7: number
  d30: number
  prev_d30: number
  trend_pct: number
}
type Totals = {
  today: number
  d7: number
  d30: number
  prev_d30: number
  trend_pct: number
  unsubs_d30: number
  net_d30: number
}
type ApiResponse = {
  days: number
  daily: DailyRow[]
  unsubs_daily: DailyRow[]
  by_project: ProjectRow[]
  totals: Totals
}

// Distinct color palette for stacked bars (per project)
const PALETTE = [
  "#15803D", // green
  "#175CD3", // blue
  "#B54708", // amber
  "#6941C6", // purple
  "#0E7490", // cyan
  "#BE185D", // pink
  "#4D7C0F", // olive
  "#9A3412", // orange
]

const DAYS_OPTIONS = [7, 30, 90]

// ═══════════════════════════════════════════
// Trend arrow
// ═══════════════════════════════════════════
function TrendArrow({ pct }: { pct: number }) {
  if (pct === 0) {
    return (
      <span style={{ fontSize: "13px", color: tokens.fgMuted, fontWeight: 500 }}>—</span>
    )
  }
  const up = pct > 0
  const color = up ? tokens.successFg : tokens.dangerFg
  const bg = up ? tokens.successSoft : tokens.dangerSoft
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "3px",
        fontSize: "12px",
        fontWeight: 600,
        color,
        background: bg,
        padding: "2px 7px",
        borderRadius: tokens.rSm,
        fontVariantNumeric: "tabular-nums",
        whiteSpace: "nowrap",
      }}
    >
      <span aria-hidden>{up ? "↑" : "↓"}</span>
      {Math.abs(pct).toFixed(1)}%
    </span>
  )
}

// ═══════════════════════════════════════════
// KPI card
// ═══════════════════════════════════════════
function StatCard({
  label,
  value,
  trend,
  sub,
  accent,
  icon,
}: {
  label: string
  value: string
  trend?: number
  sub?: string
  accent?: string
  icon?: string
}) {
  return (
    <div className="mkt-card" style={{ padding: "20px", position: "relative" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ fontSize: "13px", fontWeight: 500, color: tokens.fgSecondary }}>{label}</div>
        {icon && (
          <div style={{ fontSize: "18px", opacity: 0.6, lineHeight: 1 }} aria-hidden>
            {icon}
          </div>
        )}
      </div>
      <div
        style={{
          fontSize: "32px",
          fontWeight: 600,
          color: accent || tokens.fg,
          marginTop: "10px",
          letterSpacing: "-0.02em",
          lineHeight: 1,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "8px", minHeight: "18px" }}>
        {typeof trend === "number" && <TrendArrow pct={trend} />}
        {sub && <span style={{ fontSize: "12px", color: tokens.fgMuted }}>{sub}</span>}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════
// Segmented control (period switcher)
// ═══════════════════════════════════════════
function Segmented({
  value,
  options,
  onChange,
}: {
  value: number
  options: number[]
  onChange: (v: number) => void
}) {
  return (
    <div
      style={{
        display: "inline-flex",
        gap: "2px",
        padding: "3px",
        background: tokens.borderSubtle,
        borderRadius: tokens.rMd,
      }}
    >
      {options.map((o) => {
        const active = o === value
        return (
          <button
            key={o}
            type="button"
            onClick={() => onChange(o)}
            style={{
              border: "none",
              cursor: "pointer",
              padding: "6px 14px",
              borderRadius: tokens.rSm,
              fontSize: "13px",
              fontWeight: active ? 600 : 500,
              fontFamily: "inherit",
              color: active ? tokens.fg : tokens.fgSecondary,
              background: active ? tokens.surface : "transparent",
              boxShadow: active ? tokens.shadowSm : "none",
              transition: "all 120ms ease-out",
            }}
          >
            {o}d
          </button>
        )
      })}
    </div>
  )
}

// ═══════════════════════════════════════════
// Build a continuous day axis (fills empty days with 0)
// ═══════════════════════════════════════════
function buildAxis(days: number): string[] {
  const out: string[] = []
  const now = new Date()
  // UTC "today" midnight
  const base = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(base - i * 86400000)
    const y = d.getUTCFullYear()
    const m = String(d.getUTCMonth() + 1).padStart(2, "0")
    const day = String(d.getUTCDate()).padStart(2, "0")
    out.push(`${y}-${m}-${day}`)
  }
  return out
}

// ═══════════════════════════════════════════
// Stacked bar chart (inline SVG, no library)
// ═══════════════════════════════════════════
function SignupsChart({
  axis,
  daily,
  unsubsDaily,
  brands,
}: {
  axis: string[]
  daily: DailyRow[]
  unsubsDaily: DailyRow[]
  brands: { slug: string; name: string; color: string }[]
}) {
  const [hover, setHover] = useState<number | null>(null)

  // Build per-day stacks: { date -> { slug -> count } } and per-day total
  const byDate = useMemo(() => {
    const m: Record<string, Record<string, number>> = {}
    for (const d of axis) m[d] = {}
    for (const r of daily) {
      if (!m[r.date]) m[r.date] = {}
      m[r.date][r.brand_slug] = (m[r.date][r.brand_slug] || 0) + r.count
    }
    return m
  }, [axis, daily])

  const unsubByDate = useMemo(() => {
    const m: Record<string, number> = {}
    for (const d of axis) m[d] = 0
    for (const r of unsubsDaily) m[r.date] = (m[r.date] || 0) + r.count
    return m
  }, [axis, unsubsDaily])

  const totals = axis.map((d) =>
    Object.values(byDate[d] || {}).reduce((a: number, b) => a + (Number(b) || 0), 0)
  )
  const maxVal = Math.max(1, ...totals)

  // Nice Y ticks
  const yTickCount = 4
  const yTicks = Array.from({ length: yTickCount + 1 }, (_, i) =>
    Math.round((maxVal / yTickCount) * i)
  )

  // SVG geometry
  const W = 920
  const H = 280
  const padL = 40
  const padR = 12
  const padT = 12
  const padB = 34
  const plotW = W - padL - padR
  const plotH = H - padT - padB
  const n = axis.length
  const slot = plotW / n
  const barW = Math.max(2, Math.min(28, slot * 0.62))
  const barGap = (slot - barW) / 2

  const yFor = (v: number) => padT + plotH - (v / maxVal) * plotH

  // X labels — show a responsive subset so they don't collide
  const maxLabels = 12
  const labelEvery = Math.max(1, Math.ceil(n / maxLabels))

  function shortDate(iso: string) {
    // "06-24" from "2026-06-24"
    const parts = iso.split("-")
    return `${parts[2]}/${parts[1]}`
  }

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        style={{ display: "block", fontFamily: tokens.fontFamily }}
        preserveAspectRatio="xMidYMid meet"
        onMouseLeave={() => setHover(null)}
      >
        {/* Horizontal grid + Y labels */}
        {yTicks.map((t, i) => {
          const y = yFor(t)
          return (
            <g key={`y-${i}`}>
              <line x1={padL} y1={y} x2={W - padR} y2={y} stroke={tokens.borderSubtle} strokeWidth={1} />
              <text
                x={padL - 8}
                y={y + 3}
                textAnchor="end"
                fontSize={10}
                fill={tokens.fgMuted}
              >
                {t}
              </text>
            </g>
          )
        })}

        {/* Bars (stacked per brand) */}
        {axis.map((date, i) => {
          const x = padL + i * slot + barGap
          const stack = byDate[date] || {}
          let yCursor = padT + plotH
          const segs: React.ReactNode[] = []
          brands.forEach((b) => {
            const v = stack[b.slug] || 0
            if (v <= 0) return
            const h = (v / maxVal) * plotH
            yCursor -= h
            segs.push(
              <rect
                key={`${date}-${b.slug}`}
                x={x}
                y={yCursor}
                width={barW}
                height={Math.max(0, h)}
                rx={2}
                fill={b.color}
                opacity={hover === null || hover === i ? 1 : 0.4}
              />
            )
          })
          const total = totals[i]
          return (
            <g key={date} onMouseEnter={() => setHover(i)}>
              {/* invisible hover hitbox spanning the slot */}
              <rect
                x={padL + i * slot}
                y={padT}
                width={slot}
                height={plotH}
                fill="transparent"
              />
              {segs}
              {total === 0 && (
                <rect x={x} y={padT + plotH - 2} width={barW} height={2} rx={1} fill={tokens.borderStrong} opacity={0.5} />
              )}
            </g>
          )
        })}

        {/* Unsubscribe overlay line (net view) */}
        {(() => {
          const pts = axis
            .map((d, i) => {
              const v = unsubByDate[d] || 0
              const x = padL + i * slot + slot / 2
              const y = yFor(v)
              return `${x},${y}`
            })
            .join(" ")
          const anyUnsub = axis.some((d) => (unsubByDate[d] || 0) > 0)
          if (!anyUnsub) return null
          return (
            <polyline
              points={pts}
              fill="none"
              stroke={tokens.dangerFg}
              strokeWidth={1.5}
              strokeDasharray="3 3"
              opacity={0.7}
            />
          )
        })()}

        {/* X axis labels */}
        {axis.map((date, i) => {
          if (i % labelEvery !== 0 && i !== n - 1) return null
          const x = padL + i * slot + slot / 2
          return (
            <text
              key={`x-${date}`}
              x={x}
              y={H - padB + 16}
              textAnchor="middle"
              fontSize={10}
              fill={tokens.fgMuted}
            >
              {shortDate(date)}
            </text>
          )
        })}
      </svg>

      {/* Tooltip */}
      {hover !== null && (
        <div
          style={{
            position: "absolute",
            top: "8px",
            left: `${(((hover + 0.5) / n) * (920 - 40 - 12) + 40) / 920 * 100}%`,
            transform: "translateX(-50%)",
            background: tokens.fg,
            color: "#fff",
            borderRadius: tokens.rSm,
            padding: "8px 10px",
            fontSize: "12px",
            pointerEvents: "none",
            whiteSpace: "nowrap",
            boxShadow: tokens.shadowMd,
            zIndex: 5,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: "4px" }}>{axis[hover]}</div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span>Aanmeldingen:</span>
            <strong>{fmt(totals[hover])}</strong>
          </div>
          {(unsubByDate[axis[hover]] || 0) > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#FCA5A5" }}>
              <span>Afmeldingen:</span>
              <strong>{fmt(unsubByDate[axis[hover]])}</strong>
            </div>
          )}
        </div>
      )}

      {/* Legend (only when >1 brand stacked, plus unsub) */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "14px",
          marginTop: "12px",
          paddingTop: "12px",
          borderTop: `1px solid ${tokens.borderSubtle}`,
        }}
      >
        {brands.map((b) => (
          <div key={b.slug} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ width: "10px", height: "10px", borderRadius: "3px", background: b.color }} />
            <span style={{ fontSize: "12px", color: tokens.fgSecondary }}>{b.name}</span>
          </div>
        ))}
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span
            style={{
              width: "14px",
              height: 0,
              borderTop: `2px dashed ${tokens.dangerFg}`,
              display: "inline-block",
            }}
          />
          <span style={{ fontSize: "12px", color: tokens.fgSecondary }}>Afmeldingen</span>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════
// Loading skeleton
// ═══════════════════════════════════════════
function Skeleton() {
  return (
    <div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "16px",
          marginBottom: "24px",
        }}
      >
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="mkt-card" style={{ padding: "20px", height: "104px" }}>
            <div style={{ width: "60%", height: "12px", background: tokens.borderSubtle, borderRadius: "4px" }} />
            <div style={{ width: "40%", height: "28px", background: tokens.borderSubtle, borderRadius: "6px", marginTop: "14px" }} />
          </div>
        ))}
      </div>
      <div className="mkt-card" style={{ padding: "24px", height: "320px" }}>
        <div style={{ width: "30%", height: "14px", background: tokens.borderSubtle, borderRadius: "4px" }} />
        <div style={{ width: "100%", height: "240px", background: tokens.bg, borderRadius: "8px", marginTop: "16px" }} />
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════
// Section heading
// ═══════════════════════════════════════════
function SectionHeading({ title, sub }: { title: string; sub?: string }) {
  return (
    <div style={{ marginBottom: "12px" }}>
      <h2 style={{ fontSize: "16px", fontWeight: 600, color: tokens.fg, margin: 0, letterSpacing: "-0.005em" }}>
        {title}
      </h2>
      {sub && <div style={{ fontSize: "13px", color: tokens.fgSecondary, marginTop: "3px" }}>{sub}</div>}
    </div>
  )
}

// ═══════════════════════════════════════════
// Page
// ═══════════════════════════════════════════
function AcquisitionPage() {
  const { brandId } = useSelectedBrand()
  const [days, setDays] = useState<number>(30)

  const qs = brandQs(brandId)
  const url = `/admin/marketing/popup-signups${qs}${qs ? "&" : "?"}days=${days}`

  const { data, isLoading } = useQuery({
    queryKey: ["mkt-popup-signups", brandId, days],
    queryFn: () => sdk.client.fetch<ApiResponse>(url, { method: "GET" }),
  })

  const resp = (data as ApiResponse) || undefined
  const axis = useMemo(() => buildAxis(days), [days])

  // Brand color map for stacking — derived from the daily rows present
  const brandsForChart = useMemo(() => {
    const seen: Record<string, string> = {}
    const ordered: { slug: string; name: string; color: string }[] = []
    const rows = resp?.daily || []
    // Order brands by total volume desc so biggest sits at bottom of stack
    const totalsBySlug: Record<string, { name: string; total: number }> = {}
    for (const r of rows) {
      if (!totalsBySlug[r.brand_slug]) totalsBySlug[r.brand_slug] = { name: r.brand_name, total: 0 }
      totalsBySlug[r.brand_slug].total += r.count
    }
    Object.entries(totalsBySlug)
      .sort((a, b) => b[1].total - a[1].total)
      .forEach(([slug, v], i) => {
        seen[slug] = PALETTE[i % PALETTE.length]
        ordered.push({ slug, name: v.name, color: PALETTE[i % PALETTE.length] })
      })
    return ordered
  }, [resp?.daily])

  const totals = resp?.totals
  const hasData =
    !!resp && ((resp.daily && resp.daily.length > 0) || (totals && totals.d30 > 0))

  return (
    <MarketingShell
      title="Aanmeldingen"
      subtitle="Dagelijkse nieuwe inschrijvingen via de popups op de indexpagina's"
      breadcrumbs={[{ label: "Marketing", to: "/marketing" }, { label: "Aanmeldingen" }]}
      right={<Segmented value={days} options={DAYS_OPTIONS} onChange={setDays} />}
    >
      {isLoading ? (
        <Skeleton />
      ) : !hasData ? (
        <div className="mkt-card">
          <EmptyState
            icon="📥"
            title="Nog geen aanmeldingen"
            description="Er zijn in deze periode geen popup-inschrijvingen geregistreerd voor de geselecteerde selectie."
          />
        </div>
      ) : (
        <>
          {/* KPI cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "16px",
              marginBottom: "28px",
            }}
          >
            <StatCard label="Vandaag" value={fmt(totals?.today ?? 0)} sub="nieuwe aanmeldingen" icon="📈" />
            <StatCard label="Laatste 7 dagen" value={fmt(totals?.d7 ?? 0)} icon="📅" />
            <StatCard
              label="Laatste 30 dagen"
              value={fmt(totals?.d30 ?? 0)}
              trend={totals?.trend_pct}
              sub="vs. vorige 30d"
              icon="🚀"
            />
            <StatCard
              label="Netto (30d)"
              value={fmt(totals?.net_d30 ?? 0)}
              accent={(totals?.net_d30 ?? 0) >= 0 ? tokens.successFg : tokens.dangerFg}
              sub={`−${fmt(totals?.unsubs_d30 ?? 0)} afmeldingen`}
              icon="⚖️"
            />
          </div>

          {/* Chart */}
          <div className="mkt-card" style={{ padding: "24px", marginBottom: "28px" }}>
            <SectionHeading
              title="Aanmeldingen per dag"
              sub={`Laatste ${days} dagen${brandId ? "" : " · gestapeld per project"}`}
            />
            <SignupsChart
              axis={axis}
              daily={resp!.daily}
              unsubsDaily={resp!.unsubs_daily}
              brands={brandsForChart}
            />
          </div>

          {/* Per-project table */}
          <div className="mkt-card" style={{ overflow: "hidden", padding: 0 }}>
            <div style={{ padding: "20px 24px", borderBottom: `1px solid ${tokens.borderSubtle}` }}>
              <SectionHeading title="Per project" sub="Gesorteerd op aanmeldingen (30d)" />
            </div>
            {(resp?.by_project || []).length === 0 ? (
              <EmptyState icon="📋" title="Geen projecten" description="Geen aanmeldingen om per project te tonen." />
            ) : (
              <table className="mkt-table">
                <thead>
                  <tr>
                    <th>Project</th>
                    <th style={{ textAlign: "right" }}>Vandaag</th>
                    <th style={{ textAlign: "right" }}>7d</th>
                    <th style={{ textAlign: "right" }}>30d</th>
                    <th style={{ textAlign: "right" }}>Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {(resp?.by_project || []).map((p) => (
                    <tr key={p.brand_slug} className="mkt-row">
                      <td>
                        <ProjectBadge slug={p.brand_slug} fallbackLabel={p.brand_name} />
                      </td>
                      <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt(p.today)}</td>
                      <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt(p.d7)}</td>
                      <td style={{ textAlign: "right", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                        {fmt(p.d30)}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <TrendArrow pct={p.trend_pct} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </MarketingShell>
  )
}

export const config = defineRouteConfig({
  label: "Aanmeldingen",
})

export default AcquisitionPage
