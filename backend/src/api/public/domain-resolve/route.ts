import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { PROFITABILITY_MODULE } from "../../../modules/profitability"
import type ProfitabilityModuleService from "../../../modules/profitability/service"

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
