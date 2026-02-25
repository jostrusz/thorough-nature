import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { META_PIXEL_MODULE } from "../../../modules/meta-pixel"
import type MetaPixelModuleService from "../../../modules/meta-pixel/service"

/**
 * GET /admin/meta-pixel — List all Meta Pixel configurations
 */
export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const service = req.scope.resolve(META_PIXEL_MODULE) as MetaPixelModuleService
  const configs = await service.listMetaPixelConfigs()

  // Mask access tokens in response
  const masked = configs.map((c: any) => ({
    ...c,
    access_token: c.access_token
      ? c.access_token.slice(0, 8) + "****" + c.access_token.slice(-4)
      : null,
  }))

  res.json({ meta_pixel_configs: masked })
}

/**
 * POST /admin/meta-pixel — Create a new Meta Pixel configuration
 *
 * Body: { project_id, pixel_id, access_token, test_event_code?, enabled? }
 */
export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  try {
    const service = req.scope.resolve(META_PIXEL_MODULE) as MetaPixelModuleService
    const data = req.body as Record<string, any>

    if (!data.project_id || !data.pixel_id || !data.access_token) {
      res.status(400).json({
        error: "project_id, pixel_id, and access_token are required",
      })
      return
    }

    const config = await service.createMetaPixelConfigs(data)
    res.status(201).json({ meta_pixel_config: config })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
}
