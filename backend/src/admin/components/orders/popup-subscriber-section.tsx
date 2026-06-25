// @ts-nocheck
import React, { useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { sdk } from "../../lib/sdk"
import { tokens, ProjectBadge, fmt } from "../marketing/shared"

// ═══════════════════════════════════════════
// Types (mirror /admin/marketing/popup-signups response)
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

// Distinct line colors per popup/project — 1st violet, 2nd teal, then palette
const PALETTE = [
  "#6366F1", // violet (1st project)
  "#14B8A6", // teal   (2nd project)
  "#F59E0B", // amber
  "#EC4899", // pink
  "#0EA5E9", // sky
  "#84CC16", // lime
  "#A855F7", // purple
  "#EF4444", // red
]

const DAYS_OPTIONS = [7, 30, 90]
const STORAGE_KEY = "hq_popup_subs_open"

// Domain per project slug — shown in the leaderboard subtitle
const PROJECT_DOMAIN: Record<string, string> = {
  loslatenboek: "loslatenboek.nl",
  "het-leven": "pakjeleventerug.nl",
  dehondenbijbel: "dehondenbijbel.nl",
  "lass-los": "jetztloslassen.de",
  "odpusc-ksiazka": "odpusc-ksiazka.pl",
  "slapp-taget": "slapptagetboken.se",
  "psi-superzivot": "psi-superzivot.cz",
  "odpust-knizka": "knihyprodusi.cz",
}

// ═══════════════════════════════════════════
// SSR-safe localStorage read for the collapsed/expanded state
// ═══════════════════════════════════════════
function readOpenState(): boolean {
  if (typeof window === "undefined") return false
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1"
  } catch {
    return false
  }
}

// ═══════════════════════════════════════════
// Continuous day axis (UTC) — fills empty days so lines never break
// ═══════════════════════════════════════════
function buildAxis(days: number): string[] {
  const out: string[] = []
  const now = new Date()
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

function shortDate(iso: string): string {
  const p = iso.split("-")
  if (p.length < 3) return iso
  return `${p[2]}/${p[1]}`
}

// ═══════════════════════════════════════════
// Smooth path (Catmull-Rom → cubic bézier). Returns "" for <2 points.
// ═══════════════════════════════════════════
function smoothPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return ""
  if (points.length === 1) {
    // a tiny horizontal nub so a single point is still visible as a line
    const p = points[0]
    return `M ${p.x - 0.5} ${p.y} L ${p.x + 0.5} ${p.y}`
  }
  let d = `M ${points[0].x} ${points[0].y}`
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[i + 2] || p2
    const c1x = p1.x + (p2.x - p0.x) / 6
    const c1y = p1.y + (p2.y - p0.y) / 6
    const c2x = p2.x - (p3.x - p1.x) / 6
    const c2y = p2.y - (p3.y - p1.y) / 6
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`
  }
  return d
}

// ═══════════════════════════════════════════
// Trend pill ↑/↓ %
// ═══════════════════════════════════════════
function TrendPill({ pct }: { pct: number }) {
  if (!pct) {
    return <span style={{ fontSize: "12px", color: tokens.fgMuted, fontWeight: 500 }}>—</span>
  }
  const up = pct > 0
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "3px",
        fontSize: "12px",
        fontWeight: 600,
        color: up ? tokens.successFg : tokens.dangerFg,
        background: up ? tokens.successSoft : tokens.dangerSoft,
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
// Mini sparkline (inline SVG, area + gradient). values = last ~14 day counts.
// ═══════════════════════════════════════════
function Sparkline({
  values,
  color,
  width = 76,
  height = 28,
}: {
  values: number[]
  color: string
  width?: number
  height?: number
}) {
  const id = useMemo(() => `spark-${Math.random().toString(36).slice(2)}`, [])
  if (!values || values.length === 0) {
    return <svg width={width} height={height} aria-hidden />
  }
  const max = Math.max(1, ...values)
  const n = values.length
  const pad = 2
  const innerW = width - pad * 2
  const innerH = height - pad * 2
  // Single point → place it centred
  const xFor = (i: number) => (n <= 1 ? width / 2 : pad + (i / (n - 1)) * innerW)
  const yFor = (v: number) => pad + innerH - (v / max) * innerH
  const pts = values.map((v, i) => ({ x: xFor(i), y: yFor(v) }))
  const line = smoothPath(pts)
  const area =
    pts.length > 0
      ? `${line} L ${pts[pts.length - 1].x} ${height - pad} L ${pts[0].x} ${height - pad} Z`
      : ""
  const last = pts[pts.length - 1]
  return (
    <svg width={width} height={height} style={{ display: "block" }} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.28} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      {area && <path d={area} fill={`url(#${id})`} />}
      <path d={line} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      {last && <circle cx={last.x} cy={last.y} r={1.8} fill={color} />}
    </svg>
  )
}

