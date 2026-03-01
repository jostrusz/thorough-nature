import React, { useState, useEffect } from "react"
import { toast } from "@medusajs/ui"
import { useUpdateOrderDetails } from "../../hooks/use-order-actions"
import { formatCurrency } from "../../lib/format-currency"
import { colors, shadows, radii, cardStyle, fontStack, btnOutline, btnPrimary } from "./design-tokens"

interface OrderDetailCustomerProps {
  order: any
  orderCount?: number
  totalSpent?: number
}

const FLAGS: Record<string, string> = {
  NL: "\u{1F1F3}\u{1F1F1}",
  BE: "\u{1F1E7}\u{1F1EA}",
  DE: "\u{1F1E9}\u{1F1EA}",
  AT: "\u{1F1E6}\u{1F1F9}",
  PL: "\u{1F1F5}\u{1F1F1}",
  CZ: "\u{1F1E8}\u{1F1FF}",
  SK: "\u{1F1F8}\u{1F1F0}",
  SE: "\u{1F1F8}\u{1F1EA}",
  HU: "\u{1F1ED}\u{1F1FA}",
  LU: "\u{1F1F1}\u{1F1FA}",
  DK: "\u{1F1E9}\u{1F1F0}",
  EE: "\u{1F1EA}\u{1F1EA}",
}

const COUNTRY_NAMES: Record<string, string> = {
  NL: "Netherlands",
  BE: "Belgium",
  DE: "Germany",
  AT: "Austria",
  PL: "Poland",
  CZ: "Czech Republic",
  SK: "Slovakia",
  SE: "Sweden",
  HU: "Hungary",
  LU: "Luxembourg",
  DK: "Denmark",
  EE: "Estonia",
}

const COUNTRY_OPTIONS = Object.entries(COUNTRY_NAMES)
  .map(([code, name]) => ({ code: code.toLowerCase(), name }))
  .sort((a, b) => a.name.localeCompare(b.name))

