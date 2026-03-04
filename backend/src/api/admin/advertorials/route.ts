import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ADVERTORIAL_MODULE } from "../../../modules/advertorial"
import type AdvertorialModuleService from "../../../modules/advertorial/service"
import { generateSlug } from "./utils"

/**
 * GET /admin/advertorials
 * List all advertorial pages. Optional ?project_id=xxx filter.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve(ADVERTORIAL_MODULE) as AdvertorialModuleService

  try {
    const filters: Record<string, any> = {}
    if (req.query.project_id) {
      filters.project_id = req.query.project_id as string
    }
    if (req.query.status) {
      filters.status = req.query.status as string
    }

    const pages = await service.listAdvertorialPages(
      filters,
      {
        take: 200,
        order: { created_at: "DESC" },
      }
    )

    res.json({ pages })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
}

/**
 * POST /admin/advertorials
 * Create a new advertorial page.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve(ADVERTORIAL_MODULE) as AdvertorialModuleService

  try {
    const data = req.body as Record<string, any>

    if (!data.title || !data.project_id) {
      res.status(400).json({ error: "title and project_id are required" })
      return
    }

    // Auto-generate slug if not provided
    if (!data.slug) {
      data.slug = generateSlug(data.title)
    }

    // Check for duplicate slug within this project
    const existing = await service.listAdvertorialPages(
      { project_id: data.project_id, slug: data.slug },
      { take: 1 }
    )
    if (existing.length > 0) {
      res.status(409).json({
        error: `Slug "${data.slug}" already exists for this project`,
      })
      return
    }

    const page = await service.createAdvertorialPages(data)
    res.status(201).json({ page })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
}
