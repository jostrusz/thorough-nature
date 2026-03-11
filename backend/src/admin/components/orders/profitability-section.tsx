import React, { useState, useMemo } from "react"
import { toast } from "@medusajs/ui"
import { useProfitability, Period, ProjectStats } from "../../hooks/use-profitability"
import { fontStack, colors } from "./design-tokens"

// ═══════════════════════════════════════════
// CURRENCY FORMATTER
// ═══════════════════════════════════════════
const eurFormat = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
})

function formatEur(value: number): string {
  return eurFormat.format(value)
}

// ═══════════════════════════════════════════
// GLOW BAR LOGIC
// ═══════════════════════════════════════════
type GlowLevel = "excellent" | "good" | "warning" | "danger" | "neutral"

function getGlowLevel(project: ProjectStats): GlowLevel {
  if (project.order_count === 0 && project.revenue === 0) return "neutral"
  if (project.profit_margin > 30) return "excellent"
  if (project.profit_margin > 15) return "good"
  if (project.profit_margin > 0) return "warning"
  return "danger"
}

const glowGradients: Record<GlowLevel, string> = {
  excellent: "linear-gradient(90deg, #00B37A, #00D68F)",
  good: "linear-gradient(90deg, #00B37A, #7ED8A8)",
  warning: "linear-gradient(90deg, #D4A017, #F0C040)",
  danger: "linear-gradient(90deg, #E74C3C, #FF6B5A)",
  neutral: "linear-gradient(90deg, #9CA3B8, #BCC3D4)",
}

// ═══════════════════════════════════════════
// KEYFRAME ANIMATIONS
// ═══════════════════════════════════════════
function ProfitabilityStyles() {
  return (
    <style>{`
      @keyframes profitLivePulse {
        0%, 100% { opacity: 1; box-shadow: 0 0 6px rgba(0,179,122,0.4); }
        50% { opacity: 0.5; box-shadow: 0 0 12px rgba(0,179,122,0.6); }
      }
      @keyframes profitGradientShift {
        0% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
        100% { background-position: 0% 50%; }
      }
      @keyframes profitSkeletonPulse {
        0% { background-position: -200% 0; }
        100% { background-position: 200% 0; }
      }
      .profit-project-card {
        transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) !important;
      }
      .profit-project-card:hover {
        transform: translateY(-3px) scale(1.01);
        box-shadow: 0 12px 28px rgba(0,0,0,0.08), 0 4px 8px rgba(0,0,0,0.04);
        border-color: rgba(0,0,0,0.1) !important;
      }
      .profit-project-card:active {
        transform: translateY(0) scale(0.98);
      }
      .profit-total-bar {
        transition: all 0.25s ease !important;
      }
      .profit-total-bar:hover {
        box-shadow: 0 6px 24px rgba(0,0,0,0.06) !important;
      }
      .profit-period-btn {
        transition: all 0.15s ease !important;
      }
      .profit-period-btn:hover {
        color: #1A1D2E !important;
        background: rgba(0,0,0,0.03) !important;
      }
      .profit-custom-range {
        overflow: hidden;
        transition: max-height 0.2s ease, opacity 0.2s ease;
      }
    `}</style>
  )
}

// ═══════════════════════════════════════════
// PERIOD SELECTOR
// ═══════════════════════════════════════════
const PERIODS: { id: Period; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "this_week", label: "This Week" },
  { id: "this_month", label: "This Month" },
  { id: "custom", label: "Custom" },
]

const periodSelectorStyle: React.CSSProperties = {
  display: "flex",
  gap: "2px",
  background: "rgba(0,0,0,0.04)",
  borderRadius: "8px",
  padding: "3px",
}

const periodBtnBase: React.CSSProperties = {
  padding: "6px 14px",
  borderRadius: "6px",
  fontSize: "12px",
  fontWeight: 500,
  color: "#6B7185",
  cursor: "pointer",
  border: "none",
  background: "transparent",
  fontFamily: fontStack,
}

const periodBtnActive: React.CSSProperties = {
  ...periodBtnBase,
  background: "#fff",
  color: "#1A1D2E",
  fontWeight: 600,
  boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
}

// ═══════════════════════════════════════════
// CUSTOM DATE RANGE
// ═══════════════════════════════════════════
const dateInputStyle: React.CSSProperties = {
  padding: "5px 10px",
  borderRadius: "6px",
  border: "1px solid rgba(0,0,0,0.1)",
  fontSize: "12px",
  fontFamily: fontStack,
  color: "#1A1D2E",
  background: "#fff",
  outline: "none",
}

