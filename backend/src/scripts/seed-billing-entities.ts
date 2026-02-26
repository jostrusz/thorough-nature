import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { BILLING_ENTITY_MODULE } from "../modules/billing-entity"

/**
 * Seed script: Create the 2 billing entities (companies) if they don't exist.
 *
 * Run with: npx medusa exec ./src/scripts/seed-billing-entities.ts
 */
export default async function seedBillingEntities({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const billingService = container.resolve(BILLING_ENTITY_MODULE) as any

  const existing = await billingService.listBillingEntities()

  // Check if already seeded by tax_id
  const existingTaxIds = existing.map((e: any) => e.tax_id)

  const companies = [
    {
      name: "Performance Marketing Solution",
      legal_name: "Performance Marketing Solution s.r.o.",
      country_code: "cz",
      tax_id: "06259928",
      vat_id: "CZ06259928",
      registration_id: "06259928",
      address: {
        address_1: "Rybná 716/24",
        city: "Praha",
        postal_code: "11000",
        country_code: "CZ",
        district: "Staré Město",
      },
      invoicing_system: "fakturoid",
      is_default: true,
    },
    {
      name: "EverChapter",
      legal_name: "EverChapter OÜ",
      country_code: "ee",
      tax_id: "17327067",
      vat_id: "EE102906196",
      registration_id: "17327067",
      address: {
        address_1: "Narva mnt 5",
        city: "Tallinn",
        postal_code: "10117",
        country_code: "EE",
        district: "Kesklinna linnaosa, Harju maakond",
      },
      invoicing_system: "quickbooks",
      is_default: false,
    },
  ]

  let created = 0
  for (const company of companies) {
    if (existingTaxIds.includes(company.tax_id)) {
      logger.info(`[Seed] Company "${company.name}" already exists, skipping`)
      continue
    }

    await billingService.createBillingEntities(company)
    logger.info(`[Seed] Created company: ${company.legal_name} (${company.invoicing_system})`)
    created++
  }

  logger.info(`[Seed] Done. Created ${created} billing entities.`)
}
