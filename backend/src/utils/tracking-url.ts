/**
 * Tracking URL generation utility
 * Shared logic for generating tracking URLs from carrier + tracking number.
 * Used by: fulfillment modal (frontend), webhook handler, polling job.
 */

// Country → default carrier mapping
export const COUNTRY_CARRIER_MAP: Record<string, string> = {
  nl: "gls",
  be: "gls",
  de: "gls",
  lu: "gls",
  at: "gls",
  cz: "packeta",
  sk: "packeta",
  pl: "packeta",
  hu: "packeta",
  se: "postnord",
}

// Packeta language codes per country
const PACKETA_LANG: Record<string, string> = {
  cz: "cs",
  sk: "sk",
  pl: "pl",
  hu: "hu",
}

/**
 * Build tracking URL from carrier, tracking number, country code, and postal code.
 */
export function buildTrackingUrl(
  carrier: string,
  trackingNumber: string,
  countryCode?: string,
  postalCode?: string,
): string {
  if (!trackingNumber) return ""
  const cc = (countryCode || "").toLowerCase()

  switch (carrier) {
    case "gls": {
      const zip = (postalCode || "").replace(/\s+/g, "+")
      return `https://gls-group.eu/CZ/en/parcel-tracking?match=${trackingNumber}${zip ? `&postalCode=${zip}` : ""}`
    }
    case "packeta": {
      const lang = PACKETA_LANG[cc] || "en"
      return `https://tracking.packeta.com/${lang}/${trackingNumber}`
    }
    case "postnord":
      return `https://tracking.postnord.com/tracking.html?id=${trackingNumber}`
    case "inpost":
      return `https://inpost.pl/sledzenie-przesylek?number=${trackingNumber}`
    default:
      return ""
  }
}

/**
 * Detect carrier from country code using the country→carrier mapping.
 */
export function detectCarrierFromCountry(countryCode?: string): string {
  if (!countryCode) return ""
  return COUNTRY_CARRIER_MAP[countryCode.toLowerCase()] || ""
}

/**
 * Given a tracking number and order shipping info, generate the best tracking URL.
 * - If a carrier name is provided (from Dextrum), try to map it to our carrier codes.
 * - Otherwise, detect from country code.
 * - Build the URL from carrier + tracking number + country + zip.
 */
export function generateTrackingUrl(
  trackingNumber: string,
  countryCode?: string,
  postalCode?: string,
  dextrumCarrierName?: string,
): { carrier: string; trackingUrl: string } {
  if (!trackingNumber) return { carrier: "", trackingUrl: "" }

  // Try to map Dextrum carrier name to our carrier codes
  let carrier = ""
  if (dextrumCarrierName) {
    const cn = dextrumCarrierName.toLowerCase()
    if (cn.includes("gls")) carrier = "gls"
    else if (cn.includes("packeta") || cn.includes("zasilkovna") || cn.includes("zásilkovna")) carrier = "packeta"
    else if (cn.includes("postnord")) carrier = "postnord"
    else if (cn.includes("inpost")) carrier = "inpost"
  }

  // Fallback: detect from country
  if (!carrier) {
    carrier = detectCarrierFromCountry(countryCode)
  }

  const trackingUrl = carrier ? buildTrackingUrl(carrier, trackingNumber, countryCode, postalCode) : ""

  return { carrier, trackingUrl }
}
