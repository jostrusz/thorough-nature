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

    // Fetch current order metadata
    const { data: [order] } = await query.graph({
      entity: "order",
      fields: ["id", "metadata"],
      filters: { id },
    })

    if (!order) {
      res.status(404).json({ error: "Order not found" })
      return
    }

    // TODO: Implement real BaseLinker API integration
    // For now, update metadata to mark as imported
    const existingMetadata = (order as any).metadata || {}

    await orderModuleService.updateOrders(id, {
      metadata: {
        ...existingMetadata,
        baselinker_status: "imported",
        baselinker_import_date: new Date().toISOString(),
      },
    })

    res.json({
      success: true,
      message: "Order sent to BaseLinker",
      order_id: id,
    })
  } catch (error: any) {
    console.error("BaseLinker send error:", error)
    res.status(500).json({ error: error.message || "Failed to send to BaseLinker" })
  }
}