function buildMapUrl(addr: any): string {
  const parts = [
    addr.address_1,
    addr.address_2,
    addr.postal_code,
    addr.city,
    addr.province,
    COUNTRY_NAMES[addr.country_code?.toUpperCase()] || addr.country_code,
  ].filter(Boolean)
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(parts.join(", "))}`
}

// ═══════════════════════════════════════════
// INLINE INPUT COMPONENT
// ═══════════════════════════════════════════
function InlineInput({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <div style={{ marginBottom: "10px" }}>
      <label
        style={{
          display: "block",
          fontSize: "11px",
          fontWeight: 600,
          color: colors.textSec,
          textTransform: "uppercase",
          letterSpacing: "0.3px",
          marginBottom: "4px",
        }}
      >
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="od-input"
        style={{
          width: "100%",
          padding: "7px 10px",
          border: `1px solid ${colors.border}`,
          borderRadius: radii.xs,
          fontSize: "13px",
          color: colors.text,
          outline: "none",
          boxSizing: "border-box",
          fontFamily: fontStack,
          transition: "border-color 0.2s, box-shadow 0.2s",
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = colors.accent
          e.currentTarget.style.boxShadow = "0 0 0 3px rgba(108,92,231,0.12)"
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = colors.border
          e.currentTarget.style.boxShadow = "none"
        }}
      />
    </div>
  )
}

function InlineSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { code: string; name: string }[]
}) {
  return (
    <div style={{ marginBottom: "10px" }}>
      <label
        style={{
          display: "block",
          fontSize: "11px",
          fontWeight: 600,
          color: colors.textSec,
          textTransform: "uppercase",
          letterSpacing: "0.3px",
          marginBottom: "4px",
        }}
      >
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="od-input"
        style={{
          width: "100%",
          padding: "7px 10px",
          border: `1px solid ${colors.border}`,
          borderRadius: radii.xs,
          fontSize: "13px",
          color: colors.text,
          outline: "none",
          boxSizing: "border-box",
          fontFamily: fontStack,
          background: colors.bgCard,
          transition: "border-color 0.2s, box-shadow 0.2s",
          cursor: "pointer",
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = colors.accent
          e.currentTarget.style.boxShadow = "0 0 0 3px rgba(108,92,231,0.12)"
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = colors.border
          e.currentTarget.style.boxShadow = "none"
        }}
      >
        <option value="">Select country</option>
        {options.map((opt) => (
          <option key={opt.code} value={opt.code}>
            {opt.name}
          </option>
        ))}
      </select>
    </div>
  )
}

// ═══════════════════════════════════════════
// EDIT / SAVE BUTTON BAR
// ═══════════════════════════════════════════
function EditSaveBar({
  editing,
  onEdit,
  onSave,
  onCancel,
  isLoading,
}: {
  editing: boolean
  onEdit: () => void
  onSave: () => void
  onCancel: () => void
  isLoading?: boolean
}) {
  if (editing) {
    return (
      <div style={{ display: "flex", gap: "6px" }}>
        <button
          onClick={onCancel}
          className="od-btn"
          style={{
            padding: "4px 10px",
            borderRadius: radii.xs,
            fontSize: "11px",
            fontWeight: 500,
            cursor: "pointer",
            border: `1px solid ${colors.border}`,
            background: colors.bgCard,
            color: colors.textSec,
            transition: "all 0.15s ease",
          }}
        >
          Cancel
        </button>
        <button
          onClick={onSave}
          disabled={isLoading}
          className="od-btn-primary"
          style={{
            padding: "4px 10px",
            borderRadius: radii.xs,
            fontSize: "11px",
            fontWeight: 500,
            cursor: isLoading ? "default" : "pointer",
            border: `1px solid ${colors.accent}`,
            background: colors.accent,
            color: "#FFFFFF",
            opacity: isLoading ? 0.6 : 1,
            transition: "all 0.15s ease",
          }}
        >
          {isLoading ? "Saving..." : "Save"}
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={onEdit}
      className="od-edit-btn"
      style={{
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: "4px",
        color: colors.textSec,
        display: "flex",
        alignItems: "center",
        borderRadius: "4px",
        transition: "all 0.15s ease",
      }}
      title="Edit"
    >
      <svg
        width="15"
        height="15"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path d="M13.586 3.586a2 2 0 112.828 2.828l-10 10L3 17.5l1.086-3.414 10-10z" />
      </svg>
    </button>
  )
}

// ═══════════════════════════════════════════
// COPY LINE (text + copy icon on hover)
// ═══════════════════════════════════════════
function CopyLine({
  text,
  style: extraStyle,
}: {
  text: string
  style?: React.CSSProperties
}) {
  const [copied, setCopied] = useState(false)
  const [hovered, setHovered] = useState(false)

  function handleCopy(e: React.MouseEvent) {
    e.stopPropagation()
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "6px",
        padding: "1px 0",
        ...extraStyle,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span style={{ flex: 1, minWidth: 0 }}>{text}</span>
      <button
        onClick={handleCopy}
        title={copied ? "Copied!" : "Copy"}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: "2px",
          color: copied ? colors.green : colors.textSec,
          opacity: hovered || copied ? 1 : 0,
          transition: "opacity 0.15s, color 0.15s",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
        }}
      >
        {copied ? (
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 10l3 3 7-7" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="7" y="7" width="10" height="10" rx="2" />
            <path d="M13 7V5a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2" />
          </svg>
        )}
      </button>
    </div>
  )
}

// ═══════════════════════════════════════════
// ADDRESS DISPLAY (read-only)
// ═══════════════════════════════════════════
function AddressDisplay({ addr }: { addr: any }) {
  const countryCode = addr.country_code?.toUpperCase() || ""
  const flag = FLAGS[countryCode] || ""
  const countryName = COUNTRY_NAMES[countryCode] || countryCode
  const mapUrl = buildMapUrl(addr)

  return (
    <div style={{ fontSize: "13px", color: colors.text, lineHeight: 1.5 }}>
      {(addr.first_name || addr.last_name) && (
        <CopyLine text={[addr.first_name, addr.last_name].filter(Boolean).join(" ")} />
      )}
      {addr.company && <CopyLine text={addr.company} style={{ color: colors.textSec }} />}
      {addr.address_1 && <CopyLine text={addr.address_1} />}
      {addr.address_2 && <CopyLine text={addr.address_2} />}
      <CopyLine text={[addr.postal_code, addr.city].filter(Boolean).join(" ")} />
      {addr.province && <CopyLine text={addr.province} />}
      <CopyLine text={`${flag} ${countryName}`} />
      {addr.phone && (
        <CopyLine text={addr.phone} style={{ color: colors.textSec, marginTop: "4px" }} />
      )}
      <a
        href={mapUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="od-link"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "4px",
          fontSize: "12px",
          color: colors.accent,
          textDecoration: "none",
          marginTop: "6px",
          transition: "color 0.15s",
        }}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M10 2C6.69 2 4 4.69 4 8c0 5.25 6 10 6 10s6-4.75 6-10c0-3.31-2.69-6-6-6z" />
          <circle cx="10" cy="8" r="2" />
        </svg>
        View map
      </a>
    </div>
  )
}

// ═══════════════════════════════════════════
// ADDRESS FORM (editable)
// ═══════════════════════════════════════════
function AddressForm({
  addr,
  onChange,
}: {
  addr: Record<string, string>
  onChange: (field: string, value: string) => void
}) {
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
        <InlineInput
          label="First name"
          value={addr.first_name || ""}
          onChange={(v) => onChange("first_name", v)}
        />
        <InlineInput
          label="Last name"
          value={addr.last_name || ""}
          onChange={(v) => onChange("last_name", v)}
        />
      </div>
      <InlineInput
        label="Company"
        value={addr.company || ""}
        onChange={(v) => onChange("company", v)}
        placeholder="Optional"
      />
      <InlineInput
        label="Address"
        value={addr.address_1 || ""}
        onChange={(v) => onChange("address_1", v)}
      />
      <InlineInput
        label="Apartment, suite, etc."
        value={addr.address_2 || ""}
        onChange={(v) => onChange("address_2", v)}
        placeholder="Optional"
      />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
        <InlineInput
          label="Postal code"
          value={addr.postal_code || ""}
          onChange={(v) => onChange("postal_code", v)}
        />
        <InlineInput
          label="City"
          value={addr.city || ""}
          onChange={(v) => onChange("city", v)}
        />
      </div>
      <InlineInput
        label="Province / State"
        value={addr.province || ""}
        onChange={(v) => onChange("province", v)}
        placeholder="Optional"
      />
      <InlineSelect
        label="Country"
        value={addr.country_code || ""}
        options={COUNTRY_OPTIONS}
        onChange={(v) => onChange("country_code", v)}
      />
      <InlineInput
        label="Phone"
        value={addr.phone || ""}
        onChange={(v) => onChange("phone", v)}
        type="tel"
      />
    </>
  )
}

// ═══════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════
export function OrderDetailCustomer({
  order,
  orderCount,
  totalSpent,
}: OrderDetailCustomerProps) {
  const updateOrder = useUpdateOrderDetails()
  const addr = order.shipping_address
  const billing = order.billing_address
  const name = addr
    ? [addr.first_name, addr.last_name].filter(Boolean).join(" ")
    : ""

  // ── Edit states ──
  const [editingContact, setEditingContact] = useState(false)
  const [editingShipping, setEditingShipping] = useState(false)
  const [editingBilling, setEditingBilling] = useState(false)

  // ── Contact form ──
  const [contactEmail, setContactEmail] = useState(order.email || "")
  const [contactPhone, setContactPhone] = useState(addr?.phone || "")

  // ── Shipping address form ──
  const [shippingAddr, setShippingAddr] = useState<Record<string, string>>({})

  // ── Billing address form ──
  const [billingAddr, setBillingAddr] = useState<Record<string, string>>({})

  // Sync form state when order changes
  useEffect(() => {
    setContactEmail(order.email || "")
    setContactPhone(addr?.phone || "")
  }, [order.email, addr?.phone])

  // ── Helpers ──
  function initShippingForm() {
    setShippingAddr({
      first_name: addr?.first_name || "",
      last_name: addr?.last_name || "",
      company: addr?.company || "",
      address_1: addr?.address_1 || "",
      address_2: addr?.address_2 || "",
      postal_code: addr?.postal_code || "",
      city: addr?.city || "",
      province: addr?.province || "",
      country_code: addr?.country_code || "",
      phone: addr?.phone || "",
    })
  }

  function initBillingForm() {
    setBillingAddr({
      first_name: billing?.first_name || "",
      last_name: billing?.last_name || "",
      company: billing?.company || "",
      address_1: billing?.address_1 || "",
      address_2: billing?.address_2 || "",
      postal_code: billing?.postal_code || "",
      city: billing?.city || "",
      province: billing?.province || "",
      country_code: billing?.country_code || "",
      phone: billing?.phone || "",
    })
  }

  // ── Save handlers ──
  function handleSaveContact() {
    updateOrder.mutate(
      {
        orderId: order.id,
        email: contactEmail,
        shipping_address: { ...addr, phone: contactPhone },
      },
      {
        onSuccess: () => {
          toast.success("Contact information updated")
          setEditingContact(false)
        },
        onError: () => toast.error("Failed to update contact info"),
      }
    )
  }

  function handleSaveShipping() {
    updateOrder.mutate(
      {
        orderId: order.id,
        shipping_address: shippingAddr,
      },
      {
        onSuccess: () => {
          toast.success("Shipping address updated")
          setEditingShipping(false)
        },
        onError: () => toast.error("Failed to update shipping address"),
      }
    )
  }

  function handleSaveBilling() {
    updateOrder.mutate(
      {
        orderId: order.id,
        billing_address: billingAddr,
      },
      {
        onSuccess: () => {
          toast.success("Billing address updated")
          setEditingBilling(false)
        },
        onError: () => toast.error("Failed to update billing address"),
      }
    )
  }

  // ── Section label style ──
  const sectionLabel: React.CSSProperties = {
    fontSize: "12px",
    fontWeight: 600,
    color: colors.textSec,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    marginBottom: "6px",
    marginTop: "16px",
  }

  return (
    <div
      className="od-card"
      style={{
        ...cardStyle,
        padding: "16px 20px",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "4px",
        }}
      >
        <span style={{ fontSize: "14px", fontWeight: 600, color: colors.text }}>
          Customer
        </span>
      </div>

      {/* Customer name as link */}
      <div style={{ marginBottom: "2px" }}>
        <a
          href={order.customer_id ? `/app/customers/${order.customer_id}` : "#"}
          className="od-link"
          style={{
            fontSize: "13px",
            fontWeight: 500,
            color: colors.accent,
            textDecoration: "none",
            transition: "color 0.15s",
          }}
        >
          {name || "Unknown customer"}
        </a>
      </div>

      {/* Order count + Total spent */}
      {orderCount !== undefined && (
        <div style={{ fontSize: "12px", color: colors.green, marginBottom: "2px" }}>
          {orderCount} {orderCount === 1 ? "order" : "orders"}
          {totalSpent !== undefined && totalSpent > 0 && (
            <span style={{ color: colors.textSec, marginLeft: "8px" }}>
              {formatCurrency(totalSpent, order.currency_code)} spent
            </span>
          )}
        </div>
      )}

      {/* ═══════════ CONTACT INFORMATION ═══════════ */}
      <div
        style={{
          ...sectionLabel,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span>Contact information</span>
        <EditSaveBar
          editing={editingContact}
          onEdit={() => {
            setContactEmail(order.email || "")
            setContactPhone(addr?.phone || "")
            setEditingContact(true)
          }}
          onSave={handleSaveContact}
          onCancel={() => setEditingContact(false)}
          isLoading={updateOrder.isPending}
        />
      </div>

      {editingContact ? (
        <div>
          <InlineInput
            label="Email"
            value={contactEmail}
            onChange={setContactEmail}
            type="email"
          />
          <InlineInput
            label="Phone"
            value={contactPhone}
            onChange={setContactPhone}
            type="tel"
          />
        </div>
      ) : (
        <>
          {order.email && (
            <div
              style={{
                fontSize: "13px",
                color: colors.accent,
                marginBottom: "2px",
                padding: "2px 0",
              }}
            >
              {order.email}
            </div>
          )}
          <div style={{ fontSize: "13px", color: colors.textSec }}>
            {addr?.phone || "No phone number"}
          </div>
        </>
      )}

      {/* ═══════════ SHIPPING ADDRESS ═══════════ */}
      {addr && (
        <>
          <div
            style={{
              ...sectionLabel,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span>Shipping address</span>
            <EditSaveBar
              editing={editingShipping}
              onEdit={() => {
                initShippingForm()
                setEditingShipping(true)
              }}
              onSave={handleSaveShipping}
              onCancel={() => setEditingShipping(false)}
              isLoading={updateOrder.isPending}
            />
          </div>

          {editingShipping ? (
            <AddressForm
              addr={shippingAddr}
              onChange={(field, value) =>
                setShippingAddr((prev) => ({ ...prev, [field]: value }))
              }
            />
          ) : (
            <AddressDisplay addr={addr} />
          )}
        </>
      )}

      {/* ═══════════ BILLING ADDRESS ═══════════ */}
      {billing && (
        <>
          <div
            style={{
              ...sectionLabel,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span>Billing address</span>
            <EditSaveBar
              editing={editingBilling}
              onEdit={() => {
                initBillingForm()
                setEditingBilling(true)
              }}
              onSave={handleSaveBilling}
              onCancel={() => setEditingBilling(false)}
              isLoading={updateOrder.isPending}
            />
          </div>

          {editingBilling ? (
            <AddressForm
              addr={billingAddr}
              onChange={(field, value) =>
                setBillingAddr((prev) => ({ ...prev, [field]: value }))
              }
            />
          ) : (
            <AddressDisplay addr={billing} />
          )}
        </>
      )}
    </div>
  )
}
