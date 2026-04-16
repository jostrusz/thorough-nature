// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Pool } from "pg"
import { MARKETING_MODULE } from "../../../../modules/marketing"
import type MarketingModuleService from "../../../../modules/marketing/service"

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const q = (req.query as any) || {}
  const brand_id = q.brand_id
  if (!brand_id) {
    res.status(400).json({ error: "brand_id is required" })
    return
  }

  const limit = Math.min(500, Math.max(1, Number(q.limit ?? 50)))
  const offset = Math.max(0, Number(q.offset ?? 0))

  // If email filter provided, use raw pg for ILIKE substring match.
  if (q.email) {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
    try {
      const where: string[] = ["brand_id = $1", "deleted_at IS NULL", "email ILIKE $2"]
      const params: any[] = [brand_id, `%${q.email}%`]
      if (q.status) {
        params.push(q.status)
        where.push(`status = $${params.length}`)
      }

      const sqlCount = `SELECT COUNT(*)::int AS c FROM marketing_contact WHERE ${where.join(" AND ")}`
      const countRes = await pool.query(sqlCount, params)
      const total = countRes.rows[0]?.c ?? 0

      params.push(limit, offset)
      const sql = `
        SELECT * FROM marketing_contact
        WHERE ${where.join(" AND ")}
        ORDER BY created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}
      `
      const { rows } = await pool.query(sql, params)
      res.json({ contacts: rows, count: total, limit, offset })
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "internal_error" })
    } finally {
      await pool.end()
    }
    return
  }

  try {
    const service = req.scope.resolve(MARKETING_MODULE) as unknown as MarketingModuleService
    const filters: any = { brand_id }
    if (q.status) filters.status = q.status

    const contacts = await service.listMarketingContacts(filters, {
      take: limit,
      skip: offset,
      order: { created_at: "DESC" },
    })
    res.json({ contacts, limit, offset })
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "internal_error" })
  }
}

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const service = req.scope.resolve(MARKETING_MODULE) as unknown as MarketingModuleService
    const body = (req.body as any) || {}

    const required = ["brand_id", "email"]
    for (const key of required) {
      if (!body[key]) {
        res.status(400).json({ error: `${key} is required` })
        return
      }
    }

    const data: any = {
      brand_id: body.brand_id,
      email: String(body.email).toLowerCase().trim(),
      phone: body.phone ?? null,
      first_name: body.first_name ?? null,
      last_name: body.last_name ?? null,
      locale: body.locale ?? null,
      country_code: body.country_code ?? null,
      timezone: body.timezone ?? null,
      status: body.status ?? "unconfirmed",
      source: body.source ?? "manual",
      consent_version: body.consent_version ?? null,
      consent_ip: body.consent_ip ?? null,
      consent_user_agent: body.consent_user_agent ?? null,
      consent_at: body.consent_at ? new Date(body.consent_at) : null,
      external_id: body.external_id ?? null,
      properties: body.properties ?? null,
      tags: body.tags ?? null,
      metadata: body.metadata ?? null,
    }

    const contact = await service.createMarketingContacts(data)
    res.status(201).json({ contact })
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "internal_error" })
  }
}
