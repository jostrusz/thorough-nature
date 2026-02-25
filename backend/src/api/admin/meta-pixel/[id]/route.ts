import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { META_PIXEL_MODULE } from "../../../../modules/meta-pixel"
import type MetaPixelModuleService from "../../../../modules/meta-pixel/service"

/**
 * GET /admin/meta-pixel/:id — Get single configuration
 */
export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const { id } = req.params
  const service = req.scope.resolve(META_PIXEL_MODULE) as MetaPixelModuleService

  try {
    const config = await service.retrieveMetaPixelConfig(id)
    res.json({ meta_pixel_config: config })
  } catch (error: any) {
    res.status(404).json({ error: "Meta Pixel config not found" })
  }
}

/**
 * POST /admin/meta-pixel/:id — Update a configuration
 *
 * Body: { pixel_id?, access_token?, test_event_code?, enabled? }
 */
export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const { id } = req.params
  const service = req.scope.resolve(META_PIXEL_MODULE) as MetaPixelModuleService

  try {
    const data = req.body as Record<string, any>
    const config = await service.updateMetaPixelConfigs({ id, ...data })
    res.json({ meta_pixel_config: config })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
}

/**
 * DELETE /admin/meta-pixel/:id — Delete a configuration
 */
export async function DELETE(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const { id } = req.params
  const service = req.scope.resolve(META_PIXEL_MODULE) as MetaPixelModuleService

  try {
    await service.deleteMetaPixelConfigs(id)
    res.json({ success: true, deleted: id })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
}
