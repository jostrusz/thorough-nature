import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { QUICKBOOKS_MODULE } from "../../../../modules/quickbooks"
import type QuickBooksModuleService from "../../../../modules/quickbooks/service"

/**
 * GET /admin/quickbooks/:id — Get single configuration
 */
export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const { id } = req.params
  const service = req.scope.resolve(
    QUICKBOOKS_MODULE
  ) as unknown as QuickBooksModuleService

  try {
    const config = await service.retrieveQuickBooksConfig(id)
    res.json({ quickbooks_config: config })
  } catch (error: any) {
    res.status(404).json({ error: "QuickBooks config not found" })
  }
}

/**
 * POST /admin/quickbooks/:id — Update a configuration
 *
 * Body: { client_id?, client_secret?, environment?, redirect_uri?, default_item_id?, enabled? }
 */
export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const { id } = req.params
  const service = req.scope.resolve(
    QUICKBOOKS_MODULE
  ) as unknown as QuickBooksModuleService

  try {
    const data = req.body as Record<string, any>
    const config = await service.updateQuickBooksConfigs({ id, ...data })
    res.json({ quickbooks_config: config })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
}

/**
 * DELETE /admin/quickbooks/:id — Delete a configuration
 */
export async function DELETE(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const { id } = req.params
  const service = req.scope.resolve(
    QUICKBOOKS_MODULE
  ) as unknown as QuickBooksModuleService

  try {
    await service.deleteQuickBooksConfigs(id)
    res.json({ success: true, deleted: id })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
}
