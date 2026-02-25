/**
 * Shared multi-currency formatting utility
 * Supports: EUR, CZK, PLN, SEK, HUF
 */

interface CurrencyConfig {
  symbol: string
  position: "before" | "after"
  decimals: number
  thousandSep: string
  decimalSep: string
}

const CURRENCY_CONFIG: Record<string, CurrencyConfig> = {
  EUR: { symbol: "\u20AC", position: "before", decimals: 2, thousandSep: ",", decimalSep: "." },
  CZK: { symbol: "K\u010D", position: "after", decimals: 2, thousandSep: "\u00A0", decimalSep: "," },
  PLN: { symbol: "z\u0142", position: "after", decimals: 2, thousandSep: "\u00A0", decimalSep: "," },
  SEK: { symbol: "kr", position: "after", decimals: 2, thousandSep: "\u00A0", decimalSep: "," },
  HUF: { symbol: "Ft", position: "after", decimals: 0, thousandSep: "\u00A0", decimalSep: "," },
  USD: { symbol: "$", position: "before", decimals: 2, thousandSep: ",", decimalSep: "." },
  GBP: { symbol: "\u00A3", position: "before", decimals: 2, thousandSep: ",", decimalSep: "." },
}

function formatNumber(
  value: number,
  decimals: number,
  thousandSep: string,
  decimalSep: string
): string {
  const fixed = value.toFixed(decimals)
  const [intPart, decPart] = fixed.split(".")

  // Add thousand separator
  const withThousands = intPart.replace(
    /\B(?=(\d{3})+(?!\d))/g,
    thousandSep
  )

  if (decimals === 0) return withThousands
  return `${withThousands}${decimalSep}${decPart}`
}

export function formatCurrency(amount: number, currency?: string): string {
  const code = (currency || "EUR").toUpperCase()
  const config = CURRENCY_CONFIG[code]

  if (!config) {
    return `${amount.toFixed(2)} ${code}`
  }

  const formatted = formatNumber(
    amount,
    config.decimals,
    config.thousandSep,
    config.decimalSep
  )

  if (config.position === "before") {
    return `${config.symbol}${formatted}`
  }
  // "after" — with thin space
  return `${formatted}\u00A0${config.symbol}`
}

export function getCurrencySymbol(currency?: string): string {
  const code = (currency || "EUR").toUpperCase()
  return CURRENCY_CONFIG[code]?.symbol || code
}
