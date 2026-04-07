import React, { useState, useCallback, useMemo, useRef, useEffect } from "react"

// Debounce hook — delays value updates to avoid excessive API calls
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debouncedValue
}
import { defineRouteConfig } from "@medusajs/admin-sdk"
import { ShoppingBag } from "@medusajs/icons"
import { toast } from "@medusajs/ui"
import { ProfitabilitySection } from "../../components/orders/profitability-section"
import { OrderTabs, TABS } from "../../components/orders/order-tabs"
import { OrdersTable } from "../../components/orders/orders-table"
import { BulkActionsBar } from "../../components/orders/bulk-actions-bar"
import { NewOrderCelebration } from "../../components/orders/new-order-celebration"
// useOrderStats removed — replaced by ProfitabilitySection
import { useOrdersList } from "../../hooks/use-orders-list"
import { useBulkActions } from "../../hooks/use-bulk-actions"
import { useUpdateMetadata } from "../../hooks/use-update-metadata"
import { colors, radii, shadows, fontStack, cardStyle as tokenCardStyle, btnOutline, btnPrimary } from "../../components/orders/design-tokens"
import { AiOrderCreatorModal } from "../../components/orders/ai-order-creator-modal"

// ═══════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════
const BG_COLOR = "#fafafa"

const dashboardStyle: React.CSSProperties = {
  maxWidth: "1600px",
  margin: "0 auto",
  padding: "20px 48px 32px",
  fontFamily: fontStack,
}

/**
 * Hook that walks up the DOM, sets background, and forces width on ancestors.
 * Stops at the layout boundary (sidebar+content flex/grid split) to avoid
 * breaking the Medusa admin sidebar layout.
 */
function useFullPageBackground(ref: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const el = ref.current
    if (!el) return

    const originals: { el: HTMLElement; s: Record<string, string> }[] = []
    let node: HTMLElement | null = el.parentElement

    while (node && node !== document.documentElement) {
      // Check if this element's parent is a multi-child flex/grid container
      // (= the Medusa admin layout split between sidebar and content).
      // If so, expand THIS element but don't go higher — preserve sidebar.
      const parent = node.parentElement
      let isLayoutBoundary = false
      if (parent && parent !== document.documentElement) {
        const parentDisplay = getComputedStyle(parent).display
        if ((parentDisplay === "flex" || parentDisplay === "grid") && parent.children.length > 1) {
          isLayoutBoundary = true
        }
      }

      originals.push({
        el: node,
        s: {
          bg: node.style.background,
          mw: node.style.maxWidth,
          w: node.style.width,
          pl: node.style.paddingLeft,
          pr: node.style.paddingRight,
          flex: node.style.flex,
          minWidth: node.style.minWidth,
        },
      })

      node.style.setProperty("background", BG_COLOR, "important")
      node.style.setProperty("max-width", "none", "important")
      node.style.setProperty("width", "100%", "important")
      node.style.setProperty("padding-left", "0", "important")
      node.style.setProperty("padding-right", "0", "important")
      node.style.setProperty("min-width", "0", "important")

      if (isLayoutBoundary) {
        // Expand content column to fill remaining space, then STOP
        node.style.setProperty("flex", "1 1 0%", "important")
        break
      }

      node = node.parentElement
    }

    return () => {
      originals.forEach(({ el: n, s }) => {
        n.style.background = s.bg
        n.style.maxWidth = s.mw
        n.style.width = s.w
        n.style.paddingLeft = s.pl
        n.style.paddingRight = s.pr
        n.style.flex = s.flex
        n.style.minWidth = s.minWidth
      })
    }
  }, [ref])
}

const headerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: "24px",
}

const h1Style: React.CSSProperties = {
  fontSize: "24px",
  fontWeight: 700,
  letterSpacing: "-0.5px",
  color: colors.text,
  display: "flex",
  alignItems: "center",
  gap: "10px",
}

const countBadgeStyle: React.CSSProperties = {
  background: colors.accentBg,
  color: colors.accent,
  borderRadius: "6px",
  fontSize: "12px",
  fontWeight: 600,
  padding: "2px 8px",
}

const mainCardStyle: React.CSSProperties = {
  background: colors.bgCard,
  border: `1px solid ${colors.border}`,
  borderRadius: radii.card,
  overflow: "hidden",
  boxShadow: shadows.card,
}

const toolbarStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  padding: "12px 20px",
  borderBottom: `1px solid ${colors.border}`,
}

const searchBoxStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  flex: 1,
  background: colors.bg,
  borderRadius: radii.xs,
  padding: "8px 12px",
  border: `1px solid ${colors.border}`,
}

const searchInputStyle: React.CSSProperties = {
  border: "none",
  background: "transparent",
  outline: "none",
  flex: 1,
  fontSize: "13px",
  color: colors.text,
}

const paginationStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "4px",
  padding: "16px 20px",
  borderTop: `1px solid ${colors.border}`,
}

const pageBtnStyle: React.CSSProperties = {
  width: "32px",
  height: "32px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: radii.xs,
  border: `1px solid ${colors.border}`,
  background: colors.bgCard,
  color: colors.textSec,
  fontSize: "13px",
  fontWeight: 500,
  cursor: "pointer",
  transition: "all 0.15s",
}

const pageBtnActiveStyle: React.CSSProperties = {
  ...pageBtnStyle,
  background: colors.accent,
  color: "#fff",
  borderColor: colors.accent,
  fontWeight: 600,
}

const paginationInfoStyle: React.CSSProperties = {
  fontSize: "13px",
  color: colors.textMuted,
}

// ═══════════════════════════════════════════
// DASHBOARD HOVER STYLES
// ═══════════════════════════════════════════
function DashboardStyles() {
  return (
    <style>{`
      /* ═══ FORCE FULL WIDTH on Medusa admin layout containers ═══ */
      /* Nuclear approach: target main and ALL nested divs up to 6 levels deep */
      main,
      main > div,
      main > div > div,
      main > div > div > div,
      main > div > div > div > div,
      main > div > div > div > div > div,
      main > div > div > div > div > div > div {
        max-width: none !important;
        width: 100% !important;
      }
      /* Also override any flex/grid constraints on the content area */
      main > div,
      main > div > div {
        flex: 1 1 100% !important;
        min-width: 0 !important;
      }

      /* Card hover — premium lift + glow */
      .dash-stat-card {
        transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) !important;
      }
      .dash-stat-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 28px rgba(0, 0, 0, 0.07), 0 2px 8px rgba(0, 0, 0, 0.04);
        border-color: rgba(0, 0, 0, 0.12) !important;
      }
      .dash-stat-card:active {
        transform: translateY(0) scale(0.99);
      }

      /* Main table card */
      .dash-main-card {
        transition: box-shadow 0.3s ease !important;
      }

      /* Table row hover */
      .dash-table-row {
        transition: background 0.15s ease !important;
      }
      .dash-table-row:hover {
        background: #F8F9FB !important;
      }

      /* Button hover — premium spring */
      .dash-btn {
        transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1) !important;
        background: linear-gradient(135deg, #FFFFFF 0%, #FAFBFF 100%);
      }
      .dash-btn:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08), 0 0 0 3px rgba(108, 92, 231, 0.08);
        border-color: rgba(108, 92, 231, 0.25) !important;
      }
      .dash-btn:active {
        transform: translateY(1px) scale(0.97);
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
      }

      /* Primary button hover — accent glow */
      .dash-btn-primary {
        transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1) !important;
      }
      .dash-btn-primary:hover {
        transform: translateY(-1px);
        box-shadow: 0 6px 20px rgba(108, 92, 231, 0.35), 0 0 0 3px rgba(108, 92, 231, 0.12);
      }
      .dash-btn-primary:active {
        transform: translateY(1px) scale(0.97);
        box-shadow: 0 1px 4px rgba(108, 92, 231, 0.3);
      }

      /* Search box focus */
      .dash-search {
        transition: all 0.2s ease !important;
      }
      .dash-search:focus-within {
        border-color: rgba(108, 92, 231, 0.35) !important;
        box-shadow: 0 0 0 3px rgba(108, 92, 231, 0.08) !important;
      }

      /* Tab hover */
      .dash-tab {
        transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1) !important;
      }
      .dash-tab:hover {
        background: rgba(0, 0, 0, 0.04) !important;
        transform: translateY(-1px);
      }
      .dash-tab:active {
        transform: scale(0.97);
      }

      /* Pagination button hover */
      .dash-page-btn {
        transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1) !important;
      }
      .dash-page-btn:hover:not(:disabled) {
        background: #F8F9FB !important;
        border-color: rgba(0, 0, 0, 0.14) !important;
        transform: translateY(-1px);
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
      }
      .dash-page-btn:active:not(:disabled) {
        transform: translateY(1px) scale(0.95);
      }

      /* Badge pulse for new items */
      @keyframes subtlePulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.7; }
      }

      /* Smooth page entrance */
      @keyframes dashFadeIn {
        from { opacity: 0; transform: translateY(8px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .dash-animate-in {
        animation: dashFadeIn 0.4s ease;
      }

      /* Hide Medusa admin notification bar / header above the dashboard */
      .dash-animate-in {
        margin-top: -12px;
      }

      /* Responsive: smaller screens get tighter padding */
      @media (max-width: 1400px) {
        .dash-animate-in {
          padding-left: 32px !important;
          padding-right: 32px !important;
        }
      }
      @media (max-width: 1100px) {
        .dash-animate-in {
          padding-left: 20px !important;
          padding-right: 20px !important;
        }
      }
      @media (max-width: 768px) {
        .dash-animate-in {
          padding-left: 12px !important;
          padding-right: 12px !important;
          padding-top: 12px !important;
        }

        /* Header: stack vertically */
        .dash-header-row {
          flex-direction: column !important;
          align-items: flex-start !important;
          gap: 12px !important;
        }
        .dash-header-row h1 {
          font-size: 20px !important;
        }
        .dash-header-buttons {
          width: 100% !important;
        }

        /* Hide button text on small screens, keep icons */
        .dash-btn-text {
          display: none !important;
        }

        /* Search toolbar full width */
        .dash-toolbar {
          padding: 10px 12px !important;
        }
        .dash-search {
          width: 100% !important;
        }

        /* Pagination: simplified on mobile */
        .dash-pagination {
          flex-direction: column !important;
          gap: 10px !important;
          padding: 12px !important;
        }
        .dash-pagination-pages .dash-page-num {
          display: none !important;
        }
        .dash-pagination-pages {
          gap: 8px !important;
        }

        /* Desktop table hidden on mobile */
        .orders-desktop-table {
          display: none !important;
        }

        /* Mobile cards visible on mobile */
        .orders-mobile-cards {
          display: block !important;
        }
      }

      /* Desktop: hide mobile cards, show table */
      @media (min-width: 769px) {
        .orders-mobile-cards {
          display: none !important;
        }
        .orders-desktop-table {
          display: block !important;
        }
      }
    `}</style>
  )
}

