import React from "react"

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

const cardStyle: React.CSSProperties = {
  background: "#FFFFFF",
  border: "1px solid #E1E3E5",
  borderRadius: "10px",
  padding: "20px",
  transition: "box-shadow 0.2s ease, transform 0.2s ease",
  cursor: "default",
}

const labelStyle: React.CSSProperties = {
  fontSize: "13px",
  color: "#6D7175",
  fontWeight: 500,
  marginBottom: "8px",
}

const valueStyle: React.CSSProperties = {
  fontSize: "28px",
  fontWeight: 600,
  color: "#1A1A1A",
  letterSpacing: "-0.5px",
}

const changeBaseStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "4px",
  fontSize: "12px",
  fontWeight: 500,
  marginTop: "6px",
  padding: "2px 8px",
  borderRadius: "12px",
}

function ChangeLabel({ pct, dir }: { pct: number; dir: "up" | "down" | "neutral" }) {
  const styles: Record<string, React.CSSProperties> = {
    up: { color: "#0D5740", background: "#AEE9D1" },
    down: { color: "#9E2B25", background: "#FED3D1" },
    neutral: { color: "#6D7175", background: "#F1F1F1" },
  }
  const arrows: Record<string, string> = { up: "\u25B2", down: "\u25BC", neutral: "" }

  return (
    <span style={{ ...changeBaseStyle, ...styles[dir] }}>
      {arrows[dir]} {pct}% vs yesterday
    </span>
  )
}

function SkeletonCard() {
  return (
    <div style={cardStyle}>
      <div style={{ ...labelStyle, width: "80px", height: "14px", background: "#EBEBEB", borderRadius: "4px" }} />
      <div style={{ ...valueStyle, width: "60px", height: "32px", background: "#EBEBEB", borderRadius: "4px", marginTop: "8px" }} />
      <div style={{ width: "120px", height: "18px", background: "#EBEBEB", borderRadius: "12px", marginTop: "8px" }} />
    </div>
  )
}

export function StatCards(props: StatCardsProps) {
  const { ordersToday, revenueToday, ordersYesterday, revenueYesterday, unfulfilled, inTransit, isLoading } = props

  if (isLoading) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "24px" }}>
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    )
  }

  const orderChange = calcChange(ordersToday, ordersYesterday)
  const revenueChange = calcChange(revenueToday, revenueYesterday)

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "24px" }}>
      {/* Orders Today */}
      <div style={cardStyle}>
        <div style={labelStyle}>Orders Today</div>
        <div style={valueStyle}>{ordersToday}</div>
        <ChangeLabel pct={orderChange.pct} dir={orderChange.dir} />
      </div>

      {/* Revenue Today */}
      <div style={cardStyle}>
        <div style={labelStyle}>Revenue Today</div>
        <div style={valueStyle}>&euro;{revenueToday.toFixed(2)}</div>
        <ChangeLabel pct={revenueChange.pct} dir={revenueChange.dir} />
      </div>

      {/* Unfulfilled */}
      <div style={cardStyle}>
        <div style={{ ...labelStyle, color: unfulfilled > 0 ? "#D72C0D" : "#6D7175" }}>Unfulfilled</div>
        <div style={{ ...valueStyle, color: unfulfilled > 0 ? "#D72C0D" : "#1A1A1A" }}>{unfulfilled}</div>
        <span style={{ ...changeBaseStyle, color: "#6D7175", background: "#F1F1F1" }}>awaiting shipment</span>
      </div>

      {/* In Transit */}
      <div style={cardStyle}>
        <div style={labelStyle}>In Transit</div>
        <div style={valueStyle}>{inTransit}</div>
        <span style={{ ...changeBaseStyle, color: "#6D7175", background: "#F1F1F1" }}>on the way</span>
      </div>
    </div>
  )
}
