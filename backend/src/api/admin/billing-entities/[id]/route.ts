import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { BILLING_ENTITY_MODULE } from "../../../../modules/billing-entity"
import type BillingEntityModuleService from "../../../../modules/billing-entity/service"

/**
 * GET /admin/billing-entities/:id — Get single billing entity
 */
export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const { id } = req.params
  const billingEntityService = req.scope.resolve(
    BILLING_ENTITY_MODULE
  ) as BillingEntityModuleService

  try {
    const entity = await billingEntityService.retrieveBillingEntity(id)
    res.json({ billing_entity: entity })
  } catch (error: any) {
    res.status(404).json({ error: "Billing entity not found" })
  }
}

/**
 * POST /admin/billing-entities/:id — Update a billing entity
 */
export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const { id } = req.params
  const billingEntityService = req.scope.resolve(
    BILLING_ENTITY_MODULE
  ) as BillingEntityModuleService

  try {
    const data = req.body as Record<string, any>
    const entity = await billingEntityService.updateBillingEntities({
      id,
      ...data,
    })
    res.json({ billing_entity: entity })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
}

/**
 * DELETE /admin/billing-entities/:id — Delete a billing entity
 */
export async function DELETE(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const { id } = req.params
  const billingEntityService = req.scope.resolve(
    BILLING_ENTITY_MODULE
  ) as BillingEntityModuleService

  try {
    await billingEntityService.deleteBillingEntities(id)
    res.json({ success: true, deleted: id })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
}
