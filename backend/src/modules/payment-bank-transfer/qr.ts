// @ts-nocheck
/**
 * Bank-transfer reference + QR string helpers (server side) — mirror of the
 * storefront checkout logic, so the e-mail QR encodes exactly the same SEPA/CZK
 * payment as the checkout popup. Shared by the QR image endpoint and the email
 * subscriber.
 */

// ISO 11649 RF Creditor Reference (EUR / SEPA).
export function rfReference(orderNo: string): string {
  const ref = String(orderNo).replace(/[^0-9A-Za-z]/g, "")
  const rearr = (ref + "RF00").toUpperCase()
  let num = ""
  for (let i = 0; i < rearr.length; i++) {
    const c = rearr.charCodeAt(i)
    num += c >= 48 && c <= 57 ? rearr[i] : String(c - 55)
  }
  let rem = 0
  for (let j = 0; j < num.length; j++) rem = (rem * 10 + Number(num[j])) % 97
  let check = String(98 - rem)
  if (check.length < 2) check = "0" + check
  return "RF" + check + ref
}

// Numeric variable symbol for domestic transfers (CZK/PLN/HUF/SEK/NOK).
export function vsReference(orderNo: string): string {
  return String(orderNo).replace(/\D/g, "").slice(-10)
}

export function paymentReference(orderNo: string, currency: string): string {
  return String(currency).toUpperCase() === "EUR" ? rfReference(orderNo) : vsReference(orderNo)
}

// EPC069-12 (GiroCode) SEPA Credit Transfer — EUR, RF in the structured field.
function epcString(amount: number, ref: string, bank: any): string {
  return [
    "BCD", "002", "1", "SCT",
    bank.bic || "",
    String(bank.beneficiary || "").substring(0, 70),
    String(bank.iban || "").replace(/\s/g, ""),
    "EUR" + Number(amount).toFixed(2),
    "", ref, "", "",
  ].join("\n")
}

// Czech "QR Platba" (SPD 1.0) — CZK, VS in X-VS.
function spdString(amount: number, vs: string, bank: any): string {
  let acc = String(bank.iban || "").replace(/\s/g, "")
  if (bank.bic) acc += "+" + bank.bic
  return `SPD*1.0*ACC:${acc}*AM:${Number(amount).toFixed(2)}*CC:CZK*X-VS:${vs}*MSG:Platba za objednavku`
}

/**
 * QR payload for the given currency, or null when there is no universal bank QR
 * standard (PLN/HUF/SEK/NOK → details only).
 */
export function qrPayload(amount: number, ref: string, currency: string, bank: any): string | null {
  const cur = String(currency).toUpperCase()
  if (cur === "EUR") return epcString(amount, ref, bank)
  if (cur === "CZK") return spdString(amount, ref, bank)
  return null
}

/**
 * Load the active bank_transfer gateway's beneficiary details, preferring a
 * config scoped to `projectSlug`, else the global fallback.
 */
export async function loadBankConfig(projectSlug?: string): Promise<any | null> {
  const { Pool } = require("pg")
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 })
  try {
    const { rows } = await pool.query(
      `SELECT mode, live_keys, test_keys, supported_currencies, project_slugs
       FROM gateway_config
       WHERE provider = 'bank_transfer' AND is_active = true AND deleted_at IS NULL
       ORDER BY priority ASC`
    )
    if (!rows.length) return null
    let cfg = projectSlug
      ? rows.find((r: any) => Array.isArray(r.project_slugs) && r.project_slugs.includes(projectSlug))
      : null
    if (!cfg) cfg = rows.find((r: any) => !r.project_slugs?.length) || rows[0]

    let keys = cfg.mode === "live" ? cfg.live_keys : cfg.test_keys
    if (typeof keys === "string") { try { keys = JSON.parse(keys) } catch { keys = {} } }
    keys = keys || {}
    const currency = (Array.isArray(cfg.supported_currencies) && cfg.supported_currencies[0]) || "EUR"
    return {
      iban: String(keys.iban || "").replace(/\s/g, ""),
      bic: keys.bic || "",
      beneficiary: keys.beneficiary || "",
      currency: String(currency).toUpperCase(),
    }
  } catch {
    return null
  } finally {
    await pool.end().catch(() => {})
  }
}
