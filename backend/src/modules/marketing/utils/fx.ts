import { Pool } from "pg"

/**
 * FX conversion to EUR.
 *
 * Strategy:
 *   1. Try marketing_fx_rate table for a row with matching currency and
 *      as_of_date <= asOf (most recent).
 *   2. Fall back to a hardcoded rough table for common project currencies
 *      (EUR, CZK, PLN, SEK, GBP, USD, CHF, DKK, NOK). Used when the table
 *      hasn't been seeded yet — values are conservative so gross revenue
 *      roll-ups are directionally correct, not accounting-accurate.
 *
 * Precision: results rounded to 4 decimals (matches numeric(14,4)).
 * All inputs/outputs are in MAJOR currency units (euros, not cents).
 */

const FALLBACK_RATES_TO_EUR: Record<string, number> = {
  EUR: 1,
  CZK: 0.0395,   // 1 CZK ≈ 0.0395 EUR (rough; seed daily for accurate reports)
  PLN: 0.2350,
  SEK: 0.0870,
  GBP: 1.17,
  USD: 0.92,
  CHF: 1.05,
  DKK: 0.1340,
  NOK: 0.0860,
  HUF: 0.00255,
  RON: 0.2010,
  BGN: 0.5110,
}

export type FxLookupResult = {
  rate: number
  source: "table" | "fallback" | "identity"
  as_of_date: string | null
}

export async function getRateToEur(
  pool: Pool,
  currencyCode: string,
  asOf: Date = new Date()
): Promise<FxLookupResult> {
  const code = (currencyCode || "").toUpperCase().trim()
  if (!code || code === "EUR") {
    return { rate: 1, source: "identity", as_of_date: null }
  }

  try {
    const { rows } = await pool.query(
      `SELECT rate_to_eur, as_of_date
       FROM marketing_fx_rate
       WHERE currency_code = $1 AND as_of_date <= $2::date
       ORDER BY as_of_date DESC
       LIMIT 1`,
      [code, asOf.toISOString().slice(0, 10)]
    )
    if (rows[0]) {
      const rate = Number(rows[0].rate_to_eur)
      if (Number.isFinite(rate) && rate > 0) {
        return {
          rate,
          source: "table",
          as_of_date: rows[0].as_of_date instanceof Date
            ? rows[0].as_of_date.toISOString().slice(0, 10)
            : String(rows[0].as_of_date),
        }
      }
    }
  } catch {
    // swallow — fall through to fallback
  }

  const fallback = FALLBACK_RATES_TO_EUR[code]
  if (fallback) {
    return { rate: fallback, source: "fallback", as_of_date: null }
  }

  // Unknown currency — return identity so caller can decide (rare case; every
  // project uses one of the codes above).
  return { rate: 1, source: "fallback", as_of_date: null }
}

export function toEur(amountMajor: number, rateToEur: number): number {
  if (!Number.isFinite(amountMajor) || !Number.isFinite(rateToEur)) return 0
  return Math.round(amountMajor * rateToEur * 10000) / 10000
}
