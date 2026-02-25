import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  try {
    const { id } = req.params
    const { metadata } = req.body as { metadata: Record<string, any> }

    if (!metadata || typeof metadata !== "object") {
      res.status(400).json({ error: "metadata object is required" })
      return
    }

    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const orderModuleService = req.scope.resolve(Modules.ORDER)

    // Fetch current order to get existing metadata
    const { data: [existingOrder] } = await query.graph({
      entity: "order",
      fields: ["id", "metadata"],
      filters: { id },
    })

    if (!existingOrder) {
      res.status(404).json({ error: "Order not found" })
      return
    }

    // Merge new metadata with existing
    const mergedMetadata = {
      ...((existingOrder as any).metadata || {}),
      ...metadata,
    }

    await orderModuleService.updateOrders(id, {
      metadata: mergedMetadata,
    })

    res.json({
      success: true,
      order_id: id,
      metadata: mergedMetadata,
    })
  } catch (error: any) {
    console.error("Order metadata update error:", error)
    res
      .status(500)
      .json({ error: error.message || "Failed to update metadata" })
  }
}
