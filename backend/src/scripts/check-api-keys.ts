import { ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"

export default async function checkApiKeys({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const apiKeyModuleService = container.resolve(Modules.API_KEY)

  // List all publishable API keys
  const keys = await apiKeyModuleService.listApiKeys({})
  for (const key of keys) {
    logger.info(`API Key: "${key.title}" | type: ${key.type} | token: ${key.token} | id: ${key.id}`)
  }

  // Check publishable key links to sales channels
  try {
    const { data: links } = await query.graph({
      entity: "publishable_api_key_sales_channel",
      fields: ["publishable_key_id", "sales_channel_id"],
    })
    logger.info(`\nPublishable key -> sales channel links:`)
    for (const link of links) {
      logger.info(`  key: ${(link as any).publishable_key_id} -> channel: ${(link as any).sales_channel_id}`)
    }
  } catch (e: any) {
    logger.warn(`Could not query links entity: ${e.message}`)
  }

  // List all sales channels
  const salesChannelModuleService = container.resolve(Modules.SALES_CHANNEL)
  const channels = await salesChannelModuleService.listSalesChannels({})
  logger.info(`\nAll sales channels:`)
  for (const ch of channels) {
    logger.info(`  "${ch.name}" | id: ${ch.id}`)
  }
}
