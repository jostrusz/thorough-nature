// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MARKETING_MODULE } from "../../../../../modules/marketing"
import type MarketingModuleService from "../../../../../modules/marketing/service"

/**
 * Bulk contact actions — POST /admin/marketing/contacts/bulk
 *
 * Body:
 *   { action: "delete", ids: string[] }
 *   { action: "update_status", ids: string[], status: string }
 *   { action: "add_tags", ids: string[], tags: string[] }
 *   { action: "remove_tags", ids: string[], tags: string[] }
 *
 * Response: { action, processed, errors[] }
 *
 * Uses MedusaService CRUD methods — soft delete for deletes, regular update
 * for others. Iterates per id for error isolation (one bad row doesn't
 * abort the batch).
 */
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const service = req.scope.resolve(MARKETING_MODULE) as unknown as MarketingModuleService
    const body = (req.body as any) || {}
    const action = body.action
    const ids: string[] = Array.isArray(body.ids) ? body.ids.filter((x: any) => typeof x === "string" && x.length) : []

    if (!action) {
      res.status(400).json({ error: "action is required" })
      return
    }
    if (!ids.length) {
      res.status(400).json({ error: "ids array is required and must be non-empty" })
      return
    }

    let processed = 0
    const errors: any[] = []

    if (action === "delete") {
      for (const id of ids) {
        try {
          await service.deleteMarketingContacts(id)
          processed++
        } catch (e: any) {
          errors.push({ id, error: e?.message || String(e) })
        }
      }
    } else if (action === "update_status") {
      const status = String(body.status || "").trim()
      const ALLOWED = ["subscribed", "unsubscribed", "unconfirmed", "bounced", "complained", "suppressed"]
      if (!ALLOWED.includes(status)) {
        res.status(400).json({ error: `invalid status. allowed: ${ALLOWED.join(", ")}` })
        return
      }
      for (const id of ids) {
        try {
          const patch: any = { id, status }
          if (status === "unsubscribed") {
            patch.unsubscribed_at = new Date()
          } else if (status === "subscribed") {
            patch.consent_at = new Date()
          }
          await service.updateMarketingContacts(patch)
          processed++
        } catch (e: any) {
          errors.push({ id, error: e?.message || String(e) })
        }
      }
    } else if (action === "add_tags" || action === "remove_tags") {
      const tags: string[] = Array.isArray(body.tags)
        ? body.tags.map((t: any) => String(t).trim()).filter(Boolean)
        : []
      if (!tags.length) {
        res.status(400).json({ error: "tags array required" })
        return
      }
      for (const id of ids) {
        try {
          const [existing] = await service.listMarketingContacts({ id })
          if (!existing) {
            errors.push({ id, error: "not_found" })
            continue
          }
          const current: string[] = Array.isArray((existing as any).tags) ? (existing as any).tags : []
          const next = action === "add_tags"
            ? Array.from(new Set([...current, ...tags]))
            : current.filter((t) => !tags.includes(t))
          await service.updateMarketingContacts({ id, tags: next })
          processed++
        } catch (e: any) {
          errors.push({ id, error: e?.message || String(e) })
        }
      }
    } else {
      res.status(400).json({ error: `unknown action: ${action}` })
      return
    }

    res.json({ action, processed, errors })
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "internal_error" })
  }
}
