"use client"

import Link from "next/link"

function getPaymentBadge(status: string) {
  const map: Record<string, { label: string; className: string }> = {
    paid: {
      label: "Paid",
      className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    },
    captured: {
      label: "Captured",
      className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    },
    pending: {
      label: "Pending",
      className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    },
    authorized: {
      label: "Authorized",
      className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    },
    refunded: {
      label: "Refunded",
      className: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
    },
    partially_refunded: {
      label: "Partial Refund",
      className: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    },
    failed: {
      label: "Failed",
      className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    },
    canceled: {
      label: "Canceled",
      className: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
    },
  }
  return map[status] || { label: status, className: "bg-slate-100 text-slate-600" }
}

function getDeliveryBadge(status: string) {
  const map: Record<string, { label: string; className: string }> = {
    unfulfilled: {
      label: "Unfulfilled",
      className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    },
    fulfilled: {
      label: "Fulfilled",
      className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    },
    DISPATCHED: {
      label: "Dispatched",
      className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    },
    IN_TRANSIT: {
      label: "In Transit",
      className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    },
    DELIVERED: {
      label: "Delivered",
      className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    },
    PACKED: {
      label: "Packed",
      className: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
    },
    PROCESSED: {
      label: "Processed",
      className: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
    },
  }
  return map[status] || { label: status, className: "bg-slate-100 text-slate-600" }
}

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: currency || "CZK",
    maximumFractionDigits: 0,
  }).format(amount / 100)
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("cs-CZ", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date))
}

const countryFlags: Record<string, string> = {
  cz: "🇨🇿",
  sk: "🇸🇰",
  de: "🇩🇪",
  at: "🇦🇹",
  pl: "🇵🇱",
  nl: "🇳🇱",
  be: "🇧🇪",
  hu: "🇭🇺",
  us: "🇺🇸",
  gb: "🇬🇧",
}

export default function OrderCard({
  order,
  countryCode,
}: {
  order: any
  countryCode: string
}) {
  const paymentStatus =
    order.metadata?.payment_status || order.payment_status || "pending"
  const deliveryStatus =
    order.metadata?.dextrum_status ||
    (order.fulfillments?.length ? "fulfilled" : "unfulfilled")
  const payment = getPaymentBadge(paymentStatus)
  const delivery = getDeliveryBadge(deliveryStatus)
  const country =
    order.shipping_address?.country_code?.toLowerCase() || ""
  const flag = countryFlags[country] || ""
  const customerName = order.shipping_address
    ? `${order.shipping_address.first_name || ""} ${order.shipping_address.last_name || ""}`.trim()
    : order.email || "—"

  const orderNumber =
    order.metadata?.custom_order_number || `#${order.display_id}`

  return (
    <Link
      href={`/${countryCode}/admin/orders/${order.id}`}
      className="block border-b border-slate-100 bg-white px-4 py-3 transition-colors active:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:active:bg-slate-800"
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-slate-900 dark:text-white">
              {orderNumber}
            </span>
            {flag && <span className="text-sm">{flag}</span>}
            <span className="text-xs text-slate-400">
              {formatDate(order.created_at)}
            </span>
          </div>
          <p className="mt-0.5 truncate text-sm text-slate-500 dark:text-slate-400">
            {customerName}
          </p>
        </div>
        <span className="ml-2 whitespace-nowrap font-medium text-slate-900 dark:text-white">
          {formatCurrency(order.total, order.currency_code)}
        </span>
      </div>
      <div className="mt-2 flex gap-2">
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${payment.className}`}
        >
          {payment.label}
        </span>
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${delivery.className}`}
        >
          {delivery.label}
        </span>
      </div>
    </Link>
  )
}
