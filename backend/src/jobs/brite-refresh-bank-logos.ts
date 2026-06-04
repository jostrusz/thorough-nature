// @ts-nocheck
/**
 * Daily refresh of Brite bank list (id + name + logo) per market.
 *
 * Source of truth: POST /api/bank.list (per country). This returns the REAL,
 * opaque bank_id ("ag9ofmFib25l...") used for pre-selection in the Web SDK
 * (client.start({ bank_id })) — NOT a filename-derived synthetic id.
 *
 * Each bank row: { id, name, country_id, enabled, logo(base64 data URI) }.
 * We cache them in `brite_bank_logo` so the storefront bank picker can render
 * them via /store/banks?country=XX without hitting Brite on every page load.
 *
 * Requires an active Brite gateway in gateway_config (client_id + client_secret).
 * Inert (skips) until that exists.
 *
 * Schedule: 03:15 every day (Bangkok local per CLAUDE.md → cron is local).
 */
import { Pool } from "pg"
import { BriteApiClient } from "../modules/payment-brite/api-client"

// Merchant markets (per Jaroslav): DE, AT, LU, NL, BE, SE, NO.
// Add more ISO-3166-1 alpha-2 (lowercase) codes if new markets go live.
const COUNTRIES = ["nl", "be", "de", "at", "lu", "se", "no"]

export default async function refreshBriteBankLogos(container: any) {
  const logger = container.resolve("logger")

  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })

  // Read active Brite gateway credentials (client_id + client_secret).
  let clientId: string | null = null
  let clientSecret: string | null = null
  let isTest = true
  let baseUrl: string | undefined

  try {
    const { rows } = await pool.query(
      `SELECT mode, live_keys, test_keys, metadata
       FROM gateway_config
       WHERE provider = 'brite' AND is_active = true AND deleted_at IS NULL
       ORDER BY priority ASC LIMIT 1`
    )
    if (rows[0]) {
      isTest = rows[0].mode !== "live"
      const keys = isTest ? rows[0].test_keys : rows[0].live_keys
      clientId = keys?.api_key || null         // DB "api_key" = Brite Client ID
      clientSecret = keys?.secret_key || null  // DB "secret_key" = Brite Client Secret
      baseUrl = rows[0].metadata?.base_url || undefined
    }
  } catch (e: any) {
    logger.error(`[Brite Refresh] gateway_config query failed: ${e.message}`)
  }

  if (!clientId || !clientSecret) {
    logger.warn(
      `[Brite Refresh] No active Brite gateway with client credentials — skipping daily bank.list refresh.`
    )
    await pool.end().catch(() => {})
    return
  }

  const client = new BriteApiClient(clientId, clientSecret, isTest, logger, baseUrl)
  try {
    await client.authenticate()
  } catch (e: any) {
    logger.error(`[Brite Refresh] authenticate failed: ${e.message}`)
    await pool.end().catch(() => {})
    return
  }

  let totalRows = 0
  let totalCountries = 0
  const failures: string[] = []

  for (const country of COUNTRIES) {
    try {
      const banks = await client.listBanks(country)
      if (!banks.length) {
        logger.info(`[Brite Refresh] ${country}: 0 banks (skipped)`)
        continue
      }

      // Replace rows for this country atomically
      const tx = await pool.connect()
      try {
        await tx.query("BEGIN")
        await tx.query(`DELETE FROM brite_bank_logo WHERE country = $1`, [country.toUpperCase()])
        let inserted = 0
        let sort = 0
        for (const b of banks) {
          if (b.enabled === false) continue
          if (!b.id || !b.name) continue
          const id = `bbl_${country}_${b.id}`
            .toLowerCase()
            .replace(/[^a-z0-9_]/g, "_")
            .slice(0, 120)

          await tx.query(
            `INSERT INTO brite_bank_logo
               (id, country, locale, bank_id, name, logo_url, sort_order, is_active, metadata, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8::jsonb, now(), now())
             ON CONFLICT (id) DO UPDATE SET
               name = EXCLUDED.name, logo_url = EXCLUDED.logo_url,
               sort_order = EXCLUDED.sort_order, bank_id = EXCLUDED.bank_id,
               metadata = EXCLUDED.metadata, updated_at = now(), deleted_at = null`,
            [
              id,
              country.toUpperCase(),
              country,                         // locale slot — store raw country for now
              b.id,                            // REAL Brite bank_id (opaque token)
              b.name,
              b.logo || "",                    // base64 data URI
              sort++,
              JSON.stringify({ enabled: b.enabled !== false, source: "bank.list" }),
            ]
          )
          inserted++
        }
        await tx.query("COMMIT")
        totalRows += inserted
        totalCountries++
        logger.info(`[Brite Refresh] ${country.toUpperCase()}: ${inserted} banks cached (real bank_id)`)
      } catch (txErr: any) {
        await tx.query("ROLLBACK").catch(() => {})
        throw txErr
      } finally {
        tx.release()
      }
    } catch (e: any) {
      failures.push(`${country}: ${e.message}`)
      logger.warn(`[Brite Refresh] ${country} failed: ${e.message}`)
    }
  }

  await pool.end().catch(() => {})

  logger.info(
    `[Brite Refresh] Done. Countries: ${totalCountries}/${COUNTRIES.length}, total banks: ${totalRows}` +
      (failures.length ? `. Failures: ${failures.join("; ")}` : "")
  )
}

export const config = {
  name: "brite-refresh-bank-logos",
  schedule: "15 3 * * *", // 03:15 daily
}
