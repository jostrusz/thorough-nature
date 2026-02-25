import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { FAKTUROID_MODULE } from "../../../../modules/fakturoid"
import type FakturoidModuleService from "../../../../modules/fakturoid/service"

/**
 * GET /admin/fakturoid/:id — Get single configuration
 */
export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const { id } = req.params
  const service = req.scope.resolve(
    FAKTUROID_MODULE
  ) as unknown as FakturoidModuleService

  try {
    const config = await service.retrieveFakturoidConfig(id)
    res.json({ fakturoid_config: config })
  } catch (error: any) {
    res.status(404).json({ error: "Fakturoid config not found" })
  }
}

/**
 * POST /admin/fakturoid/:id — Update a configuration
 *
 * Body: { slug?, client_id?, client_secret?, user_agent_email?, default_language?, enabled? }
 */
export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const { id } = req.params
  const service = req.scope.resolve(
    FAKTUROID_MODULE
  ) as unknown as FakturoidModuleService

  try {
    const data = req.body as Record<string, any>
    const config = await service.updateFakturoidConfigs({ id, ...data })
    res.json({ fakturoid_config: config })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
}

/**
 * DELETE /admin/fakturoid/:id — Delete a configuration
 */
export async function DELETE(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const { id } = req.params
  const service = req.scope.resolve(
    FAKTUROID_MODULE
  ) as unknown as FakturoidModuleService

  try {
    await service.deleteFakturoidConfigs(id)
    res.json({ success: true, deleted: id })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
}
