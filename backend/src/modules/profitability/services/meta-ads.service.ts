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
 * Returns spend in the account's currency (usually matches EUR for our accounts)
 */
export async function getAccountSpend(
  accessToken: string,
  adAccountId: string,
  dateFrom: string,
  dateTo: string
): Promise<number> {
  const timeRange = JSON.stringify({ since: dateFrom, until: dateTo })
  const url = `${META_API_BASE}/${adAccountId}/insights?fields=spend&time_range=${encodeURIComponent(timeRange)}&level=account&access_token=${encodeURIComponent(accessToken)}`

  const response = await fetch(url)
  if (!response.ok) {
    const errorData = await response.json()
    // Handle rate limiting
    if (response.status === 429) {
      throw new Error("Meta Ads API rate limit reached. Will retry next cycle.")
    }
    throw new Error(errorData?.error?.message || `Meta API error: ${response.status}`)
  }

  const data = await response.json()
  const insights = data.data || []

  if (insights.length === 0) {
    return 0
  }

  // Sum spend across all returned insight rows
  return insights.reduce((total: number, row: any) => total + parseFloat(row.spend || "0"), 0)
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
