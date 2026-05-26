// @ts-nocheck
/**
 * Daily refresh of Brite bank logos cache.
 *
 * Brite recommends polling the Service Presentation API once per day and
 * caching results. We call it per (locale × project gateway) and persist
 * rows into the `brite_bank_logo` table — the storefront then serves them
 * via /store/banks?country=XX.
 *
 * Locale → country map covers all merchant markets:
 *   nl_NL (NL), nl_BE (BE), fr_BE (BE), de_DE (DE), de_AT (AT), de_LU (LU),
 *   fr_LU (LU), sv_SE (SE), nb_NO (NO), en_GB (UK), pl_PL (PL), cs_CZ (CZ),
 *   da_DK (DK), fi_FI (FI), et_EE (EE), lt_LT (LT), lv_LV (LV), fr_FR (FR),
 *   it_IT (IT), es_ES (ES), pt_PT (PT)
 *
 * Schedule: 03:15 every day (Bangkok local time per CLAUDE.md → cron is local).
 */
import { Pool } from "pg"
import { BritePresentationClient } from "../modules/payment-brite/api-client"

// Locales we want to populate. Add more if a new market goes live.
const LOCALES: Array<{ locale: string; country: string }> = [
  { locale: "nl_NL", country: "NL" },
  { locale: "nl_BE", country: "BE" },
  { locale: "fr_BE", country: "BE" },
  { locale: "de_DE", country: "DE" },
  { locale: "de_AT", country: "AT" },
  { locale: "de_LU", country: "LU" },
  { locale: "fr_LU", country: "LU" },
  { locale: "sv_SE", country: "SE" },
  { locale: "nb_NO", country: "NO" },
  { locale: "en_GB", country: "GB" },
  { locale: "pl_PL", country: "PL" },
  { locale: "cs_CZ", country: "CZ" },
  { locale: "da_DK", country: "DK" },
  { locale: "fi_FI", country: "FI" },
  { locale: "et_EE", country: "EE" },
  { locale: "lt_LT", country: "LT" },
  { locale: "lv_LV", country: "LV" },
  { locale: "fr_FR", country: "FR" },
  { locale: "it_IT", country: "IT" },
  { locale: "es_ES", country: "ES" },
  { locale: "pt_PT", country: "PT" },
]

/**
 * Parse "https://.../bank-logos/DE/001_SPARKASSE_DE.svg" →
 *   { country: "DE", sort_order: 1, bank_id: "SPARKASSE_DE", name: "Sparkasse" }
 */
function parseBankLogoUrl(url: string, fallbackCountry: string): {
  country: string
  bank_id: string
  name: string
  sort_order: number
  filename: string
} | null {
  try {
    const parts = url.split("/")
    const filename = parts[parts.length - 1]                            // 001_SPARKASSE_DE.svg
    const stem = filename.replace(/\.[^.]+$/, "")                       // 001_SPARKASSE_DE
    const pathCountry = parts[parts.length - 2]                         // DE
    const m = stem.match(/^(\d+)_(.+?)_([A-Z]{2})$/)
    if (m) {
      const [, ord, rawName, country] = m
      return {
        country: country || pathCountry || fallbackCountry,
        sort_order: parseInt(ord, 10) || 0,
        bank_id: `${rawName}_${country}`,
        name: humanizeBankName(rawName),
        filename,
      }
    }
    // Looser fallback: take whatever's after the numeric prefix
    const m2 = stem.match(/^(?:(\d+)_)?(.+)$/)
    if (m2) {
      const [, ord, rawName] = m2
      return {
        country: pathCountry || fallbackCountry,
        sort_order: ord ? parseInt(ord, 10) : 0,
        bank_id: rawName,
        name: humanizeBankName(rawName.replace(/_[A-Z]{2}$/, "")),
        filename,
      }
    }
    return null
  } catch {
    return null
  }
}

/** "ABN_AMRO_NL" → "ABN AMRO"; "RABOBANK_NL" → "Rabobank" */
function humanizeBankName(raw: string): string {
  const dropCountry = raw.replace(/_[A-Z]{2}$/, "")
  return dropCountry
    .split("_")
    .map((w) => {
      // Keep all-caps acronyms (KBC, ING, ABN, SEB, DNB, BNP, BIL)
      if (w.length <= 4 && w === w.toUpperCase()) return w
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
    })
    .join(" ")
}

