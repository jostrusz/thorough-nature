import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { PROJECT_SETTINGS_MODULE } from "../../../modules/project-settings"
import type ProjectSettingsModuleService from "../../../modules/project-settings/service"

/**
 * GET /store/project-settings?project_id=loslatenboek
 *
 * Public endpoint for storefront to fetch project toggles (order bump, upsell).
 * Only returns toggle flags, no sensitive data.
 */
export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const projectId = req.query.project_id as string

  if (!projectId) {
    res.status(400).json({ error: "project_id query parameter is required" })
    return
  }

  const service = req.scope.resolve(PROJECT_SETTINGS_MODULE) as ProjectSettingsModuleService

  try {
    const allSettings = await service.listProjectSettings({ project_id: projectId })

    if (allSettings.length === 0) {
      // No settings configured — return defaults (everything enabled)
      res.json({
        project_setting: {
          project_id: projectId,
          order_bump_enabled: true,
          upsell_enabled: true,
          foxentry_api_key: null,
          promo_codes: null,
        },
      })
      return
    }

    const s = allSettings[0] as any
    res.json({
      project_setting: {
        project_id: s.project_id,
        order_bump_enabled: s.order_bump_enabled,
        upsell_enabled: s.upsell_enabled,
        foxentry_api_key: s.foxentry_api_key || null,
        promo_codes: s.promo_codes || null,
      },
    })
  } catch (error: any) {
    // On error, return defaults so checkout doesn't break
    res.json({
      project_setting: {
        project_id: projectId,
        order_bump_enabled: true,
        upsell_enabled: true,
        foxentry_api_key: null,
        promo_codes: null,
      },
    })
  }
}
