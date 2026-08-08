// @ts-nocheck
import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

/**
 * One-off: B2B objednávka pro Městskou knihovnu Velká Bíteš (odpust-knizka).
 *
 * Knihovna psala 7. 8., že web nabízí jen online platbu a na účtárně by to
 * neprošlo — poprosila o fakturu splatnou až po dodání. Fakturu 2026-40338
 * jsem vystavil ručně ve Fakturoidu (749 Kč, splatnost 14 dní, Fio CZK).
 *
 * Proto tahle objednávka NESMÍ projít fakturoidHandlerem — jinak by vznikla
 * druhá faktura označená jako zaplacená. Spouští se jen potvrzení, e-booky
 * a Dextrum (viz fire-knihovna-bites-notifications.ts).
 *
 * payment_method záměrně NENÍ "cod" — kurýr nic nevybírá, knihovna platí
 * převodem na fakturu. `created_by: manual_ai_order_creator` obejde v Dextrum
 * send route guard "objednávka musí být zaplacená".
 *
 * Doručení na adresu (ne výdejní místo) — instituce, podatelna.
 *
 * Run: pnpm medusa exec ./src/scripts/create-order-knihovna-bites.ts
 */
export default async function createOrderKnihovnaBites({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const orderModuleService = container.resolve(Modules.ORDER)

  const REGION_ID = "reg_01KKB4EZN0CHFYDG64K4VP0J2A"          // Czech Republic
  const SALES_CHANNEL_ID = "sc_01KTTR1W2GDWQC8R6NE12V7MWT"    // Odpust Knizka
  const VARIANT_ID = "variant_01KTTR2PJATN1AP1YS6Q06NA5P"     // PTCTN2876287672
  const SHIPPING_OPTION_ID = "so_01KTTR2B5J2XPRAHNQHHDQ0XVN"  // Zásilkovna - Na adresu
  const EMAIL = "info@knihovnabites.cz"

  const { data: existing } = await query.graph({
    entity: "order",
    fields: ["id", "metadata"],
    filters: { email: EMAIL, sales_channel_id: SALES_CHANNEL_ID },
  })
  const already = (existing || []).find(
    (o: any) => o?.metadata?.manual_source === "manual_knihovna_bites_script"
  )
  if (already) {
    logger.info(`[Knihovna Bíteš] Order already exists: ${already.id} (${already.metadata?.custom_order_number}) — skipping`)
    return
  }

  const shipping = {
    first_name: "Městská knihovna",
    last_name: "Velká Bíteš",
    company: "Městská knihovna Velká Bíteš",
    address_1: "Masarykovo náměstí 67",
    city: "Velká Bíteš",
    postal_code: "595 01",
    country_code: "cz",
    phone: "+420606063666",
  }

  const billing = {
    first_name: "Město",
    last_name: "Velká Bíteš",
    company: "Město Velká Bíteš",
    address_1: "Masarykovo náměstí 87",
    city: "Velká Bíteš",
    postal_code: "595 01",
    country_code: "cz",
    phone: "+420606063666",
  }

  const metadata: any = {
    created_by: "manual_ai_order_creator",
    created_manually: true,
    manual_source: "manual_knihovna_bites_script",
    project_id: "odpust-knizka",
    payment_provider: "bank",
    payment_method: "bank",          // NE cod — kurýr nevybírá hotovost
    copied_payment_status: "pending",
    shipping_method: "zasilkovna_home",
    company_name: "Město Velká Bíteš",
    company_registration_no: "00295647",
    company_vat_no: "CZ00295647",
    contact_person: "Monika Ulmanová",
    // Faktura vystavena RUČNĚ — subscriber na Fakturoid se nespouští.
    fakturoid_invoice_number: "2026-40338",
    fakturoid_invoice_id: 61394523,
    fakturoid_invoice_url: "https://app.fakturoid.cz/jaroslavostruszka/p/I9BQfusLKw/2026-40338",
    manual_order_notes:
      "Městská knihovna Velká Bíteš — online platba na účtárně neprojde. " +
      "Faktura 2026-40338 vystavena ručně, splatnost 14 dní (do 22. 8. 2026), " +
      "úhrada převodem na Fio 2502550298/2010 až po dodání. " +
      "NESPOUŠTĚT fakturoidHandler — vznikla by duplicitní faktura.",
  }

  const newOrder = await orderModuleService.createOrders({
    currency_code: "czk",
    email: EMAIL,
    region_id: REGION_ID,
    sales_channel_id: SALES_CHANNEL_ID,
    shipping_address: shipping,
    billing_address: billing,
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

  // DPH 0 % — shodně se všemi ostatními fakturami tohoto projektu
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
    logger.warn(`[Knihovna Bíteš] tax line skipped: ${e.message}`)
  }

  logger.info("═══════════════════════════════════════════")
  logger.info(`[Knihovna Bíteš] ORDER CREATED`)
  logger.info(`  order_id: ${orderId}`)
  logger.info(`  custom_order_number: ${customOrderNumber}`)
  logger.info(`  1x Pusť to, co tě ničí @ 749 CZK — faktura 2026-40338, splatnost 22. 8.`)
  logger.info(`  doručení: Zásilkovna - Na adresu → Masarykovo náměstí 67, Velká Bíteš`)
  logger.info("═══════════════════════════════════════════")
}
