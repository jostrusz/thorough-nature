// @ts-nocheck
import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { DEXTRUM_MODULE } from "../modules/dextrum"

/**
 * One-off: bank-transfer order for Dagmar Konečná (odpust-knizka, 2 books).
 *
 * She tried to pay on pusttocotenici.cz three times over five weeks — the
 * Comgate gateway never credited a single attempt (four abandoned carts, the
 * last one cart_01KYMD0AP91008FR4F5TNBNYNB with the 2-book bundle). On 28.07.
 * she wrote asking for a bank transfer or COD; we issued invoice 2026-36893 by
 * hand on 30.07. and the 1 199 CZK landed on the Fio account the same day
 * (VS 202636893, message "Dagmar Konečná", counter-account 986051073/0800).
 *
 * Emits nothing: order.placed would issue a SECOND Fakturoid invoice on top of
 * 2026-36893 and mail her another confirmation. The dextrum_order_map row is
 * written directly with hold_until in the past so the every-minute hold cron
 * forwards it to mySTOCK on its next tick.
 *
 * Run: pnpm medusa exec ./src/scripts/create-order-konecna.ts
 */
export default async function createOrderKonecna({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const orderModuleService = container.resolve(Modules.ORDER)
  const dextrumService = container.resolve(DEXTRUM_MODULE) as any

  const REGION_ID = "reg_01KKB4EZN0CHFYDG64K4VP0J2A"        // Czechia (CZK)
  const SALES_CHANNEL_ID = "sc_01KTTR1W2GDWQC8R6NE12V7MWT"  // Pusť to, co tě ničí
  const VARIANT_ID = "variant_01KTTR2PJATN1AP1YS6Q06NA5P"   // PTCTN2876287672, Paperback
  const SHIPPING_OPTION_ID = "so_01KTTR2B5J2XPRAHNQHHDQ0XVN" // Zásilkovna - Na adresu
  const EMAIL = "konecna.ing@seznam.cz"
  const VARIABLE_SYMBOL = "202636893"

  // Idempotency: the variable symbol is the natural key here.
  const { data: existing } = await query.graph({
    entity: "order",
    fields: ["id", "display_id", "metadata"],
    filters: { email: EMAIL, sales_channel_id: SALES_CHANNEL_ID },
  })
  const already = (existing || []).find(
    (o: any) => o?.metadata?.variable_symbol === VARIABLE_SYMBOL
  )
  if (already) {
    logger.info(`[Konečná] Order already exists: ${already.id} (${already.metadata?.custom_order_number}) — skipping`)
    return
  }

  const address = {
    first_name: "Dagmar",
    last_name: "Konečná",
    address_1: "Ruská 804/58",
    city: "Praha 10 - Vršovice",
    postal_code: "101 00",
    country_code: "cz",
    phone: "+420603474668",
  }

  const metadata: any = {
    created_by: "manual_bank_transfer_konecna",
    created_manually: true,
    project_id: "odpust-knizka",
    tags: "Pusť to, co tě ničí",
    payment_provider: "bank_transfer",
    payment_method: "bank_transfer",
    copied_payment_status: "paid",
    payment_captured: true,
    bank_transfer_reconciled: true,
    variable_symbol: VARIABLE_SYMBOL,
    bank_transfer_received_at: "2026-07-30",
    bank_account: "2502550298/2010",
    fakturoid_internal_id: "61067062",
    fakturoid_invoice_id: "2026-36893",
    fakturoid_invoice_number: "2026-36893",
    shipping_method: "zasilkovna_home",
    dextrum_status: "WAITING",
    recovered_from_cart_id: "cart_01KYMD0AP91008FR4F5TNBNYNB",
    supportbox_ticket_id: "01KYNYDEYZ27TZ3S6DJ12S568G",
    manual_order_notes:
      "Zákaznice opakovaně nemohla zaplatit přes Comgate (3 pokusy, 4 nedokončené košíky " +
      "od 26. 6. do 28. 7.) — platba se nikdy nepřipsala. Domluven bankovní převod, faktura " +
      "2026-36893 vystavena ručně 30. 7., platba 1 199 Kč dorazila na Fio týž den (VS 202636893). " +
      "Objednávka založena ručně na 2 ks dle rozpracovaného košíku; order.placed záměrně " +
      "neemitován, aby nevznikla duplicitní faktura.",
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
      quantity: 2,
      unit_price: 599.5,        // bundle 2 ks = 1 199 Kč, shodné s fakturou
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

  // Czech books are zero-rated — same tax line every other odpust-knizka order carries.
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
    logger.warn(`[Konečná] tax line skipped: ${e.message}`)
  }

  await dextrumService.createDextrumOrderMaps({
    medusa_order_id: orderId,
    display_id: String(displayId),
    project_code: "DEFAULT",
    mystock_order_code: customOrderNumber,
    delivery_status: "WAITING",
    delivery_status_updated_at: new Date().toISOString(),
    hold_until: new Date(Date.now() - 60_000).toISOString(),
  })

  logger.info("═══════════════════════════════════════════")
  logger.info(`[Konečná] ORDER CREATED (no order.placed emitted)`)
  logger.info(`  order_id: ${orderId}`)
  logger.info(`  custom_order_number: ${customOrderNumber}`)
  logger.info(`  2× Pusť to, co tě ničí — 1 199 Kč`)
  logger.info(`  ship to: Ruská 804/58, 101 00 Praha 10 - Vršovice`)
  logger.info(`  invoice 2026-36893 (VS ${VARIABLE_SYMBOL})`)
  logger.info(`  dextrum_order_map: WAITING, hold elapsed → cron will send`)
  logger.info("═══════════════════════════════════════════")
}
