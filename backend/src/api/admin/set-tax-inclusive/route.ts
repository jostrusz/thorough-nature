import { MedusaRequest, MedusaResponse } from "@medusajs/framework"
import { Modules } from "@medusajs/framework/utils"

/**
 * POST /admin/set-tax-inclusive
 *
 * Sets PricePreference for all regions to tax-inclusive.
 * In NL/BE, all consumer prices must include VAT.
 *
 * This endpoint is idempotent — safe to call multiple times.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const pricingModule = req.scope.resolve(Modules.PRICING)
    const regionModule = req.scope.resolve(Modules.REGION)
    const logger = req.scope.resolve("logger")

    logger.info("[Tax] Setting tax-inclusive price preferences for all regions...")

    const regions = await regionModule.listRegions()
    const results: Array<{ region: string; region_id: string; action: string }> = []

    for (const region of regions) {
      const existing = await pricingModule.listPricePreferences({
        attribute: "region_id",
        value: region.id,
      })

      if (existing.length > 0) {
        const pref = existing[0]
        if (!(pref as any).is_tax_inclusive) {
          await pricingModule.updatePricePreferences(pref.id, {
            is_tax_inclusive: true,
          })
          results.push({ region: region.name, region_id: region.id, action: "updated" })
          logger.info(`[Tax] Updated region "${region.name}" (${region.id}) to tax-inclusive`)
        } else {
          results.push({ region: region.name, region_id: region.id, action: "already_set" })
          logger.info(`[Tax] Region "${region.name}" (${region.id}) already tax-inclusive`)
        }
      } else {
        await pricingModule.createPricePreferences({
          attribute: "region_id",
          value: region.id,
          is_tax_inclusive: true,
        })
        results.push({ region: region.name, region_id: region.id, action: "created" })
        logger.info(`[Tax] Created tax-inclusive preference for region "${region.name}" (${region.id})`)
      }
    }

    // Also set for EUR currency (belt and suspenders)
    const existingCurrency = await pricingModule.listPricePreferences({
      attribute: "currency_code",
      value: "eur",
    })

    if (existingCurrency.length > 0) {
      if (!(existingCurrency[0] as any).is_tax_inclusive) {
        await pricingModule.updatePricePreferences(existingCurrency[0].id, {
          is_tax_inclusive: true,
        })
        results.push({ region: "EUR currency", region_id: "eur", action: "updated" })
      } else {
        results.push({ region: "EUR currency", region_id: "eur", action: "already_set" })
      }
    } else {
      await pricingModule.createPricePreferences({
        attribute: "currency_code",
        value: "eur",
        is_tax_inclusive: true,
      })
      results.push({ region: "EUR currency", region_id: "eur", action: "created" })
    }

    logger.info("[Tax] Done. All regions and EUR currency are now tax-inclusive.")

    return res.json({
      success: true,
      message: "All regions and EUR currency set to tax-inclusive",
      results,
    })
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message,
    })
  }
}
