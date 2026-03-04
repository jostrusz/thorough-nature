import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ADVERTORIAL_MODULE } from "../../../../modules/advertorial"
import type AdvertorialModuleService from "../../../../modules/advertorial/service"

/**
 * GET /store/advertorials/:slug?project_id=xxx
 * Public route — returns published advertorial page content.
 * Increments view_count on each request.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const { slug } = req.params
  const projectId = req.query.project_id as string

  if (!projectId) {
    res.status(400).json({ found: false, error: "project_id query param is required" })
    return
  }

  const service = req.scope.resolve(ADVERTORIAL_MODULE) as AdvertorialModuleService

  try {
    const pages = await service.listAdvertorialPages(
      { project_id: projectId, slug, status: "published" },
      { take: 1 }
    )

    if (pages.length === 0) {
      res.json({ found: false })
      return
    }

    const page = pages[0] as any

    // Increment view count (fire and forget — don't block response)
    service.updateAdvertorialPages({
      id: page.id,
      view_count: (page.view_count || 0) + 1,
    }).catch(() => {
      // Silently ignore view count errors
    })

    res.json({
      found: true,
      page: {
        id: page.id,
        title: page.title,
        slug: page.slug,
        html_content: page.html_content,
        meta_title: page.meta_title,
        meta_description: page.meta_description,
        og_image_url: page.og_image_url,
        facebook_pixel_id: page.facebook_pixel_id,
      },
    })
  } catch (error: any) {
    res.status(500).json({ found: false, error: error.message })
  }
}
