import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { PROFITABILITY_MODULE } from "../../../../modules/profitability"
import type ProfitabilityModuleService from "../../../../modules/profitability/service"

/**
 * GET /admin/profitability/meta-ads-accounts
 * List all ad accounts available with the stored token
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve(PROFITABILITY_MODULE) as ProfitabilityModuleService

  try {
    const configs = await service.listMetaAdsConfigs({}, { take: 1 })
    if (configs.length === 0) {
      res.status(400).json({ error: "No Meta Ads token configured" })
      return
    }

    const config = configs[0] as any
    if (config.token_status !== "valid") {
      res.status(400).json({
        error: `Meta Ads token is ${config.token_status}. Please update and validate.`,
      })
      return
    }

    const response = await fetch(
      `https://graph.facebook.com/v21.0/me/adaccounts?fields=id,name,currency,account_status&access_token=${encodeURIComponent(config.access_token)}`
    )

    if (!response.ok) {
      const errorData = await response.json()
      res.status(400).json({
        error: errorData?.error?.message || "Failed to fetch ad accounts",
      })
      return
    }

    const data = await response.json()
    const accounts = (data.data || []).map((acc: any) => ({
      id: acc.id,
      name: acc.name,
      currency: acc.currency,
      account_status: acc.account_status,
    }))

    res.json({ accounts })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
}
