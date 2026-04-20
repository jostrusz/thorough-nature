// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Pool } from "pg"

/**
 * GET /admin/marketing/contacts/:id/activity
 *
 * Unified chronological timeline for a contact:
 *  - opt-in / consent changes (marketing_consent_log)
 *  - marketing events (form_submitted, order_placed, email_sent/opened/clicked)
 *  - attribution rows (order attributed to email click)
 *  - Medusa orders keyed by email (source of truth for purchases)
 *
 * Returns sorted DESC by occurred_at.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const id = String((req.params as any).id || "")
  if (!id) {
    res.status(400).json({ error: "id required" })
    return
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
  try {
    const { rows: contactRows } = await pool.query(
      `SELECT c.id, c.email, c.brand_id, c.created_at, b.project_id
       FROM marketing_contact c
       LEFT JOIN marketing_brand b ON b.id = c.brand_id AND b.deleted_at IS NULL
       WHERE c.id = $1 AND c.deleted_at IS NULL LIMIT 1`,
      [id]
    )
    const contact = contactRows[0]
    if (!contact) {
      res.status(404).json({ error: "not_found" })
      return
    }

    const events: any[] = []

    // ── 1. marketing_event rows for this contact ─────────────────────────
    try {
      const { rows } = await pool.query(
        `SELECT id, type, payload, occurred_at, source
         FROM marketing_event
         WHERE brand_id = $1 AND (contact_id = $2 OR lower(email) = lower($3))
           AND deleted_at IS NULL
         ORDER BY occurred_at DESC
         LIMIT 500`,
        [contact.brand_id, contact.id, contact.email]
      )
      for (const r of rows) {
        events.push({
          kind: "event",
          type: r.type,
          occurred_at: r.occurred_at,
          payload: r.payload || {},
          source: r.source,
        })
      }
    } catch {}

    // ── 2. consent log ───────────────────────────────────────────────────
    try {
      const { rows } = await pool.query(
        `SELECT action, source, ip_address, user_agent, occurred_at
         FROM marketing_consent_log
         WHERE brand_id = $1 AND (contact_id = $2 OR lower(email) = lower($3))
           AND deleted_at IS NULL
         ORDER BY occurred_at DESC
         LIMIT 200`,
        [contact.brand_id, contact.id, contact.email]
      )
      for (const r of rows) {
        events.push({
          kind: "consent",
          type: `consent_${r.action}`,
          occurred_at: r.occurred_at,
          payload: { source: r.source, ip: r.ip_address },
        })
      }
    } catch {}

    // ── 3. attribution rows ──────────────────────────────────────────────
    try {
      const { rows } = await pool.query(
        `SELECT order_id, order_display_id, order_total_eur, currency_code, order_total,
                click_at, order_placed_at, campaign_id, flow_id
         FROM marketing_attribution
         WHERE contact_id = $1 AND deleted_at IS NULL
         ORDER BY order_placed_at DESC
         LIMIT 200`,
        [contact.id]
      )
      for (const r of rows) {
        events.push({
          kind: "attribution",
          type: "email_attributed_order",
          occurred_at: r.order_placed_at,
          payload: {
            order_id: r.order_id,
            display_id: r.order_display_id,
            total: r.order_total,
            currency_code: r.currency_code,
            total_eur: r.order_total_eur,
            campaign_id: r.campaign_id,
            flow_id: r.flow_id,
          },
        })
      }
    } catch {}

    // ── 4. Medusa orders by email (source of truth for purchases) ────────
    // Scope to this brand's project_id only.
    if (contact.project_id) {
      try {
        const { rows } = await pool.query(
          `SELECT id, display_id, total, currency_code, created_at, metadata
           FROM "order"
           WHERE lower(email) = lower($1)
             AND metadata->>'project_id' = $2
           ORDER BY created_at DESC
           LIMIT 100`,
          [contact.email, contact.project_id]
        )
        for (const r of rows) {
          events.push({
            kind: "order",
            type: "order",
            occurred_at: r.created_at,
            payload: {
              order_id: r.id,
              display_id: r.display_id,
              custom_display_id: r.metadata?.custom_display_id,
              total: Number(r.total) || 0,
              currency_code: r.currency_code,
            },
          })
        }
      } catch {}
    }

    // Sort all events DESC by occurred_at
    events.sort((a, b) => {
      const at = new Date(a.occurred_at).getTime()
      const bt = new Date(b.occurred_at).getTime()
      return bt - at
    })

    res.json({
      contact: {
        id: contact.id,
        email: contact.email,
        brand_id: contact.brand_id,
        project_id: contact.project_id,
        created_at: contact.created_at,
      },
      events,
      total: events.length,
    })
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "internal_error" })
  } finally {
    await pool.end()
  }
}
