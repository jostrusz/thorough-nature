import { Modules } from "@medusajs/framework/utils"
import { IOrderModuleService } from "@medusajs/framework/types"
import { SubscriberArgs, SubscriberConfig } from "@medusajs/medusa"

const NTFY_TOPIC = "medusa-ntfy-obj-2026"
const NTFY_URL = `https://ntfy.sh/${NTFY_TOPIC}`

// Project display names
const PROJECT_NAMES: Record<string, string> = {
  odpusc: "Odpuść (PL)",
  "odpusc-ksiazka": "Odpuść (PL)",
  dehondenbijbel: "De Hondenbijbel (NL)",
  slapp: "Släpp taget (SE)",
  "slapp-taget": "Släpp taget (SE)",
  "psi-superzivot": "Psí superživot (CZ)",
  "lass-los": "Lass los (DE/AT)",
}

// Currency symbols
const CURRENCY_SYMBOLS: Record<string, string> = {
  eur: "€",
  pln: "zł",
  sek: "kr",
  czk: "Kč",
  usd: "$",
  gbp: "£",
}

/**
 * Subscriber: order.placed → Push notification via ntfy.sh
 *
 * Sends a celebratory push notification to iOS when a new order is placed.
 */
export default async function orderPlacedNtfyHandler({
  event: { data },
  container,
}: SubscriberArgs<any>) {
  try {
    const orderService: IOrderModuleService = container.resolve(Modules.ORDER)

    const order = await orderService.retrieveOrder(data.id, {
      relations: ["items", "summary", "shipping_address"],
    })

    if (!order) return

    const metadata = (order.metadata || {}) as Record<string, any>
    const projectId = metadata.project_id || "unknown"
    const projectName = PROJECT_NAMES[projectId] || projectId

    // Get order total
    const total = (order.summary as any)?.current_order_total
      || (order.summary as any)?.total
      || 0
    const currency = order.currency_code?.toLowerCase() || "eur"
    const symbol = CURRENCY_SYMBOLS[currency] || currency.toUpperCase()

    // Format amount (divide by 100 if in minor units)
    const amount = total > 1000 ? (total / 100).toFixed(2) : total.toFixed(2)

    // Customer info
    const shipping = order.shipping_address as any
    const customerName = shipping
      ? `${shipping.first_name || ""} ${shipping.last_name || ""}`.trim()
      : order.email || "Unknown"
    const country = shipping?.country_code?.toUpperCase() || ""

    // Item count
    const itemCount = (order.items || []).reduce(
      (sum: number, item: any) => sum + (item.quantity || 1),
      0
    )

    // Build display number
    const displayNumber = (order as any).display_id
      || metadata.custom_order_number
      || order.id.slice(-8)

    // Send ntfy notification (use base64-encoded UTF-8 title to avoid non-ASCII header error)
    const title = `Nova objednavka`
    const body = [
      `${amount} ${symbol} | ${projectName}`,
      `${customerName}${country ? ` (${country})` : ""}`,
    ].join("\n")

    await fetch(NTFY_URL, {
      method: "POST",
      headers: {
        Title: title,
        Priority: "high",
        Tags: "tada,moneybag",
      },
      body,
    })

    console.log(`[ntfy] Notification sent for order ${displayNumber}`)
  } catch (error: any) {
    // Never let notification errors crash the order flow
    console.error("[ntfy] Failed to send notification:", error.message)
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
