import React, { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { sdk } from "../../lib/sdk"

// ═══════════════════════════════════════════
// DESIGN TOKENS (Linear / Resend / Beehiiv 2025 aesthetic)
// ═══════════════════════════════════════════
export const tokens = {
  // Colors
  bg: "#F9FAFB",
  surface: "#FFFFFF",
  border: "#E4E7EC",
  borderStrong: "#D0D5DD",
  borderSubtle: "#F2F4F7",

  // Text
  fg: "#101828",
  fgSecondary: "#475467",
  fgMuted: "#98A2B3",
  fgLabel: "#344054",
  fgPlaceholder: "#667085",

  // Accent
  primary: "#15803D",
  primaryHover: "#166534",
  primarySoft: "#F0FDF4",

  // Semantic
  success: "#12B76A",
  successSoft: "#ECFDF3",
  successFg: "#067647",
  warning: "#F79009",
  warningSoft: "#FEF0C7",
  warningFg: "#B54708",
  danger: "#D92D20",
  dangerSoft: "#FEE4E2",
  dangerFg: "#B42318",
  info: "#175CD3",
  infoSoft: "#EFF8FF",
  purple: "#6941C6",
  purpleSoft: "#F4F3FF",

  // Shadows
  shadowSm: "0 1px 2px rgba(16,24,40,0.04), 0 1px 3px rgba(16,24,40,0.02)",
  shadowMd: "0 4px 8px rgba(16,24,40,0.06), 0 2px 4px rgba(16,24,40,0.04)",
  shadowLg: "0 20px 40px rgba(16,24,40,0.12)",

  // Radius
  rSm: "6px",
  rMd: "8px",
  rLg: "12px",
  rXl: "16px",

  // Font
  fontFamily: `-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif`,
}

// ═══════════════════════════════════════════
// SHARED PAGE STYLES
// ═══════════════════════════════════════════
export function MarketingPageStyles() {
  return (
    <style>{`
      @keyframes mktFadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes mktPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.55; } }

      .mkt-card {
        transition: box-shadow 150ms ease-out, border-color 150ms ease-out, transform 150ms ease-out;
        border: 1px solid ${tokens.border};
        border-radius: ${tokens.rLg};
        background: ${tokens.surface};
        box-shadow: ${tokens.shadowSm};
      }
      .mkt-card-hover:hover {
        box-shadow: ${tokens.shadowMd};
        border-color: ${tokens.borderStrong};
      }

      .mkt-btn-primary {
        transition: background 150ms ease-out, box-shadow 150ms ease-out, transform 100ms ease-out;
        cursor: pointer;
        background: ${tokens.primary};
        color: #FFFFFF;
        border: none;
        border-radius: ${tokens.rMd};
        padding: 0 14px;
        height: 36px;
        font-size: 13px;
        font-weight: 500;
        font-family: inherit;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        text-decoration: none;
        white-space: nowrap;
      }
      .mkt-btn-primary:hover:not(:disabled) { background: ${tokens.primaryHover}; }
      .mkt-btn-primary:active:not(:disabled) { transform: scale(0.98); }
      .mkt-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

      .mkt-btn {
        transition: background 150ms ease-out, border-color 150ms ease-out, transform 100ms ease-out;
        cursor: pointer;
        background: ${tokens.surface};
        color: ${tokens.fg};
        border: 1px solid ${tokens.borderStrong};
        border-radius: ${tokens.rMd};
        padding: 0 12px;
        height: 36px;
        font-size: 13px;
        font-weight: 500;
        font-family: inherit;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        text-decoration: none;
        white-space: nowrap;
      }
      .mkt-btn:hover:not(:disabled) { background: #F9FAFB; border-color: ${tokens.fgMuted}; }
      .mkt-btn:active:not(:disabled) { transform: scale(0.98); }
      .mkt-btn:disabled { opacity: 0.5; cursor: not-allowed; }

      .mkt-btn-ghost {
        transition: background 150ms ease-out;
        cursor: pointer;
        background: transparent;
        color: ${tokens.fgSecondary};
        border: none;
        border-radius: ${tokens.rMd};
        padding: 0 10px;
        height: 32px;
        font-size: 12px;
        font-weight: 500;
        font-family: inherit;
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }
      .mkt-btn-ghost:hover:not(:disabled) { background: ${tokens.borderSubtle}; color: ${tokens.fg}; }
      .mkt-btn-ghost:disabled { opacity: 0.5; cursor: not-allowed; }

      .mkt-btn-danger-ghost {
        transition: background 150ms ease-out;
        cursor: pointer;
        background: transparent;
        color: ${tokens.dangerFg};
        border: 1px solid transparent;
        border-radius: ${tokens.rMd};
        padding: 0 10px;
        height: 32px;
        font-size: 12px;
        font-weight: 500;
        font-family: inherit;
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }
      .mkt-btn-danger-ghost:hover:not(:disabled) { background: ${tokens.dangerSoft}; }

      .mkt-btn-sm { height: 32px; padding: 0 10px; font-size: 12px; }
      .mkt-btn-xs { height: 28px; padding: 0 8px; font-size: 12px; }

      .mkt-input {
        transition: border-color 150ms ease-out, box-shadow 150ms ease-out;
        width: 100%;
        height: 40px;
        padding: 0 12px;
        border: 1px solid ${tokens.borderStrong};
        border-radius: ${tokens.rMd};
        font-size: 14px;
        color: ${tokens.fg};
        box-sizing: border-box;
        font-family: inherit;
        background: ${tokens.surface};
      }
      .mkt-input::placeholder { color: ${tokens.fgPlaceholder}; }
      .mkt-input:focus {
        border-color: ${tokens.primary} !important;
        box-shadow: 0 0 0 3px rgba(21,128,61,0.14);
        outline: none;
      }
      .mkt-input:disabled { background: ${tokens.borderSubtle}; cursor: not-allowed; color: ${tokens.fgMuted}; }
      textarea.mkt-input { height: auto; padding: 10px 12px; line-height: 1.5; }
      select.mkt-input { appearance: none; background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path d='M1 1l4 4 4-4' stroke='%23667085' stroke-width='1.5' fill='none' stroke-linecap='round'/></svg>"); background-repeat: no-repeat; background-position: right 12px center; padding-right: 32px; }

      .mkt-label {
        display: block;
        font-size: 13px;
        font-weight: 500;
        color: ${tokens.fgLabel};
        margin-bottom: 6px;
      }

      .mkt-toggle { width: 36px; height: 20px; border-radius: 10px; border: none; cursor: pointer; transition: background 150ms ease-out; position: relative; padding: 0; }
      .mkt-toggle::after { content: ''; width: 16px; height: 16px; border-radius: 50%; background: #FFFFFF; position: absolute; top: 2px; transition: left 150ms ease-out; box-shadow: 0 1px 3px rgba(16,24,40,0.15); }
      .mkt-toggle-on { background: ${tokens.primary}; }
      .mkt-toggle-on::after { left: 18px; }
      .mkt-toggle-off { background: ${tokens.borderStrong}; }
      .mkt-toggle-off::after { left: 2px; }

      .mkt-section-enter { animation: mktFadeIn 200ms ease-out; }

      .mkt-table { width: 100%; border-collapse: collapse; font-size: 14px; }
      .mkt-table th {
        text-align: left;
        font-size: 11px;
        color: ${tokens.fgSecondary};
        text-transform: uppercase;
        letter-spacing: 0.04em;
        font-weight: 600;
        padding: 10px 16px;
        background: ${tokens.bg};
        border-bottom: 1px solid ${tokens.border};
      }
      .mkt-table td {
        padding: 14px 16px;
        border-bottom: 1px solid ${tokens.borderSubtle};
        color: ${tokens.fg};
      }
      .mkt-table tr:last-child td { border-bottom: none; }
      .mkt-row { transition: background 120ms ease-out; }
      .mkt-row:hover { background: ${tokens.bg}; }

      .mkt-badge {
        font-size: 11px;
        line-height: 1;
        padding: 4px 8px;
        border-radius: ${tokens.rSm};
        font-weight: 500;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        height: 20px;
        letter-spacing: 0;
        text-transform: none;
      }
      .mkt-badge-pulse { animation: mktPulse 1.4s ease-in-out infinite; }

      .mkt-link { color: ${tokens.primary}; text-decoration: none; cursor: pointer; transition: color 120ms ease-out; }
      .mkt-link:hover { color: ${tokens.primaryHover}; text-decoration: underline; }

      .mkt-muted-link { color: ${tokens.fgSecondary}; text-decoration: none; transition: color 120ms ease-out; }
      .mkt-muted-link:hover { color: ${tokens.fg}; }

      .mkt-modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(16,24,40,0.6);
        backdrop-filter: blur(4px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        animation: mktFadeIn 150ms ease-out;
        padding: 20px;
      }
      .mkt-modal {
        background: ${tokens.surface};
        border-radius: ${tokens.rXl};
        width: 560px;
        max-width: 100%;
        max-height: calc(100vh - 40px);
        overflow: auto;
        box-shadow: ${tokens.shadowLg};
      }
      .mkt-slideover {
        position: fixed;
        top: 0;
        right: 0;
        bottom: 0;
        width: 560px;
        max-width: 92vw;
        background: ${tokens.surface};
        box-shadow: -8px 0 40px rgba(16,24,40,0.18);
        z-index: 9998;
        overflow: auto;
        animation: mktFadeIn 200ms ease-out;
      }

      .mkt-tile {
        transition: box-shadow 150ms ease-out, border-color 150ms ease-out, transform 150ms ease-out;
        display: block;
        border: 1px solid ${tokens.border};
        border-radius: ${tokens.rLg};
        background: ${tokens.surface};
        padding: 20px;
        text-decoration: none;
        color: inherit;
        cursor: pointer;
      }
      .mkt-tile:hover { box-shadow: ${tokens.shadowMd}; border-color: ${tokens.borderStrong}; transform: translateY(-1px); }
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
  const map: Record<string, { bg: string; fg: string; pulse?: boolean }> = {
    draft: { bg: tokens.borderSubtle, fg: tokens.fgSecondary },
    ready: { bg: tokens.infoSoft, fg: tokens.info },
    scheduled: { bg: tokens.infoSoft, fg: tokens.info },
    sending: { bg: tokens.warningSoft, fg: tokens.warningFg, pulse: true },
    sent: { bg: tokens.successSoft, fg: tokens.successFg },
    paused: { bg: tokens.purpleSoft, fg: tokens.purple },
    cancelled: { bg: tokens.dangerSoft, fg: tokens.dangerFg },
    failed: { bg: tokens.dangerSoft, fg: tokens.dangerFg },
    error: { bg: tokens.dangerSoft, fg: tokens.dangerFg },
    live: { bg: tokens.successSoft, fg: tokens.successFg },
    subscribed: { bg: tokens.successSoft, fg: tokens.successFg },
    unsubscribed: { bg: tokens.dangerSoft, fg: tokens.dangerFg },
    unconfirmed: { bg: tokens.warningSoft, fg: tokens.warningFg },
    bounced: { bg: tokens.dangerSoft, fg: tokens.dangerFg },
    active: { bg: tokens.successSoft, fg: tokens.successFg },
    inactive: { bg: tokens.borderSubtle, fg: tokens.fgSecondary },
    published: { bg: tokens.successSoft, fg: tokens.successFg },
    archived: { bg: tokens.bg, fg: tokens.fgPlaceholder },
  }
  const c = map[s] || { bg: tokens.borderSubtle, fg: tokens.fgSecondary }
  const text = (status || "—").replace(/_/g, " ")
  return (
    <span
      className={`mkt-badge${c.pulse ? " mkt-badge-pulse" : ""}`}
      style={{ background: c.bg, color: c.fg }}
    >
      {text}
    </span>
  )
}

// ═══════════════════════════════════════════
// PROJECT BADGE — colored label per project
// ═══════════════════════════════════════════
// Deterministic color per project slug — gives admins fast visual identification
// of which brand a contact belongs to in cross-brand views.
const PROJECT_COLORS: Record<string, { bg: string; fg: string; label: string }> = {
  loslatenboek:   { bg: "#DCFCE7", fg: "#166534", label: "Loslatenboek" },
  "het-leven":    { bg: "#E0F2FE", fg: "#075985", label: "Het Leven" },
  dehondenbijbel: { bg: "#FFEDD5", fg: "#9A3412", label: "De Hondenbijbel" },
  "lass-los":     { bg: "#FEF9C3", fg: "#854D0E", label: "Lass los" },
  "odpusc-ksiazka": { bg: "#FCE7F3", fg: "#9D174D", label: "Odpuść" },
  "slapp-taget":  { bg: "#E0E7FF", fg: "#3730A3", label: "Släpp taget" },
  "psi-superzivot": { bg: "#F3E8FF", fg: "#6B21A8", label: "Psí superživot" },
  "kocici-bible": { bg: "#FCE7F3", fg: "#831843", label: "Kočičí bible" },
}

export function ProjectBadge({ slug, fallbackLabel }: { slug?: string | null; fallbackLabel?: string | null }) {
  if (!slug && !fallbackLabel) return <span style={{ color: tokens.fgMuted }}>—</span>
  const colors = (slug && PROJECT_COLORS[slug]) || { bg: tokens.borderSubtle, fg: tokens.fgSecondary, label: slug || fallbackLabel || "—" }
  return (
    <span
      className="mkt-badge"
      style={{ background: colors.bg, color: colors.fg, fontWeight: 500, whiteSpace: "nowrap" }}
    >
      {colors.label}
    </span>
  )
}

// ═══════════════════════════════════════════
// ORDER STATUS BADGE — Buyer / Non-buyer
// ═══════════════════════════════════════════
export function OrderStatusBadge({ totalOrders }: { totalOrders?: number | null }) {
  const isBuyer = (totalOrders ?? 0) > 0
  return (
    <span
      className="mkt-badge"
      style={{
        background: isBuyer ? tokens.successSoft : tokens.borderSubtle,
        color: isBuyer ? tokens.successFg : tokens.fgSecondary,
        fontWeight: 500,
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        whiteSpace: "nowrap",
      }}
      title={isBuyer ? `${totalOrders} order(s)` : "No orders"}
    >
      <span aria-hidden style={{ fontSize: "10px" }}>{isBuyer ? "●" : "○"}</span>
      {isBuyer ? "Buyer" : "Non-buyer"}
    </span>
  )
}

// ═══════════════════════════════════════════
// FLOW ACTIVITY BADGE — Yes / No
// ═══════════════════════════════════════════
export function FlowActivityBadge({ active }: { active?: boolean | null }) {
  const yes = !!active
  return (
    <span
      className="mkt-badge"
      style={{
        background: yes ? tokens.infoSoft : tokens.borderSubtle,
        color: yes ? tokens.info : tokens.fgSecondary,
        fontWeight: 500,
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        whiteSpace: "nowrap",
      }}
      title={yes ? "In an active flow" : "Not in any flow"}
    >
      <span aria-hidden style={{ fontSize: "10px" }}>{yes ? "▶" : "■"}</span>
      {yes ? "Yes" : "No"}
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
      <span style={{ fontSize: "12px", color: tokens.fgSecondary, fontWeight: 500 }}>Brand</span>
      <select
        className="mkt-input"
        style={{ width: "auto", minWidth: "200px", height: "36px", fontSize: "13px" }}
        value={brandId || ""}
        onChange={(e) => setBrandId(e.target.value || null)}
      >
        <option value="">All brands</option>
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
// TOP NAV (kept for backward-compat; not rendered by MarketingShell anymore)
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
        background: tokens.borderSubtle,
        borderRadius: tokens.rMd,
        marginBottom: "20px",
        flexWrap: "wrap",
      }}
    >
      {NAV_ITEMS.map((item) => {
        const isActive = active === item.href || (item.href !== "/marketing" && active.startsWith(item.href))
        return (
          <Link
            key={item.href}
            to={item.href}
            style={{
              padding: "6px 12px",
              borderRadius: tokens.rSm,
              fontSize: "12px",
              fontWeight: isActive ? 600 : 500,
              color: isActive ? tokens.fg : tokens.fgSecondary,
              background: isActive ? tokens.surface : "transparent",
              boxShadow: isActive ? tokens.shadowSm : "none",
              textDecoration: "none",
            }}
          >
            {item.label}
          </Link>
        )
      })}
    </div>
  )
}

// ═══════════════════════════════════════════
// BREADCRUMBS
// ═══════════════════════════════════════════
export function Breadcrumbs({
  items,
}: {
  items: { label: string; to?: string }[]
}) {
  return (
    <nav
      style={{
        display: "flex",
        alignItems: "center",
        gap: "6px",
        fontSize: "13px",
        color: tokens.fgSecondary,
        marginBottom: "16px",
      }}
    >
      {items.map((item, idx) => {
        const isLast = idx === items.length - 1
        return (
          <React.Fragment key={`${item.label}-${idx}`}>
            {item.to && !isLast ? (
              <Link to={item.to} className="mkt-muted-link" style={{ fontWeight: 500 }}>
                {idx === 0 ? `← ${item.label}` : item.label}
              </Link>
            ) : (
              <span style={{ color: isLast ? tokens.fg : tokens.fgSecondary, fontWeight: isLast ? 500 : 400 }}>
                {item.label}
              </span>
            )}
            {!isLast && <span style={{ color: tokens.fgMuted }}>/</span>}
          </React.Fragment>
        )
      })}
    </nav>
  )
}

// ═══════════════════════════════════════════
// SHELL
// ═══════════════════════════════════════════
export function MarketingShell({
  title,
  subtitle,
  children,
  right,
  breadcrumbs,
  showBrandSwitcher = true,
}: {
  title: string
  subtitle?: string
  /** @deprecated Kept for backward compat; no longer used to render the top nav. */
  active?: string
  children: React.ReactNode
  right?: React.ReactNode
  breadcrumbs?: { label: string; to?: string }[]
  showBrandSwitcher?: boolean
}) {
  return (
    <div
      style={{
        width: "100%",
        maxWidth: "1200px",
        margin: "0 auto",
        padding: "32px 32px 64px",
        fontFamily: tokens.fontFamily,
        color: tokens.fg,
        background: tokens.bg,
        minHeight: "100%",
      }}
    >
      <MarketingPageStyles />
      {breadcrumbs && breadcrumbs.length > 0 && <Breadcrumbs items={breadcrumbs} />}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "16px",
          flexWrap: "wrap",
          marginBottom: "24px",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1
            style={{
              fontSize: "28px",
              fontWeight: 600,
              color: tokens.fg,
              margin: 0,
              letterSpacing: "-0.01em",
              lineHeight: 1.2,
            }}
          >
            {title}
          </h1>
          {subtitle && (
            <p
              style={{
                fontSize: "14px",
                color: tokens.fgSecondary,
                margin: "6px 0 0 0",
                lineHeight: 1.5,
              }}
            >
              {subtitle}
            </p>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          {right}
          {showBrandSwitcher && <BrandSwitcher />}
        </div>
      </div>
      <div
        style={{
          height: "1px",
          background: tokens.borderSubtle,
          marginBottom: "24px",
        }}
      />
      <div className="mkt-section-enter">{children}</div>
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
      <div
        className="mkt-modal"
        style={width ? { width: `${width}px` } : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: "20px 24px",
            borderBottom: `1px solid ${tokens.borderSubtle}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <h2
            style={{
              fontSize: "20px",
              fontWeight: 600,
              margin: 0,
              color: tokens.fg,
              letterSpacing: "-0.01em",
            }}
          >
            {title}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: "transparent",
              border: "none",
              fontSize: "22px",
              lineHeight: 1,
              cursor: "pointer",
              color: tokens.fgSecondary,
              padding: "4px 8px",
              borderRadius: tokens.rSm,
            }}
          >
            ×
          </button>
        </div>
        <div style={{ padding: "24px" }}>{children}</div>
        {footer && (
          <div
            style={{
              padding: "16px 24px",
              borderTop: `1px solid ${tokens.borderSubtle}`,
              display: "flex",
              justifyContent: "flex-end",
              gap: "8px",
              background: tokens.bg,
              borderBottomLeftRadius: tokens.rXl,
              borderBottomRightRadius: tokens.rXl,
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
            padding: "20px 24px",
            borderBottom: `1px solid ${tokens.borderSubtle}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            position: "sticky",
            top: 0,
            background: tokens.surface,
            zIndex: 1,
          }}
        >
          <h2
            style={{
              fontSize: "18px",
              fontWeight: 600,
              margin: 0,
              color: tokens.fg,
              letterSpacing: "-0.01em",
              wordBreak: "break-all",
              paddingRight: "12px",
            }}
          >
            {title}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: "transparent",
              border: "none",
              fontSize: "22px",
              lineHeight: 1,
              cursor: "pointer",
              color: tokens.fgSecondary,
              padding: "4px 8px",
              borderRadius: tokens.rSm,
            }}
          >
            ×
          </button>
        </div>
        <div style={{ padding: "24px" }}>{children}</div>
        {footer && (
          <div
            style={{
              padding: "16px 24px",
              borderTop: `1px solid ${tokens.borderSubtle}`,
              display: "flex",
              justifyContent: "flex-end",
              gap: "8px",
              background: tokens.bg,
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
// EMPTY STATE
// ═══════════════════════════════════════════
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div
      style={{
        padding: "64px 24px",
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "12px",
      }}
    >
      {icon && (
        <div
          style={{
            width: "64px",
            height: "64px",
            borderRadius: tokens.rLg,
            background: tokens.borderSubtle,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "28px",
            color: tokens.fgSecondary,
            marginBottom: "4px",
          }}
        >
          {icon}
        </div>
      )}
      <div
        style={{
          fontSize: "16px",
          fontWeight: 600,
          color: tokens.fg,
          letterSpacing: "-0.005em",
        }}
      >
        {title}
      </div>
      {description && (
        <div
          style={{
            fontSize: "14px",
            color: tokens.fgSecondary,
            maxWidth: "420px",
            lineHeight: 1.5,
          }}
        >
          {description}
        </div>
      )}
      {action && <div style={{ marginTop: "8px" }}>{action}</div>}
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
// LABEL STYLE (kept for backward compat)
// ═══════════════════════════════════════════
export const lblStyle: React.CSSProperties = {
  display: "block",
  fontSize: "13px",
  fontWeight: 500,
  color: tokens.fgLabel,
  marginBottom: "6px",
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
