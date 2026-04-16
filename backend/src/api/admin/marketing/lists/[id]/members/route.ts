// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Pool } from "pg"
import { MARKETING_MODULE } from "../../../../../../modules/marketing"
import type MarketingModuleService from "../../../../../../modules/marketing/service"

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const list_id = (req.params as any).id
  const q = (req.query as any) || {}
  const limit = Math.min(500, Math.max(1, Number(q.limit ?? 100)))
  const offset = Math.max(0, Number(q.offset ?? 0))

  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
  try {
    const countRes = await pool.query(
      `SELECT COUNT(*)::int AS c
       FROM marketing_list_membership m
       WHERE m.list_id = $1 AND m.deleted_at IS NULL`,
      [list_id]
    )
    const total = countRes.rows[0]?.c ?? 0

    const { rows } = await pool.query(
      `SELECT m.id AS membership_id, m.added_at, m.source,
              c.id AS contact_id, c.email, c.first_name, c.last_name, c.status
       FROM marketing_list_membership m
       JOIN marketing_contact c ON c.id = m.contact_id AND c.deleted_at IS NULL
       WHERE m.list_id = $1 AND m.deleted_at IS NULL
       ORDER BY m.added_at DESC
       LIMIT $2 OFFSET $3`,
      [list_id, limit, offset]
    )

    res.json({ members: rows, count: total, limit, offset })
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "internal_error" })
  } finally {
    await pool.end()
  }
}

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const service = req.scope.resolve(MARKETING_MODULE) as unknown as MarketingModuleService
    const list_id = (req.params as any).id
    const body = (req.body as any) || {}

    const [list] = await service.listMarketingLists({ id: list_id })
    if (!list) {
      res.status(404).json({ error: "list_not_found" })
      return
    }
    const brand_id = (list as any).brand_id

    // Resolve contact_ids list
    let contactIds: string[] = Array.isArray(body.contact_ids) ? body.contact_ids : []

    if (Array.isArray(body.emails) && body.emails.length > 0) {
      const emails = body.emails.map((e: string) => String(e).toLowerCase().trim())
      const foundContacts = await service.listMarketingContacts({ brand_id, email: emails })
      for (const c of foundContacts) {
        if (!contactIds.includes((c as any).id)) contactIds.push((c as any).id)
      }
    }

    if (contactIds.length === 0) {
      res.status(400).json({ error: "no_contacts_resolved" })
      return
    }

    let added = 0
    let skipped = 0
    for (const contact_id of contactIds) {
      const existing = await service.listMarketingListMemberships({
        list_id,
        contact_id,
      })
      if (existing && existing.length > 0) {
        skipped++
        continue
      }
      await service.createMarketingListMemberships({
        list_id,
        contact_id,
        brand_id,
        source: body.source ?? "manual",
        added_at: new Date(),
      })
      added++
    }

    res.json({ added, skipped })
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "internal_error" })
  }
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const service = req.scope.resolve(MARKETING_MODULE) as unknown as MarketingModuleService
    const list_id = (req.params as any).id
    const q = (req.query as any) || {}

    const contactIdsStr = q.contact_ids
    if (!contactIdsStr) {
      res.status(400).json({ error: "contact_ids query param is required" })
      return
    }
    const contactIds = String(contactIdsStr)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)

    let removed = 0
    for (const contact_id of contactIds) {
      const existing = await service.listMarketingListMemberships({ list_id, contact_id })
      for (const m of existing) {
        await service.deleteMarketingListMemberships((m as any).id)
        removed++
      }
    }

    res.json({ removed })
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "internal_error" })
  }
}
