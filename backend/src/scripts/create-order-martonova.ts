// @ts-nocheck
import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

/**
 * One-off: manual COD order for Jaroslava Martonová (pusti-to-sk).
 *
 * She wrote in on 3. 8. asking whether the order could be paid cash on delivery
 * (SupportBox, podpora@pustitocotanici.sk). Cash-on-delivery is not offered in
 * the SK storefront, so support asked for her address and phone by e-mail; she
 * sent them the same day and asked for 2 copies.
 *
 * Agreed total is 52 EUR collected by the courier — shipping and the COD fee are
 * included in that number, so the line items must sum to exactly 52 (2 x 26.00)
 * and the shipping method carries 0. Dextrum derives the cash-to-collect amount
 * from the line items.
 *
 * Emits order.placed so the normal pipeline runs (Fakturoid invoice, order
 * confirmation, free e-books, Dextrum WMS row) — no invoice exists yet, so there
 * is no duplicate-invoice risk. Same shape as create-order-bartkova.ts.
 *
 * Run: pnpm medusa exec ./src/scripts/create-order-martonova.ts
 */
export default async function createOrderMartonova({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const orderModuleService = container.resolve(Modules.ORDER)

  const REGION_ID = "reg_01KWVAZVNATPX01HH77MYWKG3M"        // Slovakia (Pusti To SK)
  const SALES_CHANNEL_ID = "sc_01KWVAX8XTNTXHF9ZWH211Y6CF"  // pusti-to-sk
  const VARIANT_ID = "variant_01KWVB0CS1A6XBKNB9M3SG5GFK"   // PTCN6764786297
  const SHIPPING_OPTION_ID = "so_01KWVB06DRRS7ZP2E5AY6N3VR3" // Packeta - Na adresu (home)
  const EMAIL = "jaroslava.martonova@gmail.com"

  // Idempotency
  const { data: existing } = await query.graph({
    entity: "order",
    fields: ["id", "metadata"],
    filters: { email: EMAIL, sales_channel_id: SALES_CHANNEL_ID },
  })
  const already = (existing || []).find(
    (o: any) => o?.metadata?.manual_source === "manual_martonova_script"
  )
  if (already) {
    logger.info(`[Martonová] Order already exists: ${already.id} (${already.metadata?.custom_order_number}) — skipping`)
    return
  }

  const address = {
    first_name: "Jaroslava",
    last_name: "Martonová",
    address_1: "Jarná 6",
    city: "Nové Mesto nad Váhom",
    postal_code: "915 01",
    country_code: "sk",
    phone: "+421903267638",
  }

  const metadata: any = {
    // `manual_ai_order_creator` is the marker the Dextrum send route checks to
    // skip the "order must be paid" guard — required for COD.
    created_by: "manual_ai_order_creator",
    created_manually: true,
    manual_source: "manual_martonova_script",
    project_id: "pusti-to-sk",
    payment_provider: "cod",
    payment_method: "cod",          // <- drives isCOD => Dextrum U0123_DOBIRKA
    copied_payment_status: "pending",
    shipping_method: "zasilkovna_home",
    manual_order_notes:
      "Zákazníčka písala 3. 8. na podporu, či sa dá objednávka zaplatiť dobierkou " +
      "(dobierka nie je v SK e-shope). Poslala adresu aj telefón a požiadala o 2 ks. " +
      "Dohodnutá suma 52 € v hotovosti kuriérovi — poštovné aj poplatok za dobierku " +
      "sú v cene, takže Dextrum vyberie presne 52 € (2 x 26,00).",
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
      unit_price: 26,
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
    logger.warn(`[Martonová] tax line skipped: ${e.message}`)
  }

  // Fire the full pipeline (invoice, confirmation e-mail, e-books, Dextrum row)
  try {
    const eventBus = container.resolve(Modules.EVENT_BUS)
    await eventBus.emit({ name: "order.placed", data: { id: orderId } })
    logger.info(`[Martonová] Emitted order.placed`)
  } catch (e: any) {
    logger.error(`[Martonová] Failed to emit order.placed: ${e.message}`)
  }

  logger.info("═══════════════════════════════════════════")
  logger.info(`[Martonová] ORDER CREATED`)
  logger.info(`  order_id: ${orderId}`)
  logger.info(`  custom_order_number: ${customOrderNumber}`)
  logger.info(`  2x Pusti to, čo ťa ničí @ 26.00 = 52 EUR (COD)`)
  logger.info(`  delivery: Packeta - Na adresu → Nové Mesto nad Váhom`)
  logger.info("═══════════════════════════════════════════")
}
