import React, { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { sdk } from "../../lib/sdk"

// ═══════════════════════════════════════════
// SHARED PAGE STYLES
// ═══════════════════════════════════════════
export function MarketingPageStyles() {
  return (
    <style>{`
      @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
      .mkt-card { transition: box-shadow 0.25s ease, border-color 0.25s ease; border: 1px solid #E1E3E5; border-radius: 10px; background: #FFF; }
      .mkt-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.06); border-color: #D2D5D8; }
      .mkt-btn { transition: all 0.15s ease; cursor: pointer; }
      .mkt-btn:hover { background: #F6F6F7 !important; }
      .mkt-btn:active { transform: scale(0.97); }
      .mkt-btn-primary { transition: all 0.15s ease; cursor: pointer; }
      .mkt-btn-primary:hover { filter: brightness(1.1); box-shadow: 0 2px 8px rgba(0,128,96,0.25); }
      .mkt-input { transition: border-color 0.2s, box-shadow 0.2s; width: 100%; padding: 7px 10px; border: 1px solid #E1E3E5; border-radius: 6px; font-size: 13px; box-sizing: border-box; font-family: inherit; background: #FFF; }
      .mkt-input:focus { border-color: #008060 !important; box-shadow: 0 0 0 3px rgba(0,128,96,0.12); outline: none; }
      .mkt-toggle { width: 40px; height: 22px; border-radius: 11px; border: none; cursor: pointer; transition: background 0.2s ease; position: relative; }
      .mkt-toggle::after { content: ''; width: 18px; height: 18px; border-radius: 50%; background: #FFF; position: absolute; top: 2px; transition: left 0.2s ease; box-shadow: 0 1px 3px rgba(0,0,0,0.2); }
      .mkt-toggle-on { background: #008060; }
      .mkt-toggle-on::after { left: 20px; }
      .mkt-toggle-off { background: #C9CCCF; }
      .mkt-toggle-off::after { left: 2px; }
      .mkt-section-enter { animation: fadeIn 0.3s ease; }
      .mkt-row { transition: background 0.12s ease; }
      .mkt-row:hover { background: #F9FAFB; }
      .mkt-table { width: 100%; border-collapse: collapse; font-size: 13px; }
      .mkt-table th { text-align: left; font-size: 11px; color: #6D7175; text-transform: uppercase; font-weight: 600; padding: 10px 12px; border-bottom: 1px solid #E1E3E5; background: #FAFAFA; }
      .mkt-table td { padding: 10px 12px; border-bottom: 1px solid #F1F2F4; }
      .mkt-badge { font-size: 11px; padding: 2px 8px; border-radius: 10px; font-weight: 600; display: inline-block; }
      .mkt-link { color: #008060; text-decoration: none; cursor: pointer; }
      .mkt-link:hover { text-decoration: underline; }
      .mkt-modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.35); display: flex; align-items: center; justify-content: center; z-index: 9999; animation: fadeIn 0.15s ease; }
      .mkt-modal { background: #FFF; border-radius: 10px; width: 560px; max-width: 92vw; max-height: 88vh; overflow: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.25); }
      .mkt-slideover { position: fixed; top: 0; right: 0; bottom: 0; width: 520px; max-width: 92vw; background: #FFF; box-shadow: -8px 0 32px rgba(0,0,0,0.15); z-index: 9998; overflow: auto; animation: fadeIn 0.2s ease; }
    `}</style>
  )
}

// ═══════════════════════════════════════════
// TOGGLE
// ═══════════════════════════════════════════
export function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean
  onChange: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      className={`mkt-toggle ${checked ? "mkt-toggle-on" : "mkt-toggle-off"}`}
      onClick={onChange}
      disabled={disabled}
      style={{ opacity: disabled ? 0.5 : 1 }}
    />
  )
}

