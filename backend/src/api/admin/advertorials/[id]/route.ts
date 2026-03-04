import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ADVERTORIAL_MODULE } from "../../../../modules/advertorial"
import type AdvertorialModuleService from "../../../../modules/advertorial/service"

/**
 * GET /admin/advertorials/:id
 * Retrieve a single advertorial page.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const { id } = req.params
  const service = req.scope.resolve(ADVERTORIAL_MODULE) as AdvertorialModuleService

  try {
    const page = await service.retrieveAdvertorialPage(id)
    res.json({ page })
  } catch (error: any) {
    res.status(404).json({ error: "Advertorial page not found" })
  }
}

/**
 * POST /admin/advertorials/:id
 * Update an existing advertorial page.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const { id } = req.params
  const service = req.scope.resolve(ADVERTORIAL_MODULE) as AdvertorialModuleService

  try {
    const data = req.body as Record<string, any>

    // If slug is being changed, check for duplicates
    if (data.slug) {
      // Get current page to know the project_id
      const current = await service.retrieveAdvertorialPage(id)
      const projectId = data.project_id || (current as any).project_id

      const existing = await service.listAdvertorialPages(
        { project_id: projectId, slug: data.slug },
        { take: 1 }
      )
      if (existing.length > 0 && (existing[0] as any).id !== id) {
        res.status(409).json({
          error: `Slug "${data.slug}" already exists for this project`,
        })
        return
      }
    }

    const page = await service.updateAdvertorialPages({ id, ...data })
    res.json({ page })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
}

/**
 * DELETE /admin/advertorials/:id
 * Delete an advertorial page.
 */
export async function DELETE(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const { id } = req.params
  const service = req.scope.resolve(ADVERTORIAL_MODULE) as AdvertorialModuleService

  try {
    await service.deleteAdvertorialPages(id)
    res.json({ success: true, deleted: id })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
}
