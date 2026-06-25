// @ts-nocheck
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { PRESALE_MODULE } from "../../../modules/presale"
import type PresaleModuleService from "../../../modules/presale/service"
import {
  generateSlug,
  pickAllowed,
  isUniqueViolation,
  buildSnapshot,
  translateHeadline,
  ALLOWED_FIELDS,
} from "../../admin/presale/utils"

/**
 * POST /public/presale-admin
 * Token-gated write API for the presale MCP server. Centralizes ALL writes
 * through the same module service the admin UI uses (so ID generation, slug
 * dedup and field whitelisting stay identical — no drift, no direct SQL).
 *
 * Auth: header `x-presale-token` or body.token must equal PRESALE_MCP_TOKEN.
 * Body: { action, ...params }.
 *
 * Actions: list, get, create, update, duplicate, translate, publish,
 *          delete, list_revisions, rollback.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const expected = process.env.PRESALE_MCP_TOKEN
  const body = (req.body || {}) as Record<string, any>
  const provided = (req.headers["x-presale-token"] as string) || body.token

  if (!expected) {
    res.status(503).json({ error: "PRESALE_MCP_TOKEN not configured on server" })
    return
  }
  if (!provided || provided !== expected) {
    res.status(401).json({ error: "unauthorized" })
    return
  }

  const service = req.scope.resolve(PRESALE_MODULE) as PresaleModuleService
  const action = (body.action || "").toString()

  try {
    switch (action) {
      case "list": {
        const filters: Record<string, any> = {}
        if (body.domain) filters.domain = body.domain
        if (body.status) filters.status = body.status
        const pages = await service.listPresalePages(filters, {
          take: Math.min(Number(body.limit) || 200, 500),
          order: { created_at: "DESC" },
        })
        res.json({ pages })
        return
      }

      case "get": {
        if (!body.id) return void res.status(400).json({ error: "id is required" })
        const page = await service.retrievePresalePage(body.id)
        res.json({ page })
        return
      }

      case "create": {
        const data = pickAllowed(body)
        if (!data.title || !data.domain) {
          return void res.status(400).json({ error: "title and domain are required" })
        }
        if (!data.slug) data.slug = generateSlug(data.title)
        if (!data.slug) {
          return void res.status(400).json({ error: "could not generate slug from title" })
        }
        if (data.status && !["draft", "published"].includes(data.status)) {
          return void res.status(400).json({ error: "status must be draft or published" })
        }
        const existing = await service.listPresalePages(
          { domain: data.domain, slug: data.slug },
          { take: 1 }
        )
        if (existing.length > 0) {
          return void res.status(409).json({ error: `Slug "${data.slug}" already exists for ${data.domain}` })
        }
        const page = await service.createPresalePages(data)
        res.status(201).json({ page })
        return
      }

      case "update": {
        if (!body.id) return void res.status(400).json({ error: "id is required" })
        const data = pickAllowed(body)
        if (data.status && !["draft", "published"].includes(data.status)) {
          return void res.status(400).json({ error: "status must be draft or published" })
        }
        const current = (await service.retrievePresalePage(body.id)) as any
        if (data.slug || data.domain) {
          const domain = data.domain || current.domain
          const slug = data.slug || current.slug
          const clash = await service.listPresalePages({ domain, slug }, { take: 1 })
          if (clash.length > 0 && (clash[0] as any).id !== body.id) {
            return void res.status(409).json({ error: `Slug "${slug}" already exists for ${domain}` })
          }
        }
        service
          .createPresaleRevisions({
            presale_id: body.id,
            snapshot: buildSnapshot(current),
            note: "auto before mcp update",
          })
          .catch(() => {})
        const page = await service.updatePresalePages({ ...data, id: body.id })
        res.json({ page })
        return
      }

      case "duplicate": {
        if (!body.id) return void res.status(400).json({ error: "id is required" })
        const source = (await service.retrievePresalePage(body.id)) as any
        const domain = body.domain || source.domain
        const title = body.title || `${source.title} (kopie)`
        const base = generateSlug(title) || generateSlug(source.title) || "presale"
        let slug = base
        let n = 2
        while (true) {
          const clash = await service.listPresalePages({ domain, slug }, { take: 1 })
          if (clash.length === 0) break
          slug = `${base}-${n++}`
          if (n > 50) { slug = `${base}-${Date.now()}`; break }
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
        return
      }

      case "translate": {
        const title = (body.title || "").toString()
        if (!title.trim()) return void res.status(400).json({ error: "title is required" })
        const translation = await translateHeadline(title, (body.target_lang || "cs").toString())
        res.json({ translation })
        return
      }

      case "publish": {
        if (!body.id) return void res.status(400).json({ error: "id is required" })
        const status = (body.status || "published").toString()
        if (!["draft", "published"].includes(status)) {
          return void res.status(400).json({ error: "status must be draft or published" })
        }
        const page = await service.updatePresalePages({ id: body.id, status })
        res.json({ page })
        return
      }

      case "delete": {
        if (!body.id) return void res.status(400).json({ error: "id is required" })
        await service.deletePresalePages(body.id)
        res.json({ success: true, deleted: body.id })
        return
      }

      case "list_revisions": {
        if (!body.id) return void res.status(400).json({ error: "id is required" })
        const revisions = await service.listPresaleRevisions(
          { presale_id: body.id },
          { take: 50, order: { created_at: "DESC" } }
        )
        res.json({ revisions })
        return
      }

      case "rollback": {
        if (!body.id || !body.revision_id) {
          return void res.status(400).json({ error: "id and revision_id are required" })
        }
        const revision = (await service.retrievePresaleRevision(body.revision_id)) as any
        if (revision.presale_id !== body.id) {
          return void res.status(400).json({ error: "revision does not belong to this presale page" })
        }
        let snapshot: Record<string, any>
        try { snapshot = JSON.parse(revision.snapshot) } catch {
          return void res.status(500).json({ error: "corrupt revision snapshot" })
        }
        const current = (await service.retrievePresalePage(body.id)) as any
        service.createPresaleRevisions({
          presale_id: body.id,
          snapshot: buildSnapshot(current),
          note: "auto before mcp rollback",
        }).catch(() => {})
        const data: Record<string, any> = {}
        for (const key of ALLOWED_FIELDS) {
          if (snapshot[key] !== undefined) data[key] = snapshot[key]
        }
        const page = await service.updatePresalePages({ ...data, id: body.id })
        res.json({ page })
        return
      }

      case "list_domains": {
        let projects: any[] = []
        try {
          const prof = req.scope.resolve("profitability") as any
          projects = await prof.listProjectConfigs({}, { order: { display_order: "ASC" }, take: 100 })
        } catch {
          projects = []
        }
        const domains = (projects || [])
          .filter((p: any) => p && p.domain)
          .map((p: any) => ({
            domain: p.domain,
            project_name: p.project_name,
            flag_emoji: p.flag_emoji,
            country_tag: p.country_tag,
          }))
        res.json({ domains })
        return
      }

      default:
        res.status(400).json({ error: `unknown action: ${action}` })
    }
  } catch (error: any) {
    if (isUniqueViolation(error)) {
      res.status(409).json({ error: "Slug already exists for this domain" })
      return
    }
    res.status(500).json({ error: error.message })
  }
}
