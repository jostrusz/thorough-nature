import crypto from "crypto"

/**
 * AES-256-GCM encryption helpers for marketing secrets (e.g. per-brand
 * Resend API key overrides).
 *
 * Master secret is read from env var MARKETING_KEYSTORE_SECRET.
 * The secret must be either:
 *   - 64 hex chars (32 bytes)  — recommended
 *   - 32 UTF-8 chars            — accepted for convenience
 *
 * Ciphertext format: base64( iv(12) | authTag(16) | payload )
 */

const MAGIC_PREFIX = "enc:v1:"

function getKey(): Buffer {
  const raw = process.env.MARKETING_KEYSTORE_SECRET
  if (!raw) {
    throw new Error(
      "MARKETING_KEYSTORE_SECRET is not configured. Set it to a 64-hex-char string (32 bytes)."
    )
  }
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, "hex")
  }
  if (raw.length === 32) {
    return Buffer.from(raw, "utf8")
  }
  // Derive a 32-byte key from any-length secret via SHA-256 — keeps dev setups working.
  return crypto.createHash("sha256").update(raw, "utf8").digest()
}

export function encryptSecret(plaintext: string): string {
  if (!plaintext) return plaintext
  const key = getKey()
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv)
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const authTag = cipher.getAuthTag()
  const payload = Buffer.concat([iv, authTag, enc]).toString("base64")
  return MAGIC_PREFIX + payload
}

export function decryptSecret(ciphertext: string | null | undefined): string | null {
  if (!ciphertext) return null
  if (!ciphertext.startsWith(MAGIC_PREFIX)) {
    // Back-compat: allow plaintext reads if someone seeded without encryption.
    return ciphertext
  }
  const key = getKey()
  const buf = Buffer.from(ciphertext.slice(MAGIC_PREFIX.length), "base64")
  const iv = buf.subarray(0, 12)
  const authTag = buf.subarray(12, 28)
  const enc = buf.subarray(28)
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv)
  decipher.setAuthTag(authTag)
  const dec = Buffer.concat([decipher.update(enc), decipher.final()])
  return dec.toString("utf8")
}

/** Stable SHA-256 hash of a lowercased email, for post-erasure audit proof. */
export function hashEmail(email: string): string {
  return crypto.createHash("sha256").update(email.trim().toLowerCase(), "utf8").digest("hex")
}
