// @ts-nocheck
import React, { useState, useRef, useEffect } from "react"
import { sdk } from "../../lib/sdk"
import { colors, radii, shadows, fontStack } from "./design-tokens"

/* ═══════════════════════════════════════════════════════
   AI ORDER CREATOR MODAL
   ═══════════════════════════════════════════════════════ */

interface AiOrderCreatorModalProps {
  open: boolean
  onClose: () => void
  onCreated: () => void
}

// Confidence badge
function Badge({ level }: { level: string }) {
  const cfg = level === "high"
    ? { bg: "#ECFDF5", color: "#059669", label: "high" }
    : level === "medium"
    ? { bg: "#FFF7ED", color: "#D97706", label: "med" }
    : { bg: "#FEF2F2", color: "#DC2626", label: "low" }
  return (
    <span style={{
      fontSize: "10px", fontWeight: 600, padding: "1px 6px",
      borderRadius: "4px", backgroundColor: cfg.bg, color: cfg.color,
      textTransform: "uppercase", letterSpacing: "0.5px",
    }}>{cfg.label}</span>
  )
}

// Section header
function SectionHeader({ icon, label }: { icon: string; label: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "8px",
      fontSize: "11px", fontWeight: 700, color: colors.accent,
      textTransform: "uppercase", letterSpacing: "1px",
      marginTop: "20px", marginBottom: "10px",
    }}>
      <span style={{ fontSize: "14px" }}>{icon}</span>
      {label}
    </div>
  )
}

// Form field
function Field({ label, value, onChange, badge, type = "text", options, disabled, placeholder }: {
  label: string; value: string; onChange: (v: string) => void
  badge?: string; type?: string; options?: { value: string; label: string }[]
  disabled?: boolean; placeholder?: string
}) {
  const inputStyle: React.CSSProperties = {
    flex: 1, padding: "7px 10px", fontSize: "13px", fontFamily: fontStack,
    border: `1px solid ${colors.border}`, borderRadius: radii.xs,
    color: colors.text, background: disabled ? "#F9FAFB" : "#fff",
    outline: "none", transition: "border-color 0.15s",
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
      <label style={{
        width: "90px", fontSize: "12px", fontWeight: 500,
        color: colors.textSec, flexShrink: 0, textAlign: "right",
      }}>{label}</label>
      {options ? (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ ...inputStyle, cursor: "pointer" }}
        >
          <option value="">-- Select --</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder={placeholder}
          style={inputStyle}
          onFocus={(e) => (e.target.style.borderColor = colors.accent)}
          onBlur={(e) => (e.target.style.borderColor = String(colors.border))}
        />
      )}
      {badge && <Badge level={badge} />}
    </div>
  )
}

