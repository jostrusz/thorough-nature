// @ts-nocheck
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { PRESALE_MODULE } from "../../../modules/presale"
import type PresaleModuleService from "../../../modules/presale/service"
import { generateSlug, pickAllowed, isUniqueViolation } from "./utils"

/**
 * GET /admin/presale
 * List presale pages. Optional ?domain= and ?status= filters.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve(PRESALE_MODULE) as PresaleModuleService

  try {
    const filters: Record<string, any> = {}
    if (req.query.domain) filters.domain = req.query.domain as string
    if (req.query.status) filters.status = req.query.status as string

    const pages = await service.listPresalePages(filters, {
      take: 200,
      order: { created_at: "DESC" },
    })

    res.json({ pages })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
}

/**
 * POST /admin/presale
 * Create a new presale page (whitelisted fields only).
 */
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve(PRESALE_MODULE) as PresaleModuleService

  try {
    const data = pickAllowed(req.body as Record<string, any>)

    if (!data.title || !data.domain) {
      res.status(400).json({ error: "title and domain are required" })
      return
    }
    if (!data.slug) data.slug = generateSlug(data.title)
    if (!data.slug) {
      res.status(400).json({ error: "could not generate slug from title" })
      return
    }
    if (data.status && !["draft", "published"].includes(data.status)) {
      res.status(400).json({ error: "status must be draft or published" })
      return
    }

    const existing = await service.listPresalePages(
      { domain: data.domain, slug: data.slug },
      { take: 1 }
    )
    if (existing.length > 0) {
      res.status(409).json({ error: `Slug "${data.slug}" already exists for ${data.domain}` })
      return
    }

    const page = await service.createPresalePages(data)
    res.status(201).json({ page })
  } catch (error: any) {
    if (isUniqueViolation(error)) {
      res.status(409).json({ error: "Slug already exists for this domain" })
      return
    }
    res.status(500).json({ error: error.message })
  }
}
