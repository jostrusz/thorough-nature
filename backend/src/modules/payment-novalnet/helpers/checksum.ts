import crypto from "crypto"

/**
 * Novalnet webhook signature verification.
 *
 * Algorithm (extracted from official Novalnet PHP SDKs — payum-payment-integration-novalnet/Api.php):
 *
 *   expected_checksum = sha256( tid + txn_secret + status + reverse(payment_access_key) )
 *
 * Where:
 *   - tid                 — transaction ID returned by Novalnet (17-digit number)
 *   - txn_secret          — temporary token bound to this transaction (returned by Novalnet)
 *   - status              — short status code from Novalnet ("100" for success, etc.)
 *   - payment_access_key  — merchant's secret from Novalnet admin portal, REVERSED character-by-character
 *
 * Plain SHA-256, NOT HMAC. The reverse(payment_access_key) acts as the secret salt.
 *
 * The webhook payload itself contains an `event.checksum` field which we compare against.
 */
export function buildNovalnetChecksum(params: {
  tid: string | number
  txnSecret: string
  status: string | number
  paymentAccessKey: string
}): string {
  const tid = String(params.tid || "")
  const txnSecret = String(params.txnSecret || "")
  const status = String(params.status || "")
  const reversedKey = (params.paymentAccessKey || "")
    .split("")
    .reverse()
    .join("")

  const payload = tid + txnSecret + status + reversedKey
  return crypto.createHash("sha256").update(payload).digest("hex")
}

/**
 * Constant-time comparison to defeat timing attacks.
 * Returns true if both checksums match exactly (case-insensitive — Novalnet returns lowercase hex).
 */
export function verifyNovalnetChecksum(
  expected: string,
  received: string
): boolean {
  if (!expected || !received) return false
  const a = Buffer.from(expected.toLowerCase(), "utf8")
  const b = Buffer.from(received.toLowerCase(), "utf8")
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}