// ═══════════════════════════════════════════
// PROJECT CARD
// ═══════════════════════════════════════════
const cardOuterStyle: React.CSSProperties = {
  background: "#FFFFFF",
  border: "1px solid rgba(0,0,0,0.06)",
  borderRadius: "12px",
  padding: 0,
  overflow: "hidden",
  position: "relative",
  cursor: "pointer",
}

const cardInnerStyle: React.CSSProperties = {
  padding: "12px 14px 13px",
}

const projectNameRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: "5px",
}

const projectNameStyle: React.CSSProperties = {
  fontSize: "12px",
  fontWeight: 600,
  color: "#1A1D2E",
  letterSpacing: "-0.1px",
  display: "flex",
  alignItems: "center",
  gap: "6px",
}

const countryTagStyle: React.CSSProperties = {
  fontSize: "9px",
  fontWeight: 600,
  padding: "1px 6px",
  borderRadius: "3px",
  background: "rgba(0,0,0,0.04)",
  color: "#6B7185",
  letterSpacing: "0.3px",
}

const profitLabelStyle: React.CSSProperties = {
  fontSize: "10px",
  fontWeight: 500,
  color: "#9CA3B8",
  marginBottom: "7px",
  textTransform: "uppercase" as const,
  letterSpacing: "0.3px",
}

const cardDividerStyle: React.CSSProperties = {
  height: "1px",
  background: "rgba(0,0,0,0.05)",
  margin: "0 -12px 6px",
}

const metricsRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "4px",
}

const metricStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column" as const,
  gap: "1px",
  minWidth: 0,
}

const metricLabelStyle: React.CSSProperties = {
  fontSize: "9px",
  fontWeight: 500,
  color: "#9CA3B8",
  textTransform: "uppercase" as const,
  letterSpacing: "0.3px",
}

const metricValueStyle: React.CSSProperties = {
  fontSize: "13px",
  fontWeight: 700,
  color: "#1A1D2E",
  fontVariantNumeric: "tabular-nums",
}

// Subtle background tints per glow level
const glowBg: Record<GlowLevel, string> = {
  excellent: "linear-gradient(135deg, #F0FDF9 0%, #FFFFFF 60%)",
  good: "linear-gradient(135deg, #F0FDF9 0%, #FFFFFF 60%)",
  warning: "linear-gradient(135deg, #FFFBEB 0%, #FFFFFF 60%)",
  danger: "linear-gradient(135deg, #FEF2F2 0%, #FFFFFF 60%)",
  neutral: "linear-gradient(135deg, #F8F9FB 0%, #FFFFFF 60%)",
}

function getStatusEmoji(project: ProjectStats): string {
  if (project.order_count === 0) return "💤"
  if (project.profit_margin > 30) return "🔥"
  if (project.profit_margin > 15) return "✨"
  if (project.profit_margin > 0) return "📈"
  return "⚠️"
}