export default async function refreshBriteBankLogos(container: any) {
  const logger = container.resolve("logger")

  // Read active brite gateway config(s) — we need merchant_id to call
  // the Service Presentation API.
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
  let merchantId: string | null = null
  let isTest = true

  try {
    const { rows } = await pool.query(
      `SELECT mode, live_keys, test_keys
       FROM gateway_config
       WHERE provider = 'brite' AND is_active = true AND deleted_at IS NULL
       ORDER BY priority ASC LIMIT 1`
    )
    if (rows[0]) {
      isTest = rows[0].mode !== "live"
      const keys = isTest ? rows[0].test_keys : rows[0].live_keys
      // Brite Merchant ID stored under "account_id" (same field name reused
      // from Airwallex form — see service.ts comment).
      merchantId = keys?.account_id || null
    }
  } catch (e: any) {
    logger.error(`[Brite Refresh] gateway_config query failed: ${e.message}`)
  }

  if (!merchantId) {
    logger.warn(
      `[Brite Refresh] No active Brite gateway with merchant_id (account_id) configured — skipping daily refresh.`
    )
    await pool.end().catch(() => {})
    return
  }

  const presentation = new BritePresentationClient(merchantId, isTest, logger)

  let totalRows = 0
  let totalLocales = 0
  let failures: string[] = []

  for (const { locale, country } of LOCALES) {
    try {
      const assets = await presentation.fetchAssets(locale)
      const logos = assets.bank_logos || []
      if (!logos.length) {
        logger.info(`[Brite Refresh] ${locale}: 0 banks (skipped)`)
        continue
      }

      // Replace rows for this locale atomically
      const tx = await pool.connect()
      try {
        await tx.query("BEGIN")
        await tx.query(
          `DELETE FROM brite_bank_logo WHERE locale = $1`,
          [locale]
        )
        let inserted = 0
        for (const url of logos) {
          const parsed = parseBankLogoUrl(url, country)
          if (!parsed) continue
          // Generic Medusa-style ID (text PK, no FK constraints needed)
          const id = `bbl_${locale}_${parsed.bank_id}`
            .toLowerCase()
            .replace(/[^a-z0-9_]/g, "_")
            .slice(0, 80)

          await tx.query(
            `INSERT INTO brite_bank_logo
               (id, country, locale, bank_id, name, logo_url, sort_order, is_active, metadata, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8::jsonb, now(), now())
             ON CONFLICT (id) DO UPDATE SET
               country    = EXCLUDED.country,
               locale     = EXCLUDED.locale,
               bank_id    = EXCLUDED.bank_id,
               name       = EXCLUDED.name,
               logo_url   = EXCLUDED.logo_url,
               sort_order = EXCLUDED.sort_order,
               metadata   = EXCLUDED.metadata,
               updated_at = now(),
               deleted_at = null`,
            [
              id,
              parsed.country,
              locale,
              parsed.bank_id,
              parsed.name,
              url,
              parsed.sort_order,
              JSON.stringify({ filename: parsed.filename, raw_url: url }),
            ]
          )
          inserted++
        }
        await tx.query("COMMIT")
        totalRows += inserted
        totalLocales++
        logger.info(`[Brite Refresh] ${locale} (${country}): ${inserted} banks cached`)
      } catch (txErr: any) {
        await tx.query("ROLLBACK").catch(() => {})
        throw txErr
      } finally {
        tx.release()
      }
    } catch (e: any) {
      failures.push(`${locale}: ${e.message}`)
      logger.warn(`[Brite Refresh] ${locale} failed: ${e.message}`)
    }
  }

  await pool.end().catch(() => {})

  logger.info(
    `[Brite Refresh] Done. Locales: ${totalLocales}/${LOCALES.length}, total banks: ${totalRows}` +
      (failures.length ? `. Failures: ${failures.join("; ")}` : "")
  )
}

export const config = {
  name: "brite-refresh-bank-logos",
  schedule: "15 3 * * *", // 03:15 daily
}
