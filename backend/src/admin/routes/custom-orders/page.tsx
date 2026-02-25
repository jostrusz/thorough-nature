import React, { useState, useCallback, useMemo } from "react"
import { defineRouteConfig } from "@medusajs/admin-sdk"
import { ShoppingBag } from "@medusajs/icons"
import { toast } from "@medusajs/ui"
import { StatCards } from "../../components/orders/stat-cards"
import { OrderTabs, TABS } from "../../components/orders/order-tabs"
import { OrdersTable } from "../../components/orders/orders-table"
import { BulkActionsBar } from "../../components/orders/bulk-actions-bar"
import { useOrderStats } from "../../hooks/use-order-stats"
import { useOrdersList } from "../../hooks/use-orders-list"
import { useBulkActions } from "../../hooks/use-bulk-actions"
import { useUpdateMetadata } from "../../hooks/use-update-metadata"

// ═══════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════
const dashboardStyle: React.CSSProperties = {
  maxWidth: "100%",
  margin: "0 auto",
  padding: "24px 32px",
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif",
}

const headerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: "24px",
}

const h1Style: React.CSSProperties = {
  fontSize: "20px",
  fontWeight: 600,
  color: "#1A1A1A",
}

const btnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  padding: "7px 14px",
  borderRadius: "6px",
  fontSize: "13px",
  fontWeight: 500,
  cursor: "pointer",
  border: "1px solid #E1E3E5",
  background: "#FFFFFF",
  color: "#1A1A1A",
  transition: "all 0.15s ease",
  whiteSpace: "nowrap",
}

const btnPrimaryStyle: React.CSSProperties = {
  ...btnStyle,
  background: "#008060",
  color: "#fff",
  borderColor: "#008060",
}

const cardStyle: React.CSSProperties = {
  background: "#FFFFFF",
  border: "1px solid #E1E3E5",
  borderRadius: "10px",
  overflow: "hidden",
}

const toolbarStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  padding: "12px 16px",
  borderBottom: "1px solid #E1E3E5",
}

const searchBoxStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  flex: 1,
  maxWidth: "400px",
  background: "#F6F6F7",
  border: "1px solid #E1E3E5",
  borderRadius: "6px",
  padding: "7px 12px",
  transition: "all 0.2s ease",
}

const searchInputStyle: React.CSSProperties = {
  border: "none",
  background: "transparent",
  outline: "none",
  fontSize: "13px",
  color: "#1A1A1A",
  width: "100%",
}

const paginationStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "12px 16px",
  borderTop: "1px solid #E1E3E5",
  fontSize: "13px",
  color: "#6D7175",
}

const pageBtnStyle: React.CSSProperties = {
  width: "32px",
  height: "32px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  border: "1px solid #E1E3E5",
  borderRadius: "6px",
  background: "#FFFFFF",
  cursor: "pointer",
  transition: "all 0.15s",
  fontSize: "13px",
}

const pageBtnActiveStyle: React.CSSProperties = {
  ...pageBtnStyle,
  background: "#1A1A1A",
  color: "#fff",
  borderColor: "#1A1A1A",
}

// ═══════════════════════════════════════════
// PAGE SIZE
// ═══════════════════════════════════════════
const PAGE_SIZE = 20

// ═══════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════
const CustomOrdersPage = () => {
  // State
  const [activeTab, setActiveTab] = useState("all")
  const [searchValue, setSearchValue] = useState("")
  const [page, setPage] = useState(0)
  const [sortField, setSortField] = useState("created_at")
  const [sortDir, setSortDir] = useState("DESC")
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set())

  // Build query params from active tab
  const activeTabDef = TABS.find((t) => t.id === activeTab)
  const queryParams = useMemo(
    () => ({
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
      q: searchValue || undefined,
      delivery_status: activeTabDef?.deliveryStatus || undefined,
      country: activeTabDef?.country || undefined,
      payment_status: activeTabDef?.paymentStatus || undefined,
      sort_by: sortField,
      sort_dir: sortDir,
    }),
    [page, searchValue, activeTabDef, sortField, sortDir]
  )

  // Data hooks
  const { data: stats, isLoading: statsLoading } = useOrderStats()
  const { data: ordersData, isLoading: ordersLoading } = useOrdersList(queryParams)
  const bulkActions = useBulkActions()
  const updateMetadata = useUpdateMetadata()

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

  const handleMarkFulfilled = useCallback(() => {
    if (selectedOrders.size === 0) return
    bulkActions.mutate(
      {
        action: "update_metadata",
        order_ids: Array.from(selectedOrders),
        payload: { metadata: { baselinker_status: "processing" } },
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

  const handleSendToBaseLinker = useCallback(() => {
    // Placeholder - will be implemented with BaseLinker integration
  }, [])

  const orders = ordersData?.orders || []
  const totalCount = ordersData?.count || 0
  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  return (
    <div style={dashboardStyle}>
      {/* Page Header */}
      <div style={headerStyle}>
        <h1 style={h1Style}>Orders</h1>
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            style={btnStyle}
            onClick={() => {
              bulkActions.mutate(
                {
                  action: "export",
                  order_ids: orders.map((o: any) => o.id),
                },
                {
                  onSuccess: (data: any) => {
                    const blob = new Blob([data.csv], { type: "text/csv" })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement("a")
                    a.href = url
                    a.download = `orders-export-${new Date().toISOString().split("T")[0]}.csv`
                    a.click()
                    URL.revokeObjectURL(url)
                    toast.success(`Exported ${data.count} orders`)
                  },
                }
              )
            }}
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
            Export
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <StatCards
        ordersToday={stats?.ordersToday ?? 0}
        revenueToday={stats?.revenueToday ?? 0}
        ordersYesterday={stats?.ordersYesterday ?? 0}
        revenueYesterday={stats?.revenueYesterday ?? 0}
        unfulfilled={stats?.unfulfilled ?? 0}
        inTransit={stats?.inTransit ?? 0}
        isLoading={statsLoading}
      />

      {/* Main Card */}
      <div style={cardStyle}>
        {/* Tabs */}
        <OrderTabs
          activeTab={activeTab}
          onTabChange={handleTabChange}
          tabCounts={tabCounts}
        />

        {/* Toolbar */}
        <div style={toolbarStyle}>
          <div style={searchBoxStyle}>
            <svg
              width="16"
              height="16"
              viewBox="0 0 20 20"
              fill="none"
              stroke="#8C9196"
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
          onSendToBaseLinker={handleSendToBaseLinker}
          onExport={handleExport}
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
        <div style={paginationStyle}>
          <span>
            {orders.length > 0
              ? `Showing ${page * PAGE_SIZE + 1}-${Math.min(
                  (page + 1) * PAGE_SIZE,
                  totalCount
                )} of ${totalCount} orders`
              : "0 orders"}
          </span>
          <div style={{ display: "flex", gap: "4px" }}>
            <button
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
                  style={page === pageNum ? pageBtnActiveStyle : pageBtnStyle}
                  onClick={() => setPage(pageNum)}
                >
                  {pageNum + 1}
                </button>
              )
            })}
            <button
              style={pageBtnStyle}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
            >
              {"\u203A"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Orders HQ",
  icon: ShoppingBag,
})

export default CustomOrdersPage