export function AiOrderCreatorModal({ open, onClose, onCreated }: AiOrderCreatorModalProps) {
  const [step, setStep] = useState<"input" | "review">("input")
  const [inputText, setInputText] = useState("")
  const [analyzing, setAnalyzing] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState("")
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Extracted data
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [address1, setAddress1] = useState("")
  const [address2, setAddress2] = useState("")
  const [city, setCity] = useState("")
  const [postalCode, setPostalCode] = useState("")
  const [countryCode, setCountryCode] = useState("")
  const [projectSlug, setProjectSlug] = useState("")
  const [productId, setProductId] = useState("")
  const [variantId, setVariantId] = useState("")
  const [productTitle, setProductTitle] = useState("")
  const [quantity, setQuantity] = useState("1")
  const [unitPrice, setUnitPrice] = useState("")
  const [currencyCode, setCurrencyCode] = useState("eur")
  const [paymentId, setPaymentId] = useState("")
  const [paymentMethod, setPaymentMethod] = useState("")
  const [paymentStatus, setPaymentStatus] = useState("paid")
  const [notes, setNotes] = useState("")

  // Available options from API
  const [availableProjects, setAvailableProjects] = useState<any[]>([])
  const [availableProducts, setAvailableProducts] = useState<any[]>([])
  const [confidence, setConfidence] = useState<any>({})

  // Reset on open
  useEffect(() => {
    if (open) {
      setStep("input")
      setInputText("")
      setError("")
      setAnalyzing(false)
      setCreating(false)
      setTimeout(() => textareaRef.current?.focus(), 100)
    }
  }, [open])

  // ─── Analyze with AI ───
  const handleAnalyze = async () => {
    if (!inputText.trim()) return
    setAnalyzing(true)
    setError("")

    try {
      const result = await sdk.client.fetch("/admin/custom-orders/ai-extract", {
        method: "POST",
        body: { text: inputText },
      }) as any

      const ext = result.extracted || {}
      setFirstName(ext.first_name || "")
      setLastName(ext.last_name || "")
      setEmail(ext.email || "")
      setPhone(ext.phone || "")
      setAddress1(ext.address_1 || "")
      setAddress2(ext.address_2 || "")
      setCity(ext.city || "")
      setPostalCode(ext.postal_code || "")
      setCountryCode(ext.country_code || "")
      setProjectSlug(ext.project_slug || "")
      setProductId(ext.product_id || "")
      setVariantId(ext.variant_id || "")
      setProductTitle(ext.product_title || "")
      setQuantity(String(ext.quantity || 1))
      setUnitPrice(ext.unit_price != null ? String(ext.unit_price) : "")
      setCurrencyCode(ext.currency_code || "eur")
      setPaymentId(ext.payment_id || "")
      setPaymentMethod(ext.payment_method || "")
      setPaymentStatus(ext.payment_status || "paid")
      setNotes(ext.notes || "")
      setConfidence(result.confidence || {})
      setAvailableProjects(result.availableProjects || [])
      setAvailableProducts(result.availableProducts || [])
      setStep("review")
    } catch (e: any) {
      setError(e.message || "AI analysis failed")
    } finally {
      setAnalyzing(false)
    }
  }

  // ─── Create Order ───
  const handleCreate = async () => {
    setCreating(true)
    setError("")

    try {
      const result = await sdk.client.fetch("/admin/custom-orders/create", {
        method: "POST",
        body: {
          first_name: firstName,
          last_name: lastName,
          email,
          phone,
          address_1: address1,
          address_2: address2,
          city,
          postal_code: postalCode,
          country_code: countryCode,
          project_slug: projectSlug,
          product_id: productId,
          variant_id: variantId,
          product_title: productTitle,
          quantity: Number(quantity),
          unit_price: Number(unitPrice),
          currency_code: currencyCode,
          payment_id: paymentId,
          payment_method: paymentMethod,
          payment_status: paymentStatus,
          notes,
        },
      }) as any

      if (result.success) {
        onCreated()
        onClose()
      } else {
        setError(result.error || "Failed to create order")
      }
    } catch (e: any) {
      setError(e.message || "Failed to create order")
    } finally {
      setCreating(false)
    }
  }

  // ─── Price display ───
  const priceDisplay = unitPrice
    ? `${(Number(unitPrice) / 100).toFixed(2)} ${currencyCode.toUpperCase()}`
    : ""

  // ─── Country options ───
  const countryOptions = [
    { value: "nl", label: "\ud83c\uddf3\ud83c\uddf1 Netherlands" },
    { value: "be", label: "\ud83c\udde7\ud83c\uddea Belgium" },
    { value: "de", label: "\ud83c\udde9\ud83c\uddea Germany" },
    { value: "at", label: "\ud83c\udde6\ud83c\uddf9 Austria" },
    { value: "pl", label: "\ud83c\uddf5\ud83c\uddf1 Poland" },
    { value: "cz", label: "\ud83c\udde8\ud83c\uddff Czech Republic" },
    { value: "se", label: "\ud83c\uddf8\ud83c\uddea Sweden" },
    { value: "gb", label: "\ud83c\uddec\ud83c\udde7 United Kingdom" },
    { value: "fr", label: "\ud83c\uddeb\ud83c\uddf7 France" },
  ]

  if (!open) return null

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)",
        paddingTop: "60px", padding: "60px 24px 40px", overflowY: "auto",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "900px", maxWidth: "calc(100vw - 48px)", maxHeight: "calc(100vh - 100px)",
          flex: "0 0 auto", boxSizing: "border-box",
          background: "#fff", borderRadius: "16px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
          display: "flex", flexDirection: "column",
          animation: "modalSlideIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
          marginBottom: "40px",
        }}
      >
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "18px 24px", borderBottom: `1px solid ${colors.border}`,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{
              width: "32px", height: "32px", borderRadius: "10px",
              background: `linear-gradient(135deg, ${colors.accent}, #A78BFA)`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "16px",
            }}>
              <span style={{ filter: "brightness(10)" }}>&#x2728;</span>
            </div>
            <div>
              <div style={{ fontSize: "15px", fontWeight: 700, color: colors.text }}>
                AI Order Creator
              </div>
              <div style={{ fontSize: "11px", color: colors.textMuted }}>
                Paste any text — AI extracts order details
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: "28px", height: "28px", borderRadius: "8px",
              border: "none", background: "transparent", cursor: "pointer",
              fontSize: "18px", color: colors.textMuted, display: "flex",
              alignItems: "center", justifyContent: "center",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = colors.bgHover }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent" }}
          >
            &times;
          </button>
        </div>

        {/* Body — scrollable */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>

          {/* ─── STEP 1: Input ─── */}
          <div>
            <label style={{
              display: "block", fontSize: "12px", fontWeight: 600,
              color: colors.textSec, marginBottom: "8px",
              textTransform: "uppercase", letterSpacing: "0.5px",
            }}>
              Paste order information
            </label>
            <textarea
              ref={textareaRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={"Paste email conversation, Airwallex payment data,\ncustomer message, or any text with order details...\n\nExample:\nSaskia Meijboom\nSterkenburglaan 31\n3221 BT Hellevoetsluis\n06-20593963\nPayment: int_nlpdh..."}
              style={{
                width: "100%", minHeight: step === "review" ? "80px" : "180px",
                padding: "14px", fontSize: "13px", fontFamily: fontStack,
                border: `1px solid ${colors.border}`, borderRadius: radii.sm,
                color: colors.text, resize: "vertical", outline: "none",
                transition: "all 0.2s", lineHeight: 1.6,
                background: step === "review" ? "#F9FAFB" : "#fff",
              }}
              onFocus={(e) => (e.target.style.borderColor = colors.accent)}
              onBlur={(e) => (e.target.style.borderColor = String(colors.border))}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "10px" }}>
              <button
                onClick={handleAnalyze}
                disabled={analyzing || !inputText.trim()}
                style={{
                  padding: "9px 20px", fontSize: "13px", fontWeight: 600,
                  color: "#fff", border: "none", borderRadius: radii.xs,
                  cursor: analyzing || !inputText.trim() ? "not-allowed" : "pointer",
                  background: analyzing || !inputText.trim()
                    ? colors.textMuted
                    : `linear-gradient(135deg, ${colors.accent}, #A78BFA)`,
                  boxShadow: analyzing || !inputText.trim() ? "none" : shadows.btn,
                  transition: "all 0.2s",
                  display: "flex", alignItems: "center", gap: "8px",
                }}
              >
                {analyzing ? (
                  <>
                    <span style={{
                      width: "14px", height: "14px", border: "2px solid rgba(255,255,255,0.3)",
                      borderTop: "2px solid #fff", borderRadius: "50%",
                      animation: "spin 0.8s linear infinite", display: "inline-block",
                    }} />
                    Analyzing...
                  </>
                ) : step === "review" ? (
                  <><span>&#x1f504;</span> Re-analyze</>
                ) : (
                  <><span>&#x1f9e0;</span> Analyze</>
                )}
              </button>
            </div>
          </div>

          {/* ─── STEP 2: Review ─── */}
          {step === "review" && (
            <div style={{
              marginTop: "16px", paddingTop: "16px",
              borderTop: `1px solid ${colors.border}`,
              animation: "fadeSlideUp 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
            }}>
              <div style={{
                display: "flex", alignItems: "center", gap: "8px",
                marginBottom: "16px",
              }}>
                <span style={{
                  fontSize: "13px", fontWeight: 700, color: colors.green,
                  display: "flex", alignItems: "center", gap: "6px",
                }}>
                  <span>&#x2705;</span> Extracted details — review and edit
                </span>
              </div>

              {/* Product */}
              <SectionHeader icon="&#x1f4e6;" label="Product" />
              <Field
                label="Project"
                value={projectSlug}
                onChange={setProjectSlug}
                badge={confidence.product}
                options={availableProjects.map((p: any) => ({
                  value: p.slug, label: `${p.flag} ${p.name}`,
                }))}
              />
              <Field
                label="Product"
                value={productTitle}
                onChange={setProductTitle}
                badge={confidence.product}
              />
              <Field
                label="Variant"
                value={variantId}
                onChange={setVariantId}
                options={
                  availableProducts
                    .flatMap((p: any) => p.variants || [])
                    .map((v: any) => ({
                      value: v.id,
                      label: `${v.title || v.sku} (${v.price ? (v.price/100).toFixed(2) : "?"} ${v.currency || "EUR"})`,
                    }))
                }
              />
              <div style={{ display: "flex", gap: "8px" }}>
                <div style={{ flex: 1 }}>
                  <Field label="Quantity" value={quantity} onChange={setQuantity} type="number" />
                </div>
                <div style={{ flex: 1 }}>
                  <Field
                    label="Price (cents)"
                    value={unitPrice}
                    onChange={setUnitPrice}
                    type="number"
                    placeholder="e.g. 3500"
                  />
                </div>
              </div>
              {priceDisplay && (
                <div style={{
                  textAlign: "right", fontSize: "12px", color: colors.green,
                  fontWeight: 600, marginTop: "-2px", marginBottom: "4px",
                }}>
                  = {priceDisplay}
                </div>
              )}

              {/* Customer */}
              <SectionHeader icon="&#x1f464;" label="Customer" />
              <div style={{ display: "flex", gap: "8px" }}>
                <div style={{ flex: 1 }}>
                  <Field label="First name" value={firstName} onChange={setFirstName} badge={confidence.name} />
                </div>
                <div style={{ flex: 1 }}>
                  <Field label="Last name" value={lastName} onChange={setLastName} />
                </div>
              </div>
              <Field label="Email" value={email} onChange={setEmail} badge={confidence.email} type="email" />
              <Field label="Phone" value={phone} onChange={setPhone} badge={confidence.phone} />

              {/* Address */}
              <SectionHeader icon="&#x1f4cd;" label="Shipping Address" />
              <Field label="Street" value={address1} onChange={setAddress1} badge={confidence.address} />
              <Field label="Line 2" value={address2} onChange={setAddress2} />
              <div style={{ display: "flex", gap: "8px" }}>
                <div style={{ flex: 2 }}>
                  <Field label="City" value={city} onChange={setCity} />
                </div>
                <div style={{ flex: 1 }}>
                  <Field label="Postal" value={postalCode} onChange={setPostalCode} />
                </div>
              </div>
              <Field
                label="Country"
                value={countryCode}
                onChange={setCountryCode}
                badge={confidence.country}
                options={countryOptions}
              />

              {/* Payment */}
              <SectionHeader icon="&#x1f4b3;" label="Payment" />
              <Field label="Payment ID" value={paymentId} onChange={setPaymentId} badge={confidence.payment} />
              <Field
                label="Method"
                value={paymentMethod}
                onChange={setPaymentMethod}
                options={[
                  { value: "ideal", label: "iDEAL" },
                  { value: "bancontact", label: "Bancontact" },
                  { value: "creditcard", label: "Credit Card" },
                  { value: "klarna", label: "Klarna" },
                  { value: "paypal", label: "PayPal" },
                  { value: "eps", label: "EPS" },
                  { value: "blik", label: "BLIK" },
                  { value: "przelewy24", label: "Przelewy24" },
                  { value: "cod", label: "Cash on Delivery" },
                  { value: "bank_transfer", label: "Bank Transfer" },
                  { value: "other", label: "Other" },
                ]}
              />
              <Field
                label="Status"
                value={paymentStatus}
                onChange={setPaymentStatus}
                options={[
                  { value: "paid", label: "\u2705 Paid" },
                  { value: "pending", label: "\u23f3 Pending" },
                  { value: "unknown", label: "\u2753 Unknown" },
                ]}
              />

              {/* Notes */}
              <SectionHeader icon="&#x1f4dd;" label="Notes" />
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any additional notes..."
                style={{
                  width: "100%", minHeight: "50px", padding: "10px",
                  fontSize: "13px", fontFamily: fontStack,
                  border: `1px solid ${colors.border}`, borderRadius: radii.xs,
                  color: colors.text, resize: "vertical", outline: "none",
                }}
              />
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{
              marginTop: "12px", padding: "10px 14px",
              background: colors.redBg, border: `1px solid ${colors.red}30`,
              borderRadius: radii.xs, fontSize: "13px", color: colors.red,
            }}>
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        {step === "review" && (
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "16px 24px", borderTop: `1px solid ${colors.border}`,
            background: "#FAFBFC",
            borderRadius: "0 0 16px 16px",
          }}>
            <button
              onClick={onClose}
              style={{
                padding: "9px 18px", fontSize: "13px", fontWeight: 500,
                color: colors.textSec, border: `1px solid ${colors.border}`,
                borderRadius: radii.xs, background: "#fff", cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={creating || !firstName || !lastName || !email || !address1}
              style={{
                padding: "9px 24px", fontSize: "13px", fontWeight: 700,
                color: "#fff", border: "none", borderRadius: radii.xs,
                cursor: creating ? "not-allowed" : "pointer",
                background: creating
                  ? colors.textMuted
                  : `linear-gradient(135deg, ${colors.green}, #00D68F)`,
                boxShadow: creating ? "none" : `0 2px 8px ${colors.green}40`,
                transition: "all 0.2s",
                display: "flex", alignItems: "center", gap: "8px",
              }}
            >
              {creating ? (
                <>
                  <span style={{
                    width: "14px", height: "14px", border: "2px solid rgba(255,255,255,0.3)",
                    borderTop: "2px solid #fff", borderRadius: "50%",
                    animation: "spin 0.8s linear infinite", display: "inline-block",
                  }} />
                  Creating...
                </>
              ) : (
                <><span>&#x2705;</span> Create Order</>
              )}
            </button>
          </div>
        )}

        {/* Animations */}
        <style>{`
          @keyframes modalSlideIn {
            from { opacity: 0; transform: translateY(-20px) scale(0.97); }
            to { opacity: 1; transform: translateY(0) scale(1); }
          }
          @keyframes fadeSlideUp {
            from { opacity: 0; transform: translateY(12px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  )
}
