import React from "react"
import { colors, radii, shadows } from "./design-tokens"

interface StatCardsProps {
  ordersToday: number
  revenueToday: number
  ordersYesterday: number
  revenueYesterday: number
  unfulfilled: number
  inTransit: number
  isLoading?: boolean
}

function calcChange(today: number, yesterday: number): { pct: number; dir: "up" | "down" | "neutral" } {
  if (yesterday === 0 && today === 0) return { pct: 0, dir: "neutral" }
  if (yesterday === 0) return { pct: 100, dir: "up" }
  const pct = Math.round(((today - yesterday) / yesterday) * 100)
  if (pct > 0) return { pct, dir: "up" }
  if (pct < 0) return { pct: Math.abs(pct), dir: "down" }
  return { pct: 0, dir: "neutral" }
}

/* ── Grid ── */

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: "12px",
  marginBottom: "24px",
}

/* ── Card ── */

const cardStyle: React.CSSProperties = {
  background: "#FFFFFF",
  border: "1px solid rgba(0,0,0,0.07)",
  borderRadius: "14px",
  padding: "20px",
  boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 24px rgba(0,0,0,0.03)",
  position: "relative",
  overflow: "hidden",
}

/* ── Top gradient line (2px absolute at top) ── */

function topLineStyle(color: string): React.CSSProperties {
  return {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "2px",
    background: color,
  }
}

/* ── Typography ── */

const labelStyle: React.CSSProperties = {
  fontSize: "13px",
  color: "#6B7185",
  fontWeight: 500,
  marginBottom: "8px",
}

const valueStyle: React.CSSProperties = {
  fontSize: "28px",
  fontWeight: 700,
  color: "#1A1D2E",
  letterSpacing: "-0.5px",
}

/* ── ChangeLabel ── */

const trendBadgeBase: React.CSSProperties = {
  position: "absolute",
  top: "16px",
  right: "16px",
  display: "inline-flex",
  alignItems: "center",
  gap: "3px",
  padding: "3px 8px",
  borderRadius: "6px",
  fontSize: "12px",
  fontWeight: 600,
}

const trendStyles: Record<string, React.CSSProperties> = {
  up: { background: "rgba(0,179,122,0.08)", color: "#00B37A" },
  down: { background: "rgba(231,76,60,0.07)", color: "#E74C3C" },
  neutral: { background: "rgba(0,0,0,0.04)", color: "#9CA3B8" },
}

const trendPrefixes: Record<string, string> = {
  up: "\u25B2",
  down: "\u25BC",
  neutral: "\u2014",
}

function ChangeLabel({ pct, dir }: { pct: number; dir: "up" | "down" | "neutral" }) {
  return (
    <span style={{ ...trendBadgeBase, ...trendStyles[dir] }}>
      {trendPrefixes[dir]} {pct}% vs yesterday
    </span>
  )
}

/* ── SkeletonCard ── */

const shimmerKeyframes = `
@keyframes statCardShimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
`

const shimmerGradient =
  "linear-gradient(90deg, #EBEBEB 25%, #F5F5F5 50%, #EBEBEB 75%)"

function shimmerBlock(width: string, height: string, extra?: React.CSSProperties): React.CSSProperties {
  return {
    width,
    height,
    borderRadius: "6px",
    background: shimmerGradient,
    backgroundSize: "200% 100%",
    animation: "statCardShimmer 1.5s ease-in-out infinite",
    ...extra,
  }
}

function SkeletonCard() {
  return (
    <div style={cardStyle}>
      <div style={topLineStyle("rgba(0,0,0,0.06)")} />
      <div style={shimmerBlock("80px", "14px")} />
      <div style={shimmerBlock("60px", "32px", { marginTop: "8px" })} />
      <div style={shimmerBlock("72px", "20px", { marginTop: "10px", position: "absolute", top: "10px", right: "16px", borderRadius: "6px" })} />
    </div>
  )
}

/* ── StatCards ── */

export function StatCards(props: StatCardsProps) {
  const { ordersToday, revenueToday, ordersYesterday, revenueYesterday, unfulfilled, inTransit, isLoading } = props

  if (isLoading) {
    return (
      <>
        <style>{shimmerKeyframes}</style>
        <div style={gridStyle}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </>
    )
  }

  const orderChange = calcChange(ordersToday, ordersYesterday)
  const revenueChange = calcChange(revenueToday, revenueYesterday)

  const unfulfilledLineColor = unfulfilled > 0 ? "#E74C3C" : "#9CA3B8"

  return (
    <div style={gridStyle}>
      {/* Orders Today */}
      <div style={cardStyle}>
        <div style={topLineStyle("#00B37A")} />
        <div style={labelStyle}>Orders Today</div>
        <div style={valueStyle}>{ordersToday}</div>
        <ChangeLabel pct={orderChange.pct} dir={orderChange.dir} />
      </div>

      {/* Revenue Today */}
      <div style={cardStyle}>
        <div style={topLineStyle("#00B37A")} />
        <div style={labelStyle}>Revenue Today</div>
        <div style={valueStyle}>&euro;{revenueToday.toFixed(2)}</div>
        <ChangeLabel pct={revenueChange.pct} dir={revenueChange.dir} />
      </div>

      {/* Unfulfilled */}
      <div style={cardStyle}>
        <div style={topLineStyle(unfulfilledLineColor)} />
        <div style={labelStyle}>Unfulfilled</div>
        <div style={valueStyle}>{unfulfilled}</div>
        <span style={{ ...trendBadgeBase, background: "rgba(0,0,0,0.04)", color: "#9CA3B8" }}>
          awaiting shipment
        </span>
      </div>

      {/* In Transit */}
      <div style={cardStyle}>
        <div style={topLineStyle("#3B82F6")} />
        <div style={labelStyle}>In Transit</div>
        <div style={valueStyle}>{inTransit}</div>
        <span style={{ ...trendBadgeBase, background: "rgba(0,0,0,0.04)", color: "#9CA3B8" }}>
          on the way
        </span>
      </div>
    </div>
  )
}
