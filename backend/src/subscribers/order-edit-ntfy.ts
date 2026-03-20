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
  loslatenboek: "Laat los (NL)",
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
 * Subscriber: order-edit.confirmed → Push notification via ntfy.sh
 *
 * Sends a push notification to iOS when an upsell/order edit is confirmed.
 */
export default async function orderEditNtfyHandler({
  event: { data },
  container,
}: SubscriberArgs<any>) {
  try {
    const orderId = data.order_id
    if (!orderId) return

    const orderService: IOrderModuleService = container.resolve(Modules.ORDER)

    const order = await orderService.retrieveOrder(orderId, {
      relations: ["items", "summary", "shipping_address"],
    })

    if (!order) return

    const metadata = (order.metadata || {}) as Record<string, any>
    const projectId = metadata.project_id || "unknown"
    const projectName = PROJECT_NAMES[projectId] || projectId

    // Get order total
    const total = (order.summary as any)?.raw_current_order_total?.value
      || (order.summary as any)?.current_order_total
      || (order.summary as any)?.total
      || 0
    const currency = order.currency_code?.toLowerCase() || "eur"
    const symbol = CURRENCY_SYMBOLS[currency] || currency.toUpperCase()

    // Format amount
    const amount = total > 1000 ? (total / 100).toFixed(2) : total.toFixed(2)

    // Customer info
    const shipping = order.shipping_address as any
    const customerName = shipping
      ? `${shipping.first_name || ""} ${shipping.last_name || ""}`.trim()
      : order.email || "Unknown"

    // Display number
    const displayNumber = metadata.custom_order_number
      || (order as any).display_id
      || order.id.slice(-8)

    const title = `Upsell pridan!`
    const body = [
      `#${displayNumber} | ${amount} ${symbol} | ${projectName}`,
      `${customerName}`,
    ].join("\n")

    await fetch(NTFY_URL, {
      method: "POST",
      headers: {
        Title: title,
        Priority: "high",
        Tags: "rocket,moneybag",
      },
      body,
    })

    console.log(`[ntfy] Upsell notification sent for order ${displayNumber}`)
  } catch (error: any) {
    // Never let notification errors crash the order flow
    console.error("[ntfy] Failed to send upsell notification:", error.message)
  }
}

export const config: SubscriberConfig = {
  event: "order-edit.confirmed",
}
