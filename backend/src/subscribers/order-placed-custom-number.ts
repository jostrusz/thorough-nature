import { Modules } from "@medusajs/framework/utils"
import { SubscriberArgs, SubscriberConfig } from "@medusajs/medusa"

/**
 * When an order is placed, generate a custom order number
 * in format: {COUNTRY}{YEAR}-{display_id}
 * e.g., NL2026-1111, BE2026-1112, SE2026-1113
 */
export default async function orderPlacedCustomNumberHandler({
  event: { data },
  container,
}: SubscriberArgs<any>) {
  try {
    const orderModuleService = container.resolve(Modules.ORDER) as any
    const query = container.resolve("query") as any

    const { data: [order] } = await query.graph({
      entity: "order",
      fields: ["id", "display_id", "metadata", "shipping_address.country_code"],
      filters: { id: data.id },
    })

    if (!order) return

    // Skip if custom_order_number already set (e.g., duplicated order)
    if ((order as any).metadata?.custom_order_number) return

    const countryCode = (order as any).shipping_address?.country_code?.toUpperCase() || "XX"
    const year = new Date().getFullYear()
    const displayId = (order as any).display_id
    const customOrderNumber = `${countryCode}${year}-${displayId}`

    const existingMeta = (order as any).metadata || {}
    await orderModuleService.updateOrders(data.id, {
      metadata: {
        ...existingMeta,
        custom_order_number: customOrderNumber,
      },
    })

    console.log(`[CustomNumber] Order ${data.id} → ${customOrderNumber}`)
  } catch (error: any) {
    console.error("[CustomNumber] Error:", error.message)
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
