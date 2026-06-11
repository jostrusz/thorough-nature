// @ts-nocheck
import { Modules } from "@medusajs/framework/utils"
import { SubscriberArgs, SubscriberConfig } from "@medusajs/medusa"
import { HUSET_MODULE } from "../modules/huset"
import { getHusetConfig } from "../modules/huset/config"
import { isHusetOrder } from "../utils/huset-routing"

/**
 * When an order is placed for the Huset-fulfilled project (slipp-taket / NO),
 * create a huset_order_map entry with delivery_status WAITING and a hold_until
 * timestamp. The huset-order-send cron picks it up after the hold expires and
 * the payment is confirmed.
 *
 * Mirror of order-placed-dextrum.ts — same lifecycle, different WMS.
 */
export default async function orderPlacedHusetHandler({
  event: { data },
  container,
}: SubscriberArgs<any>) {
  try {
    const config = getHusetConfig()
    if (!config.enabled) return

    const husetService = container.resolve(HUSET_MODULE) as any
    const orderModuleService = container.resolve(Modules.ORDER) as any
    const query = container.resolve("query") as any

    // 1. Get order details
    const { data: [order] } = await query.graph({
      entity: "order",
      fields: ["id", "display_id", "email", "metadata", "sales_channel_id", "shipping_address.*", "billing_address.*"],
      filters: { id: data.id },
    })
    if (!order) return

    // 2. Route check — only the Huset project (slipp-taket)
    if (!(await isHusetOrder(order, container))) return

    // 3. Check if already tracked
    const existing = await husetService.listHusetOrderMaps(
      { medusa_order_id: data.id },
      { take: 1 }
    )
    if (existing[0]) return

    // 4. Build order ref — same scheme as custom_order_number (NO2026-123)
    const countryCode = (
      (order as any).shipping_address?.country_code ||
      (order as any).billing_address?.country_code ||
      ""
    ).toUpperCase()
    if (!countryCode) {
      console.error(`[Huset] Order ${data.id} has no country_code on shipping or billing address!`)
    }
    const year = new Date().getFullYear()
    const orderRef = `${countryCode || "XX"}${year}-${(order as any).display_id}`
    const projectCode = (order as any).metadata?.project_code || "DEFAULT"

    // 5. Hold window (payment settle + customer support cancel window)
    const holdUntil = new Date(Date.now() + config.holdMinutes * 60 * 1000).toISOString()

    // 6. Create huset_order_map with WAITING status
    await husetService.createHusetOrderMaps({
      medusa_order_id: data.id,
      display_id: String((order as any).display_id),
      project_code: projectCode,
      order_ref: orderRef,
      delivery_status: "WAITING",
      delivery_status_updated_at: new Date().toISOString(),
      hold_until: holdUntil,
    })

    // 7. Update order metadata — pass ONLY new fields, Medusa merges at DB level.
    // dextrum_status mirror keeps the existing admin UI rendering these orders.
    await orderModuleService.updateOrders(data.id, {
      metadata: {
        fulfillment_provider: "huset",
        huset_status: "WAITING",
        huset_order_ref: orderRef,
        huset_hold_until: holdUntil,
        dextrum_status: "WAITING",
        dextrum_order_code: orderRef,
      },
    })

    console.log(`[Huset] Order ${orderRef} queued for Huset WMS (hold until ${holdUntil})`)
  } catch (error: any) {
    console.error("[Huset] order.placed handler error:", error.message)
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
