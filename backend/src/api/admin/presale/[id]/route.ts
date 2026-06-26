// @ts-nocheck
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { PRESALE_MODULE } from "../../../../modules/presale"
import type PresaleModuleService from "../../../../modules/presale/service"
import { pickAllowed, isUniqueViolation, buildSnapshot } from "../utils"
import { bareDomain } from "../railway-domains"

/**
 * GET /admin/presale/:id
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const { id } = req.params
  const service = req.scope.resolve(PRESALE_MODULE) as PresaleModuleService

  try {
    const page = await service.retrievePresalePage(id)
    res.json({ page })
  } catch (error: any) {
    res.status(404).json({ error: "Presale page not found" })
  }
}

/**
 * POST /admin/presale/:id
 * Update a presale page. Whitelisted fields only; snapshots the prior state
 * into a revision before overwriting.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const { id } = req.params
  const service = req.scope.resolve(PRESALE_MODULE) as PresaleModuleService

  try {
    const data = pickAllowed(req.body as Record<string, any>)

    // Normalize to the BARE domain (strip www/protocol) — serving matches bare.
    if (data.domain) data.domain = bareDomain(data.domain)

    if (data.status && !["draft", "published"].includes(data.status)) {
      res.status(400).json({ error: "status must be draft or published" })
      return
    }

    const current = await service.retrievePresalePage(id)

    // Duplicate check when slug/domain changes
    if (data.slug || data.domain) {
      const domain = data.domain || (current as any).domain
      const slug = data.slug || (current as any).slug
      const existing = await service.listPresalePages({ domain, slug }, { take: 1 })
      if (existing.length > 0 && (existing[0] as any).id !== id) {
        res.status(409).json({ error: `Slug "${slug}" already exists for ${domain}` })
        return
      }
    }

    // Snapshot the current state into a revision (fire and forget)
    service
      .createPresaleRevisions({
        presale_id: id,
        snapshot: buildSnapshot(current as any),
        note: "auto before update",
      })
      .catch(() => {})

    // id LAST so a stray id in the body can never override the path param
    const page = await service.updatePresalePages({ ...data, id })
    res.json({ page })
  } catch (error: any) {
    if (isUniqueViolation(error)) {
      res.status(409).json({ error: "Slug already exists for this domain" })
      return
    }
    res.status(500).json({ error: error.message })
  }
}

/**
 * DELETE /admin/presale/:id  (soft delete)
 */
export async function DELETE(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const { id } = req.params
  const service = req.scope.resolve(PRESALE_MODULE) as PresaleModuleService

  try {
    await service.deletePresalePages(id)
    res.json({ success: true, deleted: id })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
}