// ═══════════════════════════════════════════
// STATUS BADGE
// ═══════════════════════════════════════════
export function StatusBadge({ status }: { status?: string }) {
  const s = (status || "").toLowerCase()
  const map: Record<string, { bg: string; fg: string }> = {
    draft: { bg: "#E4E5E7", fg: "#4A4A4A" },
    ready: { bg: "#DBEAFE", fg: "#1D4ED8" },
    scheduled: { bg: "#FDE68A", fg: "#7A4F01" },
    sending: { bg: "#BFDBFE", fg: "#1E40AF" },
    sent: { bg: "#AEE9D1", fg: "#0D5740" },
    paused: { bg: "#FED7AA", fg: "#9A3412" },
    cancelled: { bg: "#FED3D1", fg: "#9E2B25" },
    live: { bg: "#AEE9D1", fg: "#0D5740" },
    subscribed: { bg: "#AEE9D1", fg: "#0D5740" },
    unsubscribed: { bg: "#FED3D1", fg: "#9E2B25" },
    unconfirmed: { bg: "#FDE68A", fg: "#7A4F01" },
    bounced: { bg: "#FED3D1", fg: "#9E2B25" },
    active: { bg: "#AEE9D1", fg: "#0D5740" },
    inactive: { bg: "#E4E5E7", fg: "#4A4A4A" },
    published: { bg: "#AEE9D1", fg: "#0D5740" },
  }
  const c = map[s] || { bg: "#F0F0F0", fg: "#6D7175" }
  return (
    <span className="mkt-badge" style={{ background: c.bg, color: c.fg }}>
      {(status || "—").toUpperCase()}
    </span>
  )
}

// ═══════════════════════════════════════════
// BRAND CONTEXT (localStorage)
// ═══════════════════════════════════════════
const BRAND_KEY = "mkt_selected_brand"

export function getSelectedBrandId(): string | null {
  try {
    return localStorage.getItem(BRAND_KEY)
  } catch {
    return null
  }
}
export function setSelectedBrandId(id: string | null) {
  try {
    if (id) localStorage.setItem(BRAND_KEY, id)
    else localStorage.removeItem(BRAND_KEY)
    window.dispatchEvent(new Event("mkt-brand-change"))
  } catch {
    /* ignore */
  }
}

export function useSelectedBrand() {
  const [brandId, setBrandIdState] = useState<string | null>(() => getSelectedBrandId())
  useEffect(() => {
    const onChange = () => setBrandIdState(getSelectedBrandId())
    window.addEventListener("mkt-brand-change", onChange)
    window.addEventListener("storage", onChange)
    return () => {
      window.removeEventListener("mkt-brand-change", onChange)
      window.removeEventListener("storage", onChange)
    }
  }, [])
  return {
    brandId,
    setBrandId: (id: string | null) => {
      setSelectedBrandId(id)
      setBrandIdState(id)
    },
  }
}

export function useBrands() {
  return useQuery({
    queryKey: ["mkt-brands"],
    queryFn: () =>
      sdk.client.fetch<{ brands: any[] }>("/admin/marketing/brands", {
        method: "GET",
      }),
  })
}

export function BrandSwitcher() {
  const { data } = useBrands()
  const { brandId, setBrandId } = useSelectedBrand()
  const brands = ((data as any)?.brands || []) as any[]

  useEffect(() => {
    if (!brandId && brands.length > 0) {
      setBrandId(brands[0].id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brands.length])

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <span style={{ fontSize: "12px", color: "#6D7175" }}>Brand:</span>
      <select
        className="mkt-input"
        style={{ width: "auto", minWidth: "180px" }}
        value={brandId || ""}
        onChange={(e) => setBrandId(e.target.value || null)}
      >
        <option value="">— All brands —</option>
        {brands.map((b: any) => (
          <option key={b.id} value={b.id}>
            {b.display_name || b.slug}
          </option>
        ))}
      </select>
    </div>
  )
}

// ═══════════════════════════════════════════
// TOP NAV
// ═══════════════════════════════════════════
const NAV_ITEMS = [
  { label: "Dashboard", href: "/marketing" },
  { label: "Brands", href: "/marketing/brands" },
  { label: "Templates", href: "/marketing/templates" },
  { label: "Campaigns", href: "/marketing/campaigns" },
  { label: "Contacts", href: "/marketing/contacts" },
  { label: "Lists", href: "/marketing/lists" },
  { label: "Segments", href: "/marketing/segments" },
  { label: "Flows", href: "/marketing/flows" },
  { label: "Forms", href: "/marketing/forms" },
  { label: "Analytics", href: "/marketing/analytics" },
]

export function MarketingTopNav({ active }: { active: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "4px",
        padding: "4px",
        background: "#F6F6F7",
        borderRadius: "8px",
        marginBottom: "20px",
        flexWrap: "wrap",
      }}
    >
      {NAV_ITEMS.map((item) => {
        const isActive = active === item.href || (item.href !== "/marketing" && active.startsWith(item.href))
        return (
          <a
            key={item.href}
            href={`#${item.href}`}
            style={{
              padding: "6px 12px",
              borderRadius: "6px",
              fontSize: "12px",
              fontWeight: isActive ? 600 : 500,
              color: isActive ? "#1A1A1A" : "#6D7175",
              background: isActive ? "#FFF" : "transparent",
              boxShadow: isActive ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
              textDecoration: "none",
              cursor: "pointer",
            }}
          >
            {item.label}
          </a>
        )
      })}
    </div>
  )
}

