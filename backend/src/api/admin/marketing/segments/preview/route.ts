// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Pool } from "pg"
import { compileSegment } from "../../../../../modules/marketing/utils/segment-evaluator"

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const body = (req.body as any) || {}
    const brandId = body.brand_id
    const query = body.query

    if (!brandId) {
      res.status(400).json({ error: "brand_id is required" })
      return
    }

    const recipients = await runOneOffSegment(brandId, query)
    const count = recipients.length
    const sample = recipients.slice(0, 100).map((r: any) => r.email)
    res.json({ count, sample })
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "internal_error" })
  }
}

async function runOneOffSegment(brandId: string, query: any): Promise<any[]> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
  try {
    const baseWhere: string[] = []
    const baseParams: any[] = [brandId]

    baseWhere.push(`c.brand_id = $1`)
    baseWhere.push(`c.deleted_at IS NULL`)
    baseWhere.push(`c.status = 'subscribed'`)
    baseWhere.push(
      `NOT EXISTS (SELECT 1 FROM marketing_suppression s
                   WHERE s.brand_id = $1
                     AND lower(s.email) = lower(c.email)
                     AND s.deleted_at IS NULL)`
    )

    if (query) {
      const compiled = compileSegment(query, brandId)
      const remaining = compiled.params.slice(1)
      const offset = baseParams.length - 1
      const remapped = compiled.sql.replace(/\$(\d+)/g, (_, d) => {
        const num = Number(d)
        if (num === 1) return `$1`
        return `$${num + offset}`
      })
      baseWhere.push(`(${remapped})`)
      baseParams.push(...remaining)
    }

    const sql = `
      SELECT c.id, c.email, c.first_name, c.last_name, c.locale, c.country_code
      FROM marketing_contact c
      WHERE ${baseWhere.join(" AND ")}
      ORDER BY c.created_at DESC
      LIMIT 200000
    `
    const { rows } = await pool.query(sql, baseParams)
    return rows
  } finally {
    await pool.end()
  }
}
