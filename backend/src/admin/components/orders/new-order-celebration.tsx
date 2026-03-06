import React, { useEffect, useState, useRef, useMemo } from "react"
import { createPortal } from "react-dom"
import { colors, radii, fontStack } from "./design-tokens"

// ═══ Types ═══

interface NewOrderCelebrationProps {
  order: {
    display_id: string | number
    email?: string
    total?: number
    currency_code?: string
    shipping_address?: { first_name?: string; last_name?: string }
    metadata?: { custom_order_number?: string }
  } | null
  onDismiss: () => void
}

// ═══ Confetti Configuration (matches storefront thank-you page) ═══

const CONFETTI_COLORS = [
  colors.accent,   // #6C5CE7
  "#C4B5FD",       // light purple
  "#1A1A1A",       // dark
  "#F3E8FF",       // soft lavender
  "#374151",       // charcoal
  "#A78BFA",       // medium purple
  "#fff",          // white
]

const CONFETTI_COUNT = 60

interface ConfettiPiece {
  id: number
  color: string
  left: number
  delay: number
  duration: number
  size: number
  shape: "circle" | "square" | "triangle"
}

function generateConfetti(): ConfettiPiece[] {
  const shapes: Array<"circle" | "square" | "triangle"> = ["circle", "square", "triangle"]
  return Array.from({ length: CONFETTI_COUNT }, (_, i) => ({
    id: i,
    color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    left: Math.random() * 100,
    delay: Math.random() * 1.5,
    duration: 2.5 + Math.random() * 2,
    size: 6 + Math.random() * 10,
    shape: shapes[Math.floor(Math.random() * shapes.length)],
  }))
}

// ═══ Sound ═══

function playNotificationChime() {
  try {
    const ctx = new (window.AudioContext ||
      (window as any).webkitAudioContext)()
    const now = ctx.currentTime

    const playTone = (freq: number, start: number, dur: number) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = "sine"
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.12, start)
      gain.gain.exponentialRampToValueAtTime(0.001, start + dur)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(start)
      osc.stop(start + dur)
    }

    playTone(523.25, now, 0.12)
    playTone(659.25, now + 0.08, 0.12)
    setTimeout(() => ctx.close(), 500)
  } catch {
    // Web Audio not available
  }
}

// ═══ Currency Formatting ═══

function formatCurrency(amount: number, currencyCode: string = "EUR"): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currencyCode.toUpperCase(),
      minimumFractionDigits: 2,
    }).format(amount)
  } catch {
    return `${amount.toFixed(2)} ${currencyCode.toUpperCase()}`
  }
}

// ═══ Keyframes (injected once) ═══

const STYLE_ID = "new-order-celebration-keyframes"

function ensureKeyframes() {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement("style")
  style.id = STYLE_ID
  style.textContent = `
    @keyframes noc-confetti-fall {
      0% {
        opacity: 1;
        transform: translateY(0) rotate(0deg) scale(1);
      }
      80% {
        opacity: 1;
      }
      100% {
        opacity: 0;
        transform: translateY(100vh) rotate(720deg) scale(0.3);
      }
    }

    @keyframes noc-banner-slide-down {
      0% {
        opacity: 0;
        transform: translateY(-100%);
      }
      100% {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @keyframes noc-banner-slide-up {
      0% {
        opacity: 1;
        transform: translateY(0);
      }
      100% {
        opacity: 0;
        transform: translateY(-100%);
      }
    }
  `
  document.head.appendChild(style)
}

// ═══ Confetti Piece Renderer ═══

function ConfettiPieceEl({ piece }: { piece: ConfettiPiece }) {
  const baseStyle: React.CSSProperties = {
    position: "absolute",
    top: -20,
    left: `${piece.left}%`,
    opacity: 0,
    animation: `noc-confetti-fall ${piece.duration}s ease-in ${piece.delay}s forwards`,
  }

  if (piece.shape === "circle") {
    return (
      <div
        style={{
          ...baseStyle,
          width: piece.size,
          height: piece.size,
          borderRadius: "50%",
          background: piece.color,
        }}
      />
    )
  }

  if (piece.shape === "square") {
    return (
      <div
        style={{
          ...baseStyle,
          width: piece.size,
          height: piece.size,
          borderRadius: 2,
          background: piece.color,
        }}
      />
    )
  }

  // triangle
  return (
    <div
      style={{
        ...baseStyle,
        width: 0,
        height: 0,
        borderLeft: `${piece.size / 2}px solid transparent`,
        borderRight: `${piece.size / 2}px solid transparent`,
        borderBottom: `${piece.size}px solid ${piece.color}`,
        background: "none",
      }}
    />
  )
}

