import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { PROFITABILITY_MODULE } from "../../../../modules/profitability"
import type ProfitabilityModuleService from "../../../../modules/profitability/service"

/**
 * GET /admin/profitability/meta-ads-config
 * Get current Meta Ads token status (masked)
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve(PROFITABILITY_MODULE) as ProfitabilityModuleService

  try {
    const configs = await service.listMetaAdsConfigs({}, { take: 1 })
    if (configs.length === 0) {
      res.json({ config: null })
      return
    }

    const config = configs[0] as any
    // Mask the access token for security
    const maskedToken = config.access_token
      ? config.access_token.slice(0, 6) + "****" + config.access_token.slice(-4)
      : null

    res.json({
      config: {
        id: config.id,
        access_token_masked: maskedToken,
        token_status: config.token_status,
        last_validated_at: config.last_validated_at,
        created_at: config.created_at,
        updated_at: config.updated_at,
      },
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
}

/**
 * POST /admin/profitability/meta-ads-config
 * Save or update Meta Ads access token
 */
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve(PROFITABILITY_MODULE) as ProfitabilityModuleService

  try {
    const { access_token } = req.body as { access_token: string }

    if (!access_token) {
      res.status(400).json({ error: "access_token is required" })
      return
    }

    // Check if config exists
    const existing = await service.listMetaAdsConfigs({}, { take: 1 })

    let config: any
    if (existing.length > 0) {
      config = await service.updateMetaAdsConfigs({
        id: (existing[0] as any).id,
        access_token,
        token_status: "valid",
        last_validated_at: new Date(),
      })
    } else {
      config = await service.createMetaAdsConfigs({
        access_token,
        token_status: "valid",
        last_validated_at: new Date(),
      })
    }

    res.json({ config: { id: (config as any).id, token_status: "valid" } })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
}
