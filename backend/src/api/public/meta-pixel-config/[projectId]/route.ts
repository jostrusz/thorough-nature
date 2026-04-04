import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { META_PIXEL_MODULE } from "../../../../modules/meta-pixel"
import type MetaPixelModuleService from "../../../../modules/meta-pixel/service"

/**
 * GET /public/meta-pixel-config/:projectId
 *
 * Public endpoint (no publishable API key required) that returns
 * the pixel_id for a given project so the frontend pixel.js can
 * initialize the browser pixel dynamically.
 *
 * Only returns pixel_id — never exposes access_token or test_event_code.
 */
export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const { projectId } = req.params as { projectId: string }

  try {
    const service = req.scope.resolve(META_PIXEL_MODULE) as MetaPixelModuleService
    const configs = await service.listMetaPixelConfigs({ project_id: projectId })

    if (!configs.length || !configs[0].enabled) {
      res.json({ pixel_id: null, enabled: false })
      return
    }

    res.json({
      pixel_id: configs[0].pixel_id,
      enabled: true,
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
}