// ═══════════════════════════════════════════
// SHELL
// ═══════════════════════════════════════════
export function MarketingShell({
  title,
  subtitle,
  active,
  children,
  right,
}: {
  title: string
  subtitle?: string
  active: string
  children: React.ReactNode
  right?: React.ReactNode
}) {
  return (
    <div
      style={{
        width: "1100px",
        maxWidth: "calc(100vw - 280px)",
        margin: "0 auto",
        padding: "24px 32px",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif",
      }}
    >
      <MarketingPageStyles />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "16px",
          gap: "12px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1 style={{ fontSize: "20px", fontWeight: 600, color: "#1A1A1A", margin: 0 }}>{title}</h1>
          {subtitle && <p style={{ fontSize: "13px", color: "#6D7175", margin: "4px 0 0 0" }}>{subtitle}</p>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {right}
          <BrandSwitcher />
        </div>
      </div>
      <MarketingTopNav active={active} />
      {children}
    </div>
  )
}

// ═══════════════════════════════════════════
// MODAL
// ═══════════════════════════════════════════
export function Modal({
  title,
  onClose,
  children,
  footer,
  width,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
  footer?: React.ReactNode
  width?: number
}) {
  return (
    <div className="mkt-modal-backdrop" onClick={onClose}>
      <div className="mkt-modal" style={width ? { width: `${width}px` } : undefined} onClick={(e) => e.stopPropagation()}>
        <div
          style={{
            padding: "14px 20px",
            borderBottom: "1px solid #E1E3E5",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <h2 style={{ fontSize: "15px", fontWeight: 600, margin: 0 }}>{title}</h2>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: "20px",
              lineHeight: "20px",
              cursor: "pointer",
              color: "#6D7175",
              padding: "0 4px",
            }}
          >
            ×
          </button>
        </div>
        <div style={{ padding: "16px 20px" }}>{children}</div>
        {footer && (
          <div
            style={{
              padding: "12px 20px",
              borderTop: "1px solid #E1E3E5",
              display: "flex",
              justifyContent: "flex-end",
              gap: "8px",
              background: "#FAFAFA",
              borderBottomLeftRadius: "10px",
              borderBottomRightRadius: "10px",
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

export function SlideOver({
  title,
  onClose,
  children,
  footer,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  return (
    <div className="mkt-modal-backdrop" onClick={onClose}>
      <div className="mkt-slideover" onClick={(e) => e.stopPropagation()}>
        <div
          style={{
            padding: "14px 20px",
            borderBottom: "1px solid #E1E3E5",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            position: "sticky",
            top: 0,
            background: "#FFF",
            zIndex: 1,
          }}
        >
          <h2 style={{ fontSize: "15px", fontWeight: 600, margin: 0 }}>{title}</h2>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: "20px",
              lineHeight: "20px",
              cursor: "pointer",
              color: "#6D7175",
              padding: "0 4px",
            }}
          >
            ×
          </button>
        </div>
        <div style={{ padding: "16px 20px" }}>{children}</div>
        {footer && (
          <div
            style={{
              padding: "12px 20px",
              borderTop: "1px solid #E1E3E5",
              display: "flex",
              justifyContent: "flex-end",
              gap: "8px",
              background: "#FAFAFA",
              position: "sticky",
              bottom: 0,
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════
// PROJECT SLUGS
// ═══════════════════════════════════════════
export const PROJECT_SLUGS = [
  "loslatenboek",
  "dehondenbijbel",
  "lass-los",
  "odpusc-ksiazka",
  "psi-superzivot",
  "slapp-taget",
  "het-leven",
]

// ═══════════════════════════════════════════
// LABEL STYLE
// ═══════════════════════════════════════════
export const lblStyle: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 600,
  color: "#6D7175",
  textTransform: "uppercase",
  marginBottom: "4px",
  display: "block",
}

export function brandQs(brandId: string | null) {
  return brandId ? `?brand_id=${encodeURIComponent(brandId)}` : ""
}

export function fmt(n: any) {
  return typeof n === "number" ? n.toLocaleString() : n ?? "—"
}
export function pct(n: any) {
  return typeof n === "number" ? `${(n * 100).toFixed(1)}%` : "—"
}
