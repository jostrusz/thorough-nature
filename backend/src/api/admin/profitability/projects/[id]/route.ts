import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { PROFITABILITY_MODULE } from "../../../../../modules/profitability"
import type ProfitabilityModuleService from "../../../../../modules/profitability/service"

/**
 * GET /admin/profitability/projects/:id
 * Retrieve a single project config
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const { id } = req.params
  const service = req.scope.resolve(PROFITABILITY_MODULE) as ProfitabilityModuleService

  try {
    const project = await service.retrieveProjectConfig(id)
    res.json({ project })
  } catch (error: any) {
    res.status(404).json({ error: "Project config not found" })
  }
}

/**
 * POST /admin/profitability/projects/:id
 * Update an existing project config
 */
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const { id } = req.params
  const service = req.scope.resolve(PROFITABILITY_MODULE) as ProfitabilityModuleService

  try {
    const data = req.body as Record<string, any>
    const project = await service.updateProjectConfigs({ id, ...data })
    res.json({ project })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
}

/**
 * DELETE /admin/profitability/projects/:id
 * Delete a project config (and its daily stats)
 */
export async function DELETE(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const { id } = req.params
  const service = req.scope.resolve(PROFITABILITY_MODULE) as ProfitabilityModuleService

  try {
    // Delete associated daily stats first
    const stats = await service.listDailyProjectStats(
      { project_id: id } as any,
      { take: 10000 }
    )
    if (stats.length > 0) {
      await service.deleteDailyProjectStats(stats.map((s: any) => s.id))
    }

    await service.deleteProjectConfigs(id)
    res.json({ success: true, deleted: id })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
}
