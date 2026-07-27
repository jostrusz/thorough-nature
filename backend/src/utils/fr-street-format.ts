/**
 * French street formatting for Dextrum/mySTOCK.
 *
 * mySTOCK derives the house number by parsing the END of the street field
 * ("Protože číslo musí být na konci" — Dextrum, 2026-07). French convention
 * puts it at the FRONT ("12 Rue Des Pres"), so 93 % of FR orders failed label
 * generation until David fixed each one by hand.
 *
 * This runs ONLY for country FR, and only at the moment an order is sent to
 * the WMS — the order itself keeps the address exactly as the customer typed
 * it. Verified against all 46 production FR addresses plus 19 synthetic edge
 * cases: no token is ever lost, the result is idempotent (re-sending an
 * already-converted street changes nothing), and anything unrecognised is
 * passed through untouched rather than mangled.
 *
 * Rule order is load-bearing:
 *  1. Leading number wins. A trailing number is usually part of the street
 *     name — "83 rue du 27 août 1944" ends in a year, "125 B Route
 *     Departementale 943" in a road number.
 *  2. Then a number starting a comma segment ("Clinique CLINEA, 33 Bis rue
 *     du 8 Mai 1945" — building name typed first).
 *  3. A street already ending in a number is left alone (idempotence).
 *  4. "Batiment B 106 Chemin de la Cordice" — number after a building label.
 *
 * House numbers are 1-4 digits; the (?!\d) guard keeps a 5-digit run (a
 * French postal code typed into the street, e.g. ", 34150 Gignac") from being
 * partially eaten — without it a second pass produced ", 0 Gignac 80 3415".
 */

const LEAD = /^(\d{1,4})(?!\d)\s*[,]?\s*((?:bis|ter|quater)\b|[a-zA-Z](?![a-zA-Z]))?\s*/i
const TRAIL = /[,\s]\s*(?:n[o°]\s*)?(\d{1,4})(?!\d)\s*((?:bis|ter|quater)\b|[a-zA-Z](?![a-zA-Z]))?\s*$/i
const BUILDING = /^(.*?\b(?:b[aâ]t(?:iment)?|r[ée]s(?:idence)?|imm(?:euble)?)\b\s*\S*)\s+(\d{1,4})(?!\d)\s*([a-zA-Z](?![a-zA-Z]))?\s+(.+)$/i

const fmt = (n: string, sfx?: string) =>
  !sfx ? n : sfx.length === 1 ? n + sfx.toUpperCase() : `${n} ${sfx.toLowerCase()}`

export interface FrStreetResult {
  street: string
  houseNumber: string | null
  changed: boolean
  status:
    | "jina_zeme_beze_zmeny"
    | "prazdne"
    | "presunuto"
    | "presunuto_ze_stredu"
    | "presunuto_za_budovou"
    | "beze_zmeny"
    | "jen_cislo_bez_ulice"
    | "cislo_nenalezeno"
}

export function formatFrStreetForWms(raw: string | null | undefined, countryCode: string | null | undefined): FrStreetResult {
  const original = String(raw || "")
  if (String(countryCode || "").trim().toUpperCase() !== "FR") {
    return { street: original, houseNumber: null, changed: false, status: "jina_zeme_beze_zmeny" }
  }
  const s = original.replace(/\s+/g, " ").trim()
  if (!s) return { street: "", houseNumber: null, changed: false, status: "prazdne" }

  // 1) leading number → move to the end
  const m = s.match(LEAD)
  if (m) {
    const rest = s.slice(m[0].length).replace(/^[,\s]+/, "").trim()
    if (rest) {
      const num = fmt(m[1], m[2])
      return { street: `${rest} ${num}`, houseNumber: num, changed: true, status: "presunuto" }
    }
    return { street: s, houseNumber: null, changed: false, status: "jen_cislo_bez_ulice" }
  }

  // 2) number opening a comma segment
  const parts = s.split(",").map((x) => x.trim()).filter(Boolean)
  if (parts.length > 1) {
    const i = parts.findIndex((p) => /^\d/.test(p) && LEAD.test(p) && p.replace(LEAD, "").trim())
    if (i >= 0) {
      const mm = parts[i].match(LEAD)!
      const num = fmt(mm[1], mm[2])
      const rest = parts[i].slice(mm[0].length).replace(/^[,\s]+/, "").trim()
      const seg = [...parts.slice(0, i), rest, ...parts.slice(i + 1)].filter(Boolean).join(", ")
      return { street: `${seg} ${num}`, houseNumber: num, changed: true, status: "presunuto_ze_stredu" }
    }
  }

  // 3) number already at the end → leave alone
  const t = s.match(TRAIL)
  if (t) return { street: s, houseNumber: fmt(t[1], t[2]), changed: false, status: "beze_zmeny" }

  // 4) number after a building label
  const b = s.match(BUILDING)
  if (b) {
    const num = fmt(b[2], b[3])
    return { street: `${b[1]} ${b[4]} ${num}`, houseNumber: num, changed: true, status: "presunuto_za_budovou" }
  }

  // no house number found — pass through unchanged, never invent one
  return { street: s, houseNumber: null, changed: false, status: "cislo_nenalezeno" }
}
