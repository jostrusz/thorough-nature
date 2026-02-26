import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { PROJECT_SETTINGS_MODULE } from "../../../modules/project-settings"
import type ProjectSettingsModuleService from "../../../modules/project-settings/service"

/**
 * GET /admin/project-settings — List all project settings
 */
export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const service = req.scope.resolve(PROJECT_SETTINGS_MODULE) as ProjectSettingsModuleService
  const settings = await service.listProjectSettings()
  res.json({ project_settings: settings })
}

/**
 * POST /admin/project-settings — Create settings for a project
 *
 * Body: { project_id, order_bump_enabled?, upsell_enabled? }
 */
export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  try {
    const service = req.scope.resolve(PROJECT_SETTINGS_MODULE) as ProjectSettingsModuleService
    const data = req.body as Record<string, any>

    if (!data.project_id) {
      res.status(400).json({ error: "project_id is required" })
      return
    }

    const settings = await service.createProjectSettings(data)
    res.status(201).json({ project_setting: settings })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
}
