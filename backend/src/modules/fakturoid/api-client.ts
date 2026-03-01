/**
 * Fakturoid API v3 Client
 *
 * Handles OAuth token management, subject (customer) CRUD,
 * invoice creation, and payment recording.
 */

const BASE_URL = "https://app.fakturoid.cz/api/v3"

// ═══════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════

export interface FakturoidCredentials {
  slug: string
  client_id: string
  client_secret: string
  user_agent_email: string
  access_token?: string | null
  token_expires_at?: string | null
}

export interface FakturoidSubject {
  id: number
  name: string
  email?: string
  street?: string
  city?: string
  zip?: string
  country?: string
  registration_no?: string
  vat_no?: string
}

export interface FakturoidInvoiceLine {
  name: string
  quantity: number
  unit_price: number
  unit_name?: string
  vat_rate?: number
}

export interface FakturoidInvoicePayload {
  subject_id: number
  custom_id?: string
  order_number?: string
  currency?: string
  language?: string
  oss?: "disabled" | "service" | "goods"
  vat_price_mode?: string
  payment_method?: string
  note?: string
  tags?: string[]
  lines: FakturoidInvoiceLine[]
}

export interface FakturoidInvoice {
  id: number
  number: string
  status: string
  total: string
  public_html_url: string
  html_url: string
  pdf_url: string
  created_at: string
}

// ═══════════════════════════════════════════
// AUTH
// ═══════════════════════════════════════════

/**
 * Get a valid access token, using cached one if still valid.
 * Returns { access_token, expires_at } for persisting back to DB.
 */
export async function getAccessToken(
  creds: FakturoidCredentials
): Promise<{ access_token: string; expires_at: string }> {
  // Check if cached token is still valid (with 5min buffer)
  if (creds.access_token && creds.token_expires_at) {
    const expiresAt = new Date(creds.token_expires_at)
    const buffer = new Date(Date.now() + 5 * 60 * 1000)
    if (expiresAt > buffer) {
      return {
        access_token: creds.access_token,
        expires_at: creds.token_expires_at,
      }
    }
  }

  // Request new token via Client Credentials flow
  const basicAuth = Buffer.from(
    `${creds.client_id}:${creds.client_secret}`
  ).toString("base64")

  const res = await fetch(`${BASE_URL}/oauth/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      "User-Agent": `MarketingHQ (${creds.user_agent_email})`,
    },
    body: "grant_type=client_credentials",
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Fakturoid OAuth failed (${res.status}): ${text}`)
  }

  const data = await res.json()
  const expiresAt = new Date(
    Date.now() + (data.expires_in || 7200) * 1000
  ).toISOString()

  return {
    access_token: data.access_token,
    expires_at: expiresAt,
  }
}

// ═══════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════

function headers(token: string, email: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Accept: "application/json",
    "User-Agent": `MarketingHQ (${email})`,
  }
}

function accountUrl(slug: string): string {
  return `${BASE_URL}/accounts/${slug}`
}

// ═══════════════════════════════════════════
// SUBJECTS (Customers)
// ═══════════════════════════════════════════

/**
 * Search for an existing subject by email.
 */
export async function searchSubject(
  creds: FakturoidCredentials,
  token: string,
  email: string
): Promise<FakturoidSubject | null> {
  const url = `${accountUrl(creds.slug)}/subjects/search.json?query=${encodeURIComponent(email)}`
  const res = await fetch(url, {
    method: "GET",
    headers: headers(token, creds.user_agent_email),
  })

  if (!res.ok) return null

  const subjects = await res.json()
  if (Array.isArray(subjects) && subjects.length > 0) {
    return subjects[0]
  }
  return null
}

/**
 * Create a new subject (customer) in Fakturoid.
 */
export async function createSubject(
  creds: FakturoidCredentials,
  token: string,
  subject: {
    name: string
    email?: string
    street?: string
    city?: string
    zip?: string
    country?: string
    registration_no?: string
    vat_no?: string
  }
): Promise<FakturoidSubject> {
  const url = `${accountUrl(creds.slug)}/subjects.json`
  const res = await fetch(url, {
    method: "POST",
    headers: headers(token, creds.user_agent_email),
    body: JSON.stringify(subject),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Fakturoid create subject failed (${res.status}): ${text}`)
  }

  return await res.json()
}

// ═══════════════════════════════════════════
// INVOICES
// ═══════════════════════════════════════════

/**
 * Create a new invoice.
 */
export async function createInvoice(
  creds: FakturoidCredentials,
  token: string,
  invoice: FakturoidInvoicePayload
): Promise<FakturoidInvoice> {
  const url = `${accountUrl(creds.slug)}/invoices.json`
  const res = await fetch(url, {
    method: "POST",
    headers: headers(token, creds.user_agent_email),
    body: JSON.stringify(invoice),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Fakturoid create invoice failed (${res.status}): ${text}`)
  }

  return await res.json()
}

/**
 * Mark an invoice as paid (full payment today).
 */
export async function markInvoicePaid(
  creds: FakturoidCredentials,
  token: string,
  invoiceId: number
): Promise<void> {
  const url = `${accountUrl(creds.slug)}/invoices/${invoiceId}/payments.json`
  const today = new Date().toISOString().split("T")[0]

  const res = await fetch(url, {
    method: "POST",
    headers: headers(token, creds.user_agent_email),
    body: JSON.stringify({ paid_on: today }),
  })

  // 403 = already paid (ignore gracefully)
  if (!res.ok && res.status !== 403) {
    const text = await res.text()
    throw new Error(
      `Fakturoid mark paid failed (${res.status}): ${text}`
    )
  }
}

// ═══════════════════════════════════════════
// MAPPING HELPERS
// ═══════════════════════════════════════════

const COUNTRY_LANGUAGE_MAP: Record<string, string> = {
  cz: "cz",
  sk: "sk",
  de: "de",
  at: "de",
  pl: "pl",
  hu: "hu",
  fr: "fr",
  es: "es",
  it: "it",
  ro: "ro",
  ru: "ru",
}

/**
 * Map country code to Fakturoid invoice language.
 */
export function mapCountryToLanguage(
  countryCode: string,
  fallback = "en"
): string {
  return COUNTRY_LANGUAGE_MAP[countryCode.toLowerCase()] || fallback
}

/**
 * Determine OSS mode based on customer country.
 * CZ (domestic) → disabled, anything else → goods.
 */
export function getOSSMode(
  countryCode: string
): "disabled" | "goods" {
  return countryCode.toLowerCase() === "cz" ? "disabled" : "goods"
}

/**
 * Test connection by attempting to get an access token.
 */
export async function testConnection(creds: {
  slug: string
  client_id: string
  client_secret: string
  user_agent_email: string
}): Promise<{ success: boolean; error?: string }> {
  try {
    await getAccessToken(creds)
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}
