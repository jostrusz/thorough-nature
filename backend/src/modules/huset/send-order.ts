// @ts-nocheck
/**
 * Shared "send order to Huset WMS" logic — used by the huset-order-send cron
 * job and the manual /admin/huset/orders/:id/send route.
 *
 * Expects a FRESH order object (query.graph with items + addresses + payments)
 * and the huset_order_map row. Returns the Huset OutgoingDeliveryOrderId.
 */
import { Pool } from "pg"
import { HusetApiClient } from "./api-client"
import { getHusetConfig, HusetConfig } from "./config"
import { normalizePhone } from "../../utils/normalize-phone"
import { normalizePostalCode } from "../../utils/normalize-postal-code"

/** Medusa ISO2 country codes → Fortus ISO 3166-1 alpha-3 */
const ISO2_TO_ISO3: Record<string, string> = {
  NO: "NOR", SE: "SWE", DK: "DNK", FI: "FIN",
  NL: "NLD", BE: "BEL", DE: "DEU", AT: "AUT", LU: "LUX",
  PL: "POL", CZ: "CZE", SK: "SVK", HU: "HUN",
}

// Non-physical line items that must never reach the warehouse
const SKIP_SKUS = new Set(["FEE-COD", "FEE-DELIVERY-HOME"])

export function buildHusetClient(config?: HusetConfig): HusetApiClient {
  const c = config || getHusetConfig()
  return new HusetApiClient({
    endpoint: c.endpoint,
    auth: {
      companyId: c.companyId,
      hashKey: c.hashKey,
      integrationId: c.integrationId,
      countryId: c.authCountryId,
    },
  })
}

/**
 * Map Medusa line items → Huset WMS items.
 * Resolution order per item SKU:
 *   1. HUSET_SKU_MAP entry (bundle variants, e.g. "ST-2" → 2× physical book)
 *   2. HUSET_ARTICLE_REF global override (single-SKU project)
 *   3. variant SKU as-is
 */
export function buildHusetItems(rawItems: any[], config: HusetConfig): Array<{ articleRef: string; qty: number }> {
  const items: Array<{ articleRef: string; qty: number }> = []

  for (const item of rawItems) {
    const sku = item.variant?.sku || item.variant_sku || ""
    if (!sku || SKIP_SKUS.has(sku)) {
      if (sku) console.log(`[Huset] Skipping non-physical item: ${sku}`)
      continue
    }

    const mapped = config.skuMap[sku]
    if (mapped) {
      items.push({ articleRef: mapped.sku, qty: (mapped.qty || 1) * (item.quantity || 1) })
      console.log(`[Huset] SKU mapping: ${sku} → ${mapped.qty}× ${mapped.sku}`)
      continue
    }

    items.push({
      articleRef: config.articleRef || sku,
      qty: item.quantity || 1,
    })
  }

  // Merge duplicate ArticleRefs (e.g. bundle + order-bump of the same book)
  const merged = new Map<string, number>()
  for (const it of items) {
    merged.set(it.articleRef, (merged.get(it.articleRef) || 0) + it.qty)
  }
  return [...merged.entries()].map(([articleRef, qty]) => ({ articleRef, qty }))
}

export async function sendOrderToHuset(opts: {
  order: any
  orderMap: any
  husetService: any
  config?: HusetConfig
}): Promise<{ outgoingDeliveryOrderId: number; orderRef: string }> {
  const { order, orderMap, husetService } = opts
  const config = opts.config || getHusetConfig()

  if (!config.hashKey) {
    throw new Error("HUSET_HASHKEY is not configured")
  }

  const addr = order.shipping_address || {}
  const countryCode2 = (addr.country_code || order.billing_address?.country_code || "").toUpperCase()
  const countryIso3 = ISO2_TO_ISO3[countryCode2]
  if (!countryIso3) {
    throw new Error(`Unsupported delivery country for Huset: "${countryCode2}"`)
  }

  const orderRef = orderMap.order_ref
  const items = buildHusetItems(order.items || [], config)
  if (items.length === 0) {
    throw new Error("Order has no physical items to ship")
  }

  const phoneResult = normalizePhone(addr.phone, countryCode2)
  const postalResult = normalizePostalCode(addr.postal_code, countryCode2)

  const fullName = [addr.first_name, addr.last_name].filter(Boolean).join(" ").trim() || order.email
  const orderMeta = order.metadata || {}
  // Bring parcel box / servicepoint code if checkout collected one
  const pickupCode = orderMeta.pickup_place_code || orderMeta.bring_pickup_point_id || ""

  const client = buildHusetClient(config)
  const outgoingDeliveryOrderId = await client.createOrder({
    orderRef,
    receiverRef: orderRef,
    items,
    logisticsMethodId: config.logisticsMethodId,
    salesOrgId: config.salesOrgId,
    orderNotes: "",
    orderStatusId: "Update",
    overrideAddress: config.overrideAddress,
    deliveryName: fullName,
    deliveryStreet: [addr.address_1, addr.address_2].filter(Boolean).join(", "),
    deliveryPostalCode: postalResult.normalized,
    deliveryCity: addr.city || "",
    deliveryCountryId: countryIso3,
    deliveryEmail: order.email || "",
    deliveryContactName: fullName,
    deliveryCellphone: phoneResult.normalized !== "000" ? phoneResult.normalized : "",
    pickupLocationCode: pickupCode,
  })

  const sentAt = new Date().toISOString()

  await husetService.updateHusetOrderMaps({
    id: orderMap.id,
    outgoing_delivery_order_id: String(outgoingDeliveryOrderId),
    delivery_status: "IMPORTED",
    delivery_status_updated_at: sentAt,
    sent_to_wms_at: sentAt,
    last_error: null,
    retry_count: 0,
  })

  // JSONB merge — never replace the whole metadata object (races with
  // concurrently-writing webhooks/subscribers). huset_* are the source of
  // truth; dextrum_status is mirrored so the existing admin UI (badges,
  // orders table, timeline) renders Huset orders without UI changes.
  const timelineEntry = {
    type: "huset",
    status: "IMPORTED",
    date: sentAt,
    detail: `Sent to Huset WMS (OutgoingDeliveryOrderId: ${outgoingDeliveryOrderId})`,
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
  try {
    await pool.query(
      `UPDATE "order" SET metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb
         || jsonb_build_object(
              'dextrum_timeline',
              COALESCE(metadata->'dextrum_timeline', '[]'::jsonb) || $2::jsonb
            ),
         updated_at = NOW()
       WHERE id = $3`,
      [
        JSON.stringify({
          fulfillment_provider: "huset",
          huset_status: "IMPORTED",
          huset_order_ref: orderRef,
          huset_outgoing_delivery_order_id: String(outgoingDeliveryOrderId),
          huset_sent_at: sentAt,
          dextrum_status: "IMPORTED",
          dextrum_order_code: orderRef,
          dextrum_sent_at: sentAt,
        }),
        JSON.stringify([timelineEntry]),
        orderMap.medusa_order_id,
      ]
    )
  } finally {
    await pool.end().catch(() => {})
  }

  console.log(`[Huset] Order ${orderRef} sent to Huset WMS → OutgoingDeliveryOrderId ${outgoingDeliveryOrderId}`)
  return { outgoingDeliveryOrderId, orderRef }
}
