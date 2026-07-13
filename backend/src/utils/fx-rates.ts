/**
 * Fixed exchange rates to EUR — single source of truth for profitability.
 *
 * Rate = how many EUR per 1 unit of foreign currency (inverse of ECB EUR base).
 * Source: ECB via frankfurter.dev, updated manually.
 * Last update: 2026-07-13 (1 EUR = 24.262 CZK, 11.027 SEK, 11.1595 NOK,
 * 4.3238 PLN, 356.78 HUF, 1.1424 USD, 0.8533 GBP)
 */
export const TO_EUR_RATES: Record<string, number> = {
  EUR: 1,
  SEK: 0.0907,
  NOK: 0.0896,
  CZK: 0.0412,
  PLN: 0.2313,
  USD: 0.8754,
  GBP: 1.1719,
  HUF: 0.002803,
  DKK: 0.1341,
}

/** Convert amount from a currency to EUR */
export function toEur(amount: number, currencyCode: string): number {
  const rate = TO_EUR_RATES[(currencyCode || "EUR").toUpperCase()] ?? 1
  return amount * rate
}
