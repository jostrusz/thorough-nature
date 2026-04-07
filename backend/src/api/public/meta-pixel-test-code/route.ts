import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { META_PIXEL_MODULE } from "../../../modules/meta-pixel"
import type MetaPixelModuleService from "../../../modules/meta-pixel/service"

/**
 * GET /public/meta-pixel-test-code?project_id=xxx&code=TEST12345
 *
 * Sets or clears the test_event_code on a pixel config.
 * Omit `code` param to clear it.
 */
export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  try {
    const projectId = (req.query as any).project_id
    const code = (req.query as any).code || null

    if (!projectId) {
      res.status(400).json({ error: "project_id query param required" })
      return
    }

    const service = req.scope.resolve(META_PIXEL_MODULE) as MetaPixelModuleService
    const configs = await service.listMetaPixelConfigs({ project_id: projectId })

    if (!configs.length) {
      res.status(404).json({ error: `No config for project "${projectId}"` })
      return
    }

    const config = configs[0]
    await service.updateMetaPixelConfigs({ id: config.id, test_event_code: code })

    res.json({
      success: true,
      project_id: projectId,
      test_event_code: code,
      message: code ? `Test event code set to "${code}"` : "Test event code cleared",
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
}