// ═══════════════════════════════════════════
// Main multi-line chart — one smooth line per popup/project
// ═══════════════════════════════════════════
function MultiLineChart({
  axis,
  byDateSlug,
  brands,
}: {
  axis: string[]
  byDateSlug: Record<string, Record<string, number>>
  brands: { slug: string; name: string; color: string }[]
}) {
  const [hover, setHover] = useState<number | null>(null)

  const n = axis.length

  // Global max across all series (≥1 → never divide by zero)
  const maxVal = useMemo(() => {
    let mx = 0
    for (const d of axis) {
      const row = byDateSlug[d] || {}
      for (const b of brands) {
        const v = row[b.slug] || 0
        if (v > mx) mx = v
      }
    }
    return Math.max(1, mx)
  }, [axis, byDateSlug, brands])

  // SVG geometry
  const W = 920
  const H = 300
  const padL = 38
  const padR = 14
  const padT = 14
  const padB = 34
  const plotW = W - padL - padR
  const plotH = H - padT - padB

  const xFor = (i: number) => (n <= 1 ? padL + plotW / 2 : padL + (i / (n - 1)) * plotW)
  const yFor = (v: number) => padT + plotH - (v / maxVal) * plotH

  // Y ticks
  const yTickCount = 4
  const yTicks = Array.from({ length: yTickCount + 1 }, (_, i) =>
    Math.round((maxVal / yTickCount) * i)
  )

  // X labels (subset to avoid collisions)
  const maxLabels = 12
  const labelEvery = Math.max(1, Math.ceil(n / maxLabels))

  // Pre-compute per-brand point arrays + smooth paths
  const series = useMemo(() => {
    return brands.map((b) => {
      const pts = axis.map((d, i) => ({
        x: xFor(i),
        y: yFor(byDateSlug[d]?.[b.slug] || 0),
      }))
      const gid = `area-${b.slug}-${Math.random().toString(36).slice(2)}`
      return { ...b, pts, path: smoothPath(pts), gid }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brands, axis, byDateSlug, maxVal])

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        style={{ display: "block", fontFamily: tokens.fontFamily }}
        preserveAspectRatio="xMidYMid meet"
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          {series.map((s) => (
            <linearGradient key={s.gid} id={s.gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity={0.16} />
              <stop offset="100%" stopColor={s.color} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>

        {/* Horizontal grid + Y labels */}
        {yTicks.map((t, i) => {
          const y = yFor(t)
          return (
            <g key={`y-${i}`}>
              <line x1={padL} y1={y} x2={W - padR} y2={y} stroke={tokens.borderSubtle} strokeWidth={1} />
              <text x={padL - 8} y={y + 3} textAnchor="end" fontSize={10} fill={tokens.fgMuted}>
                {t}
              </text>
            </g>
          )
        })}

        {/* Area fills (under lines) */}
        {series.map((s) => {
          if (s.pts.length === 0) return null
          const first = s.pts[0]
          const lastP = s.pts[s.pts.length - 1]
          const areaD = `${s.path} L ${lastP.x} ${padT + plotH} L ${first.x} ${padT + plotH} Z`
          return <path key={`area-${s.slug}`} d={areaD} fill={`url(#${s.gid})`} />
        })}

        {/* Lines */}
        {series.map((s) => (
          <path
            key={`line-${s.slug}`}
            d={s.path}
            fill="none"
            stroke={s.color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={hover === null ? 1 : 0.9}
          />
        ))}

        {/* Last-point dots */}
        {series.map((s) => {
          const p = s.pts[s.pts.length - 1]
          if (!p) return null
          return <circle key={`dot-${s.slug}`} cx={p.x} cy={p.y} r={3} fill={s.color} />
        })}

        {/* Hover guide + per-series markers */}
        {hover !== null && (
          <g>
            <line
              x1={xFor(hover)}
              y1={padT}
              x2={xFor(hover)}
              y2={padT + plotH}
              stroke={tokens.borderStrong}
              strokeWidth={1}
              strokeDasharray="3 3"
            />
            {series.map((s) => {
              const p = s.pts[hover]
              if (!p) return null
              return <circle key={`hp-${s.slug}`} cx={p.x} cy={p.y} r={3} fill={s.color} stroke="#fff" strokeWidth={1} />
            })}
          </g>
        )}

        {/* Hover hitboxes */}
        {axis.map((d, i) => {
          const slot = n <= 1 ? plotW : plotW / (n - 1)
          const cx = xFor(i)
          return (
            <rect
              key={`hit-${d}`}
              x={cx - slot / 2}
              y={padT}
              width={slot}
              height={plotH}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
            />
          )
        })}

        {/* X axis labels */}
        {axis.map((date, i) => {
          if (i % labelEvery !== 0 && i !== n - 1) return null
          return (
            <text
              key={`x-${date}`}
              x={xFor(i)}
              y={H - padB + 18}
              textAnchor="middle"
              fontSize={10}
              fill={tokens.fgMuted}
            >
              {shortDate(date)}
            </text>
          )
        })}
      </svg>

      {/* Tooltip — date + per-project counts */}
      {hover !== null && (
        <div
          style={{
            position: "absolute",
            top: "8px",
            left: `${((xFor(hover)) / W) * 100}%`,
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
          <div style={{ fontWeight: 600, marginBottom: "5px" }}>{axis[hover]}</div>
          {series.map((s) => {
            const v = byDateSlug[axis[hover]]?.[s.slug] || 0
            return (
              <div
                key={`tt-${s.slug}`}
                style={{ display: "flex", alignItems: "center", gap: "6px", lineHeight: 1.6 }}
              >
                <span style={{ width: "8px", height: "8px", borderRadius: "2px", background: s.color, display: "inline-block" }} />
                <span style={{ opacity: 0.85 }}>{s.name}</span>
                <strong style={{ marginLeft: "auto", paddingLeft: "10px" }}>{fmt(v)}</strong>
              </div>
            )
          })}
        </div>
      )}

      {/* Legend */}
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
            <span style={{ width: "14px", height: "3px", borderRadius: "2px", background: b.color }} />
            <span style={{ fontSize: "12px", color: tokens.fgSecondary }}>{b.name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════
// Segmented control (7 / 30 / 90 days)
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
            onClick={(e) => {
              e.stopPropagation()
              onChange(o)
            }}
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
            {o} days
          </button>
        )
      })}
    </div>
  )
}

// ═══════════════════════════════════════════
// KPI bento card
// ═══════════════════════════════════════════
function KpiCard({
  label,
  value,
  trend,
  sub,
  accent,
  hero,
  spark,
  sparkColor,
}: {
  label: string
  value: string
  trend?: number
  sub?: string
  accent?: string
  hero?: boolean
  spark?: number[]
  sparkColor?: string
}) {
  return (
    <div
      style={{
        position: "relative",
        background: hero
          ? "linear-gradient(135deg, #EEF0FF 0%, #FFFFFF 60%)"
          : tokens.surface,
        border: `1px solid ${hero ? "#D9DCFB" : tokens.border}`,
        borderRadius: tokens.rXl,
        padding: "18px 18px 16px",
        boxShadow: tokens.shadowSm,
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
        <div style={{ fontSize: "12px", fontWeight: 500, color: tokens.fgSecondary }}>{label}</div>
        {spark && spark.length > 0 && (
          <div style={{ marginTop: "-2px", marginRight: "-4px" }}>
            <Sparkline values={spark} color={sparkColor || PALETTE[0]} />
          </div>
        )}
      </div>
      <div
        style={{
          fontSize: hero ? "34px" : "30px",
          fontWeight: 700,
          color: accent || tokens.fg,
          marginTop: "8px",
          letterSpacing: "-0.02em",
          lineHeight: 1,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "9px", minHeight: "18px" }}>
        {typeof trend === "number" && <TrendPill pct={trend} />}
        {sub && <span style={{ fontSize: "12px", color: tokens.fgMuted }}>{sub}</span>}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════
// Loading skeleton
// ═══════════════════════════════════════════
function Skeleton() {
  return (
    <div style={{ padding: "20px 0 4px" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "14px",
          marginBottom: "20px",
        }}
      >
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              border: `1px solid ${tokens.border}`,
              borderRadius: tokens.rXl,
              background: tokens.surface,
              padding: "18px",
              height: "104px",
            }}
          >
            <div style={{ width: "55%", height: "12px", background: tokens.borderSubtle, borderRadius: "4px" }} />
            <div style={{ width: "40%", height: "28px", background: tokens.borderSubtle, borderRadius: "6px", marginTop: "14px" }} />
          </div>
        ))}
      </div>
      <div
        style={{
          border: `1px solid ${tokens.border}`,
          borderRadius: tokens.rLg,
          background: tokens.surface,
          padding: "24px",
          height: "320px",
        }}
      >
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
      <h3 style={{ fontSize: "15px", fontWeight: 600, color: tokens.fg, margin: 0, letterSpacing: "-0.005em" }}>
        {title}
      </h3>
      {sub && <div style={{ fontSize: "13px", color: tokens.fgSecondary, marginTop: "3px" }}>{sub}</div>}
    </div>
  )
}

// ═══════════════════════════════════════════
// Project avatar — rounded square with initial + project color
// ═══════════════════════════════════════════
function ProjectAvatar({ name, color }: { name: string; color: string }) {
  const initial = (name || "?").trim().charAt(0).toUpperCase() || "?"
  return (
    <div
      style={{
        width: "32px",
        height: "32px",
        borderRadius: "9px",
        background: color,
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "14px",
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {initial}
    </div>
  )
}

// ═══════════════════════════════════════════
// MAIN — collapsible "Popup subscribers" section
// ═══════════════════════════════════════════
export function PopupSubscriberSection() {
  const [open, setOpen] = useState<boolean>(() => readOpenState())
  const [days, setDays] = useState<number>(30)

  // Persist collapsed/expanded state
  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      window.localStorage.setItem(STORAGE_KEY, open ? "1" : "0")
    } catch {
      /* ignore */
    }
  }, [open])

  // Data — refetches whenever `days` changes (it's part of the query key)
  const { data, isLoading } = useQuery({
    queryKey: ["hq-popup-subscribers", days],
    queryFn: () =>
      sdk.client.fetch<ApiResponse>(`/admin/marketing/popup-signups?days=${days}`, {
        method: "GET",
      }),
  })

  const resp = (data as ApiResponse) || undefined
  const totals = resp?.totals

  // ── Build the day axis + per-(date,slug) lookup for the chart ──
  const axis = useMemo(() => buildAxis(days), [days])
  const byDateSlug = useMemo(() => {
    const m: Record<string, Record<string, number>> = {}
    for (const d of axis) m[d] = {}
    for (const r of resp?.daily || []) {
      if (!m[r.date]) m[r.date] = {}
      m[r.date][r.brand_slug] = (m[r.date][r.brand_slug] || 0) + (Number(r.count) || 0)
    }
    return m
  }, [axis, resp?.daily])

  // ── Brand order + color: biggest 30d volume first → 1st gets violet ──
  const brandsForChart = useMemo(() => {
    const totalsBySlug: Record<string, { name: string; total: number }> = {}
    for (const r of resp?.daily || []) {
      if (!totalsBySlug[r.brand_slug]) totalsBySlug[r.brand_slug] = { name: r.brand_name, total: 0 }
      totalsBySlug[r.brand_slug].total += Number(r.count) || 0
    }
    return Object.entries(totalsBySlug)
      .sort((a, b) => b[1].total - a[1].total)
      .map(([slug, v], i) => ({ slug, name: v.name, color: PALETTE[i % PALETTE.length] }))
  }, [resp?.daily])

  // Stable color lookup by slug (used by leaderboard + sparklines)
  const colorBySlug = useMemo(() => {
    const m: Record<string, string> = {}
    brandsForChart.forEach((b) => {
      m[b.slug] = b.color
    })
    return m
  }, [brandsForChart])

  // ── Per-project leaderboard, sorted by 30d desc ──
  const leaderboard = useMemo(() => {
    return [...(resp?.by_project || [])].sort((a, b) => b.d30 - a.d30)
  }, [resp?.by_project])

  // ── Sparkline data: last 14 days per slug (and an aggregate for the hero KPI) ──
  const SPARK_WINDOW = 14
  const sparkAxis = useMemo(() => axis.slice(-SPARK_WINDOW), [axis])

  const sparkBySlug = useMemo(() => {
    const m: Record<string, number[]> = {}
    for (const b of brandsForChart) {
      m[b.slug] = sparkAxis.map((d) => byDateSlug[d]?.[b.slug] || 0)
    }
    return m
  }, [brandsForChart, sparkAxis, byDateSlug])

  const heroSpark = useMemo(() => {
    return sparkAxis.map((d) => {
      const row = byDateSlug[d] || {}
      return Object.values(row).reduce((a: number, v) => a + (Number(v) || 0), 0)
    })
  }, [sparkAxis, byDateSlug])

  const hasData =
    !!resp && ((resp.daily && resp.daily.length > 0) || (totals && totals.d30 > 0))

  // Compact summary for the collapsed header
  const summary = totals
    ? `${fmt(totals.d30)} in last 30 days${
        totals.trend_pct ? ` · ${totals.trend_pct > 0 ? "↑" : "↓"} ${Math.abs(totals.trend_pct).toFixed(1)}%` : ""
      }`
    : "—"

  return (
    <div
      style={{
        marginBottom: "28px",
        border: `1px solid ${tokens.border}`,
        borderRadius: tokens.rLg,
        background: tokens.surface,
        boxShadow: tokens.shadowSm,
        overflow: "hidden",
        fontFamily: tokens.fontFamily,
        color: tokens.fg,
      }}
    >
      {/* ── Collapsed/expanded header (click to toggle) ── */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          padding: "16px 20px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
          fontFamily: "inherit",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
          <span style={{ fontSize: "18px", lineHeight: 1 }} aria-hidden>
            📥
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: "16px", fontWeight: 600, color: tokens.fg, letterSpacing: "-0.01em" }}>
              Popup subscribers
            </div>
            <div
              style={{
                fontSize: "12px",
                color: tokens.fgSecondary,
                marginTop: "2px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {isLoading ? "Loading…" : summary}
            </div>
          </div>
        </div>
        <span
          aria-hidden
          style={{
            fontSize: "12px",
            color: tokens.fgMuted,
            transition: "transform 0.2s ease",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            display: "inline-block",
            flexShrink: 0,
          }}
        >
          ▼
        </span>
      </button>

      {/* ── Expanded dashboard ── */}
      {open && (
        <div style={{ borderTop: `1px solid ${tokens.borderSubtle}`, padding: "20px" }}>
          {/* Period filter */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              marginBottom: "18px",
            }}
          >
            <Segmented value={days} options={DAYS_OPTIONS} onChange={setDays} />
          </div>

          {isLoading ? (
            <Skeleton />
          ) : !hasData ? (
            <div
              style={{
                padding: "56px 24px",
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "10px",
              }}
            >
              <div
                style={{
                  width: "56px",
                  height: "56px",
                  borderRadius: tokens.rLg,
                  background: tokens.borderSubtle,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "26px",
                }}
                aria-hidden
              >
                📥
              </div>
              <div style={{ fontSize: "15px", fontWeight: 600, color: tokens.fg }}>
                No popup sign-ups in this period.
              </div>
              <div style={{ fontSize: "13px", color: tokens.fgSecondary, maxWidth: "420px", lineHeight: 1.5 }}>
                New subscribers from the index-page popups will show up here.
              </div>
            </div>
          ) : (
            <>
              {/* ── KPI bento grid ── */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: "14px",
                  marginBottom: "24px",
                }}
              >
                <KpiCard
                  label="Today"
                  value={fmt(totals?.today ?? 0)}
                  sub="new sign-ups"
                  spark={heroSpark}
                  sparkColor={PALETTE[1]}
                />
                <KpiCard
                  label="Last 7 days"
                  value={fmt(totals?.d7 ?? 0)}
                  spark={heroSpark}
                  sparkColor={PALETTE[2]}
                />
                <KpiCard
                  label="Last 30 days"
                  value={fmt(totals?.d30 ?? 0)}
                  trend={totals?.trend_pct}
                  sub="vs. previous 30d"
                  hero
                  spark={heroSpark}
                  sparkColor={PALETTE[0]}
                />
                <KpiCard
                  label="Net growth (30d)"
                  value={fmt(totals?.net_d30 ?? 0)}
                  accent={(totals?.net_d30 ?? 0) >= 0 ? tokens.successFg : tokens.dangerFg}
                  sub={`−${fmt(totals?.unsubs_d30 ?? 0)} unsubscribes`}
                />
              </div>

              {/* ── Main multi-line chart ── */}
              <div
                style={{
                  border: `1px solid ${tokens.border}`,
                  borderRadius: tokens.rLg,
                  background: tokens.surface,
                  padding: "20px 22px",
                  marginBottom: "24px",
                }}
              >
                <SectionHeading title="Sign-ups per day" sub={`Last ${days} days · one line per popup`} />
                <MultiLineChart axis={axis} byDateSlug={byDateSlug} brands={brandsForChart} />
              </div>

              {/* ── Per-project leaderboard ── */}
              <div
                style={{
                  border: `1px solid ${tokens.border}`,
                  borderRadius: tokens.rLg,
                  background: tokens.surface,
                  overflow: "hidden",
                }}
              >
                <div style={{ padding: "16px 20px", borderBottom: `1px solid ${tokens.borderSubtle}` }}>
                  <SectionHeading title="Per project" sub="Sorted by sign-ups (30d)" />
                </div>
                {leaderboard.length === 0 ? (
                  <div style={{ padding: "32px 20px", textAlign: "center", fontSize: "13px", color: tokens.fgSecondary }}>
                    No projects to show.
                  </div>
                ) : (
                  <div>
                    {/* Column header row */}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "minmax(0,1fr) 90px 70px 70px 70px 80px",
                        gap: "8px",
                        alignItems: "center",
                        padding: "10px 20px",
                        background: tokens.bg,
                        borderBottom: `1px solid ${tokens.border}`,
                        fontSize: "11px",
                        fontWeight: 600,
                        color: tokens.fgSecondary,
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                      }}
                    >
                      <span>Project</span>
                      <span style={{ textAlign: "center" }}>Trend</span>
                      <span style={{ textAlign: "right" }}>Today</span>
                      <span style={{ textAlign: "right" }}>7d</span>
                      <span style={{ textAlign: "right" }}>30d</span>
                      <span style={{ textAlign: "right" }}>14d</span>
                    </div>

                    {leaderboard.map((p) => {
                      const color = colorBySlug[p.brand_slug] || PALETTE[0]
                      const domain = PROJECT_DOMAIN[p.brand_slug]
                      return (
                        <div
                          key={p.brand_slug}
                          style={{
                            display: "grid",
                            gridTemplateColumns: "minmax(0,1fr) 90px 70px 70px 70px 80px",
                            gap: "8px",
                            alignItems: "center",
                            padding: "12px 20px",
                            borderBottom: `1px solid ${tokens.borderSubtle}`,
                          }}
                        >
                          {/* Project: avatar + name + domain */}
                          <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                            <ProjectAvatar name={p.brand_name || p.brand_slug} color={color} />
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: "13px", fontWeight: 600, color: tokens.fg, lineHeight: 1.3 }}>
                                <ProjectBadge slug={p.brand_slug} fallbackLabel={p.brand_name} />
                              </div>
                              {domain && (
                                <div
                                  style={{
                                    fontSize: "11px",
                                    color: tokens.fgMuted,
                                    marginTop: "3px",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {domain}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Trend */}
                          <div style={{ display: "flex", justifyContent: "center" }}>
                            <TrendPill pct={p.trend_pct} />
                          </div>

                          {/* Today / 7d / 30d */}
                          <span style={{ textAlign: "right", fontSize: "13px", fontVariantNumeric: "tabular-nums" }}>
                            {fmt(p.today)}
                          </span>
                          <span style={{ textAlign: "right", fontSize: "13px", fontVariantNumeric: "tabular-nums" }}>
                            {fmt(p.d7)}
                          </span>
                          <span
                            style={{
                              textAlign: "right",
                              fontSize: "13px",
                              fontWeight: 600,
                              fontVariantNumeric: "tabular-nums",
                            }}
                          >
                            {fmt(p.d30)}
                          </span>

                          {/* Mini sparkline */}
                          <div style={{ display: "flex", justifyContent: "flex-end" }}>
                            <Sparkline
                              values={sparkBySlug[p.brand_slug] || []}
                              color={color}
                              width={72}
                              height={26}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default PopupSubscriberSection
