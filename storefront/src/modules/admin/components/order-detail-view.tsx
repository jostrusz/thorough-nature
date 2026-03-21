"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { createFulfillment, cancelOrder } from "@lib/data/admin"

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: currency || "CZK",
    maximumFractionDigits: 2,
  }).format(amount / 100)
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("cs-CZ", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date))
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-white px-4 py-3 dark:bg-slate-900">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
        {title}
      </h3>
      {children}
    </div>
  )
}

function Badge({
  label,
  className,
}: {
  label: string
  className: string
}) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}
    >
      {label}
    </span>
  )
}

export default function OrderDetailView({
  order,
  countryCode,
}: {
  order: any
  countryCode: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [actionMessage, setActionMessage] = useState("")

  const paymentStatus =
    order.metadata?.payment_status || order.payment_status || "pending"
  const deliveryStatus =
    order.metadata?.dextrum_status ||
    (order.fulfillments?.length ? "fulfilled" : "unfulfilled")
  const orderNumber =
    order.metadata?.custom_order_number || `#${order.display_id}`

  const address = order.shipping_address
  const billing = order.billing_address

  const handleFulfill = () => {
    if (!confirm("Create fulfillment for all items?")) return
    startTransition(async () => {
      try {
        const items = order.items.map((item: any) => ({
          id: item.id,
          quantity: item.quantity,
        }))
        await createFulfillment(order.id, { items })
        setActionMessage("Fulfillment created")
        router.refresh()
      } catch (err: any) {
        setActionMessage(`Error: ${err.message}`)
      }
    })
  }

  const handleCancel = () => {
    if (!confirm("Are you sure you want to cancel this order?")) return
    startTransition(async () => {
      try {
        await cancelOrder(order.id)
        setActionMessage("Order canceled")
        router.refresh()
      } catch (err: any) {
        setActionMessage(`Error: ${err.message}`)
      }
    })
  }

  return (
    <div className="space-y-2 pb-20">
      {/* Order summary */}
      <Section title="Order">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-lg font-bold text-slate-900 dark:text-white">
              {orderNumber}
            </p>
            <p className="text-sm text-slate-500">{formatDate(order.created_at)}</p>
          </div>
          <p className="text-lg font-bold text-slate-900 dark:text-white">
            {formatCurrency(order.total, order.currency_code)}
          </p>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <Badge
            label={paymentStatus}
            className={
              paymentStatus === "paid" || paymentStatus === "captured"
                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                : paymentStatus === "pending"
                  ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                  : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
            }
          />
          <Badge
            label={deliveryStatus}
            className={
              deliveryStatus === "fulfilled" || deliveryStatus === "DELIVERED"
                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                : deliveryStatus === "unfulfilled"
                  ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                  : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
            }
          />
        </div>
      </Section>

      {/* Customer */}
      <Section title="Customer">
        {address ? (
          <div className="text-sm text-slate-700 dark:text-slate-300">
            <p className="font-medium">
              {address.first_name} {address.last_name}
            </p>
            <p className="text-slate-500">{order.email}</p>
            {address.phone && (
              <a
                href={`tel:${address.phone}`}
                className="text-blue-600 dark:text-blue-400"
              >
                {address.phone}
              </a>
            )}
          </div>
        ) : (
          <p className="text-sm text-slate-500">{order.email}</p>
        )}
      </Section>

      {/* Shipping address */}
      {address && (
        <Section title="Shipping Address">
          <div className="text-sm text-slate-700 dark:text-slate-300">
            <p>{address.address_1}</p>
            {address.address_2 && <p>{address.address_2}</p>}
            <p>
              {address.postal_code} {address.city}
            </p>
            <p>{address.country_code?.toUpperCase()}</p>
          </div>
        </Section>
      )}

      {/* Items */}
      <Section title={`Items (${order.items?.length || 0})`}>
        <div className="space-y-3">
          {order.items?.map((item: any) => (
            <div
              key={item.id}
              className="flex items-start justify-between"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-900 dark:text-white">
                  {item.title}
                </p>
                {item.variant?.title && item.variant.title !== "Default" && (
                  <p className="text-xs text-slate-500">{item.variant.title}</p>
                )}
                <p className="text-xs text-slate-400">Qty: {item.quantity}</p>
              </div>
              <p className="ml-2 text-sm font-medium text-slate-900 dark:text-white">
                {formatCurrency(
                  item.unit_price * item.quantity,
                  order.currency_code
                )}
              </p>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800">
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Subtotal</span>
            <span className="text-slate-700 dark:text-slate-300">
              {formatCurrency(order.subtotal, order.currency_code)}
            </span>
          </div>
          {order.shipping_total > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Shipping</span>
              <span className="text-slate-700 dark:text-slate-300">
                {formatCurrency(order.shipping_total, order.currency_code)}
              </span>
            </div>
          )}
          {order.tax_total > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Tax</span>
              <span className="text-slate-700 dark:text-slate-300">
                {formatCurrency(order.tax_total, order.currency_code)}
              </span>
            </div>
          )}
          <div className="mt-1 flex justify-between text-sm font-bold">
            <span className="text-slate-900 dark:text-white">Total</span>
            <span className="text-slate-900 dark:text-white">
              {formatCurrency(order.total, order.currency_code)}
            </span>
          </div>
        </div>
      </Section>

      {/* Fulfillments */}
      {order.fulfillments?.length > 0 && (
        <Section title="Fulfillments">
          {order.fulfillments.map((f: any, i: number) => (
            <div key={f.id} className="text-sm text-slate-700 dark:text-slate-300">
              <p className="font-medium">Shipment {i + 1}</p>
              {f.tracking_links?.map((t: any) => (
                <a
                  key={t.tracking_number || t.url}
                  href={t.url || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400"
                >
                  {t.tracking_number || "Track"}
                </a>
              ))}
              <p className="text-xs text-slate-400">
                {formatDate(f.created_at)}
              </p>
            </div>
          ))}
        </Section>
      )}

      {/* Notes */}
      {order.metadata?.internal_note && (
        <Section title="Notes">
          <p className="text-sm text-slate-700 dark:text-slate-300">
            {order.metadata.internal_note}
          </p>
        </Section>
      )}

      {/* Action message */}
      {actionMessage && (
        <div className="mx-4 rounded-lg bg-blue-50 p-3 text-sm text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
          {actionMessage}
        </div>
      )}

      {/* Actions */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-slate-200 bg-white/90 p-4 backdrop-blur-lg dark:border-slate-800 dark:bg-slate-900/90">
        <div className="flex gap-3">
          {deliveryStatus === "unfulfilled" && (
            <button
              onClick={handleFulfill}
              disabled={isPending}
              className="flex-1 rounded-lg bg-blue-600 py-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              {isPending ? "Processing..." : "Fulfill Order"}
            </button>
          )}
          {order.status !== "canceled" && (
            <button
              onClick={handleCancel}
              disabled={isPending}
              className="rounded-lg border border-red-200 px-4 py-3 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
