import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import type { IApiKeyModuleService, ISalesChannelModuleService } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * GET /store/project-key/:salesChannelName
 *
 * Returns the publishable API key token for a given sales channel name.
 * This is safe to expose publicly — publishable keys are meant for browser use.
 * Used by the storefront to resolve the correct API key per project.
 */
export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const { salesChannelName } = req.params as { salesChannelName: string }

  try {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

    // Find sales channel by name
    const scModule = req.scope.resolve(Modules.SALES_CHANNEL) as ISalesChannelModuleService
    const channels = await scModule.listSalesChannels({ name: salesChannelName })

    if (!channels.length) {
      res.json({ token: null })
      return
    }

    const channelId = channels[0].id

    // Find publishable API key linked to this sales channel
    const apiKeyModule = req.scope.resolve(Modules.API_KEY) as IApiKeyModuleService
    const allKeys = await apiKeyModule.listApiKeys({})

    // Query the link table to find which key is linked to this channel
    const { data: links } = await query.graph({
      entity: "publishable_api_key_sales_channel",
      fields: ["publishable_key_id", "sales_channel_id"],
    })

    // Find the key linked to our sales channel
    const linkedKeyIds = (links || [])
      .filter((l: any) => l.sales_channel_id === channelId)
      .map((l: any) => l.publishable_key_id)

    const matchingKey = allKeys.find(
      (k: any) => k.type === "publishable" && !k.revoked_at && linkedKeyIds.includes(k.id)
    )

    res.json({
      token: matchingKey?.token || null,
      sales_channel_id: channelId,
    })
  } catch (error: any) {
    console.error("[project-key] Error:", error.message)
    res.status(500).json({ error: error.message })
  }
}
