// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Pool } from "pg"
import { MARKETING_MODULE } from "../../../../../modules/marketing"
import type MarketingModuleService from "../../../../../modules/marketing/service"

const UPDATABLE_FIELDS = [
  "email",
  "phone",
  "first_name",
  "last_name",
  "locale",
  "country_code",
  "timezone",
  "status",
  "source",
  "consent_version",
  "consent_ip",
  "consent_user_agent",
  "consent_at",
  "unsubscribed_at",
  "external_id",
  "properties",
  "computed",
  "tags",
  "metadata",
]

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const id = (req.params as any).id
  // Enrich with brand info + flow activity (matches list endpoint shape).
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
  try {
    const sql = `
      SELECT
        c.*,
        b.display_name AS brand_display_name,
        b.slug AS brand_slug,
        b.project_id,
        EXISTS (
          SELECT 1 FROM marketing_flow_run fr
          WHERE fr.contact_id = c.id
            AND fr.brand_id = c.brand_id
            AND fr.state IN ('running','waiting')
        ) AS is_in_active_flow
      FROM marketing_contact c
      LEFT JOIN marketing_brand b ON b.id = c.brand_id AND b.deleted_at IS NULL
      WHERE c.id = $1 AND c.deleted_at IS NULL
      LIMIT 1
    `
    const { rows } = await pool.query(sql, [id])
    const contact = rows[0]
    if (!contact) {
      res.status(404).json({ error: "not_found" })
      return
    }
    res.json({ contact })
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "internal_error" })
  } finally {
    await pool.end()
  }
}

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const service = req.scope.resolve(MARKETING_MODULE) as unknown as MarketingModuleService
    const id = (req.params as any).id
    const body = (req.body as any) || {}

    const update: any = { id }
    for (const key of UPDATABLE_FIELDS) {
      if (key in body) {
        if ((key === "consent_at" || key === "unsubscribed_at") && body[key]) {
          update[key] = new Date(body[key])
        } else if (key === "email" && body.email) {
          update.email = String(body.email).toLowerCase().trim()
        } else {
          update[key] = body[key]
        }
      }
    }

    const contact = await service.updateMarketingContacts(update)
    res.json({ contact })
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "internal_error" })
  }
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const service = req.scope.resolve(MARKETING_MODULE) as unknown as MarketingModuleService
    const id = (req.params as any).id
    await service.deleteMarketingContacts(id)
    res.status(200).json({ id, deleted: true })
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "internal_error" })
  }
}
