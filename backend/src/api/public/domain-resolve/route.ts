import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { PROFITABILITY_MODULE } from "../../../modules/profitability"
import type ProfitabilityModuleService from "../../../modules/profitability/service"
import { PRESALE_MODULE } from "../../../modules/presale"
import { bareDomain } from "../../admin/presale/railway-domains"

/**
 * GET /public/domain-resolve?domain=odpusc-ksiazka.pl
 * Public route — resolves a domain to a project_slug.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const domainParam = req.query.domain as string

  if (!domainParam) {
    res.status(400).json({ found: false, error: "domain query param is required" })
    return
  }

  const service = req.scope.resolve(PROFITABILITY_MODULE) as ProfitabilityModuleService

  try {
    const configs = await service.listProjectConfigs(
      { domain: domainParam },
      { take: 1 }
    )

    if (configs.length === 0) {
      // Presale fallback (additive, tightly gated): only route a domain here
      // when it actually has a PUBLISHED PRESALE PAGE. This lets a brand-new
      // domain (bought + connected on Railway, not in project_config) serve its
      // listicle — WITHOUT touching any existing domain. A secondary domain of
      // another project that has no presale page is never affected: it falls
      // through to `found: false` exactly as today, so its env-map routing,
      // advertorials and storefront keep working unchanged.
      try {
        const presale = req.scope.resolve(PRESALE_MODULE) as any
        const pages = await presale.listPresalePages(
          { domain: bareDomain(domainParam), status: "published" },
          { take: 1 }
        )
        if (pages && pages.length > 0) {
          res.json({
            found: true,
            project_slug: process.env.PRESALE_DEFAULT_PROJECT || "loslatenboek",
            via: "presale",
          })
          return
        }
      } catch {
        // never let the presale check break domain resolution
      }
      res.json({ found: false })
      return
    }

    const config = configs[0] as any

    res.json({
      found: true,
      project_slug: config.project_slug,
    })
  } catch (error: any) {
    res.status(500).json({ found: false, error: error.message })
  }
}
