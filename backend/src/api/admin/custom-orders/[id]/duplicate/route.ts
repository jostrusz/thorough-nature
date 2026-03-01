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
        "items.tax_lines.*",
        "items.is_tax_inclusive",
        "shipping_address.*",
        "billing_address.*",
        "shipping_methods.*",
        "payment_collections.*",
        "payment_collections.payments.*",
      ],
      filters: { id },
    })

    if (!sourceOrder) {
      res.status(404).json({ error: "Order not found" })
      return
    }

    const src = sourceOrder as any

    // Derive source order's payment status
    let sourcePaymentStatus = "pending"
    if (src.payment_collections?.length) {
      const pc = src.payment_collections[0]
      if (pc.status === "captured" || pc.status === "completed") sourcePaymentStatus = "paid"
      else if (pc.status === "refunded") sourcePaymentStatus = "refunded"
      else if (pc.status === "authorized") sourcePaymentStatus = "authorized"
      else sourcePaymentStatus = pc.status || "pending"
    }

    // Build items array for new order (preserve tax-inclusive flag)
    const sourceItems = src.items || []
    const items = sourceItems.map((item: any) => ({
      title: item.title || item.variant?.product?.title || "Unknown",
      variant_id: item.variant_id,
      quantity: item.quantity || 1,
      unit_price: Number(item.unit_price) || 0,
      is_tax_inclusive: item.is_tax_inclusive ?? false,
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
        copied_payment_status: sourcePaymentStatus,
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

    // Copy tax lines from source items to new order items
    try {
      // Fetch the newly created order's items to get their IDs
      const { data: [freshOrder] } = await query.graph({
        entity: "order",
        fields: ["items.id", "items.title"],
        filters: { id: (newOrder as any).id },
      })
      const newItems = (freshOrder as any)?.items || []

      // Build tax lines: match source items to new items by index
      const taxLinesToCreate: any[] = []
      sourceItems.forEach((srcItem: any, idx: number) => {
        const newItem = newItems[idx]
        if (!newItem || !srcItem.tax_lines?.length) return
        for (const tl of srcItem.tax_lines) {
          taxLinesToCreate.push({
            item_id: newItem.id,
            code: tl.code || "default",
            rate: Number(tl.rate) || 0,
            description: tl.description || undefined,
            provider_id: tl.provider_id || undefined,
          })
        }
      })

      if (taxLinesToCreate.length > 0) {
        await orderModuleService.createOrderLineItemTaxLines(
          (newOrder as any).id,
          taxLinesToCreate
        )
      }
    } catch (taxErr: any) {
      console.warn("[Duplicate] Could not copy tax lines:", taxErr.message)
      // Non-fatal: order is still created, just without tax lines
    }

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
