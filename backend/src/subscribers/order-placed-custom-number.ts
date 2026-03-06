import { Modules } from "@medusajs/framework/utils"
import { SubscriberArgs, SubscriberConfig } from "@medusajs/medusa"

/**
 * When an order is placed, generate a custom order number
 * in format: {COUNTRY}{YEAR}-{display_id}
 * e.g., NL2026-1111, BE2026-1112, SE2026-1113
 *
 * Runs with a 2s delay so other subscribers (payment-metadata, etc.)
 * finish their metadata writes first. Then reads the fresh metadata,
 * merges in custom_order_number, and writes back the full object.
 */
export default async function orderPlacedCustomNumberHandler({
  event: { data },
  container,
}: SubscriberArgs<any>) {
  try {
    // Wait 2s for other order.placed subscribers to finish writing metadata
    await new Promise((resolve) => setTimeout(resolve, 2000))

    const orderModuleService = container.resolve(Modules.ORDER) as any
    const query = container.resolve("query") as any

    const { data: [order] } = await query.graph({
      entity: "order",
      fields: ["id", "display_id", "metadata", "shipping_address.country_code", "billing_address.country_code"],
      filters: { id: data.id },
    })

    if (!order) return

    const existingMeta = (order as any).metadata || {}

    // Skip if custom_order_number already set
    if (existingMeta.custom_order_number) return

    const countryCode = (
      (order as any).shipping_address?.country_code ||
      (order as any).billing_address?.country_code ||
      "nl"
    ).toUpperCase()
    const year = new Date().getFullYear()
    const displayId = (order as any).display_id
    const customOrderNumber = `${countryCode}${year}-${displayId}`

    // Merge with existing metadata to avoid overwriting other subscribers' fields
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
