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
      fields: ["id", "metadata", "created_at"],
      filters: { id: orderId },
    })

    if (!orders.length) {
      res.status(404).json({ success: false, message: "Order not found" })
      return
    }

    // 5-minute edit window check
    const orderCreatedAt = (orders[0] as any).created_at
    if (orderCreatedAt) {
      const createdTime = new Date(orderCreatedAt).getTime()
      const now = Date.now()
      const minutesElapsed = (now - createdTime) / (1000 * 60)
      if (minutesElapsed > 5) {
        console.log(`[UpdateDetails] Edit window expired for ${orderId} (${minutesElapsed.toFixed(1)} min elapsed)`)
        res.status(400).json({ success: false, message: "Edit window expired (5 minutes)" })
        return
      }
    }

    const orderModuleService = req.scope.resolve(Modules.ORDER)
    const existingMeta = (orders[0].metadata as Record<string, unknown>) || {}

    const updateData: Record<string, unknown> = {}
    if (email) updateData.email = email
    if (shipping_address) updateData.shipping_address = shipping_address

    // Build list of changed fields for audit log
    const changedFields: string[] = []
    if (email) changedFields.push("email")
    if (shipping_address) {
      if (shipping_address.first_name) changedFields.push("first_name")
      if (shipping_address.last_name) changedFields.push("last_name")
      if (shipping_address.phone) changedFields.push("phone")
      if (shipping_address.address_1) changedFields.push("address")
      if (shipping_address.city) changedFields.push("city")
      if (shipping_address.postal_code) changedFields.push("postal_code")
      if (shipping_address.company) changedFields.push("company")
    }

    // Add audit log entry
    const auditLog = (existingMeta.audit_log as any[]) || []
    if (changedFields.length) {
      auditLog.push({
        field: changedFields.join(", "),
        label: "Customer updated details",
        detail: `Changed: ${changedFields.join(", ")}`,
        changed_at: new Date().toISOString(),
      })
    }

    // Merge metadata
    const mergedMeta = {
      ...existingMeta,
      ...(metadata || {}),
      audit_log: auditLog,
    }
    updateData.metadata = mergedMeta

    if (Object.keys(updateData).length) {
      await orderModuleService.updateOrders(orderId, updateData)
    }

    console.log(`[UpdateDetails] Order ${orderId}: customer updated ${changedFields.join(", ")}`)
    res.json({ success: true })
  } catch (error: any) {
    console.error("Update order details error:", error)
    res.status(500).json({ success: false, message: error.message })
  }
}