// ═══════════════════════════════════════════
// PAGE SIZE
// ═══════════════════════════════════════════
const PAGE_SIZE = 50

// ═══════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════
const CustomOrdersPage = () => {
  const pageRef = useRef<HTMLDivElement>(null)
  useFullPageBackground(pageRef)

  // State
  const [activeTab, setActiveTab] = useState("all")
  const [searchValue, setSearchValue] = useState("")
  const debouncedSearch = useDebounce(searchValue, 400)
  const [page, setPage] = useState(0)
  const [sortField, setSortField] = useState("created_at")
  const [sortDir, setSortDir] = useState("DESC")
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set())
  const [showExportModal, setShowExportModal] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)

  // New order celebration state
  const [celebrationOrder, setCelebrationOrder] = useState<any>(null)
  const lastKnownOrderId = useRef<string | number | null>(null)
  const lastKnownCount = useRef<number | null>(null)
  const isInitialLoad = useRef(true)

  // Build query params from active tab
  const activeTabDef = TABS.find((t) => t.id === activeTab)
  const queryParams = useMemo(
    () => ({
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
      q: debouncedSearch || undefined,
      delivery_status: activeTabDef?.deliveryStatus || undefined,
      country: activeTabDef?.country || undefined,
      payment_status: activeTabDef?.paymentStatus || undefined,
      sort_by: sortField,
      sort_dir: sortDir,
    }),
    [page, debouncedSearch, activeTabDef, sortField, sortDir]
  )

  // Data hooks
  const { data: ordersData, isLoading: ordersLoading } = useOrdersList(queryParams)
  const bulkActions = useBulkActions()
  const updateMetadata = useUpdateMetadata()

  // Detect new orders (from polling) and trigger celebration
  // Only celebrate when count goes UP and newest order ID changes (= real new order)
  // Do NOT celebrate when count goes down (= delete) or stays same (= status update)
  useEffect(() => {
    if (!ordersData?.orders?.length) return

    const newestOrder = ordersData.orders[0]
    const newestId = newestOrder.display_id
    const currentCount = ordersData.count || ordersData.orders.length

    // On first load, just store the ID and count — don't celebrate
    if (isInitialLoad.current) {
      lastKnownOrderId.current = newestId
      lastKnownCount.current = currentCount
      isInitialLoad.current = false
      return
    }

    // Only celebrate if: newest order changed AND total count went UP (new order arrived)
    const countIncreased = lastKnownCount.current !== null && currentCount > lastKnownCount.current
    if (lastKnownOrderId.current !== null && newestId !== lastKnownOrderId.current && countIncreased) {
      setCelebrationOrder({
        display_id: newestOrder.display_id,
        email: newestOrder.email,
        total: newestOrder.total,
        currency_code: newestOrder.currency_code,
        shipping_address: newestOrder.shipping_address,
        metadata: newestOrder.metadata,
      })
    }

    lastKnownOrderId.current = newestId
    lastKnownCount.current = currentCount
  }, [ordersData])

  const handleDismissCelebration = useCallback(() => {
    setCelebrationOrder(null)
  }, [])

  // Tab counts — we compute from a separate "all" query for the count
  // For simplicity, we'll show counts only for the active tab
  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    if (ordersData) {
      counts[activeTab] = ordersData.filtered_count
    }
    return counts
  }, [ordersData, activeTab])

  // Handlers
  const handleTabChange = useCallback((tabId: string) => {
    setActiveTab(tabId)
    setPage(0)
    setSelectedOrders(new Set())
  }, [])

  const handleSort = useCallback(
    (field: string) => {
      if (sortField === field) {
        setSortDir((d) => (d === "DESC" ? "ASC" : "DESC"))
      } else {
        setSortField(field)
        setSortDir("DESC")
      }
    },
    [sortField]
  )

  const handleSearch = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearchValue(e.target.value)
      setPage(0)
    },
    []
  )

  const handleExport = useCallback(() => {
    if (selectedOrders.size === 0) return
    bulkActions.mutate(
      { action: "export", order_ids: Array.from(selectedOrders) },
      {
        onSuccess: (data: any) => {
          // Download CSV
          const blob = new Blob([data.csv], { type: "text/csv" })
          const url = URL.createObjectURL(blob)
          const a = document.createElement("a")
          a.href = url
          a.download = `orders-export-${new Date().toISOString().split("T")[0]}.csv`
          a.click()
          URL.revokeObjectURL(url)
          toast.success(`Exported ${data.count} orders`)
          setSelectedOrders(new Set())
        },
        onError: () => {
          toast.error("Failed to export orders")
        },
      }
    )
  }, [selectedOrders, bulkActions])

  const handleSwedishExport = useCallback(() => {
    if (selectedOrders.size === 0) return
    const selected = orders.filter((o: any) => selectedOrders.has(o.id))
    const header = "Order number;Jméno;Příjmení;Adresa;PSČ;Město"
    const rows = selected.map((o: any) => {
      const orderNum = o.metadata?.custom_order_number || o.display_id || ""
      const firstName = o.shipping_address?.first_name || ""
      const lastName = o.shipping_address?.last_name || ""
      const address = o.shipping_address?.address_1 || ""
      const postalCode = o.shipping_address?.postal_code || ""
      const city = o.shipping_address?.city || ""
      return [orderNum, firstName, lastName, address, postalCode, city].join(";")
    })
    const csv = [header, ...rows].join("\n")
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `swedish-export-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`Swedish export: ${selected.length} orders`)
    setSelectedOrders(new Set())
  }, [selectedOrders, orders])

  const handleMarkFulfilled = useCallback(() => {
    if (selectedOrders.size === 0) return
    bulkActions.mutate(
      {
        action: "update_metadata",
        order_ids: Array.from(selectedOrders),
        payload: { metadata: { dextrum_status: "PROCESSED" } },
      },
      {
        onSuccess: () => {
          toast.success(`${selectedOrders.size} orders marked as processing`)
          setSelectedOrders(new Set())
        },
        onError: () => {
          toast.error("Failed to update orders")
        },
      }
    )
  }, [selectedOrders, bulkActions])

  const handleAddTags = useCallback(() => {
    toast.info("Tag management coming soon")
  }, [])

  const handleSendToDextrum = useCallback(() => {
    toast.info("Use order detail to send individual orders to Dextrum WMS")
  }, [])

  const handleDelete = useCallback(() => {
    if (selectedOrders.size === 0) return
    const confirmed = window.confirm(
      `Opravdu chcete smazat ${selectedOrders.size} objednávek? Tuto akci nelze vrátit zpět.`
    )
    if (!confirmed) return
    bulkActions.mutate(
      {
        action: "delete",
        order_ids: Array.from(selectedOrders),
      },
      {
        onSuccess: (data: any) => {
          toast.success(`Smazáno ${data.count} objednávek`)
          setSelectedOrders(new Set())
        },
        onError: () => {
          toast.error("Nepodařilo se smazat objednávky")
        },
      }
    )
  }, [selectedOrders, bulkActions])

  const orders = ordersData?.orders || []
  const totalCount = ordersData?.count || 0
  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  return (
    <div ref={pageRef} style={dashboardStyle} className="dash-animate-in">
      <DashboardStyles />

      {/* New Order Celebration */}
      <NewOrderCelebration
        order={celebrationOrder}
        onDismiss={handleDismissCelebration}
      />

      {/* Profitability Section */}
      <ProfitabilitySection />

      {/* Page Header — between profitability and orders table */}
      <div className="dash-header-row" style={headerStyle}>
        <h1 style={h1Style}>
          Orders
          <span style={countBadgeStyle}>{totalCount}</span>
        </h1>
        <div className="dash-header-buttons" style={{ display: "flex", gap: "8px" }}>
          <button
            className="dash-btn"
            style={btnOutline}
            onClick={() => setShowExportModal(true)}
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M3 14v3h14v-3M10 3v10M6 9l4 4 4-4" />
            </svg>
            <span className="dash-btn-text">Export</span>
          </button>
          <button
            className="dash-btn"
            style={{
              ...btnOutline,
              opacity: selectedOrders.size === 0 ? 0.5 : 1,
              cursor: selectedOrders.size === 0 ? "not-allowed" : "pointer",
            }}
            onClick={handleSwedishExport}
            disabled={selectedOrders.size === 0}
            title={selectedOrders.size === 0 ? "Select orders first" : `Swedish export ${selectedOrders.size} orders`}
          >
            🇸🇪
            <span className="dash-btn-text">Swedish Export</span>
          </button>
          <button className="dash-btn-primary" style={btnPrimary} onClick={() => setShowCreateModal(true)}>
            <svg
              width="15"
              height="15"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M10 4v12M4 10h12" />
            </svg>
            <span className="dash-btn-text">Create Order</span>
          </button>
        </div>
      </div>

      {/* Main Card */}
      <div className="dash-main-card" style={mainCardStyle}>
        {/* Tabs */}
        <OrderTabs
          activeTab={activeTab}
          onTabChange={handleTabChange}
          tabCounts={tabCounts}
        />

        {/* Toolbar */}
        <div className="dash-toolbar" style={toolbarStyle}>
          <div className="dash-search" style={searchBoxStyle}>
            <svg
              width="16"
              height="16"
              viewBox="0 0 20 20"
              fill="none"
              stroke={colors.textMuted}
              strokeWidth="1.8"
            >
              <circle cx="8.5" cy="8.5" r="5.5" />
              <path d="M13 13l4 4" />
            </svg>
            <input
              type="text"
              placeholder="Search orders, customers, emails..."
              value={searchValue}
              onChange={handleSearch}
              style={searchInputStyle}
            />
          </div>
        </div>

        {/* Bulk Actions Bar */}
        <BulkActionsBar
          selectedCount={selectedOrders.size}
          onMarkFulfilled={handleMarkFulfilled}
          onAddTags={handleAddTags}
          onSendToDextrum={handleSendToDextrum}
          onExport={handleExport}
          onDelete={handleDelete}
        />

        {/* Table */}
        <OrdersTable
          orders={orders}
          isLoading={ordersLoading}
          selectedOrders={selectedOrders}
          onSelectionChange={setSelectedOrders}
          sortField={sortField}
          sortDir={sortDir}
          onSort={handleSort}
        />

        {/* Pagination */}
        <div className="dash-pagination" style={paginationStyle}>
          <span style={paginationInfoStyle}>
            {orders.length > 0
              ? `Showing ${page * PAGE_SIZE + 1}-${Math.min(
                  (page + 1) * PAGE_SIZE,
                  totalCount
                )} of ${totalCount} orders`
              : "0 orders"}
          </span>
          <div className="dash-pagination-pages" style={{ display: "flex", gap: "4px", marginLeft: "16px" }}>
            <button
              className="dash-page-btn"
              style={pageBtnStyle}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              {"\u2039"}
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => {
              const pageNum = i
              return (
                <button
                  key={i}
                  className="dash-page-btn dash-page-num"
                  style={page === pageNum ? pageBtnActiveStyle : pageBtnStyle}
                  onClick={() => setPage(pageNum)}
                >
                  {pageNum + 1}
                </button>
              )
            })}
            <button
              className="dash-page-btn"
              style={pageBtnStyle}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
            >
              {"\u203A"}
            </button>
          </div>
        </div>
      </div>

      {/* Export Modal */}
      {showExportModal && (
        <ExportModal
          bulkActions={bulkActions}
          onClose={() => setShowExportModal(false)}
          currentOrderIds={orders.map((o: any) => o.id)}
        />
      )}

      {/* AI Order Creator Modal */}
      <AiOrderCreatorModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={() => {
          setShowCreateModal(false)
          toast.success("Order created successfully!")
        }}
      />
    </div>
  )
}

function ExportModal({ bulkActions, onClose, currentOrderIds }: {
  bulkActions: any; onClose: () => void; currentOrderIds: string[]
}) {
  const today = new Date().toISOString().split("T")[0]
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0]
  const [dateFrom, setDateFrom] = useState(thirtyDaysAgo)
  const [dateTo, setDateTo] = useState(today)
  const [exporting, setExporting] = useState(false)

  const handleExport = (mode: "date" | "current") => {
    setExporting(true)
    const params: any = { action: "export" }
    if (mode === "date") {
      params.date_from = dateFrom
      params.date_to = dateTo
    } else {
      params.order_ids = currentOrderIds
    }

    bulkActions.mutate(params, {
      onSuccess: (data: any) => {
        const blob = new Blob([data.csv], { type: "text/csv" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `orders-export-${dateFrom}-to-${dateTo}.csv`
        a.click()
        URL.revokeObjectURL(url)
        toast.success(`Exported ${data.count} orders`)
        setExporting(false)
        onClose()
      },
      onError: () => {
        toast.error("Export failed")
        setExporting(false)
      },
    })
  }

  const inputStyle: React.CSSProperties = {
    padding: "8px 12px", fontSize: "13px", border: "1px solid #D1D5DB",
    borderRadius: "8px", outline: "none", fontFamily: fontStack, width: "100%",
    backgroundColor: "#fff",
  }

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center",
      justifyContent: "center", zIndex: 9999,
    }} onClick={onClose}>
      <div style={{
        backgroundColor: "#fff", borderRadius: "12px", padding: "24px",
        width: "500px", maxWidth: "500px", boxSizing: "border-box", boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
      }} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ margin: "0 0 20px", fontSize: "16px", fontWeight: 600, color: "#111827", fontFamily: fontStack }}>
          Export Orders
        </h2>

        <div style={{ marginBottom: "16px" }}>
          <label style={{ fontSize: "12px", fontWeight: 500, color: "#6B7280", display: "block", marginBottom: "6px", fontFamily: fontStack }}>
            From
          </label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={inputStyle} />
        </div>

        <div style={{ marginBottom: "20px" }}>
          <label style={{ fontSize: "12px", fontWeight: 500, color: "#6B7280", display: "block", marginBottom: "6px", fontFamily: fontStack }}>
            To
          </label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={inputStyle} />
        </div>

        <div style={{ display: "flex", gap: "8px" }}>
          <button
            onClick={() => handleExport("date")}
            disabled={exporting}
            style={{
              flex: 1, padding: "10px", fontSize: "13px", fontWeight: 600,
              backgroundColor: "#4F46E5", color: "#fff", border: "none",
              borderRadius: "8px", cursor: exporting ? "not-allowed" : "pointer",
              opacity: exporting ? 0.6 : 1, fontFamily: fontStack,
            }}
          >
            {exporting ? "Exporting..." : "Export by Date"}
          </button>
          <button
            onClick={() => handleExport("current")}
            disabled={exporting}
            style={{
              flex: 1, padding: "10px", fontSize: "13px", fontWeight: 600,
              backgroundColor: "#fff", color: "#374151", border: "1px solid #D1D5DB",
              borderRadius: "8px", cursor: exporting ? "not-allowed" : "pointer",
              opacity: exporting ? 0.6 : 1, fontFamily: fontStack,
            }}
          >
            Export Current Page
          </button>
        </div>

        <button
          onClick={onClose}
          style={{
            width: "100%", marginTop: "10px", padding: "8px", fontSize: "12px",
            color: "#9CA3AF", backgroundColor: "transparent", border: "none",
            cursor: "pointer", fontFamily: fontStack,
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Orders HQ",
  icon: ShoppingBag,
  rank: 1,
})

export default CustomOrdersPage
