import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { QUICKBOOKS_MODULE } from "../../../modules/quickbooks"
import type QuickBooksModuleService from "../../../modules/quickbooks/service"

/**
 * GET /admin/quickbooks — List all QuickBooks configurations
 */
export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const service = req.scope.resolve(
    QUICKBOOKS_MODULE
  ) as unknown as QuickBooksModuleService
  const configs = await service.listQuickBooksConfigs()

  // Mask sensitive fields
  const masked = configs.map((c: any) => ({
    ...c,
    client_secret: c.client_secret
      ? c.client_secret.slice(0, 6) + "****"
      : null,
    access_token: c.access_token
      ? c.access_token.slice(0, 8) + "****"
      : null,
    refresh_token: c.refresh_token
      ? c.refresh_token.slice(0, 8) + "****"
      : null,
  }))

  res.json({ quickbooks_configs: masked })
}

/**
 * POST /admin/quickbooks — Create a new QuickBooks configuration
 *
 * Body: { project_id, client_id, client_secret, environment?, redirect_uri?, default_item_id? }
 */
export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  try {
    const service = req.scope.resolve(
      QUICKBOOKS_MODULE
    ) as unknown as QuickBooksModuleService
    const data = req.body as Record<string, any>

    if (!data.project_id || !data.client_id || !data.client_secret) {
      res.status(400).json({
        error: "project_id, client_id, and client_secret are required",
      })
      return
    }

    const config = await service.createQuickBooksConfigs(data)
    res.status(201).json({ quickbooks_config: config })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
}
