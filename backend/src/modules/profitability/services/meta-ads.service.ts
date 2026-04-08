/**
 * Meta Ads API Service
 * Handles communication with Meta/Facebook Ads API for fetching ad spend data
 */

const META_API_VERSION = "v21.0"
const META_API_BASE = `https://graph.facebook.com/${META_API_VERSION}`

export interface MetaAdAccount {
  id: string
  name: string
  currency: string
  account_status: number
}

export interface MetaInsightsResponse {
  spend: string
}

/**
 * Fetch all ad accounts available for a given access token
 */
export async function getAdAccounts(accessToken: string): Promise<MetaAdAccount[]> {
  const url = `${META_API_BASE}/me/adaccounts?fields=id,name,currency,account_status&access_token=${encodeURIComponent(accessToken)}`

  const response = await fetch(url)
  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(errorData?.error?.message || `Meta API error: ${response.status}`)
  }

  const data = await response.json()
  return (data.data || []).map((acc: any) => ({
    id: acc.id,
    name: acc.name,
    currency: acc.currency,
    account_status: acc.account_status,
  }))
}

/**
 * Fetch ad spend for a specific ad account within a date range
 * Returns spend amount and the account's currency code
 */
export async function getAccountSpend(
  accessToken: string,
  adAccountId: string,
  dateFrom: string,
  dateTo: string
): Promise<{ spend: number; currency: string }> {
  // Fetch spend + account currency in parallel
  const timeRange = JSON.stringify({ since: dateFrom, until: dateTo })
  const insightsUrl = `${META_API_BASE}/${adAccountId}/insights?fields=spend&time_range=${encodeURIComponent(timeRange)}&level=account&access_token=${encodeURIComponent(accessToken)}`
  const accountUrl = `${META_API_BASE}/${adAccountId}?fields=currency&access_token=${encodeURIComponent(accessToken)}`

  const [insightsRes, accountRes] = await Promise.all([
    fetch(insightsUrl),
    fetch(accountUrl),
  ])

  if (!insightsRes.ok) {
    const errorData = await insightsRes.json()
    if (insightsRes.status === 429) {
      throw new Error("Meta Ads API rate limit reached. Will retry next cycle.")
    }
    throw new Error(errorData?.error?.message || `Meta API error: ${insightsRes.status}`)
  }

  const insightsData = await insightsRes.json()
  const insights = insightsData.data || []
  const spend = insights.reduce((total: number, row: any) => total + parseFloat(row.spend || "0"), 0)

  // Get account currency (default to EUR if fetch fails)
  let currency = "EUR"
  try {
    if (accountRes.ok) {
      const accountData = await accountRes.json()
      currency = accountData.currency || "EUR"
    }
  } catch {
    // fallback to EUR
  }

  return { spend, currency }
}

/**
 * Validate an access token by making a simple /me request
 */
export async function validateToken(accessToken: string): Promise<boolean> {
  try {
    const url = `${META_API_BASE}/me?access_token=${encodeURIComponent(accessToken)}`
    const response = await fetch(url)
    return response.ok
  } catch {
    return false
  }
}
