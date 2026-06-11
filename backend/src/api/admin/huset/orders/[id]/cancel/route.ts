// @ts-nocheck
/**
 * POST /admin/huset/orders/:id/cancel — cancel an order in the Huset WMS
 * (UpdateOutgoingDeliveryOrder with OrderStatusId=Cancel).
 * Only possible before the warehouse dispatches the shipment.
 * :id is the Medusa order id.
 */
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Pool } from "pg"
import { HUSET_MODULE } from "../../../../../../modules/huset"
import { getHusetConfig } from "../../../../../../modules/huset/config"
import { buildHusetClient, buildHusetItems } from "../../../../../../modules/huset/send-order"

const ISO2_TO_ISO3: Record<string, string> = {
  NO: "NOR", SE: "SWE", DK: "DNK", FI: "FIN",
  NL: "NLD", BE: "BEL", DE: "DEU", AT: "AUT", LU: "LUX",
  PL: "POL", CZ: "CZE", SK: "SVK", HU: "HUN",
}

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const orderId = req.params.id
    const config = getHusetConfig()
    const husetService = req.scope.resolve(HUSET_MODULE) as any
    const query = req.scope.resolve("query") as any

    const maps = await husetService.listHusetOrderMaps({ medusa_order_id: orderId }, { take: 1 })
    const orderMap = maps[0]
    if (!orderMap) {
      res.status(404).json({ error: "No Huset order map for this order" })
      return
    }

    if (orderMap.delivery_status === "WAITING") {
      // Not yet sent to the warehouse — just cancel locally
      await husetService.updateHusetOrderMaps({ id: orderMap.id,
        delivery_status: "CANCELLED",
        delivery_status_updated_at: new Date().toISOString(),
        last_error: null,
      })
      res.json({ success: true, cancelled: "locally", note: "Order was not yet sent to Huset" })
      return
    }

    if (orderMap.delivery_status === "DISPATCHED") {
      res.status(400).json({ error: "Order already dispatched — cannot cancel in WMS" })
      return
    }

    const { data: [order] } = await query.graph({
      entity: "order",
      fields: [
        "id", "display_id", "email", "metadata",
        "items.*", "items.variant.*",
        "shipping_address.*", "billing_address.*",
      ],
      filters: { id: orderId },
    })
    if (!order) {
      res.status(404).json({ error: "Order not found" })
      return
    }

    const addr = (order as any).shipping_address || {}
    const cc2 = (addr.country_code || "").toUpperCase()
    const fullName = [addr.first_name, addr.last_name].filter(Boolean).join(" ").trim() || (order as any).email

    const client = buildHusetClient(config)
    await client.cancelOrder({
      orderRef: orderMap.order_ref,
      receiverRef: orderMap.order_ref,
      items: buildHusetItems((order as any).items || [], config),
      logisticsMethodId: config.logisticsMethodId,
      salesOrgId: config.salesOrgId,
      overrideAddress: config.overrideAddress,
      deliveryName: fullName,
      deliveryStreet: [addr.address_1, addr.address_2].filter(Boolean).join(", "),
      deliveryPostalCode: addr.postal_code || "",
      deliveryCity: addr.city || "",
      deliveryCountryId: ISO2_TO_ISO3[cc2] || cc2,
      deliveryEmail: (order as any).email || "",
      deliveryContactName: fullName,
    })

    const now = new Date().toISOString()
    await husetService.updateHusetOrderMaps({ id: orderMap.id,
      delivery_status: "CANCELLED",
      delivery_status_updated_at: now,
      last_error: null,
    })

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
          JSON.stringify({ huset_status: "CANCELLED", dextrum_status: "CANCELLED" }),
          JSON.stringify([{ type: "huset", status: "CANCELLED", date: now, detail: "Cancelled in Huset WMS (admin action)" }]),
          orderId,
        ]
      )
    } finally {
      await pool.end().catch(() => {})
    }

    res.json({ success: true, cancelled: "in_wms", order_ref: orderMap.order_ref })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
}
