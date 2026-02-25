import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { DEXTRUM_MODULE } from "../../../../../../modules/dextrum"
import { MyStockApiClient } from "../../../../../../modules/dextrum/api-client"

// POST /admin/dextrum/orders/:id/send — Manually send order to WMS
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const { id: medusaOrderId } = req.params
    const dextrumService = req.scope.resolve(DEXTRUM_MODULE) as any
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

    // 1. Get Dextrum config
    const configs = await dextrumService.listDextrumConfigs({}, { take: 1 })
    const config = configs[0]
    if (!config) {
      res.status(400).json({ error: "Dextrum not configured" })
      return
    }

    // 2. Fetch fresh order data from Medusa
    const { data: [order] } = await query.graph({
      entity: "order",
      fields: [
        "id", "display_id", "email", "currency_code", "total",
        "metadata", "items.*", "items.variant.*", "items.variant.product.*",
        "shipping_address.*", "shipping_methods.*",
        "payment_collections.*", "payment_collections.payments.*",
      ],
      filters: { id: medusaOrderId },
    })

    if (!order) {
      res.status(404).json({ error: "Order not found" })
      return
    }

    // 3. Determine project code from metadata or shipping address
    const projectCode = (order as any).metadata?.project_code || "DEFAULT"
    const countryCode = (order as any).shipping_address?.country_code?.toUpperCase() || "CZ"

    // 4. Build order code
    const prefixMap: Record<string, string> = {
      NL: "NL", BE: "BE", DE: "DE", AT: "AT", LU: "LU",
      PL: "PL", CZ: "CZ", SK: "SK", SE: "SE", HU: "HU",
    }
    const prefix = prefixMap[countryCode] || countryCode
    const orderCode = `${prefix}-${(order as any).display_id}`

    // 5. Check if already sent
    const existing = await dextrumService.listDextrumOrderMaps(
      { medusa_order_id: medusaOrderId },
      { take: 1 }
    )
    if (existing[0]?.mystock_order_id) {
      res.status(400).json({ error: "Order already sent to WMS", dextrum_order: existing[0] })
      return
    }

    // 6. Check payment status
    const paymentStatus = getPaymentStatus(order as any)
    const isCOD = (order as any).metadata?.payment_method === "cod" ||
                  (order as any).shipping_methods?.[0]?.data?.is_cod === true
    if (!isCOD && paymentStatus !== "paid" && paymentStatus !== "captured") {
      res.status(400).json({ error: "Order not paid. Only paid orders or COD can be sent to WMS." })
      return
    }

    // 7. Build items
    const orderItems = ((order as any).items || []).map((item: any) => ({
      productCode: item.variant?.sku || item.variant?.product?.handle || "UNKNOWN",
      quantity: item.quantity || 1,
      unitPrice: Number(item.unit_price) || 0,
      productName: item.variant?.product?.title || item.title || "",
    }))

    // 8. Build address
    const addr = (order as any).shipping_address || {}
    const deliveryAddress = {
      name: [addr.first_name, addr.last_name].filter(Boolean).join(" "),
      street: [addr.address_1, addr.address_2].filter(Boolean).join(", "),
      city: addr.city || "",
      zip: addr.postal_code || "",
      countryCode: addr.country_code?.toUpperCase() || "CZ",
      phone: addr.phone || "",
      email: (order as any).email || "",
    }

    // 9. Send to mySTOCK
    const client = new MyStockApiClient({
      apiUrl: config.api_url,
      username: config.api_username,
      password: config.api_password,
    })

    const wmsResult = await client.createOrder({
      orderCode,
      operatingUnitId: config.metadata?.operating_units?.[projectCode] || config.partner_id || "",
      partnerId: config.partner_id || "",
      orderItems,
      deliveryAddress,
      cashAmount: isCOD ? Number((order as any).total) || 0 : undefined,
    })

    // 10. Create or update dextrum_order_map
    const now = new Date().toISOString()
    if (existing[0]) {
      await dextrumService.updateDextrumOrderMaps(existing[0].id, {
        mystock_order_id: wmsResult.id,
        delivery_status: "IMPORTED",
        delivery_status_updated_at: now,
        sent_to_wms_at: now,
        last_error: null,
      })
    } else {
      await dextrumService.createDextrumOrderMaps({
        medusa_order_id: medusaOrderId,
        display_id: String((order as any).display_id),
        project_code: projectCode,
        mystock_order_code: orderCode,
        mystock_order_id: wmsResult.id,
        delivery_status: "IMPORTED",
        delivery_status_updated_at: now,
        sent_to_wms_at: now,
      })
    }

    // 11. Update order metadata with dextrum status
    const orderModuleService = req.scope.resolve(Modules.ORDER) as any
    const existingMeta = (order as any).metadata || {}
    await orderModuleService.updateOrders(medusaOrderId, {
      metadata: {
        ...existingMeta,
        dextrum_status: "IMPORTED",
        dextrum_order_code: orderCode,
        dextrum_mystock_id: wmsResult.id,
        dextrum_sent_at: now,
      },
    })

    res.json({
      success: true,
      order_code: orderCode,
      mystock_id: wmsResult.id,
      delivery_status: "IMPORTED",
    })
  } catch (error: any) {
    console.error("Dextrum send order error:", error)
    res.status(500).json({ error: error.message })
  }
}

function getPaymentStatus(order: any): string {
  if (order.payment_collections?.length) {
    const pc = order.payment_collections[0]
    if (pc.status === "captured" || pc.status === "completed") return "paid"
    return pc.status || "pending"
  }
  return "pending"
}
