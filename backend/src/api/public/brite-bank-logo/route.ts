// @ts-nocheck
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Pool } from "pg"

/**
 * Public bank-logo image for the admin orders list (and anywhere a Brite order's
 * paying bank should be shown as its own icon).
 *
 * GET /public/brite-bank-logo?bank_id=<opaque Brite bank id>
 *   → 200 image/png|svg  (the bank's official logo from brite_bank_logo)
 *   → 200 image/svg+xml  (a generic "Brite" badge) when bank_id is missing/unknown
 *
 * Bank logos are public brand assets, so this route needs no auth. Used as an
 * <img src>, so it always returns an image (never JSON / 404) to avoid broken
 * icons. bank_id is environment-specific but globally unique, so we match on it
 * regardless of mode.
 */

const BRITE_BADGE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="30" viewBox="0 0 48 30"><rect width="48" height="30" rx="5" fill="#FFE600"/><text x="24" y="20" font-family="Arial,Helvetica,sans-serif" font-size="11" font-weight="700" fill="#0A0B09" text-anchor="middle">Brite</text></svg>`

function sendBadge(res: MedusaResponse) {
  res.setHeader("Content-Type", "image/svg+xml")
  res.setHeader("Cache-Control", "public, max-age=86400")
  return res.end(BRITE_BADGE_SVG)
}

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const bankId = String((req.query?.bank_id as string) || "").trim()
  if (!bankId) return sendBadge(res)

  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
  try {
    const { rows } = await pool.query(
      `SELECT logo_url FROM brite_bank_logo
       WHERE bank_id = $1 AND logo_url LIKE 'data:image/%'
       ORDER BY updated_at DESC LIMIT 1`,
      [bankId]
    )
    const dataUri = rows[0]?.logo_url || ""
    const m = dataUri.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/)
    if (m) {
      res.setHeader("Content-Type", m[1])
      res.setHeader("Cache-Control", "public, max-age=86400")
      return res.end(Buffer.from(m[2], "base64"))
    }
  } catch {
    // fall through to the Brite badge
  } finally {
    await pool.end().catch(() => {})
  }
  return sendBadge(res)
}
