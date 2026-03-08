import { ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"
import {
  createRegionsWorkflow,
} from "@medusajs/medusa/core-flows"

/**
 * Migration script: Move Sweden from EUR region to dedicated SEK region.
 *
 * Problem: Sweden (SE) was seeded into the "Europe" region with EUR currency.
 * Slapp Taget orders should use SEK.
 *
 * Steps:
 * 1. Find the current region containing Sweden
 * 2. Remove Sweden from that region
 * 3. Create a new "Sweden (SEK)" region with SEK currency
 * 4. Add Sweden to the new region
 *
 * Run: npx medusa exec src/scripts/migrate-sweden-to-sek.ts
 */
export default async function migrateSweden({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const regionModuleService = container.resolve(Modules.REGION)

  logger.info("═══════════════════════════════════════════")
  logger.info("[MigrateSE] Starting Sweden SEK migration...")

  // 1. Find ALL regions and their countries
  const allRegions = await regionModuleService.listRegions({}, {
    relations: ["countries"],
  })

  logger.info(`[MigrateSE] Found ${allRegions.length} regions:`)
  for (const r of allRegions) {
    const countryCodes = (r.countries || []).map((c: any) => c.iso_2).join(", ")
    logger.info(`  - ${r.name} (${r.id}): currency=${r.currency_code}, countries=[${countryCodes}]`)
  }

  // 2. Find region currently containing Sweden
  const currentRegion = allRegions.find((r: any) =>
    r.countries?.some((c: any) => c.iso_2 === "se")
  )

  if (!currentRegion) {
    logger.warn("[MigrateSE] Sweden not found in any region! Creating new SEK region with SE...")
  } else {
    logger.info(`[MigrateSE] Sweden is currently in region: ${currentRegion.name} (${currentRegion.id}, ${currentRegion.currency_code})`)

    if (currentRegion.currency_code === "sek") {
      logger.info("[MigrateSE] Sweden is ALREADY in a SEK region! No migration needed.")
      logger.info("═══════════════════════════════════════════")
      return
    }

    // 3. Remove Sweden from current region
    // Get all country codes except SE
    const remainingCountries = (currentRegion.countries || [])
      .map((c: any) => c.iso_2)
      .filter((code: string) => code !== "se")

    logger.info(`[MigrateSE] Removing SE from "${currentRegion.name}" — remaining countries: [${remainingCountries.join(", ")}]`)

    // Update the region to remove Sweden
    await regionModuleService.updateRegions(currentRegion.id, {
      countries: remainingCountries,
    })
    logger.info(`[MigrateSE] Removed SE from "${currentRegion.name}"`)
  }

  // 4. Check if a SEK region already exists (without Sweden)
  const existingSekRegion = allRegions.find((r: any) => r.currency_code === "sek")
  if (existingSekRegion) {
    // Add Sweden to existing SEK region
    const existingCountries = (existingSekRegion.countries || []).map((c: any) => c.iso_2)
    if (!existingCountries.includes("se")) {
      existingCountries.push("se")
      await regionModuleService.updateRegions(existingSekRegion.id, {
        countries: existingCountries,
      })
      logger.info(`[MigrateSE] Added SE to existing SEK region: ${existingSekRegion.name} (${existingSekRegion.id})`)
    }
    logger.info(`[MigrateSE] SEK Region ID: ${existingSekRegion.id}`)
    logger.info("═══════════════════════════════════════════")
    return
  }

  // 5. Create new Sweden region with SEK
  logger.info("[MigrateSE] Creating new Sweden (SEK) region...")
  const { result: regionResult } = await createRegionsWorkflow(container).run({
    input: {
      regions: [
        {
          name: "Sweden (SEK)",
          currency_code: "sek",
          countries: ["se"],
          payment_providers: ["pp_system_default"],
        },
      ],
    },
  })
  const newRegion = regionResult[0]
  logger.info(`[MigrateSE] Created SEK region: ${newRegion.id}`)

  // 6. Summary
  logger.info("")
  logger.info("═══════════════════════════════════════════")
  logger.info("[MigrateSE] MIGRATION COMPLETE!")
  logger.info(`New SEK Region ID: ${newRegion.id}`)
  logger.info("")
  logger.info("IMPORTANT: New orders for Slapp Taget will now use SEK.")
  logger.info("Existing EUR orders are NOT affected (they keep their original currency).")
  logger.info("═══════════════════════════════════════════")
}
