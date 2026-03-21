"use client"

import { useState, useEffect, useCallback, useTransition } from "react"
import { getAdminOrders } from "@lib/data/admin"
import OrderCard from "./order-card"

const FILTERS = [
  { label: "All", value: "" },
  { label: "Unfulfilled", value: "unfulfilled" },
  { label: "In Transit", value: "IN_TRANSIT" },
  { label: "Delivered", value: "DELIVERED" },
]

const PAGE_SIZE = 20

export default function OrdersList({
  initialOrders,
  initialCount,
  countryCode,
}: {
  initialOrders: any[]
  initialCount: number
  countryCode: string
}) {
  const [orders, setOrders] = useState(initialOrders)
  const [count, setCount] = useState(initialCount)
  const [filter, setFilter] = useState("")
  const [search, setSearch] = useState("")
  const [offset, setOffset] = useState(0)
  const [isPending, startTransition] = useTransition()

  const fetchOrders = useCallback(
    (opts: { filter: string; search: string; offset: number }) => {
      startTransition(async () => {
        try {
          const data = await getAdminOrders({
            limit: PAGE_SIZE,
            offset: opts.offset,
            delivery_status: opts.filter || undefined,
            q: opts.search || undefined,
            sort_by: "created_at",
            sort_dir: "DESC",
          })
          setOrders(data.orders)
          setCount(data.filtered_count ?? data.count)
        } catch {
          // keep current state on error
        }
      })
    },
    []
  )

  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchOrders({ filter, search, offset })
    }, 300)
    return () => clearTimeout(timeout)
  }, [filter, search, offset, fetchOrders])

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchOrders({ filter, search, offset })
    }, 30000)
    return () => clearInterval(interval)
  }, [filter, search, offset, fetchOrders])

  const totalPages = Math.ceil(count / PAGE_SIZE)
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1

  return (
    <div>
      {/* Search */}
      <div className="px-4 py-2">
        <input
          type="search"
          placeholder="Search orders..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setOffset(0)
          }}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        />
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 overflow-x-auto px-4 py-2 scrollbar-hide">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => {
              setFilter(f.value)
              setOffset(0)
            }}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === f.value
                ? "bg-blue-600 text-white"
                : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Loading indicator */}
      {isPending && (
        <div className="px-4 py-1">
          <div className="h-0.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div className="h-full w-1/3 animate-pulse rounded-full bg-blue-500" />
          </div>
        </div>
      )}

      {/* Orders */}
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {orders.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-slate-400">
            No orders found
          </div>
        ) : (
          orders.map((order: any) => (
            <OrderCard
              key={order.id}
              order={order}
              countryCode={countryCode}
            />
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 dark:border-slate-800">
          <button
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            disabled={offset === 0}
            className="rounded-lg px-3 py-2 text-sm font-medium text-blue-600 disabled:text-slate-300 dark:text-blue-400 dark:disabled:text-slate-600"
          >
            Previous
          </button>
          <span className="text-xs text-slate-500">
            {currentPage} / {totalPages}
          </span>
          <button
            onClick={() => setOffset(offset + PAGE_SIZE)}
            disabled={currentPage >= totalPages}
            className="rounded-lg px-3 py-2 text-sm font-medium text-blue-600 disabled:text-slate-300 dark:text-blue-400 dark:disabled:text-slate-600"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
