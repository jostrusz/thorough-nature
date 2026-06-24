// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Pool } from "pg"
import { MARKETING_MODULE } from "../../../../modules/marketing"
import type MarketingModuleService from "../../../../modules/marketing/service"

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const service = req.scope.resolve(MARKETING_MODULE) as unknown as MarketingModuleService
    const q = (req.query as any) || {}
    const filters: any = {}
    if (q.brand_id) filters.brand_id = q.brand_id
    const lists = await service.listMarketingLists(filters)

    // Attach active member_count per list in a single query (no N+1)
    const listIds = (lists || []).map((l: any) => l.id).filter(Boolean)
    const countByListId: Record<string, number> = {}
    if (listIds.length > 0) {
      const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
      try {
        const { rows } = await pool.query(
          `SELECT list_id, COUNT(*)::int AS c
           FROM marketing_list_membership
           WHERE list_id = ANY($1::text[]) AND deleted_at IS NULL
           GROUP BY list_id`,
          [listIds]
        )
        for (const row of rows) {
          countByListId[row.list_id] = row.c
        }
      } finally {
        await pool.end()
      }
    }

    const listsWithCount = (lists || []).map((l: any) => ({
      ...l,
      member_count: countByListId[l.id] ?? 0,
    }))

    res.json({ lists: listsWithCount })
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "internal_error" })
  }
}

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const service = req.scope.resolve(MARKETING_MODULE) as unknown as MarketingModuleService
    const body = (req.body as any) || {}

    const required = ["brand_id", "name"]
    for (const key of required) {
      if (!body[key]) {
        res.status(400).json({ error: `${key} is required` })
        return
      }
    }

    const data: any = {
      brand_id: body.brand_id,
      name: body.name,
      description: body.description ?? null,
      type: body.type ?? "static",
      metadata: body.metadata ?? null,
    }

    const list = await service.createMarketingLists(data)
    res.status(201).json({ list })
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "internal_error" })
  }
}
