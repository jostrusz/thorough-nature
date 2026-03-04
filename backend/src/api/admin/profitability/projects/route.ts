import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { PROFITABILITY_MODULE } from "../../../../modules/profitability"
import type ProfitabilityModuleService from "../../../../modules/profitability/service"

/**
 * GET /admin/profitability/projects
 * List all project configs, ordered by display_order
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve(PROFITABILITY_MODULE) as ProfitabilityModuleService

  try {
    const projects = await service.listProjectConfigs(
      {},
      { order: { display_order: "ASC" }, take: 100 }
    )
    res.json({ projects })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
}

/**
 * POST /admin/profitability/projects
 * Create a new project config
 */
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve(PROFITABILITY_MODULE) as ProfitabilityModuleService

  try {
    const data = req.body as Record<string, any>

    if (!data.project_name || !data.project_slug) {
      res.status(400).json({ error: "project_name and project_slug are required" })
      return
    }

    const project = await service.createProjectConfigs(data)
    res.status(201).json({ project })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
}
