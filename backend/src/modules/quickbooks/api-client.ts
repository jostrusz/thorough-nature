/**
 * QuickBooks Online API Client
 *
 * Handles OAuth 2.0 token management, customer CRUD,
 * invoice creation, and payment recording.
 */

const TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer"
const AUTH_URL = "https://appcenter.intuit.com/connect/oauth2"
const MINOR_VERSION = 75

// ═══════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════

export interface QBOCredentials {
  client_id: string
  client_secret: string
  environment: string
  access_token?: string | null
  refresh_token?: string | null
  access_token_expires_at?: string | null
  refresh_token_expires_at?: string | null
  realm_id?: string | null
}

export interface QBOTokenResult {
  access_token: string
  refresh_token: string
  expires_in: number
  x_refresh_token_expires_in: number
}

export interface QBOCustomer {
  Id: string
  DisplayName: string
  PrimaryEmailAddr?: { Address: string }
}

export interface QBOInvoice {
  Id: string
  DocNumber?: string
  TotalAmt: number
  Balance: number
  InvoiceLink?: string
  SyncToken?: string
  CustomerRef?: { value: string }
}

export interface QBOCreditMemo {
  Id: string
  DocNumber?: string
  TotalAmt: number
  SyncToken?: string
}

export interface QBOPayment {
  Id: string
  TotalAmt: number
}

// ═══════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════

function getBaseUrl(environment: string): string {
  return environment === "production"
    ? "https://quickbooks.api.intuit.com"
    : "https://sandbox-quickbooks.api.intuit.com"
}

function apiUrl(creds: QBOCredentials, entity: string): string {
  return `${getBaseUrl(creds.environment)}/v3/company/${creds.realm_id}/${entity}?minorversion=${MINOR_VERSION}`
}

function authHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  }
}

function basicAuth(clientId: string, clientSecret: string): string {
  return Buffer.from(`${clientId}:${clientSecret}`).toString("base64")
}

// ═══════════════════════════════════════════
// OAUTH
// ═══════════════════════════════════════════

/**
 * Generate the OAuth authorization URL for the user to visit.
 */
export function generateAuthUrl(config: {
  client_id: string
  redirect_uri: string
  state: string
}): string {
  const params = new URLSearchParams({
    client_id: config.client_id,
    scope: "com.intuit.quickbooks.accounting",
    redirect_uri: config.redirect_uri,
    response_type: "code",
    state: config.state,
  })
  return `${AUTH_URL}?${params.toString()}`
}

/**
 * Exchange an authorization code for access + refresh tokens.
 */
export async function exchangeAuthCode(
  creds: QBOCredentials,
  code: string,
  redirectUri: string
): Promise<QBOTokenResult> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth(creds.client_id, creds.client_secret)}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }).toString(),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`QBO token exchange failed (${res.status}): ${text}`)
  }

  return await res.json()
}

/**
 * Refresh the access token using the refresh token.
 */
export async function refreshAccessToken(
  creds: QBOCredentials
): Promise<QBOTokenResult> {
  if (!creds.refresh_token) {
    throw new Error("No refresh token available")
  }

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth(creds.client_id, creds.client_secret)}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: creds.refresh_token,
    }).toString(),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`QBO token refresh failed (${res.status}): ${text}`)
  }

  return await res.json()
}

/**
 * Ensure a valid access token is available.
 * Returns updated token data or null if re-authorization is needed.
 */
export async function ensureValidToken(
  creds: QBOCredentials
): Promise<{
  access_token: string
  refresh_token: string
  access_token_expires_at: string
  refresh_token_expires_at: string
} | null> {
  // Check if access token is still valid (5min buffer)
  if (creds.access_token && creds.access_token_expires_at) {
    const expiresAt = new Date(creds.access_token_expires_at)
    const buffer = new Date(Date.now() + 5 * 60 * 1000)
    if (expiresAt > buffer) {
      return {
        access_token: creds.access_token,
        refresh_token: creds.refresh_token || "",
        access_token_expires_at: creds.access_token_expires_at,
        refresh_token_expires_at: creds.refresh_token_expires_at || "",
      }
    }
  }

  // Check if refresh token is still valid
  if (creds.refresh_token_expires_at) {
    const refreshExpiresAt = new Date(creds.refresh_token_expires_at)
    if (refreshExpiresAt <= new Date()) {
      return null // Refresh token expired, need re-authorization
    }
  }

  if (!creds.refresh_token) return null

  try {
    const tokens = await refreshAccessToken(creds)
    return {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      access_token_expires_at: new Date(
        Date.now() + tokens.expires_in * 1000
      ).toISOString(),
      refresh_token_expires_at: new Date(
        Date.now() + tokens.x_refresh_token_expires_in * 1000
      ).toISOString(),
    }
  } catch {
    return null
  }
}

