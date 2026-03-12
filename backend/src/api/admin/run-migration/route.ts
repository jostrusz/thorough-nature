import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"
import {
  createShippingOptionsWorkflow,
} from "@medusajs/medusa/core-flows"

/**
 * One-time admin API endpoint to add "Dostawa do domu (Kurier)" shipping option.
 * Call via: curl -X POST https://backend-production-aefbc.up.railway.app/admin/run-migration -H "Authorization: Bearer TOKEN"
 * Delete this file after successful execution.
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const fulfillmentModuleService = req.scope.resolve(Modules.FULFILLMENT)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  try {
    logger.info("[Migration] Adding home delivery shipping option...")

    // 1. Find existing fulfillment set
    const fulfillmentSets = await fulfillmentModuleService.listFulfillmentSets(
      { name: "Odpusc Ksiazka Delivery" },
      { relations: ["service_zones"] }
    )
    if (!fulfillmentSets.length) {
      return res.status(404).json({ message: "Fulfillment set 'Odpusc Ksiazka Delivery' not found" })
    }
    const fulfillmentSet = fulfillmentSets[0]
    const serviceZone = fulfillmentSet.service_zones[0]
    if (!serviceZone) {
      return res.status(404).json({ message: "No service zone found" })
    }

    // 2. Find default shipping profile
    const shippingProfiles = await fulfillmentModuleService.listShippingProfiles({ type: "default" })
    if (!shippingProfiles.length) {
      return res.status(404).json({ message: "No default shipping profile found" })
    }
    const shippingProfile = shippingProfiles[0]

    // 3. Find PL region
    const { data: regions } = await query.graph({
      entity: "region",
      fields: ["id", "name", "countries.*"],
      filters: {},
    })
    const region = regions.find((r: any) =>
      r.countries?.some((c: any) => c.iso_2 === "pl")
    )
    if (!region) {
      return res.status(404).json({ message: "No region with PL country found" })
    }

    // 4. Check if home delivery option already exists
    const existingOptions = await fulfillmentModuleService.listShippingOptions({
      service_zone: { id: serviceZone.id },
    } as any)
    const alreadyExists = existingOptions.some((o: any) =>
      o.name.includes("Kurier") || o.name.includes("domu")
    )
    if (alreadyExists) {
      return res.json({ message: "Home delivery option already exists, skipping", status: "skipped" })
    }

    // 5. Create the shipping option
    await createShippingOptionsWorkflow(req.scope).run({
      input: [
        {
          name: "Dostawa do domu (Kurier)",
          price_type: "flat",
          provider_id: "manual_manual",
          service_zone_id: serviceZone.id,
          shipping_profile_id: shippingProfile.id,
          type: {
            label: "Kurier",
            description: "Dostawa kurierem pod wskazany adres (3-5 dni roboczych)",
            code: "home_delivery",
          },
          prices: [
            { currency_code: "pln", amount: 500 },
            { region_id: region.id, amount: 500 },
          ],
          rules: [
            { attribute: "enabled_in_store", value: "true", operator: "eq" },
            { attribute: "is_return", value: "false", operator: "eq" },
          ],
        },
      ],
    })

    logger.info("[Migration] ✅ Home delivery option created successfully (5 PLN)")
    return res.json({ message: "Home delivery option created successfully (5 PLN)", status: "created" })
  } catch (error: any) {
    logger.error("[Migration] Error:", error.message)
    return res.status(500).json({ message: error.message, status: "error" })
  }
}
