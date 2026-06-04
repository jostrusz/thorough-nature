// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Pool } from "pg"

/**
 * GET /store/banks?country=NL[&locale=nl_NL]
 *
 * Returns the Brite-supported banks for the given country (or locale), used by
 * the storefront bank picker to render bank tiles below the country selector.
 *
 * Response:
 *   {
 *     country: "NL",
 *     locale:  "nl_NL",
 *     banks: [
 *       { bank_id, name, logo_url, sort_order }, ...
 *     ]
 *   }
 *
 * Public, no auth (publishable API key handled by Medusa store middleware).
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const country = String(req.query.country || "").toUpperCase().trim()
  const locale = String(req.query.locale || "").trim() || null

  if (!country || country.length !== 2) {
    return res.status(400).json({ error: "Missing or invalid `country` (ISO-3166-1 alpha-2)" })
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
  try {
    // Determine which bank_id set to return: it MUST match the active Brite
    // gateway's mode, because bank_id values are environment-specific (sandbox
    // ids differ from production ids). An explicit ?mode=test|live overrides.
    let mode = String(req.query.mode || "").toLowerCase()
    if (mode !== "test" && mode !== "live") {
      const { rows: gw } = await pool.query(
        `SELECT mode FROM gateway_config
         WHERE provider = 'brite' AND is_active = true AND deleted_at IS NULL
         ORDER BY priority ASC LIMIT 1`
      )
      mode = gw[0]?.mode === "live" ? "live" : "test"
    }

    const { rows } = await pool.query(
      `SELECT bank_id, name, logo_url, sort_order
       FROM brite_bank_logo
       WHERE country = $1 AND mode = $2 AND is_active = true AND deleted_at IS NULL
       ORDER BY sort_order ASC, name ASC`,
      [country, mode]
    )

    res.json({
      country,
      mode,
      count: rows.length,
      banks: rows.map((b: any) => ({
        bank_id: b.bank_id,
        name: b.name,
        logo_url: b.logo_url || null,
        sort_order: b.sort_order,
      })),
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  } finally {
    await pool.end().catch(() => {})
  }
}