// ═══════════════════════════════════════════
// CUSTOMERS
// ═══════════════════════════════════════════

/**
 * Search for an existing customer by email.
 */
export async function queryCustomer(
  creds: QBOCredentials,
  token: string,
  email: string
): Promise<QBOCustomer | null> {
  const query = `SELECT * FROM Customer WHERE PrimaryEmailAddr = '${email.replace(/'/g, "\\'")}'`
  const url = `${getBaseUrl(creds.environment)}/v3/company/${creds.realm_id}/query?query=${encodeURIComponent(query)}&minorversion=${MINOR_VERSION}`

  const res = await fetch(url, {
    method: "GET",
    headers: authHeaders(token),
  })

  if (!res.ok) return null

  const data = await res.json()
  const customers = data?.QueryResponse?.Customer
  if (Array.isArray(customers) && customers.length > 0) {
    return customers[0]
  }
  return null
}

/**
 * Create a new customer in QuickBooks.
 */
export async function createCustomer(
  creds: QBOCredentials,
  token: string,
  data: {
    DisplayName: string
    PrimaryEmailAddr?: { Address: string }
    BillAddr?: {
      Line1?: string
      City?: string
      PostalCode?: string
      Country?: string
      CountrySubDivisionCode?: string
    }
    CurrencyRef?: { value: string }
  }
): Promise<QBOCustomer> {
  const res = await fetch(apiUrl(creds, "customer"), {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(data),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`QBO create customer failed (${res.status}): ${text}`)
  }

  const result = await res.json()
  return result.Customer
}

// ═══════════════════════════════════════════
// INVOICES
// ═══════════════════════════════════════════

/**
 * Create a new invoice.
 */
export async function createInvoice(
  creds: QBOCredentials,
  token: string,
  data: {
    CustomerRef: { value: string }
    Line: Array<{
      Amount: number
      Description?: string
      DetailType: "SalesItemLineDetail"
      SalesItemLineDetail: {
        ItemRef: { value: string; name?: string }
        Qty?: number
        UnitPrice?: number
      }
    }>
    DocNumber?: string
    TxnDate?: string
    CurrencyRef?: { value: string }
    BillEmail?: { Address: string }
    BillAddr?: {
      Line1?: string
      City?: string
      PostalCode?: string
      Country?: string
    }
    PrivateNote?: string
    CustomerMemo?: { value: string }
  }
): Promise<QBOInvoice> {
  const res = await fetch(apiUrl(creds, "invoice"), {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(data),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`QBO create invoice failed (${res.status}): ${text}`)
  }

  const result = await res.json()
  return result.Invoice
}

/**
 * Create a payment to mark an invoice as paid.
 */
export async function createPayment(
  creds: QBOCredentials,
  token: string,
  data: {
    CustomerRef: { value: string }
    TotalAmt: number
    Line: Array<{
      Amount: number
      LinkedTxn: Array<{ TxnId: string; TxnType: "Invoice" }>
    }>
  }
): Promise<QBOPayment> {
  const res = await fetch(apiUrl(creds, "payment"), {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(data),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`QBO create payment failed (${res.status}): ${text}`)
  }

  const result = await res.json()
  return result.Payment
}

/**
 * Get invoice with public payment link.
 */
export async function getInvoiceWithLink(
  creds: QBOCredentials,
  token: string,
  invoiceId: string
): Promise<{ invoice: QBOInvoice; link: string | null }> {
  const url = `${getBaseUrl(creds.environment)}/v3/company/${creds.realm_id}/invoice/${invoiceId}?include=invoiceLink&minorversion=${MINOR_VERSION}`

  const res = await fetch(url, {
    method: "GET",
    headers: authHeaders(token),
  })

  if (!res.ok) {
    return { invoice: { Id: invoiceId } as QBOInvoice, link: null }
  }

  const result = await res.json()
  return {
    invoice: result.Invoice,
    link: result.Invoice?.InvoiceLink || null,
  }
}