// ═══ Component ═══

export function NewOrderCelebration({
  order,
  onDismiss,
}: NewOrderCelebrationProps) {
  const [visible, setVisible] = useState(false)
  const [exiting, setExiting] = useState(false)
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const soundPlayed = useRef(false)

  const confettiPieces = useMemo(() => generateConfetti(), [order])

  useEffect(() => {
    if (!order) return

    ensureKeyframes()
    setVisible(true)
    setExiting(false)
    soundPlayed.current = false

    if (!soundPlayed.current) {
      playNotificationChime()
      soundPlayed.current = true
    }

    dismissTimer.current = setTimeout(() => {
      handleDismiss()
    }, 5000)

    return () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current)
    }
  }, [order])

  const handleDismiss = () => {
    setExiting(true)
    setTimeout(() => {
      setVisible(false)
      setExiting(false)
      onDismiss()
    }, 350)
  }

  if (!order || !visible) return null

  const customerName = [
    order.shipping_address?.first_name,
    order.shipping_address?.last_name,
  ]
    .filter(Boolean)
    .join(" ")

  const formattedTotal =
    order.total != null
      ? formatCurrency(order.total, order.currency_code)
      : null

  // ═══ Render via portal to document.body ═══
  // This bypasses Medusa admin's parent transforms that break position:fixed

  const content = (
    <>
      {/* Confetti layer */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          pointerEvents: "none",
          zIndex: 99998,
          overflow: "hidden",
        }}
      >
        {confettiPieces.map((piece) => (
          <ConfettiPieceEl key={piece.id} piece={piece} />
        ))}
      </div>

      {/* Banner — centered, max 500px */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 99999,
          display: "flex",
          justifyContent: "center",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            maxWidth: 500,
            width: "90%",
            background: `linear-gradient(135deg, ${colors.accent} 0%, #8B7CF7 100%)`,
            color: "#fff",
            borderRadius: `0 0 ${radii.sm} ${radii.sm}`,
            boxShadow: "0 4px 24px rgba(108,92,231,0.35), 0 1px 6px rgba(0,0,0,0.1)",
            padding: "16px 20px",
            fontFamily: fontStack,
            pointerEvents: "auto",
            animation: exiting
              ? "noc-banner-slide-up 0.35s ease-in forwards"
              : "noc-banner-slide-down 0.4s cubic-bezier(0.22,1,0.36,1) forwards",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: customerName || formattedTotal ? 6 : 0,
            }}
          >
            <span
              style={{
                fontSize: 15,
                fontWeight: 700,
                fontFamily: fontStack,
                letterSpacing: "-0.01em",
              }}
            >
              New order received! {"\uD83C\uDF89"}{" "}
              {order.metadata?.custom_order_number || `#${order.display_id}`}
            </span>
            <button
              style={{
                background: "rgba(255,255,255,0.18)",
                border: "none",
                color: "#fff",
                width: 24,
                height: 24,
                borderRadius: "50%",
                fontSize: 14,
                lineHeight: "24px",
                textAlign: "center",
                cursor: "pointer",
                padding: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                transition: "background 0.15s",
                fontFamily: fontStack,
              }}
              onClick={(e) => {
                e.stopPropagation()
                if (dismissTimer.current) clearTimeout(dismissTimer.current)
                handleDismiss()
              }}
              onMouseEnter={(e) => {
                ;(e.target as HTMLElement).style.background =
                  "rgba(255,255,255,0.3)"
              }}
              onMouseLeave={(e) => {
                ;(e.target as HTMLElement).style.background =
                  "rgba(255,255,255,0.18)"
              }}
              aria-label="Dismiss"
            >
              &times;
            </button>
          </div>
          {(customerName || formattedTotal) && (
            <div
              style={{
                fontSize: 13,
                fontWeight: 400,
                fontFamily: fontStack,
                opacity: 0.88,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              {customerName && <span>{customerName}</span>}
              {customerName && formattedTotal && (
                <span style={{ opacity: 0.5 }}>&middot;</span>
              )}
              {formattedTotal && (
                <span style={{ fontWeight: 600 }}>{formattedTotal}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )

  return createPortal(content, document.body)
}
