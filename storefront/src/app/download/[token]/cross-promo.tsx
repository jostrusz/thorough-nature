"use client"

import { useState, useCallback } from "react"

const COUPON_CODE = "HETGAATOMJOU"
const PROMO_URL = "https://www.tijdomloslaten.nl"
const BOOK_IMAGE = "/Laat-los-wat-je-kapotmaakt-book-pichi.webp"

// ── Styles ──────────────────────────────────────────────────────────────

const styles = {
  arrow: {
    textAlign: "center" as const,
    marginBottom: "-6px",
    marginTop: "8px",
  },
  arrowLabel: {
    fontSize: "12px",
    fontWeight: 700,
    color: "#C27BA0",
    textTransform: "uppercase" as const,
    letterSpacing: "0.1em",
    margin: "4px 0 12px",
    fontFamily: "'Inter', Arial, sans-serif",
  },
  section: {
    background: "linear-gradient(135deg, #FAF5F8 0%, #F3E8FF 100%)",
    borderRadius: "16px",
    border: "1.5px solid #EDD9E5",
    padding: "28px 24px",
    marginBottom: "24px",
    position: "relative" as const,
    overflow: "hidden" as const,
  },
  eyebrow: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "11px",
    fontWeight: 700,
    letterSpacing: "0.1em",
    textTransform: "uppercase" as const,
    color: "#C27BA0",
    background: "rgba(194,123,160,0.12)",
    padding: "5px 12px",
    borderRadius: "6px",
    marginBottom: "16px",
    fontFamily: "'Inter', Arial, sans-serif",
  },
  body: {
    display: "flex",
    gap: "20px",
    alignItems: "flex-start",
  },
  image: {
    flexShrink: 0,
    width: "110px",
  },
  img: {
    width: "100%",
    height: "auto",
    borderRadius: "8px",
    filter: "drop-shadow(0 6px 20px rgba(45,27,61,0.15))",
  },
  text: {
    flex: 1,
  },
  title: {
    fontSize: "18px",
    fontWeight: 800,
    color: "#2D1B3D",
    lineHeight: "1.25",
    marginBottom: "8px",
    letterSpacing: "-0.02em",
    fontFamily: "'Inter', Arial, sans-serif",
  },
  titleEm: {
    fontStyle: "italic" as const,
    color: "#C27BA0",
  },
  desc: {
    fontSize: "13.5px",
    color: "#5A3D6B",
    lineHeight: "1.65",
    marginBottom: "16px",
    fontFamily: "'Inter', Arial, sans-serif",
  },
  bullet: {
    fontSize: "13px",
    color: "#5A3D6B",
    lineHeight: "1.5",
    padding: "3px 0 3px 22px",
    position: "relative" as const,
    listStyle: "none" as const,
    fontFamily: "'Inter', Arial, sans-serif",
  },
  bulletCheck: {
    position: "absolute" as const,
    left: 0,
    top: "3px",
    color: "#C27BA0",
    fontWeight: 700,
    fontSize: "13px",
  },
  rating: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    marginTop: "0",
    marginBottom: "16px",
    fontSize: "12px",
    color: "#9B7AAD",
    fontFamily: "'Inter', Arial, sans-serif",
  },
  stars: {
    color: "#F59E0B",
    fontSize: "13px",
    letterSpacing: "1px",
  },
  // Coupon
  coupon: {
    border: "2px dashed #C27BA0",
    borderRadius: "12px",
    padding: "16px 20px",
    marginBottom: "18px",
    background: "rgba(194,123,160,0.06)",
    display: "flex",
    alignItems: "center",
    gap: "14px",
    cursor: "pointer",
    transition: "all 0.2s",
    position: "relative" as const,
  },
  couponIcon: {
    fontSize: "28px",
    flexShrink: 0,
  },
  couponBody: {
    flex: 1,
  },
  couponLabel: {
    fontSize: "11px",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase" as const,
    color: "#C27BA0",
    marginBottom: "4px",
    fontFamily: "'Inter', Arial, sans-serif",
  },
  couponCode: {
    fontFamily: "'Courier New', monospace",
    fontSize: "20px",
    fontWeight: 800,
    color: "#2D1B3D",
    letterSpacing: "2px",
  },
  couponHint: {
    fontSize: "11px",
    color: "#9B7AAD",
    marginTop: "3px",
    fontFamily: "'Inter', Arial, sans-serif",
  },
  copyBtn: {
    display: "flex",
    alignItems: "center",
    gap: "5px",
    background: "#C27BA0",
    color: "#fff",
    fontSize: "12px",
    fontWeight: 700,
    padding: "8px 14px",
    borderRadius: "8px",
    flexShrink: 0,
    whiteSpace: "nowrap" as const,
    transition: "background 0.2s",
    border: "none",
    cursor: "pointer",
    fontFamily: "'Inter', Arial, sans-serif",
  },
  copyBtnCopied: {
    background: "#27AE60",
  },
  ctaWrap: {
    textAlign: "center" as const,
  },
  cta: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    background: "linear-gradient(135deg, #2D1B3D, #1A1028)",
    color: "#fff",
    fontSize: "14px",
    fontWeight: 700,
    textDecoration: "none",
    padding: "12px 24px",
    borderRadius: "10px",
    transition: "all 0.2s",
    boxShadow: "0 4px 16px rgba(45,27,61,0.2)",
    fontFamily: "'Inter', Arial, sans-serif",
  },
  // Toast
  toast: {
    position: "fixed" as const,
    top: "24px",
    left: "50%",
    transform: "translateX(-50%) translateY(-20px)",
    background: "#1A1028",
    color: "#fff",
    fontFamily: "'Inter', Arial, sans-serif",
    fontSize: "14px",
    fontWeight: 600,
    padding: "14px 28px",
    borderRadius: "12px",
    boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    zIndex: 9999,
    opacity: 0,
    transition: "opacity 0.3s, transform 0.3s",
    pointerEvents: "none" as const,
  },
  toastShow: {
    opacity: 1,
    transform: "translateX(-50%) translateY(0)",
  },
  toastCheck: {
    width: "28px",
    height: "28px",
    borderRadius: "50%",
    background: "#27AE60",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
}

