import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  try {
    const { id: orderId } = req.params
    const { email, shipping_address, metadata } = req.body as {
      email?: string
      shipping_address?: {
        first_name?: string
        last_name?: string
        phone?: string
        address_1?: string
        city?: string
        postal_code?: string
        company?: string
      }
      metadata?: Record<string, unknown>
    }

    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

    // Verify order exists
    const { data: orders } = await query.graph({
      entity: "order",
      fields: ["id", "metadata"],
      filters: { id: orderId },
    })

    if (!orders.length) {
      res.status(404).json({ success: false, message: "Order not found" })
      return
    }

    const orderModuleService = req.scope.resolve(Modules.ORDER)

    const updateData: Record<string, unknown> = {}
    if (email) updateData.email = email
    if (shipping_address) updateData.shipping_address = shipping_address
    if (metadata) {
      updateData.metadata = {
        ...((orders[0].metadata as Record<string, unknown>) || {}),
        ...metadata,
      }
    }

    if (Object.keys(updateData).length) {
      await orderModuleService.updateOrders(orderId, updateData)
    }

    res.json({ success: true })
  } catch (error: any) {
    console.error("Update order details error:", error)
    res.status(500).json({ success: false, message: error.message })
  }
}
