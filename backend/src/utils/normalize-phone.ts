/**
 * Normalize phone number to international format without spaces.
 *
 * Examples:
 *   "0612345678" + "NL" → "+31612345678"
 *   "01718228513" + "DE" → "+491718228513"
 *   "+32 479 73 34 68" → "+32479733468"
 *   "+436508723503" → "+436508723503"
 *   "" or undefined → { normalized: "000", warning: "No phone number" }
 *
 * Returns { normalized, original, warning? } for logging in order timeline.
 */

const COUNTRY_PREFIX: Record<string, string> = {
  NL: "+31",
  BE: "+32",
  DE: "+49",
  AT: "+43",
  LU: "+352",
  CZ: "+420",
  SK: "+421",
  PL: "+48",
  HU: "+36",
  SE: "+46",
  FR: "+33",
  IT: "+39",
  ES: "+34",
  PT: "+351",
  GB: "+44",
  US: "+1",
}

export interface PhoneNormalizationResult {
  normalized: string
  original: string
  changed: boolean
  warning?: string
}

export function normalizePhone(
  raw: string | undefined | null,
  countryCode: string
): PhoneNormalizationResult {
  const original = (raw || "").trim()
  const cc = (countryCode || "NL").toUpperCase()

  // No phone number
  if (!original || original === "000") {
    return {
      normalized: "000",
      original: original || "",
      changed: false,
      warning: "No phone number provided (express checkout or missing)",
    }
  }

  // Remove all spaces, dashes, parentheses, dots
  let cleaned = original.replace(/[\s\-\(\)\.]/g, "")

  // Convert 00XX to +XX format
  if (cleaned.startsWith("00") && !cleaned.startsWith("000")) {
    cleaned = "+" + cleaned.substring(2)
  }

  // Already has international prefix
  if (cleaned.startsWith("+")) {
    const result = cleaned
    return {
      normalized: result,
      original,
      changed: result !== original,
      ...(result !== original ? { warning: `Phone reformatted: "${original}" → "${result}"` } : {}),
    }
  }

  // Local number starting with 0 — replace leading 0 with country prefix
  const prefix = COUNTRY_PREFIX[cc]
  if (!prefix) {
    return {
      normalized: cleaned,
      original,
      changed: cleaned !== original,
      warning: `Unknown country code "${cc}" — phone kept as-is: "${cleaned}"`,
    }
  }

  if (cleaned.startsWith("0")) {
    const result = prefix + cleaned.substring(1)
    return {
      normalized: result,
      original,
      changed: true,
      warning: `Phone normalized: "${original}" → "${result}" (added ${cc} prefix ${prefix})`,
    }
  }

  // Number without 0 prefix and without + — check if it already starts with country code
  if (/^\d{7,}$/.test(cleaned)) {
    const prefixDigits = prefix.substring(1) // e.g. "+49" → "49"
    if (cleaned.startsWith(prefixDigits)) {
      // Already contains country code without + (e.g. "4915155518039" for DE)
      const result = "+" + cleaned
      return {
        normalized: result,
        original,
        changed: true,
        warning: `Phone normalized: "${original}" → "${result}" (added + to existing ${cc} prefix)`,
      }
    }
    const result = prefix + cleaned
    return {
      normalized: result,
      original,
      changed: true,
      warning: `Phone normalized: "${original}" → "${result}" (added ${cc} prefix ${prefix})`,
    }
  }

  // Fallback — return cleaned version
  return {
    normalized: cleaned,
    original,
    changed: cleaned !== original,
    ...(cleaned !== original ? { warning: `Phone cleaned: "${original}" → "${cleaned}"` } : {}),
  }
}
