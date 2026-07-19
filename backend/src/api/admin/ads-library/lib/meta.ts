// @ts-nocheck
/**
 * Thin Meta Graph API client for the Ads Library.
 * Token: env META_ADS_ACCESS_TOKEN (Business system-user token with ads_read
 * across all ad accounts).
 */
const GRAPH = "https://graph.facebook.com/v23.0"

export function metaToken(): string {
  const t = process.env.META_ADS_ACCESS_TOKEN
  if (!t) throw new Error("META_ADS_ACCESS_TOKEN is not configured")
  return t
}

export async function graphGet(path: string, params: Record<string, any> = {}) {
  const qs = new URLSearchParams({ access_token: metaToken() })
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) qs.set(k, String(v))
  }
  const res = await fetch(`${GRAPH}/${path}?${qs.toString()}`)
  const json = await res.json()
  if (!res.ok || json.error) {
    const msg = json?.error?.message || `Graph API ${res.status}`
    throw new Error(`[Meta] ${msg}`)
  }
  return json
}

/** Extract purchase count from an insights `actions` array. */
export function purchasesFrom(actions: any[]): number {
  if (!Array.isArray(actions)) return 0
  const hit = actions.find((a) => a.action_type === "omni_purchase")
    || actions.find((a) => a.action_type === "purchase")
    || actions.find((a) => a.action_type === "offsite_conversion.fb_pixel_purchase")
  return hit ? Number(hit.value) || 0 : 0
}

/** Extract ROAS from insights `purchase_roas`. */
export function roasFrom(purchaseRoas: any[]): number {
  if (!Array.isArray(purchaseRoas) || !purchaseRoas.length) return 0
  return Number(purchaseRoas[0]?.value) || 0
}

/**
 * Map UI range keys to Graph API params.
 * Presets exist up to 90d; 180/365 use explicit time_range.
 */
export function rangeParams(range: string): Record<string, string> {
  const presets: Record<string, string> = {
    "3d": "last_3d", "7d": "last_7d", "14d": "last_14d",
    "30d": "last_30d", "90d": "last_90d",
  }
  if (presets[range]) return { date_preset: presets[range] }
  const days = range === "180d" ? 180 : range === "365d" ? 365 : 30
  const until = new Date()
  const since = new Date(Date.now() - days * 86400_000)
  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  return { time_range: JSON.stringify({ since: fmt(since), until: fmt(until) }) }
}
