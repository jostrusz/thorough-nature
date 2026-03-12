import { ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"
import {
  createShippingOptionsWorkflow,
} from "@medusajs/medusa/core-flows"

/**
 * One-time migration script to add "Dostawa do domu (Kurier)" shipping option
 * to the odpusc-ksiazka project on live DB.
 *
 * Run with: npx medusa exec ./src/scripts/add-home-delivery-odpusc.ts
 */
export default async function addHomeDeliveryOdpusc({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const fulfillmentModuleService = container.resolve(Modules.FULFILLMENT)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  logger.info("[OdpuscKsiazka] Adding home delivery shipping option...")

  // 1. Find existing fulfillment set
  const fulfillmentSets = await fulfillmentModuleService.listFulfillmentSets(
    { name: "Odpusc Ksiazka Delivery" },
    { relations: ["service_zones"] }
  )
  if (!fulfillmentSets.length) {
    logger.error("[OdpuscKsiazka] Fulfillment set 'Odpusc Ksiazka Delivery' not found!")
    return
  }
  const fulfillmentSet = fulfillmentSets[0]
  const serviceZone = fulfillmentSet.service_zones[0]
  if (!serviceZone) {
    logger.error("[OdpuscKsiazka] No service zone found!")
    return
  }

  // 2. Find default shipping profile
  const shippingProfiles = await fulfillmentModuleService.listShippingProfiles({ type: "default" })
  if (!shippingProfiles.length) {
    logger.error("[OdpuscKsiazka] No default shipping profile found!")
    return
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
    logger.error("[OdpuscKsiazka] No region with PL country found!")
    return
  }

  // 4. Check if home delivery option already exists
  const existingOptions = await fulfillmentModuleService.listShippingOptions({
    service_zone: { id: serviceZone.id },
  } as any)
  const alreadyExists = existingOptions.some((o: any) =>
    o.name.includes("Kurier") || o.name.includes("domu")
  )
  if (alreadyExists) {
    logger.info("[OdpuscKsiazka] Home delivery option already exists, skipping")
    return
  }

  // 5. Create the shipping option
  await createShippingOptionsWorkflow(container).run({
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

  logger.info("[OdpuscKsiazka] ✅ Home delivery option created successfully (5 PLN)")
}
