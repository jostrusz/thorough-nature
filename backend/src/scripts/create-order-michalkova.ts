// @ts-nocheck
import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

/**
 * One-off: manual COD order for Zdenka Michálková (odpust-knizka / Pusť to, co tě ničí).
 *
 * Napsala 5. 8. na podporu, že si knihu chce koupit, ale neumí poslat peníze
 * z internetového bankovnictví, a chtěla číslo účtu. Podpora jí místo převodu
 * nabídla dobírku za 749 Kč včetně doručení; ona potvrdila adresu, telefon
 * a že chce doručit domů (ne na výdejní místo).
 *
 * 749 Kč je běžná cena 1 ks a doprava je v ní zahrnutá, takže line item nese
 * celých 749 a shipping method 0 — Dextrum odvozuje částku k výběru z položek.
 *
 * DPH 0 % ("Czech Zero VAT (Books)") — ověřeno proti stávajícím objednávkám
 * tohoto projektu, ne 12 %.
 *
 * Run: pnpm medusa exec ./src/scripts/create-order-michalkova.ts
 */
export default async function createOrderMichalkova({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const orderModuleService = container.resolve(Modules.ORDER)

  const REGION_ID = "reg_01KKB4EZN0CHFYDG64K4VP0J2A"          // Czech Republic
  const SALES_CHANNEL_ID = "sc_01KTTR1W2GDWQC8R6NE12V7MWT"    // Odpust Knizka
  const VARIANT_ID = "variant_01KTTR2PJATN1AP1YS6Q06NA5P"     // PTCTN2876287672, Paperback
  const SHIPPING_OPTION_ID = "so_01KTTR2B5J2XPRAHNQHHDQ0XVN"  // Zásilkovna - Na adresu
  const EMAIL = "zmichalkova@email.cz"

  // Idempotency
  const { data: existing } = await query.graph({
    entity: "order",
    fields: ["id", "metadata"],
    filters: { email: EMAIL, sales_channel_id: SALES_CHANNEL_ID },
  })
  const already = (existing || []).find(
    (o: any) => o?.metadata?.manual_source === "manual_michalkova_script"
  )
  if (already) {
    logger.info(`[Michálková] Order already exists: ${already.id} (${already.metadata?.custom_order_number}) — skipping`)
    return
  }

  const address = {
    first_name: "Zdenka",
    last_name: "Michálková",
    address_1: "Ryneček 3/152",
    city: "Příbram",
    postal_code: "261 01",
    country_code: "cz",
    phone: "+420606110852",
  }

  const metadata: any = {
    // `manual_ai_order_creator` je marker, který Dextrum send route kontroluje,
    // aby přeskočil guard "objednávka musí být zaplacená" — nutné pro dobírku.
    created_by: "manual_ai_order_creator",
    created_manually: true,
    manual_source: "manual_michalkova_script",
    project_id: "odpust-knizka",
    payment_provider: "cod",
    payment_method: "cod",          // <- drives isCOD => Dextrum U0123_DOBIRKA
    copied_payment_status: "pending",
    shipping_method: "zasilkovna_home",
    manual_order_notes:
      "Zákaznice psala 5. 8. na podporu, že neumí poslat peníze z banky a chtěla " +
      "číslo účtu. Podpora nabídla dobírku 749 Kč včetně doručení, ona potvrdila " +
      "adresu, telefon a doručení domů (ne výdejní místo). Dextrum vybere 749 Kč.",
  }

  const newOrder = await orderModuleService.createOrders({
    currency_code: "czk",
    email: EMAIL,
    region_id: REGION_ID,
    sales_channel_id: SALES_CHANNEL_ID,
    shipping_address: address,
    billing_address: address,
    items: [{
      title: "Pusť to, co tě ničí",
      variant_id: VARIANT_ID,
      quantity: 1,
      unit_price: 749,
      is_tax_inclusive: true,
    }],
    shipping_methods: [{
      name: "Zásilkovna - Na adresu",
      amount: 0,
      shipping_option_id: SHIPPING_OPTION_ID,
    }],
    metadata,
  })

  const orderId = (newOrder as any).id
  const displayId = (newOrder as any).display_id
  const customOrderNumber = `CZ${new Date().getFullYear()}-${displayId}`

  await orderModuleService.updateOrders(orderId, {
    metadata: { ...metadata, custom_order_number: customOrderNumber },
  })

  // DPH 0 % — knihy v ČR, shodné se stávajícími objednávkami projektu
  try {
    const { data: [fresh] } = await query.graph({
      entity: "order",
      fields: ["items.id"],
      filters: { id: orderId },
    })
    const item = (fresh as any)?.items?.[0]
    if (item) {
      await orderModuleService.createOrderLineItemTaxLines(orderId, [{
        item_id: item.id,
        code: "zero-vat-cz",
        rate: 0,
        description: "Czech Zero VAT (Books)",
      }])
    }
  } catch (e: any) {
    logger.warn(`[Michálková] tax line skipped: ${e.message}`)
  }

  logger.info("═══════════════════════════════════════════")
  logger.info(`[Michálková] ORDER CREATED`)
  logger.info(`  order_id: ${orderId}`)
  logger.info(`  custom_order_number: ${customOrderNumber}`)
  logger.info(`  1x Pusť to, co tě ničí @ 749 = 749 CZK (dobírka)`)
  logger.info(`  doručení: Zásilkovna - Na adresu → Příbram`)
  logger.info("═══════════════════════════════════════════")
}
