"use client"

interface Stats {
  ordersToday: number
  revenueToday: number
  ordersYesterday: number
  revenueYesterday: number
  unfulfilled: number
  inTransit: number
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: "CZK",
    maximumFractionDigits: 0,
  }).format(amount / 100)
}

export default function StatsCards({ stats }: { stats: Stats }) {
  return (
    <div className="grid grid-cols-2 gap-3 px-4 py-3">
      <div className="rounded-xl bg-white p-3 shadow-sm dark:bg-slate-800">
        <p className="text-xs text-slate-500 dark:text-slate-400">Today</p>
        <p className="text-xl font-bold text-slate-900 dark:text-white">
          {stats.ordersToday}
        </p>
        <p className="text-xs text-slate-500">
          {formatCurrency(stats.revenueToday)}
        </p>
      </div>
      <div className="rounded-xl bg-white p-3 shadow-sm dark:bg-slate-800">
        <p className="text-xs text-slate-500 dark:text-slate-400">Yesterday</p>
        <p className="text-xl font-bold text-slate-900 dark:text-white">
          {stats.ordersYesterday}
        </p>
        <p className="text-xs text-slate-500">
          {formatCurrency(stats.revenueYesterday)}
        </p>
      </div>
      <div className="rounded-xl bg-amber-50 p-3 shadow-sm dark:bg-amber-900/20">
        <p className="text-xs text-amber-600 dark:text-amber-400">
          Unfulfilled
        </p>
        <p className="text-xl font-bold text-amber-700 dark:text-amber-300">
          {stats.unfulfilled}
        </p>
      </div>
      <div className="rounded-xl bg-blue-50 p-3 shadow-sm dark:bg-blue-900/20">
        <p className="text-xs text-blue-600 dark:text-blue-400">In Transit</p>
        <p className="text-xl font-bold text-blue-700 dark:text-blue-300">
          {stats.inTransit}
        </p>
      </div>
    </div>
  )
}
