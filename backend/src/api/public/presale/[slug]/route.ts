// @ts-nocheck
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Pool } from "pg"
import { PRESALE_MODULE } from "../../../../modules/presale"
import type PresaleModuleService from "../../../../modules/presale/service"

/**
 * GET /public/presale/:slug?domain=xxx
 * Public, server-to-server route used by the storefront. Returns the published
 * presale page for (domain, slug). Increments view_count atomically WITHOUT
 * touching updated_at (raw SQL), so "last edited" stays meaningful.
 *
 * CORS is handled by the global /public/* middleware.
 */

let _pool: Pool | null = null
function getPool(): Pool {
  if (!_pool) {
    _pool = new Pool({ connectionString: process.env.DATABASE_URL })
  }
  return _pool
}

function normalizeDomain(raw: string): string {
  return String(raw || "")
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/+$/, "")
    .trim()
}

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const { slug } = req.params
  const domain = normalizeDomain(req.query.domain as string)

  if (!domain) {
    res.status(400).json({ found: false, error: "domain query param is required" })
    return
  }

  const service = req.scope.resolve(PRESALE_MODULE) as PresaleModuleService

  try {
    const pages = await service.listPresalePages(
      { domain, slug, status: "published" },
      { take: 1 }
    )

    if (pages.length === 0) {
      res.json({ found: false })
      return
    }

    const page = pages[0] as any

    // Atomic view increment — does not bump updated_at
    getPool()
      .query(
        `UPDATE presale_page SET view_count = view_count + 1 WHERE id = $1`,
        [page.id]
      )
      .catch(() => {
        // never block the response on a counter write
      })

    res.json({
      found: true,
      page: {
        id: page.id,
        domain: page.domain,
        title: page.title,
        title_cs: page.title_cs,
        slug: page.slug,
        type: page.type,
        html_content: page.html_content,
        meta_title: page.meta_title,
        meta_description: page.meta_description,
        og_image_url: page.og_image_url,
        facebook_pixel_id: page.facebook_pixel_id,
      },
    })
  } catch (error: any) {
    // Never leak internals on a public route
    res.status(500).json({ found: false, error: "internal error" })
  }
}
