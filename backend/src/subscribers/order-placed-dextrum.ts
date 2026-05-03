import { Modules } from "@medusajs/framework/utils"
import { SubscriberArgs, SubscriberConfig } from "@medusajs/medusa"
import { DEXTRUM_MODULE } from "../modules/dextrum"

/**
 * When an order is placed, create a Dextrum order map entry
 * with delivery_status = "NEW" → "WAITING" and set hold_until.
 */
export default async function orderPlacedDextrumHandler({
  event: { data },
  container,
}: SubscriberArgs<any>) {
  try {
    const dextrumService = container.resolve(DEXTRUM_MODULE) as any
    const orderModuleService = container.resolve(Modules.ORDER) as any
    const query = container.resolve("query") as any

    // 1. Check if Dextrum is enabled
    const configs = await dextrumService.listDextrumConfigs({}, { take: 1 })
    const config = configs[0]
    if (!config?.enabled) return

    // 2. Get order details
    const { data: [order] } = await query.graph({
      entity: "order",
      fields: ["id", "display_id", "email", "metadata", "shipping_address.*", "billing_address.*"],
      filters: { id: data.id },
    })

    if (!order) return

    // 3. Check if already tracked
    const existing = await dextrumService.listDextrumOrderMaps(
      { medusa_order_id: data.id },
      { take: 1 }
    )
    if (existing[0]) return

    // 4. Build order code — country from shipping address (customer selects in checkout)
    const countryCode = (
      (order as any).shipping_address?.country_code ||
      (order as any).billing_address?.country_code ||
      ""
    ).toUpperCase()

    if (!countryCode) {
      console.error(`[Dextrum] Order ${data.id} has no country_code on shipping or billing address!`)
    }

    const prefixMap: Record<string, string> = {
      NL: "NL", BE: "BE", DE: "DE", AT: "AT", LU: "LU",
      PL: "PL", CZ: "CZ", SK: "SK", SE: "SE", HU: "HU",
    }
    const prefix = prefixMap[countryCode] || countryCode || "XX"
    const year = new Date().getFullYear()
    const orderCode = `${prefix}${year}-${(order as any).display_id}`
    const projectCode = (order as any).metadata?.project_code || "DEFAULT"

    // 5. Calculate hold_until
    const holdMinutes = config.order_hold_minutes || 15
    const holdUntil = new Date(Date.now() + holdMinutes * 60 * 1000).toISOString()

    // 6. Create dextrum_order_map with WAITING status
    await dextrumService.createDextrumOrderMaps({
      medusa_order_id: data.id,
      display_id: String((order as any).display_id),
      project_code: projectCode,
      mystock_order_code: orderCode,
      delivery_status: "WAITING",
      delivery_status_updated_at: new Date().toISOString(),
      hold_until: holdUntil,
    })

    // 7. Update order metadata — pass ONLY new fields, Medusa merges at DB level.
    // Spreading existing meta snapshot races with other order.placed subscribers.
    await orderModuleService.updateOrders(data.id, {
      metadata: {
        dextrum_status: "WAITING",
        dextrum_order_code: orderCode,
        dextrum_hold_until: holdUntil,
      },
    })

    console.log(`[Dextrum] Order ${orderCode} queued (hold until ${holdUntil})`)
  } catch (error: any) {
    console.error("[Dextrum] order.placed handler error:", error.message)
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
