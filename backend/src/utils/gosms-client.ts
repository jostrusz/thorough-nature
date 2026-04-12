/**
 * GoSMS API client for sending SMS notifications.
 * Uses OAuth2 client_credentials flow.
 *
 * Required env vars:
 *   GOSMS_CLIENT_ID
 *   GOSMS_CLIENT_SECRET
 *   GOSMS_CHANNEL_ID
 */

const TOKEN_URL = "https://app.gosms.eu/oauth/v2/token"
const SEND_URL = "https://app.gosms.eu/api/v1/messages"

let cachedToken: { access_token: string; expires_at: number } | null = null

async function getAccessToken(): Promise<string> {
  // Reuse cached token if still valid (with 60s buffer)
  if (cachedToken && Date.now() < cachedToken.expires_at - 60_000) {
    return cachedToken.access_token
  }

  const clientId = process.env.GOSMS_CLIENT_ID
  const clientSecret = process.env.GOSMS_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error("GOSMS_CLIENT_ID and GOSMS_CLIENT_SECRET must be set")
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "client_credentials",
  })
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`GoSMS token request failed (${res.status}): ${text}`)
  }

  const data = await res.json()
  cachedToken = {
    access_token: data.access_token,
    expires_at: Date.now() + (data.expires_in || 3600) * 1000,
  }

  return cachedToken.access_token
}

/**
 * Send an SMS via GoSMS.
 * @param phoneNumber - Recipient in international format, e.g. "+420123456789"
 * @param message - SMS text (GSM 03.38, max 160 chars for single SMS)
 * @returns true if sent successfully
 */
export async function sendSms(phoneNumber: string, message: string): Promise<boolean> {
  const channelId = process.env.GOSMS_CHANNEL_ID
  if (!channelId) {
    console.warn("[GoSMS] GOSMS_CHANNEL_ID not set, skipping SMS")
    return false
  }

  // Skip if GoSMS is not configured
  if (!process.env.GOSMS_CLIENT_ID || !process.env.GOSMS_CLIENT_SECRET) {
    console.warn("[GoSMS] GoSMS credentials not configured, skipping SMS")
    return false
  }

  const token = await getAccessToken()

  const res = await fetch(SEND_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      message,
      recipients: phoneNumber,
      channel: Number(channelId),
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`GoSMS send failed (${res.status}): ${text}`)
  }

  const result = await res.json()
  const invalid = result?.recipients?.invalid || []
  if (invalid.length > 0) {
    console.warn(`[GoSMS] Invalid recipients: ${JSON.stringify(invalid)}`)
    return false
  }

  return true
}

/**
 * Check if GoSMS is configured (env vars present).
 */
export function isGoSmsConfigured(): boolean {
  return !!(
    process.env.GOSMS_CLIENT_ID &&
    process.env.GOSMS_CLIENT_SECRET &&
    process.env.GOSMS_CHANNEL_ID
  )
}
