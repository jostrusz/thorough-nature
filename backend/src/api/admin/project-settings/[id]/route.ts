import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { PROJECT_SETTINGS_MODULE } from "../../../../modules/project-settings"
import type ProjectSettingsModuleService from "../../../../modules/project-settings/service"

/**
 * GET /admin/project-settings/:id — Get single project settings
 */
export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const { id } = req.params
  const service = req.scope.resolve(PROJECT_SETTINGS_MODULE) as ProjectSettingsModuleService

  try {
    const settings = await service.retrieveProjectSetting(id)
    res.json({ project_setting: settings })
  } catch (error: any) {
    res.status(404).json({ error: "Project settings not found" })
  }
}

/**
 * POST /admin/project-settings/:id — Update project settings
 *
 * Body: { order_bump_enabled?, upsell_enabled? }
 */
export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const { id } = req.params
  const service = req.scope.resolve(PROJECT_SETTINGS_MODULE) as ProjectSettingsModuleService

  try {
    const data = req.body as Record<string, any>
    const settings = await service.updateProjectSettings({ id, ...data })
    res.json({ project_setting: settings })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
}

/**
 * DELETE /admin/project-settings/:id — Delete project settings
 */
export async function DELETE(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const { id } = req.params
  const service = req.scope.resolve(PROJECT_SETTINGS_MODULE) as ProjectSettingsModuleService

  try {
    await service.deleteProjectSettings(id)
    res.json({ success: true, deleted: id })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
}
