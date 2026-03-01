import React, { useEffect, useState, useRef, useMemo } from "react"
import { colors, radii, shadows, fontStack } from "./design-tokens"

// ═══ Types ═══

interface NewOrderCelebrationProps {
  order: {
    display_id: string | number
    email?: string
    total?: number
    currency_code?: string
    shipping_address?: { first_name?: string; last_name?: string }
  } | null
  onDismiss: () => void
}

// ═══ Confetti Configuration ═══

const CONFETTI_COLORS = [
  colors.accent,
  colors.green,
  colors.blue,
  colors.yellow,
  colors.red,
  colors.orange,
]

const CONFETTI_COUNT = 40

interface ConfettiPiece {
  id: number
  color: string
  left: number
  delay: number
  duration: number
  rotation: number
  drift: number
  size: number
  shape: "rect" | "circle"
}

function generateConfetti(): ConfettiPiece[] {
  return Array.from({ length: CONFETTI_COUNT }, (_, i) => ({
    id: i,
    color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    left: Math.random() * 100,
    delay: Math.random() * 0.6,
    duration: 2 + Math.random() * 2,
    rotation: Math.random() * 720 - 360,
    drift: Math.random() * 120 - 60,
    size: 6 + Math.random() * 6,
    shape: Math.random() > 0.5 ? "rect" : "circle",
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

    // C5 (523.25 Hz) then E5 (659.25 Hz) — two quick ascending tones
    playTone(523.25, now, 0.12)
    playTone(659.25, now + 0.08, 0.12)

    // Close the context after the sounds finish
    setTimeout(() => ctx.close(), 500)
  } catch {
    // Web Audio not available — silently skip
  }
}

// ═══ Currency Formatting ═══

function formatCurrency(
  amount: number,
  currencyCode: string = "EUR"
): string {
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
    @keyframes confetti-fall {
      0% {
        transform: translateY(-20px) translateX(0px) rotate(0deg);
        opacity: 1;
      }
      80% {
        opacity: 1;
      }
      100% {
        transform: translateY(100vh) translateX(var(--drift)) rotate(var(--rotation));
        opacity: 0;
      }
    }

    @keyframes banner-slide-down {
      0% {
        transform: translateX(-50%) translateY(-100%);
        opacity: 0;
      }
      100% {
        transform: translateX(-50%) translateY(0);
        opacity: 1;
      }
    }

    @keyframes banner-slide-up {
      0% {
        transform: translateX(-50%) translateY(0);
        opacity: 1;
      }
      100% {
        transform: translateX(-50%) translateY(-100%);
        opacity: 0;
      }
    }
  `
  document.head.appendChild(style)
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

    // Play chime
    if (!soundPlayed.current) {
      playNotificationChime()
      soundPlayed.current = true
    }

    // Auto-dismiss after 5 seconds
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

  // ═══ Styles ═══

  const confettiContainerStyle: React.CSSProperties = {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100vw",
    height: "100vh",
    pointerEvents: "none",
    zIndex: 9998,
    overflow: "hidden",
  }

  const bannerStyle: React.CSSProperties = {
    position: "fixed",
    top: 0,
    left: "50%",
    transform: "translateX(-50%)",
    zIndex: 9999,
    maxWidth: 480,
    width: "90%",
    background: `linear-gradient(135deg, ${colors.accent} 0%, #8B7CF7 100%)`,
    color: "#fff",
    borderRadius: `0 0 ${radii.sm} ${radii.sm}`,
    boxShadow: "0 4px 24px rgba(108,92,231,0.35), 0 1px 6px rgba(0,0,0,0.1)",
    padding: "16px 20px",
    fontFamily: fontStack,
    animation: exiting
      ? "banner-slide-up 0.35s ease-in forwards"
      : "banner-slide-down 0.4s cubic-bezier(0.22,1,0.36,1) forwards",
  }

  const headerRowStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: customerName || formattedTotal ? 6 : 0,
  }

  const titleStyle: React.CSSProperties = {
    fontSize: 15,
    fontWeight: 700,
    fontFamily: fontStack,
    letterSpacing: "-0.01em",
  }

  const subtitleStyle: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 400,
    fontFamily: fontStack,
    opacity: 0.88,
    display: "flex",
    alignItems: "center",
    gap: 8,
  }

  const closeButtonStyle: React.CSSProperties = {
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
  }

  return (
    <>
      {/* Confetti layer */}
      <div style={confettiContainerStyle}>
        {confettiPieces.map((piece) => (
          <div
            key={piece.id}
            style={{
              position: "absolute",
              top: -12,
              left: `${piece.left}%`,
              width: piece.shape === "rect" ? piece.size : piece.size * 0.8,
              height:
                piece.shape === "rect" ? piece.size * 0.6 : piece.size * 0.8,
              backgroundColor: piece.color,
              borderRadius: piece.shape === "circle" ? "50%" : "2px",
              animation: `confetti-fall ${piece.duration}s ease-in ${piece.delay}s forwards`,
              ["--drift" as any]: `${piece.drift}px`,
              ["--rotation" as any]: `${piece.rotation}deg`,
              opacity: 0,
              animationFillMode: "forwards",
            }}
          />
        ))}
      </div>

      {/* Banner */}
      <div style={bannerStyle}>
        <div style={headerRowStyle}>
          <span style={titleStyle}>
            New order received! {"\uD83C\uDF89"} #{order.display_id}
          </span>
          <button
            style={closeButtonStyle}
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
          <div style={subtitleStyle}>
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
    </>
  )
}
