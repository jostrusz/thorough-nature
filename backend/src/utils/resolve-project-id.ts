// @ts-nocheck
import { normalizeProjectSlug } from "./project-slug"
import { PROFITABILITY_MODULE } from "../modules/profitability"

/**
 * Make sure an order carries metadata.project_id before anything language- or
 * brand-specific is derived from it.
 *
 * The checkout normally writes project_id onto the order. Express-wallet flows
 * (Apple Pay / Google Pay through Revolut, and some PayPal ones) skip that step,
 * and project_id only appears once order-placed-custom-number back-fills it from
 * sales_channel_id. Both run on order.placed, so they race — and when the email
 * subscriber wins, getProjectEmailConfig() finds no project_id and silently
 * falls back to the Dutch default. That is how Norwegian buyers ended up with a
 * Dutch order confirmation (9 of 344 NO orders, all express wallets).
 *
 * Resolving the slug here removes the dependency on subscriber ordering.
 * Mutates order.metadata in memory only — persisting stays with
 * order-placed-custom-number, which owns that write.
 *
 * Never throws: a failed lookup leaves the order as-is and the caller keeps its
 * previous fallback behaviour.
 */
export async function ensureProjectId(container: any, order: any, logPrefix = "ProjectId"): Promise<string | null> {
  const existing = order?.metadata?.project_id
  if (existing) return existing

  const salesChannelId = order?.sales_channel_id
  if (!salesChannelId) {
    console.warn(`[${logPrefix}] Order ${order?.id} has no project_id and no sales_channel_id to resolve it from`)
    return null
  }

  try {
    const profitService = container.resolve(PROFITABILITY_MODULE) as any
    const configs = await profitService.listProjectConfigs({ sales_channel_id: salesChannelId }, { take: 1 })
    if (!configs?.length) {
      console.warn(`[${logPrefix}] No project_config for sales_channel ${salesChannelId}`)
      return null
    }
    const resolved = normalizeProjectSlug(configs[0].project_slug)
    order.metadata = { ...(order.metadata || {}), project_id: resolved }
    console.log(`[${logPrefix}] Resolved project_id from sales_channel: ${resolved} (order ${order?.id})`)
    return resolved
  } catch (e: any) {
    console.warn(`[${logPrefix}] Could not resolve project from sales_channel:`, e?.message)
    return null
  }
}
