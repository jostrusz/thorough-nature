/**
 * Normalize postal codes for DE, AT, LU before sending to Dextrum WMS.
 *
 * Strips country letter prefixes:
 *   "L-8708"  → "8708"  (LU)
 *   "D-50667" → "50667" (DE)
 *   "A-5020"  → "5020"  (AT)
 *   "8708"    → "8708"  (already clean)
 *
 * Only applies to DE, AT, LU. Other countries are returned as-is.
 */

export interface PostalCodeResult {
  normalized: string
  original: string
  changed: boolean
  warning?: string
}

const PREFIX_MAP: Record<string, string> = {
  DE: "D",
  AT: "A",
  LU: "L",
}

export function normalizePostalCode(
  raw: string | undefined | null,
  countryCode: string
): PostalCodeResult {
  const original = (raw || "").trim()
  const cc = (countryCode || "").toUpperCase()

  if (!original) {
    return { normalized: "", original: "", changed: false, warning: "Empty postal code" }
  }

  // Only normalize for DE, AT, LU
  const prefix = PREFIX_MAP[cc]
  if (!prefix) {
    return { normalized: original, original, changed: false }
  }

  // Strip prefix pattern: "L-", "D-", "A-" (with optional space after dash)
  const pattern = new RegExp(`^${prefix}[\\-\\s]+`, "i")
  if (pattern.test(original)) {
    const normalized = original.replace(pattern, "").trim()
    return {
      normalized,
      original,
      changed: true,
      warning: `Postal code normalized: "${original}" → "${normalized}" (stripped ${cc} prefix)`,
    }
  }

  // Also strip if just the letter prefix without dash: "L8708" → "8708"
  const patternNoDash = new RegExp(`^${prefix}(?=\\d)`, "i")
  if (patternNoDash.test(original)) {
    const normalized = original.replace(patternNoDash, "").trim()
    return {
      normalized,
      original,
      changed: true,
      warning: `Postal code normalized: "${original}" → "${normalized}" (stripped ${cc} prefix)`,
    }
  }

  return { normalized: original, original, changed: false }
}
