import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  try {
    const { id } = req.params
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const orderModuleService = req.scope.resolve(Modules.ORDER)

    // Fetch source order with all details
    const { data: [sourceOrder] } = await query.graph({
      entity: "order",
      fields: [
        "id",
        "display_id",
        "email",
        "currency_code",
        "region_id",
        "sales_channel_id",
        "metadata",
        "items.*",
        "items.variant_id",
        "items.variant.*",
        "shipping_address.*",
        "billing_address.*",
        "shipping_methods.*",
      ],
      filters: { id },
    })

    if (!sourceOrder) {
      res.status(404).json({ error: "Order not found" })
      return
    }

    const src = sourceOrder as any

    // Build items array for new order
    const items = (src.items || []).map((item: any) => ({
      title: item.title || item.variant?.product?.title || "Unknown",
      variant_id: item.variant_id,
      quantity: item.quantity || 1,
      unit_price: Number(item.unit_price) || 0,
    }))

    // Build shipping address
    const shippingAddr = src.shipping_address
      ? {
          first_name: src.shipping_address.first_name,
          last_name: src.shipping_address.last_name,
          address_1: src.shipping_address.address_1,
          address_2: src.shipping_address.address_2 || undefined,
          city: src.shipping_address.city,
          postal_code: src.shipping_address.postal_code,
          country_code: src.shipping_address.country_code,
          province: src.shipping_address.province || undefined,
          phone: src.shipping_address.phone || undefined,
        }
      : undefined

    // Build billing address
    const billingAddr = src.billing_address
      ? {
          first_name: src.billing_address.first_name,
          last_name: src.billing_address.last_name,
          address_1: src.billing_address.address_1,
          address_2: src.billing_address.address_2 || undefined,
          city: src.billing_address.city,
          postal_code: src.billing_address.postal_code,
          country_code: src.billing_address.country_code,
          province: src.billing_address.province || undefined,
          phone: src.billing_address.phone || undefined,
        }
      : undefined

    // Build shipping methods
    const shippingMethods = (src.shipping_methods || []).map((m: any) => ({
      name: m.name || "Shipping",
      amount: Number(m.amount) || 0,
      shipping_option_id: m.shipping_option_id,
    }))

    // Create the duplicate order
    const newOrder = await orderModuleService.createOrders({
      currency_code: src.currency_code || "eur",
      email: src.email,
      region_id: src.region_id,
      sales_channel_id: src.sales_channel_id,
      shipping_address: shippingAddr,
      billing_address: billingAddr || shippingAddr,
      items,
      shipping_methods: shippingMethods,
      metadata: {
        ...(src.metadata || {}),
        duplicated_from: id,
        duplicated_from_display_id: src.display_id,
        dextrum_status: undefined,
        dextrum_order_code: undefined,
        dextrum_tracking_number: undefined,
        dextrum_tracking_url: undefined,
        dextrum_carrier: undefined,
        dextrum_sent_at: undefined,
        dextrum_timeline: undefined,
        fakturoid_invoice_id: undefined,
        fakturoid_invoice_url: undefined,
      },
    })

    res.json({
      success: true,
      order: newOrder,
      source_order_id: id,
    })
  } catch (error: any) {
    console.error("Order duplicate error:", error)
    res.status(500).json({ error: error.message || "Failed to duplicate order" })
  }
}
