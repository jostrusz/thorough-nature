import { ExecArgs } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"

/**
 * Sets PricePreference for all regions to tax-inclusive.
 *
 * In NL/BE, all consumer prices must include VAT. This script ensures
 * that Medusa treats all prices as tax-inclusive by default.
 *
 * Run with: npx medusa exec src/scripts/set-tax-inclusive.ts
 */
export default async function setTaxInclusive({
  container,
}: ExecArgs) {
  const logger = container.resolve("logger")
  const pricingModule = container.resolve(Modules.PRICING)
  const regionModule = container.resolve(Modules.REGION)

  logger.info("[Tax] Setting tax-inclusive price preferences for all regions...")

  const regions = await regionModule.listRegions()

  for (const region of regions) {
    // Check if PricePreference already exists for this region
    const existing = await pricingModule.listPricePreferences({
      attribute: "region_id",
      value: region.id,
    })

    if (existing.length > 0) {
      // Update existing preference to ensure it's tax-inclusive
      const pref = existing[0]
      if (!(pref as any).is_tax_inclusive) {
        await pricingModule.updatePricePreferences(pref.id, {
          is_tax_inclusive: true,
        })
        logger.info(`[Tax] Updated region "${region.name}" (${region.id}) to tax-inclusive`)
      } else {
        logger.info(`[Tax] Region "${region.name}" (${region.id}) already tax-inclusive`)
      }
    } else {
      // Create new preference
      await pricingModule.createPricePreferences({
        attribute: "region_id",
        value: region.id,
        is_tax_inclusive: true,
      })
      logger.info(`[Tax] Created tax-inclusive preference for region "${region.name}" (${region.id})`)
    }
  }

  logger.info("[Tax] Done. All regions are now tax-inclusive.")
}
