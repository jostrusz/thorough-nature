// @ts-nocheck
/**
 * Shared routing predicate: does this order ship from the Huset warehouse
 * (3PLhuset, Landvetter SE) instead of Dextrum mySTOCK?
 *
 * Used by BOTH order-placed subscribers (huset + dextrum) so an order can
 * never be queued into both WMS systems.
 *
 * project_id may not be in order.metadata yet at order.placed time (it is
 * resolved ~2s later by order-placed-custom-number.ts), so we resolve it the
 * same way: metadata → profitability project_configs by sales_channel_id →
 * country fallback (NO is exclusively slipp-taket).
 */
import { PROFITABILITY_MODULE } from "../modules/profitability"
import { getHusetConfig } from "../modules/huset/config"

export async function resolveProjectSlug(order: any, container: any): Promise<string> {
  const meta = order?.metadata || {}
  if (meta.project_id) return String(meta.project_id)

  if (order?.sales_channel_id) {
    try {
      const profitService = container.resolve(PROFITABILITY_MODULE) as any
      const configs = await profitService.listProjectConfigs(
        { sales_channel_id: order.sales_channel_id },
        { take: 1 }
      )
      if (configs?.length > 0 && configs[0].project_slug) {
        return String(configs[0].project_slug)
      }
    } catch {
      /* fall through to country heuristic */
    }
  }
  return ""
}

/**
 * Returns true when the order must route to Huset.
 * Always false when HUSET_ENABLED !== "true" (Dextrum keeps current behavior).
 */
export async function isHusetOrder(order: any, container: any): Promise<boolean> {
  const config = getHusetConfig()
  if (!config.enabled) return false

  const slug = await resolveProjectSlug(order, container)
  if (slug) return slug === config.projectSlug

  // Fallback: Norway is exclusively the slipp-taket project
  const cc = (
    order?.shipping_address?.country_code ||
    order?.billing_address?.country_code ||
    ""
  ).toUpperCase()
  return cc === "NO"
}
