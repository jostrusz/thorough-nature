import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { MARKETING_MODULE } from "../modules/marketing"
import type MarketingModuleService from "../modules/marketing/service"

/**
 * Seed the 6 existing projects as marketing brands.
 *
 * Idempotent — safe to run multiple times. Matches on project_id; if a row
 * already exists for a project_id it is left untouched (so manual tweaks via
 * the admin UI survive re-seeds).
 *
 * Run with:
 *   npx medusa exec ./src/scripts/seed-marketing-brands.ts
 */
export default async function seedMarketingBrands({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const service = container.resolve(MARKETING_MODULE) as unknown as MarketingModuleService

  const brands = [
    {
      slug: "dehondenbijbel",
      display_name: "De Hondenbijbel",
      project_id: "dehondenbijbel",
      storefront_domain: "dehondenbijbel.nl",
      marketing_from_email: "news@news.dehondenbijbel.nl",
      marketing_from_name: "De Hondenbijbel",
      marketing_reply_to: "support@dehondenbijbel.nl",
      primary_color: "#b45309",
      locale: "nl",
      timezone: "Europe/Amsterdam",
    },
    {
      slug: "loslatenboek",
      display_name: "Laat Los Wat Je Kapotmaakt",
      project_id: "loslatenboek",
      storefront_domain: "loslatenboek.nl",
      marketing_from_email: "news@news.loslatenboek.nl",
      marketing_from_name: "Laat Los Wat Je Kapotmaakt",
      marketing_reply_to: "devries@loslatenboek.nl",
      primary_color: "#2f4858",
      locale: "nl",
      timezone: "Europe/Amsterdam",
    },
    {
      slug: "slapp-taget",
      display_name: "Släpp Taget",
      project_id: "slapp-taget",
      storefront_domain: "slapptagetboken.se",
      marketing_from_email: "news@news.slapptagetboken.se",
      marketing_from_name: "Släpp Taget",
      marketing_reply_to: "hej@slapptagetboken.se",
      primary_color: "#4b5563",
      locale: "sv",
      timezone: "Europe/Stockholm",
    },
    {
      slug: "odpusc-ksiazka",
      display_name: "Odpuść to, co cię niszczy",
      project_id: "odpusc-ksiazka",
      storefront_domain: "odpusc-ksiazka.pl",
      marketing_from_email: "news@news.odpusc-ksiazka.pl",
      marketing_from_name: "Odpuść to, co cię niszczy",
      marketing_reply_to: "biuro@odpusc-ksiazka.pl",
      primary_color: "#7c2d12",
      locale: "pl",
      timezone: "Europe/Warsaw",
    },
    {
      slug: "lass-los",
      display_name: "Lass los, was dich kaputt macht",
      project_id: "lass-los",
      storefront_domain: "lasslosbuch.de",
      marketing_from_email: "news@news.lasslosbuch.de",
      marketing_from_name: "Lass los, was dich kaputt macht",
      marketing_reply_to: "buch@lasslosbuch.de",
      primary_color: "#1f2937",
      locale: "de",
      timezone: "Europe/Berlin",
    },
    {
      slug: "psi-superzivot",
      display_name: "Psí superživot",
      project_id: "psi-superzivot",
      storefront_domain: "psi-superzivot.cz",
      marketing_from_email: "news@news.psi-superzivot.cz",
      marketing_from_name: "Psí superživot",
      marketing_reply_to: "podpora@psi-superzivot.cz",
      primary_color: "#047857",
      locale: "cs",
      timezone: "Europe/Prague",
    },
    {
      slug: "kocici-bible",
      display_name: "Kočičí bible Oficial",
      project_id: "kocici-bible",
      storefront_domain: "kocicibible.cz",
      marketing_from_email: "news@news.kocicibible.cz",
      marketing_from_name: "Kočičí bible",
      marketing_reply_to: "peterka@kocicibible.cz",
      primary_color: "#b45309",
      locale: "cs",
      timezone: "Europe/Prague",
    },
  ]

  let created = 0
  let skipped = 0
  for (const brand of brands) {
    const existing = await service.listMarketingBrands({ project_id: brand.project_id } as any)
    if (existing.length > 0) {
      skipped++
      logger.info(`[marketing-seed] brand '${brand.slug}' already exists (id=${existing[0].id}) — skipping`)
      continue
    }
    const row = await service.createMarketingBrands({
      ...brand,
      double_opt_in_enabled: false,
      tracking_enabled: true,
      abandoned_cart_owner: "transactional_legacy",
      enabled: true,
    } as any)
    created++
    logger.info(`[marketing-seed] created brand '${brand.slug}' (id=${(row as any).id})`)
  }

  logger.info(`[marketing-seed] done: ${created} created, ${skipped} skipped`)
}
