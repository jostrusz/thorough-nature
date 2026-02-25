import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { BILLING_ENTITY_MODULE } from "../../../modules/billing-entity"
import type BillingEntityModuleService from "../../../modules/billing-entity/service"

/**
 * GET /admin/billing-entities — List all billing entities (companies)
 */
export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const billingEntityService = req.scope.resolve(
    BILLING_ENTITY_MODULE
  ) as BillingEntityModuleService
  const entities = await billingEntityService.listBillingEntities()
  res.json({ billing_entities: entities })
}

/**
 * POST /admin/billing-entities — Create a new billing entity
 */
export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  try {
    const billingEntityService = req.scope.resolve(
      BILLING_ENTITY_MODULE
    ) as BillingEntityModuleService
    const data = req.body as Record<string, any>

    const entity = await billingEntityService.createBillingEntities(data)
    res.status(201).json({ billing_entity: entity })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
}
