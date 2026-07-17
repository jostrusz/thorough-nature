// @ts-nocheck
import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

/**
 * One-off: manual COD order for Katarína Bartková (pusti-to-sk).
 *
 * She could not complete checkout because cash-on-delivery is not offered in the
 * SK storefront, so support promised her 2 books for 53 EUR cash to the courier
 * (shipping included). Dextrum derives the cash-to-collect amount from the line
 * items, so 2 x 26.50 = 53 EUR is exactly what the courier will collect.
 *
 * Emits order.placed so the normal pipeline runs (Fakturoid invoice, order
 * confirmation, free e-books, Dextrum WMS row) — unlike the Kotrasová script,
 * no invoice exists yet here, so there is no duplicate-invoice risk.
 *
 * Run: pnpm medusa exec ./src/scripts/create-order-bartkova.ts
 */
export default async function createOrderBartkova({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const orderModuleService = container.resolve(Modules.ORDER)

  const REGION_ID = "reg_01KWVAZVNATPX01HH77MYWKG3M"        // Slovakia (Pusti To SK)
  const SALES_CHANNEL_ID = "sc_01KWVAX8XTNTXHF9ZWH211Y6CF"  // pusti-to-sk
  const VARIANT_ID = "variant_01KWVB0CS1A6XBKNB9M3SG5GFK"   // PTCN6764786297
  const SHIPPING_OPTION_ID = "so_01KWVB06DRRS7ZP2E5AY6N3VR3" // Packeta - Na adresu (home)
  const EMAIL = "bartkova6@gmail.com"

  // Idempotency
  const { data: existing } = await query.graph({
    entity: "order",
    fields: ["id", "metadata"],
    filters: { email: EMAIL, sales_channel_id: SALES_CHANNEL_ID },
  })
  const already = (existing || []).find((o: any) => o?.metadata?.manual_source === "manual_bartkova_script")
  if (already) {
    logger.info(`[Bartkova] Order already exists: ${already.id} (${already.metadata?.custom_order_number}) — skipping`)
    return
  }

  const address = {
    first_name: "Katarína",
    last_name: "Bartková",
    address_1: "MDŽ 824/7",
    city: "Sliač",
    postal_code: "962 31",
    country_code: "sk",
    phone: "+421902744998",
  }

  const metadata: any = {
    // `manual_ai_order_creator` is the marker the Dextrum send route checks to
    // skip the "order must be paid" guard — required for COD.
    created_by: "manual_ai_order_creator",
    created_manually: true,
    manual_source: "manual_bartkova_script",
    project_id: "pusti-to-sk",
    payment_provider: "cod",
    payment_method: "cod",          // <- drives isCOD => Dextrum U0123_DOBIRKA
    copied_payment_status: "pending",
    shipping_method: "zasilkovna_home",
    manual_order_notes:
      "Zákazníčka nemohla dokončiť objednávku (dobierka nie je v SK e-shope). Podpora prisľúbila 2 ks za 53 € v hotovosti kuriérovi, poštovné v cene. Dextrum vyberie 53 € (2 x 26,50).",
  }

  const newOrder = await orderModuleService.createOrders({
    currency_code: "eur",
    email: EMAIL,
    region_id: REGION_ID,
    sales_channel_id: SALES_CHANNEL_ID,
    shipping_address: address,
    billing_address: address,
    items: [{
      title: "Pusti to, čo ťa ničí",
      variant_id: VARIANT_ID,
      quantity: 2,
      unit_price: 26.5,
      is_tax_inclusive: true,
    }],
    shipping_methods: [{
      name: "Packeta - Na adresu",
      amount: 0,
      shipping_option_id: SHIPPING_OPTION_ID,
    }],
    metadata,
  })

  const orderId = (newOrder as any).id
  const displayId = (newOrder as any).display_id
  const customOrderNumber = `SK${new Date().getFullYear()}-${displayId}`

  await orderModuleService.updateOrders(orderId, {
    metadata: { ...metadata, custom_order_number: customOrderNumber },
  })

  // VAT 5% (SK reduced rate for books)
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
        code: "VAT",
        rate: 5,
        description: "VAT 5%",
      }])
    }
  } catch (e: any) {
    logger.warn(`[Bartkova] tax line skipped: ${e.message}`)
  }

  // Fire the full pipeline (invoice, confirmation e-mail, e-books, Dextrum row)
  try {
    const eventBus = container.resolve(Modules.EVENT_BUS)
    await eventBus.emit({ name: "order.placed", data: { id: orderId } })
    logger.info(`[Bartkova] Emitted order.placed`)
  } catch (e: any) {
    logger.error(`[Bartkova] Failed to emit order.placed: ${e.message}`)
  }

  logger.info("═══════════════════════════════════════════")
  logger.info(`[Bartkova] ORDER CREATED`)
  logger.info(`  order_id: ${orderId}`)
  logger.info(`  custom_order_number: ${customOrderNumber}`)
  logger.info(`  2x Pusti to, čo ťa ničí @ 26.50 = 53 EUR (COD)`)
  logger.info(`  delivery: Packeta - Na adresu → Sliač`)
  logger.info("═══════════════════════════════════════════")
}
