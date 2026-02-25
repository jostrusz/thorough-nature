import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  try {
    const { id: orderId } = req.params
    const { variant_id, quantity, unit_price } = req.body as {
      variant_id: string
      quantity?: number
      unit_price?: number
    }

    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

    // Verify order exists
    const { data: orders } = await query.graph({
      entity: "order",
      fields: ["id", "email", "metadata"],
      filters: { id: orderId },
    })

    if (!orders.length) {
      res.status(404).json({ success: false, message: "Order not found" })
      return
    }

    // Store upsell info in order metadata for now
    // Full order edit integration comes later with payment gateway
    const orderModuleService = req.scope.resolve(Modules.ORDER)
    await orderModuleService.updateOrders(orderId, {
      metadata: {
        ...((orders[0].metadata as Record<string, unknown>) || {}),
        upsell_accepted: true,
        upsell_variant_id: variant_id,
        upsell_quantity: quantity || 1,
        upsell_unit_price: unit_price,
      },
    })

    res.json({ success: true, order_id: orderId })
  } catch (error: any) {
    console.error("Upsell accept error:", error)
    res.status(500).json({ success: false, message: error.message })
  }
}
