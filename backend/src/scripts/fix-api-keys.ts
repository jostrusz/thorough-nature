import { ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"

export default async function fixApiKeys({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const link = container.resolve(ContainerRegistrationKeys.LINK)
  const apiKeyModuleService = container.resolve(Modules.API_KEY)

  // 1. Remove Dehondenbijbel from "Webshop" API key
  logger.info("Removing Dehondenbijbel from Webshop API key...")
  const webshopKeys = await apiKeyModuleService.listApiKeys({ title: "Webshop" })
  if (webshopKeys.length) {
    const webshopKey = webshopKeys[0]
    // Dismiss the link between Webshop key and Dehondenbijbel sales channel
    await link.dismiss({
      [Modules.API_KEY]: { publishable_key_id: webshopKey.id },
      [Modules.SALES_CHANNEL]: { sales_channel_id: "sc_01KJSENKGPV7GA0CYAT1JVN4W5" },
    })
    logger.info(`Removed Dehondenbijbel (sc_01KJSENKGPV7GA0CYAT1JVN4W5) from Webshop key`)
  }

  // 2. Create a new publishable API key for Dehondenbijbel
  logger.info("Creating Dehondenbijbel API key...")
  const newKey = await apiKeyModuleService.createApiKeys({
    title: "Dehondenbijbel",
    type: "publishable",
    created_by: "seed-script",
  })
  logger.info(`Created API key: ${newKey.id} | token: ${newKey.token}`)

  // 3. Link the new key to the Dehondenbijbel sales channel
  await link.create({
    [Modules.API_KEY]: { publishable_key_id: newKey.id },
    [Modules.SALES_CHANNEL]: { sales_channel_id: "sc_01KJSENKGPV7GA0CYAT1JVN4W5" },
  })
  logger.info("Linked Dehondenbijbel key to Dehondenbijbel sales channel")

  // 4. Verify
  logger.info("═══════════════════════════════════════════")
  logger.info("API KEY FIX COMPLETE!")
  logger.info(`New publishable key for Dehondenbijbel: ${newKey.token}`)
  logger.info("Update config.json with this key:")
  logger.info(`  "publishableApiKey": "${newKey.token}"`)
  logger.info("═══════════════════════════════════════════")
}
