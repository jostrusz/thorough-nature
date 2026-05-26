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
    // Prefer exact locale match if provided, else fall back to any locale for the country.
    const params: any[] = [country]
    let sql = `
      SELECT bank_id, name, logo_url, sort_order, locale
      FROM brite_bank_logo
      WHERE country = $1
        AND is_active = true
        AND deleted_at IS NULL
    `
    if (locale) {
      params.push(locale)
      sql += ` AND locale = $2`
    }
    sql += ` ORDER BY sort_order ASC, name ASC`

    const { rows } = await pool.query(sql, params)

    // If a locale filter was requested but yielded nothing, retry without it
    // (e.g. en_GB requested but only sv_SE cached for the country).
    let banks = rows
    let resolvedLocale = locale
    if (locale && rows.length === 0) {
      const { rows: fallback } = await pool.query(
        `SELECT bank_id, name, logo_url, sort_order, locale
         FROM brite_bank_logo
         WHERE country = $1 AND is_active = true AND deleted_at IS NULL
         ORDER BY sort_order ASC, name ASC`,
        [country]
      )
      banks = fallback
      resolvedLocale = fallback[0]?.locale || null
    } else if (!locale) {
      resolvedLocale = rows[0]?.locale || null
    }

    res.json({
      country,
      locale: resolvedLocale,
      count: banks.length,
      banks: banks.map((b: any) => ({
        bank_id: b.bank_id,
        name: b.name,
        logo_url: b.logo_url,
        sort_order: b.sort_order,
      })),
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  } finally {
    await pool.end().catch(() => {})
  }
}
