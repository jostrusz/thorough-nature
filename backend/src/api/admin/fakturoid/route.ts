import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { FAKTUROID_MODULE } from "../../../modules/fakturoid"
import type FakturoidModuleService from "../../../modules/fakturoid/service"

/**
 * GET /admin/fakturoid — List all Fakturoid configurations
 */
export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const service = req.scope.resolve(
    FAKTUROID_MODULE
  ) as unknown as FakturoidModuleService
  const configs = await service.listFakturoidConfigs()

  // Mask sensitive fields
  const masked = configs.map((c: any) => ({
    ...c,
    client_secret: c.client_secret
      ? c.client_secret.slice(0, 6) + "****"
      : null,
    access_token: c.access_token
      ? c.access_token.slice(0, 8) + "****"
      : null,
  }))

  res.json({ fakturoid_configs: masked })
}

/**
 * POST /admin/fakturoid — Create a new Fakturoid configuration
 *
 * Body: { project_id, slug, client_id, client_secret, user_agent_email, default_language?, enabled? }
 */
export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  try {
    const service = req.scope.resolve(
      FAKTUROID_MODULE
    ) as unknown as FakturoidModuleService
    const data = req.body as Record<string, any>

    if (
      !data.project_id ||
      !data.slug ||
      !data.client_id ||
      !data.client_secret ||
      !data.user_agent_email
    ) {
      res.status(400).json({
        error:
          "project_id, slug, client_id, client_secret, and user_agent_email are required",
      })
      return
    }

    const config = await service.createFakturoidConfigs(data)
    res.status(201).json({ fakturoid_config: config })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
}
