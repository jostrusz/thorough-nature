import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

/**
 * POST /admin/custom-orders/:id/update
 *
 * Updates order fields: email, shipping_address, billing_address
 */
export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  try {
    const { id } = req.params
    const { email, shipping_address, billing_address } = req.body as {
      email?: string
      shipping_address?: Record<string, any>
      billing_address?: Record<string, any>
    }

    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const orderModuleService = req.scope.resolve(Modules.ORDER)

    // Verify order exists
    const {
      data: [existingOrder],
    } = await query.graph({
      entity: "order",
      fields: ["id", "metadata"],
      filters: { id },
    })

    if (!existingOrder) {
      res.status(404).json({ error: "Order not found" })
      return
    }

    // Build update payload
    const updateData: Record<string, any> = {}

    if (email !== undefined) {
      updateData.email = email
    }

    if (shipping_address) {
      updateData.shipping_address = {
        first_name: shipping_address.first_name,
        last_name: shipping_address.last_name,
        address_1: shipping_address.address_1,
        address_2: shipping_address.address_2,
        city: shipping_address.city,
        postal_code: shipping_address.postal_code,
        province: shipping_address.province,
        country_code: shipping_address.country_code,
        phone: shipping_address.phone,
        company: shipping_address.company,
      }
    }

    if (billing_address) {
      updateData.billing_address = {
        first_name: billing_address.first_name,
        last_name: billing_address.last_name,
        address_1: billing_address.address_1,
        address_2: billing_address.address_2,
        city: billing_address.city,
        postal_code: billing_address.postal_code,
        province: billing_address.province,
        country_code: billing_address.country_code,
        phone: billing_address.phone,
        company: billing_address.company,
      }
    }

    if (Object.keys(updateData).length === 0) {
      res.status(400).json({ error: "No fields to update" })
      return
    }

    // Update the order
    await orderModuleService.updateOrders(id, updateData)

    // Also log the change in audit_log metadata
    const existingMetadata = (existingOrder as any).metadata || {}
    const auditLog = existingMetadata.audit_log || []
    const changedFields = Object.keys(updateData)
    auditLog.push({
      field: changedFields.join(", "),
      label: `Updated: ${changedFields.join(", ")}`,
      detail: `Fields updated by admin`,
      changed_at: new Date().toISOString(),
    })

    await orderModuleService.updateOrders(id, {
      metadata: { ...existingMetadata, audit_log: auditLog },
    })

    res.json({
      success: true,
      order_id: id,
      updated_fields: changedFields,
    })
  } catch (error: any) {
    console.error("Order update error:", error)
    res
      .status(500)
      .json({ error: error.message || "Failed to update order" })
  }
}
