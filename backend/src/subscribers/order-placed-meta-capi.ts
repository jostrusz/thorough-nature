import { Modules } from "@medusajs/framework/utils"
import { IOrderModuleService } from "@medusajs/framework/types"
import { SubscriberArgs, SubscriberConfig } from "@medusajs/medusa"
import { META_PIXEL_MODULE } from "../modules/meta-pixel"
import type MetaPixelModuleService from "../modules/meta-pixel/service"
import {
  sendCAPIEvents,
  type CAPIEvent,
  type CAPIUserData,
  type CAPIConfig,
} from "../modules/meta-pixel/capi"

/**
 * Server-side BACKUP Purchase event via CAPI.
 *
 * Uses DETERMINISTIC event_id: purchase_{orderId} — matches the frontend
 * browser pixel + CAPI event, so Facebook deduplicates to ONE conversion.
 *
 * Why backup?
 *  - Ad blockers might block the browser pixel
 *  - User might close the upsell page before the frontend event fires
 *  - Network errors on the CAPI fetch from frontend
 *
 * The subscriber extracts maximum user_data from the order for EMQ.
 */
export default async function orderPlacedMetaCAPIHandler({
  event: { data },
  container,
}: SubscriberArgs<any>) {
  try {
    const orderService: IOrderModuleService = container.resolve(Modules.ORDER)
    const metaPixelService = container.resolve(
      META_PIXEL_MODULE
    ) as MetaPixelModuleService

    // ── Retrieve order with relations ──
    const order = await orderService.retrieveOrder(data.id, {
      relations: ["items", "summary", "shipping_address"],
    })

    if (!order) {
      console.warn("[META CAPI Subscriber] Order not found:", data.id)
      return
    }

    // ── Guard: skip Purchase event for empty/unpaid orders ──
    const orderItems = order.items || []
    const orderTotal = (order as any).total ?? (order.summary as any)?.raw_current_order_total ?? 0
    if (orderItems.length === 0 || Number(orderTotal) <= 0) {
      console.warn(`[META CAPI Subscriber] Skipping Purchase — order ${data.id} has ${orderItems.length} items, total: ${orderTotal}`)
      return
    }

    // ── Determine project_id from order metadata or sales channel ──
    // Strategy: check order.metadata.project_id first, then sales_channel
    const projectId =
      (order.metadata as any)?.project_id ||
      (order as any).sales_channel_id ||
      null

    if (!projectId) {
      console.log("[META CAPI Subscriber] No project_id on order, skipping:", data.id)
      return
    }

    // ── Look up pixel config ──
    const configs = await metaPixelService.listMetaPixelConfigs({
      project_id: projectId,
    })

    if (!configs.length || !configs[0].enabled) {
      console.log(
        `[META CAPI Subscriber] No active pixel config for project "${projectId}", skipping`
      )
      return
    }

    const pixelConfig = configs[0]

    // ── Get shipping address for user_data ──
    let shippingAddress: any = null
    try {
      if (order.shipping_address) {
        shippingAddress = await (
          orderService as any
        ).orderAddressService_.retrieve(order.shipping_address.id)
      }
    } catch {
      // Address not available, continue without it
    }

    // ── Build user_data with maximum CIPs ──
    const userData: CAPIUserData = {}

    // Email
    if (order.email) userData.em = order.email

    // Names + address from shipping
    if (shippingAddress) {
      if (shippingAddress.first_name) userData.fn = shippingAddress.first_name
      if (shippingAddress.last_name) userData.ln = shippingAddress.last_name
      if (shippingAddress.phone) userData.ph = shippingAddress.phone
      if (shippingAddress.city) userData.ct = shippingAddress.city
      if (shippingAddress.province) userData.st = shippingAddress.province
      if (shippingAddress.postal_code) userData.zp = shippingAddress.postal_code
      if (shippingAddress.country_code) userData.country = shippingAddress.country_code
    }

    // Customer ID as external_id (prefer frontend visitor ID for matching with browser pixel)
    if ((order.metadata as any)?.external_id) {
      userData.external_id = (order.metadata as any).external_id
    } else if ((order as any).customer_id) {
      userData.external_id = (order as any).customer_id
    }

    // fbc/fbp from order metadata (if the frontend stored them)
    if ((order.metadata as any)?.fbc) userData.fbc = (order.metadata as any).fbc
    if ((order.metadata as any)?.fbp) userData.fbp = (order.metadata as any).fbp

    // Client IP + User Agent from order metadata (stored by checkout page)
    // Without these, Meta can't match server events to browser sessions (63% → ~100%)
    if ((order.metadata as any)?.client_user_agent) {
      userData.client_user_agent = (order.metadata as any).client_user_agent
    }
    // IP is not stored in metadata (privacy) — the CAPI endpoint adds it from request headers.
    // For the backup subscriber, we omit it (Meta still matches via other CIPs).

    // ── Build custom_data ──
    // Use catalog content IDs if configured for the project (for DPA remarketing)
    const CATALOG_IDS: Record<string, string[]> = {
      dehondenbijbel: ["9hduqtwz07", "5e8vclt1pz", "5d5yd6u51i", "edr7gf3itr", "1emdl02y05", "lgn3th5xv4", "zjk1xb6h9u"],
      "lass-los": ["1azgp7ymuv", "82764876", "31epnhw6c4", "dnoiszdeax", "gh1u1icp8r"],
      loslatenboek: ["32a1orwxo6", "04sbhku9gu", "3ox80zb3w3", "ovw9qrtu0h", "coonabrkxh", "dw9xqils6", "ldv9esmmfj"],
    }

    const items = order.items || []
    const catalogIds = CATALOG_IDS[projectId as string]
    const contentIds = catalogIds || items.map(
      (item: any) => item.variant_id || item.product_id || item.id
    )
    const contents = (catalogIds || items.map((i: any) => i.variant_id || i.product_id || i.id)).map((id: string, idx: number) => ({
      id,
      quantity: items[idx]?.quantity || 1,
      item_price: items[idx]?.unit_price || 0,
    }))
    const numItems = items.reduce(
      (sum: number, item: any) => sum + (item.quantity || 1),
      0
    )

    // Total value
    const totalValue =
      (order.summary as any)?.current_order_total ||
      (order.summary as any)?.total ||
      items.reduce(
        (sum: number, item: any) =>
          sum + (item.unit_price || 0) * (item.quantity || 1),
        0
      )

    const currency = order.currency_code?.toUpperCase() || "EUR"

    // ── Build and send event ──
    // DETERMINISTIC event_id: matches frontend Purchase event for deduplication.
    // Facebook keeps ONE event per event_name + event_id pair.
    const event: CAPIEvent = {
      event_name: "Purchase",
      event_id: `purchase_${order.id}`, // Deterministic — deduplicates with frontend
      event_time: Math.floor(Date.now() / 1000),
      event_source_url: (order.metadata as any)?.source_url || undefined,
      action_source: "website",
      user_data: userData,
      custom_data: {
        content_type: "product",
        content_ids: contentIds,
        value: totalValue,
        currency,
        num_items: numItems,
        contents,
        order_id: order.id,
      },
    }

    const capiConfig: CAPIConfig = {
      pixel_id: pixelConfig.pixel_id,
      access_token: pixelConfig.access_token,
      test_event_code: pixelConfig.test_event_code || undefined,
    }

    const result = await sendCAPIEvents(capiConfig, [event])

    console.log(
      `[META CAPI Subscriber] Purchase backup for order ${order.id}:`,
      result.success ? "✓ sent" : `✗ ${result.error}`,
      `| value: ${totalValue} ${currency}`,
      `| event_id: ${event.event_id.slice(0, 16)}...`
    )
  } catch (error: any) {
    // Never let tracking errors crash the order flow
    console.error("[META CAPI Subscriber] Error:", error.message)
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
