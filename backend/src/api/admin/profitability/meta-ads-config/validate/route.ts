import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { PROFITABILITY_MODULE } from "../../../../../modules/profitability"
import type ProfitabilityModuleService from "../../../../../modules/profitability/service"

/**
 * POST /admin/profitability/meta-ads-config/validate
 * Test the stored Meta Ads token and return available ad accounts
 */
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve(PROFITABILITY_MODULE) as ProfitabilityModuleService

  try {
    // Get stored config
    const configs = await service.listMetaAdsConfigs({}, { take: 1 })
    if (configs.length === 0) {
      res.status(400).json({ error: "No Meta Ads token configured. Save one first." })
      return
    }

    const config = configs[0] as any
    const accessToken = config.access_token

    // Validate token by calling Meta Ads API
    const response = await fetch(
      `https://graph.facebook.com/v21.0/me/adaccounts?fields=id,name,currency,account_status&access_token=${encodeURIComponent(accessToken)}`
    )

    if (!response.ok) {
      const errorData = await response.json()
      // Update token status to error/expired
      const errorType = errorData?.error?.code === 190 ? "expired" : "error"
      await service.updateMetaAdsConfigs({
        id: config.id,
        token_status: errorType,
        last_validated_at: new Date(),
      })

      res.status(400).json({
        valid: false,
        error: errorData?.error?.message || "Token validation failed",
        token_status: errorType,
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

    // Update token status to valid
    await service.updateMetaAdsConfigs({
      id: config.id,
      token_status: "valid",
      last_validated_at: new Date(),
    })

    res.json({
      valid: true,
      token_status: "valid",
      accounts,
      account_count: accounts.length,
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
}
