import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

const LINKER_API_URL = "https://api-platform.linker.shop/public-api/v1/orders"
const LINKER_API_KEY = "f9bc589f47ddaee80e9aa3abb4fd40ed"

/**
 * POST /admin/postnord/orders/:id/send
 * Send a Swedish order to PostNord WMS via Linker API
 */
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const { id: medusaOrderId } = req.params
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

    // 1. Fetch order data
    const { data: [order] } = await query.graph({
      entity: "order",
      fields: [
        "id", "display_id", "email", "currency_code", "total",
        "metadata", "items.*", "items.variant.*", "items.variant.product.*",
        "shipping_address.*", "billing_address.*",
        "payment_collections.*", "payment_collections.payments.*",
      ],
      filters: { id: medusaOrderId },
    })

    if (!order) {
      res.status(404).json({ error: "Order not found" })
      return
    }

    // 2. Check if already sent
    if (order.metadata?.postnord_sent) {
      res.status(400).json({ error: "Order already sent to PostNord", sent_at: order.metadata.postnord_sent_at })
      return
    }

    // 3. Build order number
    const orderNumber = order.metadata?.custom_order_number || `SE${new Date(order.created_at).getFullYear()}-${order.display_id}`
    const shippingAddr = order.shipping_address || {}
    const billingAddr = order.billing_address || shippingAddr

    // 4. Determine payment method
    const paymentMethod = (() => {
      const pcs = order.payment_collections || []
      for (const pc of pcs as any[]) {
        if (pc.status === "canceled") continue
        const payments = pc.payments || []
        if (payments.length > 0) {
          return payments[0].provider_id || "unknown"
        }
      }
      return order.metadata?.payment_method || "unknown"
    })()

    // 5. Calculate total quantity and total price
    const items = order.items || []
    const totalQuantity = items.reduce((sum: number, item: any) => sum + (item.quantity || 1), 0)
    const totalPrice = Number(order.total) || 0

    // 6. Build Linker API payload
    const payload = {
      clientOrderNumber: orderNumber,
      externalId: orderNumber,
      additionalOrderNumber: orderNumber,
      paymentMethod: paymentMethod,
      orderDate: new Date().toISOString(),
      executionDate: new Date().toISOString(),
      carrier: "PostNord - MyPack Home",
      deliveryCompany: "",
      deliveryRecipient: [shippingAddr.first_name, shippingAddr.last_name].filter(Boolean).join(" "),
      deliveryPhone: shippingAddr.phone || "",
      deliveryEmail: order.email || "",
      deliveryStreet: shippingAddr.address_1 || "",
      deliveryPostCode: shippingAddr.postal_code || "",
      deliveryCity: shippingAddr.city || "",
      deliveryCountry: shippingAddr.country_code?.toUpperCase() || "SE",
      codAmount: 0,
      shipmentPrice: 0,
      shipmentPriceNet: 0,
      discount: 0,
      items: [
        {
          id: "682ae62586557238590dff34",
          externalId: "SE9287962270",
          productExternalId: "SE9287962270",
          vat_code: "6",
          quantity: String(totalQuantity),
          price_gross: String(totalPrice),
          price_net: String(totalPrice),
          unit: "PMS",
          description: "Släpp taget om det som förstör dig",
          sku: "SE9287962270",
          weight: "0.1",
        },
      ],
      priceGross: String(totalPrice),
      priceNet: String(totalPrice),
      currencySymbol: order.currency_code?.toUpperCase() || "SEK",
      billingCompany: "",
      billingVatId: "0",
      billingFirstName: billingAddr.first_name || "",
      billingLastName: billingAddr.last_name || "",
      billingEmail: order.email || "",
      billingPhone: billingAddr.phone || shippingAddr.phone || "",
      billingStreet1: billingAddr.address_1 || "",
      billingStreet2: billingAddr.address_2 || "",
      billingPostCode: billingAddr.postal_code || "",
      billingCity: billingAddr.city || "",
      billingState: billingAddr.country_code?.toUpperCase() || "SE",
      billingCountry: billingAddr.country_code?.toUpperCase() || "SE",
      billingCountryCode: billingAddr.country_code?.toUpperCase() || "SE",
      comments: "Order created via API",
      internalDeliveryMethod: "",
      deliveryMethodMap: "",
      numberOfPackages: 1,
      deliveryConfiguration: {},
      paymentTransactionId: "",
    }

    console.log(`[PostNord] Sending order ${orderNumber} to Linker API...`)

    // 7. Send to Linker API
    const response = await fetch(LINKER_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": LINKER_API_KEY,
      },
      body: JSON.stringify(payload),
    })

    const responseText = await response.text()
    let responseData: any
    try {
      responseData = JSON.parse(responseText)
    } catch {
      responseData = { raw: responseText }
    }

    if (!response.ok) {
      console.error(`[PostNord] Linker API error: ${response.status}`, responseData)
      res.status(502).json({
        error: `Linker API returned ${response.status}`,
        details: responseData,
      })
      return
    }

    console.log(`[PostNord] Order ${orderNumber} sent successfully`, responseData)

    // 8. Update order metadata
    const orderService = req.scope.resolve("order") as any
    await orderService.updateOrders([{
      id: medusaOrderId,
      metadata: {
        ...order.metadata,
        postnord_sent: true,
        postnord_sent_at: new Date().toISOString(),
        postnord_order_number: orderNumber,
        postnord_response: responseData,
        dextrum_status: "IMPORTED",
      },
    }])

    res.json({
      success: true,
      order_number: orderNumber,
      postnord_order_number: orderNumber,
      linker_response: responseData,
    })
  } catch (error: any) {
    console.error("[PostNord] Error sending order:", error)
    res.status(500).json({ error: error.message })
  }
}
