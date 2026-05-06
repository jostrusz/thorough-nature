// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MARKETING_MODULE } from "../../../../../modules/marketing"
import type MarketingModuleService from "../../../../../modules/marketing/service"

/**
 * GET /public/marketing/cx/:slug
 *
 * Cross-sell click tracker. The slug maps to a hardcoded source-brand →
 * target-URL pair below. Records a marketing_event of type
 * "cross_sell_clicked" with the slug + source brand, then 302-redirects
 * to the target URL (UTM params preserved on the target).
 *
 * Why this exists (vs Resend's built-in click tracking):
 *   - Resend wraps every href, but the click events are only visible in
 *     Resend's dashboard / via webhook. We have no webhook subscription
 *     and the dashboard isn't queryable. This endpoint writes directly to
 *     marketing_event so the cross-sell funnel can be queried via SQL.
 *   - Persistent under our own domain (marketing-hq.eu) — Resend rotates
 *     its tracking domain occasionally; we control this one.
 *
 * Adding new cross-sell links: extend the SLUG_MAP below. No DB schema
 * change needed. If we ever have >5 cross-sell variants, move to a
 * marketing_cross_sell table.
 */

type CrossSell = {
  source_brand: string
  target_brand: string
  target_url: string
}

const SLUG_MAP: Record<string, CrossSell> = {
  "het-leven-from-loslatenboek": {
    source_brand: "loslatenboek",
    target_brand: "het-leven",
    target_url:
      "https://www.pakjeleventerug.nl/?utm_source=loslatenboek_confirmation&utm_medium=email&utm_campaign=cross_sell_het_leven",
  },
}

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const slug = String((req.params as any).slug || "").trim()
  const cx = SLUG_MAP[slug]
  if (!cx) {
    res.status(404).send("not_found")
    return
  }

  // Best-effort event log. We record but never let a logging error block
  // the redirect — the redirect IS the user's expected behaviour.
  try {
    const service = req.scope.resolve(MARKETING_MODULE) as unknown as MarketingModuleService
    // Resolve source brand id from slug for event attribution.
    const [brand] = await service.listMarketingBrands({ slug: cx.source_brand } as any)
    if (brand) {
      await service.createMarketingEvents({
        brand_id: (brand as any).id,
        type: "cross_sell_clicked",
        payload: {
          slug,
          source_brand: cx.source_brand,
          target_brand: cx.target_brand,
          target_url: cx.target_url,
          ip: clientIp(req),
          user_agent: (req.headers["user-agent"] as string) || null,
          referrer: (req.headers["referer"] as string) || null,
        },
        occurred_at: new Date(),
        source: "public:cx-redirect",
      } as any)
    }
  } catch (err: any) {
    const logger = (req.scope.resolve("logger") as any) || console
    logger.warn(`[CrossSell] click log failed for slug=${slug}: ${err?.message || err}`)
  }

  res.redirect(302, cx.target_url)
}

function clientIp(req: MedusaRequest): string {
  const fwd = (req.headers["x-forwarded-for"] as string) || ""
  if (fwd) return fwd.split(",")[0].trim()
  return (req as any).ip || (req.socket as any)?.remoteAddress || "unknown"
}