function ProjectCard({ project }: { project: ProjectStats }) {
  const glow = getGlowLevel(project)
  const profitColor =
    project.net_profit > 0
      ? "#00B37A"
      : project.net_profit < 0
        ? "#E74C3C"
        : "#9CA3B8"

  return (
    <div
      className="profit-project-card"
      style={{
        ...cardOuterStyle,
        background: glowBg[glow],
      }}
    >
      {/* Glow bar */}
      <div
        style={{
          height: "3px",
          background: glowGradients[glow],
          transition: "all 0.5s ease",
        }}
      />

      {/* Card inner */}
      <div style={cardInnerStyle}>
        {/* Project name row */}
        <div style={projectNameRowStyle}>
          <div style={projectNameStyle}>
            <span style={{ fontSize: "15px", lineHeight: 1 }}>{project.flag_emoji}</span>
            {project.project_name}
          </div>
          <span style={countryTagStyle}>{project.country_tag}</span>
        </div>

        {/* Net Profit — big number + status emoji */}
        <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
          <div
            style={{
              fontSize: "22px",
              fontWeight: 800,
              letterSpacing: "-0.8px",
              lineHeight: 1.1,
              marginBottom: "2px",
              fontVariantNumeric: "tabular-nums",
              color: profitColor,
              transition: "color 0.3s ease",
            }}
          >
            {formatEur(project.net_profit)}
          </div>
          <span style={{ fontSize: "14px", lineHeight: 1 }}>{getStatusEmoji(project)}</span>
        </div>

        {/* Label */}
        <div style={profitLabelStyle}>Net Profit</div>

        {/* Divider */}
        <div style={cardDividerStyle} />

        {/* Bottom metrics */}
        <div style={metricsRowStyle}>
          <div style={metricStyle}>
            <span style={metricLabelStyle}>Revenue</span>
            <span style={metricValueStyle}>{formatEur(project.revenue)}</span>
          </div>
          <div style={{ ...metricStyle, alignItems: "center" }}>
            <span style={metricLabelStyle}>Orders</span>
            <span style={{ ...metricValueStyle, fontSize: "14px" }}>
              {project.order_count > 0 ? project.order_count : "—"}
            </span>
          </div>
          <div style={{ ...metricStyle, alignItems: "flex-end" }}>
            <span style={metricLabelStyle}>Ad Spend</span>
            <span style={{ ...metricValueStyle, color: "#6B7185" }}>
              {project.ad_spend > 0 ? formatEur(project.ad_spend) : "\u2014"}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════
// SKELETON CARD
// ═══════════════════════════════════════════
const shimmerGradient = "linear-gradient(90deg, #EBEBEB 25%, #F5F5F5 50%, #EBEBEB 75%)"

function shimmerBlock(
  width: string,
  height: string,
  extra?: React.CSSProperties
): React.CSSProperties {
  return {
    width,
    height,
    borderRadius: "4px",
    background: shimmerGradient,
    backgroundSize: "200% 100%",
    animation: "profitSkeletonPulse 1.5s ease-in-out infinite",
    ...extra,
  }
}

function SkeletonCard() {
  return (
    <div style={cardOuterStyle}>
      <div style={{ height: "2.5px", background: "rgba(0,0,0,0.04)" }} />
      <div style={cardInnerStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
          <div style={shimmerBlock("80px", "14px")} />
          <div style={shimmerBlock("36px", "14px")} />
        </div>
        <div style={shimmerBlock("100px", "22px", { marginBottom: "4px" })} />
        <div style={shimmerBlock("52px", "10px", { marginBottom: "8px" })} />
        <div style={{ ...cardDividerStyle, margin: "0 0 6px" }} />
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <div style={shimmerBlock("60px", "16px")} />
          <div style={shimmerBlock("24px", "16px")} />
          <div style={shimmerBlock("60px", "16px")} />
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════
// TOTAL SUMMARY BAR
// ═══════════════════════════════════════════
const totalBarStyle: React.CSSProperties = {
  background: "#FFFFFF",
  border: "1px solid rgba(0,0,0,0.06)",
  borderRadius: "12px",
  padding: "12px 20px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
  marginBottom: "28px",
  position: "relative",
  overflow: "hidden",
}

const totalGradientLineStyle: React.CSSProperties = {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  height: "2px",
  background: "linear-gradient(90deg, #6C5CE7, #00B37A, #3B82F6, #D4A017)",
  backgroundSize: "300% 100%",
  animation: "profitGradientShift 6s ease infinite",
}

const totalLabelStyle: React.CSSProperties = {
  fontSize: "13px",
  fontWeight: 600,
  color: "#6B7185",
  display: "flex",
  alignItems: "center",
  gap: "8px",
}

const totalMetricsStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "32px",
}

const totalItemStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column" as const,
  alignItems: "flex-end",
  gap: "1px",
}

const totalItemLabelStyle: React.CSSProperties = {
  fontSize: "9px",
  fontWeight: 500,
  color: "#9CA3B8",
  textTransform: "uppercase" as const,
  letterSpacing: "0.4px",
}

const totalItemValueStyle: React.CSSProperties = {
  fontSize: "17px",
  fontWeight: 800,
  letterSpacing: "-0.5px",
  fontVariantNumeric: "tabular-nums",
}

// ═══════════════════════════════════════════
// SECTION DIVIDER
// ═══════════════════════════════════════════
const sectionDividerStyle: React.CSSProperties = {
  height: "1px",
  background: "linear-gradient(90deg, transparent, rgba(0,0,0,0.06), transparent)",
  margin: "0 0 24px",
}

// ═══════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════
export function ProfitabilitySection() {
  const [period, setPeriod] = useState<Period>("today")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [showCustomRange, setShowCustomRange] = useState(false)

  const { data, isLoading } = useProfitability(period, dateFrom, dateTo)

  const handlePeriodChange = (newPeriod: Period) => {
    if (newPeriod === "custom") {
      setShowCustomRange(true)
      setPeriod("custom")
    } else {
      setShowCustomRange(false)
      setPeriod(newPeriod)
      setDateFrom("")
      setDateTo("")
    }
  }

  const handleCustomDateChange = (from: string, to: string) => {
    setDateFrom(from)
    setDateTo(to)

    // Validate range
    if (from && to) {
      const fromDate = new Date(from)
      const toDate = new Date(to)
      const diffDays = Math.ceil(
        (toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)
      )

      if (diffDays > 90) {
        toast.warning("Maximum allowed range is 90 days")
        return
      }

      if (fromDate > toDate) {
        toast.warning("Start date must be before end date")
        return
      }
    }
  }

  // Format custom range label
  const customRangeLabel = useMemo(() => {
    if (dateFrom && dateTo) {
      const from = new Date(dateFrom)
      const to = new Date(dateTo)
      const formatter = new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
      })
      return `${formatter.format(from)} \u2013 ${formatter.format(to)}`
    }
    return null
  }, [dateFrom, dateTo])

  const projects = data?.projects || []
  const totals = data?.totals || { revenue: 0, order_count: 0, ad_spend: 0, net_profit: 0 }

  return (
    <div style={{ marginBottom: "28px" }}>
      <ProfitabilityStyles />

      {/* ═══ Header ═══ */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "16px",
        }}
      >
        {/* Left — Title + Live dot */}
        <h2
          style={{
            fontSize: "20px",
            fontWeight: 700,
            letterSpacing: "-0.4px",
            color: "#1A1D2E",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            margin: 0,
            fontFamily: fontStack,
            whiteSpace: "nowrap",
          }}
        >
          Project Profitability
          {period === "today" && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", marginRight: "8px" }}>
              <span
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  background: "#00B37A",
                  display: "inline-block",
                  animation: "profitLivePulse 2s ease-in-out infinite",
                  boxShadow: "0 0 6px rgba(0,179,122,0.4)",
                }}
              />
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "#00B37A",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                Live
              </span>
            </span>
          )}
        </h2>

        {/* Right — Period selector */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {/* Custom range label */}
          {showCustomRange && customRangeLabel && (
            <span
              style={{
                fontSize: "12px",
                fontWeight: 600,
                color: colors.accent,
                background: colors.accentBg,
                padding: "4px 10px",
                borderRadius: "6px",
              }}
            >
              {customRangeLabel}
            </span>
          )}

          <div style={periodSelectorStyle}>
            {PERIODS.map((p) => (
              <button
                key={p.id}
                className="profit-period-btn"
                style={period === p.id ? periodBtnActive : periodBtnBase}
                onClick={() => handlePeriodChange(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ═══ Custom Date Range ═══ */}
      {showCustomRange && (
        <div
          className="profit-custom-range"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            marginBottom: "12px",
            padding: "8px 12px",
            background: "rgba(0,0,0,0.02)",
            borderRadius: "8px",
            border: "1px solid rgba(0,0,0,0.04)",
          }}
        >
          <span style={{ fontSize: "12px", color: "#6B7185", fontWeight: 500 }}>
            From:
          </span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => handleCustomDateChange(e.target.value, dateTo)}
            style={dateInputStyle}
          />
          <span style={{ fontSize: "12px", color: "#6B7185", fontWeight: 500 }}>
            To:
          </span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => handleCustomDateChange(dateFrom, e.target.value)}
            style={dateInputStyle}
          />
        </div>
      )}

      {/* ═══ Project Cards Grid ═══ */}
      {isLoading ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "8px",
            marginBottom: "8px",
          }}
        >
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "8px",
            marginBottom: "8px",
          }}
        >
          {projects.map((project) => (
            <ProjectCard key={project.project_id} project={project} />
          ))}
        </div>
      )}

      {/* ═══ Total Summary Bar ═══ */}
      <div className="profit-total-bar" style={totalBarStyle}>
        {/* Animated gradient top border */}
        <div style={totalGradientLineStyle} />

        {/* Left label */}
        <div style={totalLabelStyle}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            style={{ opacity: 0.5 }}
          >
            <path d="M18 20V10M12 20V4M6 20v-6" />
          </svg>
          Total All Projects
        </div>

        {/* Right metrics */}
        <div style={totalMetricsStyle}>
          <div style={totalItemStyle}>
            <span style={totalItemLabelStyle}>Revenue</span>
            <span style={{ ...totalItemValueStyle, color: "#1A1D2E" }}>
              {formatEur(totals.revenue)}
            </span>
          </div>
          <div style={totalItemStyle}>
            <span style={totalItemLabelStyle}>Orders</span>
            <span style={{ ...totalItemValueStyle, color: "#1A1D2E" }}>
              {totals.order_count}
            </span>
          </div>
          <div style={totalItemStyle}>
            <span style={totalItemLabelStyle}>Ad Spend</span>
            <span style={{ ...totalItemValueStyle, color: "#6B7185" }}>
              {totals.ad_spend > 0 ? formatEur(totals.ad_spend) : "\u2014"}
            </span>
          </div>
          <div style={totalItemStyle}>
            <span style={totalItemLabelStyle}>Net Profit</span>
            <span
              style={{
                ...totalItemValueStyle,
                color: totals.net_profit >= 0 ? "#00B37A" : "#E74C3C",
              }}
            >
              {formatEur(totals.net_profit)}
            </span>
          </div>
        </div>
      </div>

    </div>
  )
}