// ═══════════════════════════════════════════
// INVOICE MANAGEMENT (get, void, delete)
// ═══════════════════════════════════════════

/**
 * Get invoice by ID (needed for SyncToken to void/delete).
 */
export async function getInvoice(
  creds: QBOCredentials,
  token: string,
  invoiceId: string
): Promise<QBOInvoice | null> {
  const url = `${getBaseUrl(creds.environment)}/v3/company/${creds.realm_id}/invoice/${invoiceId}?minorversion=${MINOR_VERSION}`

  const res = await fetch(url, {
    method: "GET",
    headers: authHeaders(token),
  })

  if (!res.ok) return null

  const result = await res.json()
  return result.Invoice || null
}

/**
 * Void an invoice (works on paid invoices too — QBO equivalent of "cancel").
 * POST /v3/company/{realmId}/invoice?operation=void
 */
export async function voidInvoice(
  creds: QBOCredentials,
  token: string,
  invoice: { Id: string; SyncToken: string }
): Promise<boolean> {
  const url = `${getBaseUrl(creds.environment)}/v3/company/${creds.realm_id}/invoice?operation=void&minorversion=${MINOR_VERSION}`

  const res = await fetch(url, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      Id: invoice.Id,
      SyncToken: invoice.SyncToken,
      sparse: true,
    }),
  })

  return res.ok
}

/**
 * Delete an invoice (only works on draft/voided invoices).
 * POST /v3/company/{realmId}/invoice?operation=delete
 */
export async function deleteInvoice(
  creds: QBOCredentials,
  token: string,
  invoice: { Id: string; SyncToken: string }
): Promise<boolean> {
  const url = `${getBaseUrl(creds.environment)}/v3/company/${creds.realm_id}/invoice?operation=delete&minorversion=${MINOR_VERSION}`

  const res = await fetch(url, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      Id: invoice.Id,
      SyncToken: invoice.SyncToken,
    }),
  })

  return res.ok
}

// ═══════════════════════════════════════════
// CREDIT MEMO
// ═══════════════════════════════════════════

/**
 * Create a credit memo (refund document in QuickBooks).
 */
export async function createCreditMemo(
  creds: QBOCredentials,
  token: string,
  data: {
    CustomerRef: { value: string }
    Line: Array<{
      Amount: number
      Description?: string
      DetailType: "SalesItemLineDetail"
      SalesItemLineDetail: {
        ItemRef: { value: string; name?: string }
        Qty?: number
        UnitPrice?: number
      }
    }>
    DocNumber?: string
    CurrencyRef?: { value: string }
    PrivateNote?: string
  }
): Promise<QBOCreditMemo> {
  const res = await fetch(apiUrl(creds, "creditmemo"), {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(data),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`QBO create credit memo failed (${res.status}): ${text}`)
  }

  const result = await res.json()
  return result.CreditMemo
}

/**
 * Get credit memo by ID.
 */
export async function getCreditMemo(
  creds: QBOCredentials,
  token: string,
  creditMemoId: string
): Promise<QBOCreditMemo | null> {
  const url = `${getBaseUrl(creds.environment)}/v3/company/${creds.realm_id}/creditmemo/${creditMemoId}?minorversion=${MINOR_VERSION}`

  const res = await fetch(url, {
    method: "GET",
    headers: authHeaders(token),
  })

  if (!res.ok) return null

  const result = await res.json()
  return result.CreditMemo || null
}

/**
 * Delete a credit memo.
 * POST /v3/company/{realmId}/creditmemo?operation=delete
 */
export async function deleteCreditMemo(
  creds: QBOCredentials,
  token: string,
  creditMemo: { Id: string; SyncToken: string }
): Promise<boolean> {
  const url = `${getBaseUrl(creds.environment)}/v3/company/${creds.realm_id}/creditmemo?operation=delete&minorversion=${MINOR_VERSION}`

  const res = await fetch(url, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      Id: creditMemo.Id,
      SyncToken: creditMemo.SyncToken,
    }),
  })

  return res.ok
}
