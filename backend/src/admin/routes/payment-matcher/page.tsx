import React, { useState, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { defineRouteConfig } from "@medusajs/admin-sdk"
import { CreditCard } from "@medusajs/icons"
import { sdk } from "../../lib/sdk"

// ═══════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════

function PageStyles() {
  return (
    <style>{`
      @keyframes pmFadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }

      .pm-wrap { max-width: 1500px; margin: 0 auto; padding: 0; }

      /* Header */
      .pm-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
      .pm-header h1 { font-size: 20px; font-weight: 600; color: #1A1A1A; }

      /* Stats */
      .pm-stats { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin-bottom: 20px; }
      .pm-stat { background: #FFF; border: 1px solid #E1E3E5; border-radius: 10px; padding: 14px 16px; animation: pmFadeIn 0.3s ease; }
      .pm-stat-label { font-size: 11px; color: #9CA3AF; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px; }
      .pm-stat-value { font-size: 22px; font-weight: 700; color: #1A1A1A; }
      .pm-stat-sub { font-size: 12px; color: #6B7280; margin-top: 2px; }

      /* Tabs */
      .pm-tabs { display: flex; gap: 0; margin-bottom: 16px; border-bottom: 1px solid #E1E3E5; }
      .pm-tab { padding: 10px 16px; font-size: 13px; font-weight: 500; color: #6B7280; border-bottom: 2px solid transparent; cursor: pointer; transition: all 0.15s; background: none; border-top: none; border-left: none; border-right: none; }
      .pm-tab:hover { color: #374151; }
      .pm-tab.active { color: #4F46E5; border-bottom-color: #4F46E5; font-weight: 600; }
      .pm-tab-count { font-size: 11px; background: #E5E7EB; color: #6B7280; padding: 1px 6px; border-radius: 8px; margin-left: 4px; }
      .pm-tab.active .pm-tab-count { background: #E0E7FF; color: #4338CA; }

      /* Toolbar */
      .pm-toolbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; flex-wrap: wrap; gap: 8px; }
      .pm-filters { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
      .pm-filter-label { font-size: 12px; color: #6B7280; font-weight: 500; }
      .pm-input { font-size: 13px; padding: 6px 10px; border: 1px solid #D1D5DB; border-radius: 6px; background: #FFF; color: #1A1A1A; outline: none; }
      .pm-input:focus { border-color: #6366F1; box-shadow: 0 0 0 2px rgba(99,102,241,0.15); }
      .pm-select { font-size: 13px; padding: 6px 10px; border: 1px solid #D1D5DB; border-radius: 6px; background: #FFF; color: #1A1A1A; outline: none; cursor: pointer; }
      .pm-btn { font-size: 13px; font-weight: 500; padding: 6px 14px; border-radius: 6px; border: 1px solid #D1D5DB; background: #FFF; color: #374151; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; transition: all 0.15s; }
      .pm-btn:hover { background: #F9FAFB; border-color: #9CA3AF; }
      .pm-btn-green { background: #16A34A; color: #FFF; border-color: #16A34A; }
      .pm-btn-green:hover { background: #15803D; }

      /* Table */
      .pm-card { background: #FFF; border: 1px solid #E1E3E5; border-radius: 10px; overflow: hidden; animation: pmFadeIn 0.3s ease; }
      .pm-table-wrap { overflow-x: auto; }
      .pm-table { width: 100%; border-collapse: collapse; font-size: 13px; }
      .pm-table thead th { background: #F8FAFC; padding: 9px 12px; text-align: left; font-weight: 600; font-size: 11px; color: #6B7280; text-transform: uppercase; letter-spacing: 0.4px; border-bottom: 1px solid #E5E7EB; white-space: nowrap; position: sticky; top: 0; }
      .pm-table tbody td { padding: 9px 12px; border-bottom: 1px solid #F3F4F6; vertical-align: middle; }
      .pm-table tbody tr:hover { background: #F9FAFB; }
      .pm-table tbody tr:last-child td { border-bottom: none; }
      .pm-table tbody tr.pm-upsell { background: #FAF5FF; }
      .pm-table tbody tr.pm-upsell:hover { background: #F3E8FF; }
      .pm-table tbody tr.pm-cod { background: #FFFEF5; }
      .pm-table tbody tr.pm-cod:hover { background: #FEFCE8; }

      /* Cell helpers */
      .pm-mono { font-family: 'SF Mono', Monaco, Consolas, monospace; font-size: 12px; }
      .pm-order-num { font-weight: 600; color: #4F46E5; text-decoration: none; cursor: pointer; }
      .pm-order-num:hover { text-decoration: underline; }
      .pm-invoice { font-weight: 500; color: #0D9488; text-decoration: none; cursor: pointer; }
      .pm-invoice:hover { text-decoration: underline; }
      .pm-pid { color: #7C3AED; background: #F5F3FF; padding: 2px 6px; border-radius: 4px; font-size: 11px; display: inline-block; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: default; }
      .pm-pid2 { color: #C026D3; background: #FDF4FF; padding: 2px 6px; border-radius: 4px; font-size: 11px; display: inline-block; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: default; }
      .pm-pid-cod { color: #92400E; background: #FFFBEB; }
      .pm-amount { font-weight: 600; text-align: right; white-space: nowrap; }
      .pm-currency { font-size: 11px; color: #9CA3AF; margin-left: 2px; }

      /* Badges */
      .pm-badge { font-size: 11px; padding: 2px 8px; border-radius: 10px; font-weight: 500; display: inline-block; white-space: nowrap; }
      .pm-badge-ideal { background: #FCE7F3; color: #BE185D; }
      .pm-badge-bancontact { background: #DBEAFE; color: #1D4ED8; }
      .pm-badge-card, .pm-badge-creditcard { background: #F3F4F6; color: #374151; }
      .pm-badge-klarna { background: #FEF3C7; color: #92400E; }
      .pm-badge-paypal { background: #DBEAFE; color: #1E40AF; }
      .pm-badge-cod { background: #FEF9C3; color: #854D0E; }
      .pm-badge-sofort { background: #EDE9FE; color: #6D28D9; }
      .pm-badge-przelewy24, .pm-badge-p24 { background: #FCE7F3; color: #9D174D; }
      .pm-badge-unknown { background: #F3F4F6; color: #6B7280; }

      .pm-status { font-size: 11px; padding: 2px 8px; border-radius: 10px; font-weight: 500; }
      .pm-status-matched { background: #DCFCE7; color: #166534; }
      .pm-status-missing_invoice { background: #FEE2E2; color: #991B1B; }
      .pm-status-missing_payment_id { background: #FEF3C7; color: #854D0E; }

      .pm-tag { font-size: 10px; padding: 1px 6px; border-radius: 8px; font-weight: 600; margin-left: 4px; }
      .pm-tag-upsell { background: #EDE9FE; color: #7C3AED; }
      .pm-tag-cod { background: #FEF9C3; color: #854D0E; }

      /* Footer */
      .pm-footer { padding: 10px 16px; border-top: 1px solid #E5E7EB; display: flex; align-items: center; justify-content: space-between; font-size: 12px; color: #6B7280; }

      /* Customer */
      .pm-customer { font-weight: 500; }
      .pm-customer-email { font-size: 11px; color: #9CA3AF; display: block; }

      /* Loading */
      .pm-loading { padding: 60px; text-align: center; color: #9CA3AF; font-size: 14px; }

      /* Empty */
      .pm-empty { padding: 60px; text-align: center; color: #9CA3AF; }
      .pm-empty-icon { font-size: 36px; margin-bottom: 8px; }

      @media (max-width: 1200px) {
        .pm-stats { grid-template-columns: repeat(3, 1fr); }
      }
    `}</style>
  )
}

// ═══════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════

interface PaymentMatchRow {
  order_id: string
  order_number: string
  display_id: number
  date: string
  customer_name: string
  customer_email: string
  invoice_number: string | null
  fakturoid_invoice_url: string | null
  payment_id_1: string | null
  payment_id_2: string | null
  payment_method: string
  payment_provider: string
  amount_1: number
  amount_2: number | null
  total: number
  currency: string
  is_cod: boolean
  is_upsell: boolean
  status: "matched" | "missing_invoice" | "missing_payment_id"
}

interface PaymentMatchResponse {
  rows: PaymentMatchRow[]
  stats: {
    total_orders: number
    matched: number
    missing_invoice: number
    missing_payment_id: number
    upsell: number
    cod: number
    total_amount_by_currency: Record<string, number>
  }
  count: number
}

// ═══════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════

function formatDate(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`
}

function formatAmount(amount: number): string {
  return amount.toFixed(2).replace(".", ",")
}

function getDefaultFrom(): string {
  const d = new Date()
  d.setDate(1) // First of current month
  return d.toISOString().split("T")[0]
}

function getDefaultTo(): string {
  return new Date().toISOString().split("T")[0]
}

const METHOD_LABELS: Record<string, string> = {
  ideal: "iDEAL",
  bancontact: "Bancontact",
  card: "Karta",
  creditcard: "Karta",
  klarna: "Klarna",
  paypal: "PayPal",
  cod: "Dobírka",
  sofort: "Sofort",
  przelewy24: "Przelewy24",
  p24: "Przelewy24",
  giropay: "Giropay",
  eps: "EPS",
}

const STATUS_LABELS: Record<string, string> = {
  matched: "Spárováno",
  missing_invoice: "Chybí faktura",
  missing_payment_id: "Chybí Payment ID",
}

// ═══════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════

const PaymentMatcherPage = () => {
  const [from, setFrom] = useState(getDefaultFrom())
  const [to, setTo] = useState(getDefaultTo())
  const [tab, setTab] = useState("all")
  const [project, setProject] = useState("")

  // Fetch data
  const { data, isLoading } = useQuery<PaymentMatchResponse>({
    queryKey: ["payment-matching", from, to, project],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (from) params.set("from", from)
      if (to) params.set("to", to)
      if (project) params.set("project", project)
      params.set("limit", "2000")

      const response = await sdk.client.fetch<PaymentMatchResponse>(
        `/admin/custom-orders/payment-matching?${params.toString()}`
      )
      return response
    },
    placeholderData: (prev) => prev,
  })

  const rows = data?.rows || []
  const stats = data?.stats || {
    total_orders: 0, matched: 0, missing_invoice: 0,
    missing_payment_id: 0, upsell: 0, cod: 0,
    total_amount_by_currency: {},
  }

  // Filter by tab
  const filteredRows = useMemo(() => {
    switch (tab) {
      case "upsell": return rows.filter((r) => r.is_upsell)
      case "cod": return rows.filter((r) => r.is_cod)
      case "missing_invoice": return rows.filter((r) => r.status === "missing_invoice")
      case "missing_payment_id": return rows.filter((r) => r.status === "missing_payment_id")
      default: return rows
    }
  }, [rows, tab])

  // Total amounts display
  const totalDisplay = Object.entries(stats.total_amount_by_currency)
    .map(([cur, amt]) => `${formatAmount(amt)} ${cur}`)
    .join(" + ")

  // Export handler
  const handleExport = () => {
    const params = new URLSearchParams()
    if (from) params.set("from", from)
    if (to) params.set("to", to)
    if (project) params.set("project", project)
    window.open(`/admin/custom-orders/payment-matching/export?${params.toString()}`, "_blank")
  }

  return (
    <>
      <PageStyles />
      <div className="pm-wrap">
        {/* Header */}
        <div className="pm-header">
          <h1>Payment Matcher</h1>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="pm-btn pm-btn-green" onClick={handleExport}>
              Export CSV (GPC)
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="pm-stats">
          <div className="pm-stat">
            <div className="pm-stat-label">Objednávky</div>
            <div className="pm-stat-value">{stats.total_orders}</div>
            <div className="pm-stat-sub">{from && to ? `${formatDate(from + "T00:00")} — ${formatDate(to + "T00:00")}` : "Celé období"}</div>
          </div>
          <div className="pm-stat">
            <div className="pm-stat-label">Celkový obrat</div>
            <div className="pm-stat-value" style={{ color: "#16A34A", fontSize: 18 }}>{totalDisplay || "—"}</div>
          </div>
          <div className="pm-stat">
            <div className="pm-stat-label">Spárované</div>
            <div className="pm-stat-value" style={{ color: "#4F46E5" }}>{stats.matched}</div>
            <div className="pm-stat-sub">Faktura + Payment ID</div>
          </div>
          <div className="pm-stat">
            <div className="pm-stat-label">S upsellem</div>
            <div className="pm-stat-value" style={{ color: "#7C3AED" }}>{stats.upsell}</div>
            <div className="pm-stat-sub">2 platby</div>
          </div>
          <div className="pm-stat">
            <div className="pm-stat-label">COD</div>
            <div className="pm-stat-value" style={{ color: "#D97706" }}>{stats.cod}</div>
            <div className="pm-stat-sub">Dobírka</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="pm-tabs">
          <button className={`pm-tab ${tab === "all" ? "active" : ""}`} onClick={() => setTab("all")}>
            Všechny <span className="pm-tab-count">{stats.total_orders}</span>
          </button>
          <button className={`pm-tab ${tab === "upsell" ? "active" : ""}`} onClick={() => setTab("upsell")}>
            S upsellem <span className="pm-tab-count">{stats.upsell}</span>
          </button>
          <button className={`pm-tab ${tab === "cod" ? "active" : ""}`} onClick={() => setTab("cod")}>
            COD <span className="pm-tab-count">{stats.cod}</span>
          </button>
          <button className={`pm-tab ${tab === "missing_invoice" ? "active" : ""}`} onClick={() => setTab("missing_invoice")}>
            Chybí faktura <span className="pm-tab-count">{stats.missing_invoice}</span>
          </button>
          <button className={`pm-tab ${tab === "missing_payment_id" ? "active" : ""}`} onClick={() => setTab("missing_payment_id")}>
            Chybí Payment ID <span className="pm-tab-count">{stats.missing_payment_id}</span>
          </button>
        </div>

        {/* Toolbar */}
        <div className="pm-toolbar">
          <div className="pm-filters">
            <span className="pm-filter-label">Období:</span>
            <input
              type="date"
              className="pm-input"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              style={{ width: 140 }}
            />
            <span style={{ color: "#9CA3AF" }}>—</span>
            <input
              type="date"
              className="pm-input"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              style={{ width: 140 }}
            />
          </div>
        </div>

        {/* Table */}
        <div className="pm-card">
          <div className="pm-table-wrap">
            <table className="pm-table">
              <thead>
                <tr>
                  <th>Objednávka</th>
                  <th>Datum</th>
                  <th>Zákazník</th>
                  <th>Číslo faktury (VS)</th>
                  <th>Payment ID 1</th>
                  <th>Payment ID 2</th>
                  <th>Platební metoda</th>
                  <th style={{ textAlign: "right" }}>Částka</th>
                  <th style={{ textAlign: "right" }}>Celkem</th>
                  <th>Měna</th>
                  <th>Stav</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr><td colSpan={11} className="pm-loading">Načítám data...</td></tr>
                )}
                {!isLoading && filteredRows.length === 0 && (
                  <tr><td colSpan={11} className="pm-empty">
                    <div className="pm-empty-icon">📋</div>
                    Žádné objednávky v tomto období
                  </td></tr>
                )}
                {filteredRows.map((row) => {
                  const rowClass = row.is_upsell && row.is_cod ? "pm-cod" :
                    row.is_upsell ? "pm-upsell" :
                    row.is_cod ? "pm-cod" : ""

                  const methodKey = (row.payment_method || "unknown").toLowerCase()
                  const methodLabel = METHOD_LABELS[methodKey] || row.payment_method || "—"
                  const badgeClass = `pm-badge pm-badge-${methodKey}`

                  return (
                    <tr key={row.order_id} className={rowClass}>
                      <td>
                        <a href={`/app/custom-orders/${row.order_id}`} className="pm-order-num">{row.order_number}</a>
                        {row.is_upsell && <span className="pm-tag pm-tag-upsell">UPSELL</span>}
                        {row.is_cod && <span className="pm-tag pm-tag-cod">COD</span>}
                      </td>
                      <td className="pm-mono">{formatDate(row.date)}</td>
                      <td>
                        <span className="pm-customer">{row.customer_name || "—"}</span>
                        <span className="pm-customer-email">{row.customer_email}</span>
                      </td>
                      <td>
                        {row.invoice_number
                          ? row.fakturoid_invoice_url
                            ? <a href={row.fakturoid_invoice_url} target="_blank" rel="noopener noreferrer" className="pm-invoice pm-mono">{row.invoice_number}</a>
                            : <span className="pm-invoice pm-mono">{row.invoice_number}</span>
                          : <span style={{ color: "#EF4444", fontSize: 12 }}>Chybí</span>
                        }
                      </td>
                      <td>
                        {row.payment_id_1
                          ? <span title={row.payment_id_1} className={`pm-mono ${row.is_cod ? "pm-pid pm-pid-cod" : "pm-pid"}`}>{row.payment_id_1}</span>
                          : <span style={{ color: "#D1D5DB" }}>—</span>
                        }
                      </td>
                      <td>
                        {row.payment_id_2
                          ? <span title={row.payment_id_2} className="pm-pid2 pm-mono">{row.payment_id_2}</span>
                          : row.is_upsell && row.is_cod
                            ? <span style={{ color: "#9CA3AF", fontSize: 11 }}>COD</span>
                            : <span style={{ color: "#D1D5DB" }}>—</span>
                        }
                      </td>
                      <td><span className={badgeClass}>{methodLabel}</span></td>
                      <td className="pm-amount">
                        {formatAmount(row.amount_1)}
                        {row.amount_2 != null && row.amount_2 > 0 && (
                          <span style={{ color: "#7C3AED", marginLeft: 8, fontSize: 12 }}>
                            +{formatAmount(row.amount_2)}
                          </span>
                        )}
                      </td>
                      <td className="pm-amount">
                        {formatAmount(row.total)}
                        <span className="pm-currency">{row.currency}</span>
                      </td>
                      <td>{row.currency}</td>
                      <td>
                        <span className={`pm-status pm-status-${row.status}`}>
                          {STATUS_LABELS[row.status] || row.status}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="pm-footer">
            <span>Zobrazeno {filteredRows.length} objednávek</span>
            <span style={{ fontWeight: 600, color: "#1A1A1A" }}>
              Celkem: {totalDisplay || "—"}
            </span>
          </div>
        </div>
      </div>
    </>
  )
}

export const config = defineRouteConfig({
  label: "Payment Matcher",
  icon: CreditCard,
  rank: 5,
})

export default PaymentMatcherPage
