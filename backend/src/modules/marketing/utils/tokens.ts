import crypto from "crypto"

/**
 * HMAC-signed tokens used for tracking pixel, click redirect, and unsubscribe
 * URLs. Tokens are opaque to the client and cannot be forged without the
 * secret.
 *
 * Format (url-safe base64):
 *   base64url( JSON.stringify(payload) ) + "." + base64url( HMAC-SHA256 )
 */

function getSecret(): string {
  // Only accept marketing-scoped secrets. Do NOT fall back to COOKIE_SECRET:
  // rotating the session cookie secret would invalidate every outstanding
  // unsubscribe/click/pixel token, which is a very different blast radius
  // than what a cookie rotation is intended to accomplish.
  const s =
    process.env.MARKETING_TOKEN_SECRET ||
    process.env.MARKETING_KEYSTORE_SECRET
  if (!s) {
    throw new Error(
      "MARKETING_TOKEN_SECRET (or MARKETING_KEYSTORE_SECRET) must be set for signed tokens."
    )
  }
  return s
}

function b64urlEncode(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function b64urlDecode(str: string): Buffer {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/") + "==".slice(0, (4 - (str.length % 4)) % 4)
  return Buffer.from(padded, "base64")
}

export type TokenPayload = {
  t: string      // token type: "unsub", "pixel", "click", "confirm", "view"
  b: string      // brand_id
  c?: string     // contact_id
  m?: string     // message_id
  u?: string     // url (for click)
  l?: string     // link label (for click — e.g. "cta_main")
  exp?: number   // unix ms expiry
  n?: string     // nonce (for DOI confirmation)
}

export function signToken(payload: TokenPayload): string {
  const json = JSON.stringify(payload)
  const body = b64urlEncode(Buffer.from(json, "utf8"))
  const sig = crypto.createHmac("sha256", getSecret()).update(body).digest()
  return body + "." + b64urlEncode(sig)
}

export function verifyToken(token: string, expectedType?: string): TokenPayload | null {
  try {
    const [body, sigPart] = token.split(".")
    if (!body || !sigPart) return null
    const expected = crypto.createHmac("sha256", getSecret()).update(body).digest()
    const actual = b64urlDecode(sigPart)
    if (expected.length !== actual.length) return null
    if (!crypto.timingSafeEqual(expected, actual)) return null
    const payload = JSON.parse(b64urlDecode(body).toString("utf8")) as TokenPayload
    if (expectedType && payload.t !== expectedType) return null
    if (payload.exp && Date.now() > payload.exp) return null
    return payload
  } catch {
    return null
  }
}
