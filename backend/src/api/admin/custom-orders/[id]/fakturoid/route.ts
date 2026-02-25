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
      fields: ["id", "display_id", "metadata"],
      filters: { id },
    })

    if (!order) {
      res.status(404).json({ error: "Order not found" })
      return
    }

    // TODO: Implement real Fakturoid API integration
    // For now, generate a stub invoice ID
    const existingMetadata = (order as any).metadata || {}
    const displayId = (order as any).display_id || "unknown"
    const invoiceId = `INV-${displayId}-${Date.now()}`

    await orderModuleService.updateOrders(id, {
      metadata: {
        ...existingMetadata,
        fakturoid_invoice_id: invoiceId,
        fakturoid_invoice_url: `https://app.fakturoid.cz/invoices/${invoiceId}`,
        fakturoid_created_at: new Date().toISOString(),
      },
    })

    res.json({
      success: true,
      invoice_id: invoiceId,
      invoice_url: `https://app.fakturoid.cz/invoices/${invoiceId}`,
      order_id: id,
    })
  } catch (error: any) {
    console.error("Fakturoid create invoice error:", error)
    res.status(500).json({ error: error.message || "Failed to create Fakturoid invoice" })
  }
}