// ── Icons ───────────────────────────────────────────────────────────────

const CopyIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
)

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

const ArrowIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
  </svg>
)

const ArrowDown = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#C27BA0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5v14" /><path d="m19 12-7 7-7-7" />
  </svg>
)

// ── Component ───────────────────────────────────────────────────────────

export function CrossPromoSection() {
  const [copied, setCopied] = useState(false)
  const [showToast, setShowToast] = useState(false)

  const handleCopy = useCallback(async () => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(COUPON_CODE)
      } else {
        const ta = document.createElement("textarea")
        ta.value = COUPON_CODE
        ta.style.position = "fixed"
        ta.style.opacity = "0"
        document.body.appendChild(ta)
        ta.select()
        document.execCommand("copy")
        document.body.removeChild(ta)
      }
    } catch {
      // Fallback: select the text
    }

    setCopied(true)
    setShowToast(true)

    setTimeout(() => setShowToast(false), 3500)
    setTimeout(() => setCopied(false), 2500)
  }, [])

  return (
    <>
      {/* Toast notification */}
      <div
        style={{
          ...styles.toast,
          ...(showToast ? styles.toastShow : {}),
        }}
      >
        <div style={styles.toastCheck}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <div>
          Kortingscode <span style={{ color: "#C27BA0" }}>{COUPON_CODE}</span> gekopieerd! Plak deze bij je bestelling.
        </div>
      </div>

      {/* Arrow + label */}
      <div style={styles.arrow}>
        <ArrowDown />
        <p style={styles.arrowLabel}>Exclusief voor jou als klant</p>
      </div>

      {/* Promo card */}
      <div style={styles.section}>
        <div style={styles.eyebrow}>
          {"\uD83D\uDC9C"} Beperkte aanbieding — alleen voor jou
        </div>

        <div style={styles.body}>
          <div style={styles.image}>
            <img src={BOOK_IMAGE} alt="Laat Los Wat Je Kapotmaakt — boek" style={styles.img} />
          </div>
          <div style={styles.text}>
            <h3 style={styles.title}>
              Laat Los Wat Je <em style={styles.titleEm}>Kapotmaakt</em>
            </h3>
            <p style={styles.desc}>
              Je geeft alles voor je hond. Maar wie zorgt er voor jou? Dit boek
              helpt je om patronen te doorbreken, los te laten wat je vasthoudt
              en weer rust te vinden — in je hoofd én in huis.
            </p>

            <ul style={{ listStyle: "none", padding: 0, margin: "0 0 16px 0" }}>
              {["Doorbreek negatieve gedachtepatronen", "Leer grenzen stellen zonder schuldgevoel", "Concrete oefeningen uit de praktijk"].map((item) => (
                <li key={item} style={styles.bullet}>
                  <span style={styles.bulletCheck}>✓</span>
                  {item}
                </li>
              ))}
            </ul>

            <div style={styles.rating}>
              <span style={styles.stars}>★★★★★</span>
              <span>4.8/5 — 2.400+ lezers</span>
            </div>
          </div>
        </div>

        {/* Coupon banner */}
        <div
          style={styles.coupon}
          onClick={handleCopy}
          role="button"
          tabIndex={0}
        >
          <div style={styles.couponIcon}>✂️</div>
          <div style={styles.couponBody}>
            <div style={styles.couponLabel}>Jouw kortingscode — 10% korting</div>
            <div style={styles.couponCode}>{COUPON_CODE}</div>
            <div style={styles.couponHint}>Klik om te kopiëren</div>
          </div>
          <button
            style={{
              ...styles.copyBtn,
              ...(copied ? styles.copyBtnCopied : {}),
            }}
            onClick={(e) => {
              e.stopPropagation()
              handleCopy()
            }}
          >
            {copied ? <><CheckIcon /> Gekopieerd!</> : <><CopyIcon /> Kopiëren</>}
          </button>
        </div>

        {/* CTA */}
        <div style={styles.ctaWrap}>
          <a href={PROMO_URL} style={styles.cta} target="_blank" rel="noopener noreferrer">
            Korting verzilveren <ArrowIcon />
          </a>
        </div>
      </div>
    </>
  )
}
