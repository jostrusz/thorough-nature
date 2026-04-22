// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Pool } from "pg"

/**
 * GET /admin/supportbox/tickets/counts
 *
 * Lightweight counter endpoint for the inbox header cards
 * (New / Solved / Old / Spam / Total). Returns aggregate counts
 * filtered by config_id without loading any ticket bodies.
 *
 * <100ms even on large mailboxes.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const q = (req.query as any) || {}
  const configId = q.config_id ? String(q.config_id) : null

  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
  try {
    const where: string[] = ["deleted_at IS NULL"]
    const params: any[] = []
    if (configId) {
      params.push(configId)
      where.push(`config_id = $${params.length}`)
    }

    const sql = `
      SELECT
        COUNT(*) FILTER (WHERE status = 'new')::int    AS new,
        COUNT(*) FILTER (WHERE status = 'solved')::int AS solved,
        COUNT(*) FILTER (WHERE status = 'old')::int    AS old,
        COUNT(*) FILTER (WHERE status = 'spam')::int   AS spam,
        COUNT(*) FILTER (WHERE status <> 'spam')::int  AS total
      FROM supportbox_ticket
      WHERE ${where.join(" AND ")}
    `
    const { rows } = await pool.query(sql, params)
    const counts = rows[0] || { new: 0, solved: 0, old: 0, spam: 0, total: 0 }
    res.json({ counts })
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "internal_error" })
  } finally {
    await pool.end()
  }
}
