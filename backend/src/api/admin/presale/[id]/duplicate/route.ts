// @ts-nocheck
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { PRESALE_MODULE } from "../../../../../modules/presale"
import type PresaleModuleService from "../../../../../modules/presale/service"
import { generateSlug } from "../../utils"

/**
 * POST /admin/presale/:id/duplicate
 * Clone a presale page. Optional body: { domain?, title? }.
 * Always creates a draft with a fresh, collision-free slug.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const { id } = req.params
  const service = req.scope.resolve(PRESALE_MODULE) as PresaleModuleService

  try {
    const source = (await service.retrievePresalePage(id)) as any

    const body = (req.body || {}) as Record<string, any>
    const domain = body.domain || source.domain
    const title = body.title || `${source.title} (kopie)`

    // Find a unique slug for the target domain
    const base = generateSlug(title) || generateSlug(source.title) || "presale"
    let slug = base
    let n = 2
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const clash = await service.listPresalePages({ domain, slug }, { take: 1 })
      if (clash.length === 0) break
      slug = `${base}-${n++}`
      if (n > 50) {
        slug = `${base}-${Date.now()}`
        break
      }
    }

    const page = await service.createPresalePages({
      domain,
      slug,
      title,
      title_cs: source.title_cs,
      type: source.type,
      html_content: source.html_content,
      meta_title: source.meta_title,
      meta_description: source.meta_description,
      og_image_url: source.og_image_url,
      facebook_pixel_id: source.facebook_pixel_id,
      status: "draft",
    })

    res.status(201).json({ page })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
}
