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

    // Counts use the same status grouping as the frontend tabs:
    //   New    = status IN ('new', 'read')
    //   Solved = status = 'solved'
    //   Old    = anything else (excluding spam)
    //   Spam   = status = 'spam'
    //   Total  = everything except spam
    const sql = `
      SELECT
        COUNT(*) FILTER (WHERE status IN ('new', 'read'))::int                                    AS new,
        COUNT(*) FILTER (WHERE status = 'solved')::int                                            AS solved,
        COUNT(*) FILTER (WHERE status NOT IN ('new', 'read', 'solved', 'spam'))::int              AS old,
        COUNT(*) FILTER (WHERE status = 'spam')::int                                              AS spam,
        COUNT(*) FILTER (WHERE status <> 'spam')::int                                             AS total
      FROM supportbox_ticket
      WHERE ${where.join(" AND ")}
    `
    const { rows } = await pool.query(sql, params)
    const counts = rows[0] || { new: 0, solved: 0, old: 0, spam: 0, total: 0 }

    // Per-config breakdown — used for sidebar "new" badges per inbox.
    // Only computed when no config_id filter is set (i.e. the "All Inboxes" view).
    let perConfig: Record<string, number> = {}
    if (!configId) {
      const { rows: cfgRows } = await pool.query(`
        SELECT config_id, COUNT(*) FILTER (WHERE status IN ('new', 'read'))::int AS new_count
        FROM supportbox_ticket
        WHERE deleted_at IS NULL
        GROUP BY config_id
      `)
      perConfig = Object.fromEntries(cfgRows.map((r: any) => [r.config_id, r.new_count]))
    }

    res.json({ counts, per_config: perConfig })
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "internal_error" })
  } finally {
    await pool.end()
  }
}
