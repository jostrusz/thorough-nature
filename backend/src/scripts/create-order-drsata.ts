// @ts-nocheck
import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { DEXTRUM_MODULE } from "../modules/dextrum"

/**
 * One-off: bank-transfer order for Lubor Dršata (odpust-knizka, 1 book).
 *
 * His checkout on 31.07. never reached the payment stage — the Fio pay-by-bank
 * connector would not link to his bank (payment_journey_log has no row at all
 * for cart_01KYWTVQ3CTJ2J5WFCMCGS52G7). He asked for account details by e-mail,
 * we issued invoice 2026-37953 by hand on 01.08. and the 749 CZK landed on the
 * Fio account the same day (VS 202637953, counter-account 2200339569/2010,
 * message "Úhrada knihy").
 *
 * Address comes from his 2024 order (Fakturoid subject 23309554, invoice
 * 2024-14713) — the 2026 cart stored an empty address row. He was asked to
 * correct it if stale and did not object.
 *
 * No phone on file: normalizePhone() falls back to "000", which mySTOCK accepts
 * (same path as express checkouts). Zásilkovna will deliver without SMS notice.
 *
 * Emits nothing: order.placed would issue a SECOND Fakturoid invoice on top of
 * 2026-37953 and mail him another confirmation. The dextrum_order_map row is
 * written directly with hold_until in the past so the every-minute hold cron
 * forwards it to mySTOCK on its next tick.
 *
 * Run: pnpm medusa exec ./src/scripts/create-order-drsata.ts
 */
export default async function createOrderDrsata({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const orderModuleService = container.resolve(Modules.ORDER)
  const dextrumService = container.resolve(DEXTRUM_MODULE) as any

  const REGION_ID = "reg_01KKB4EZN0CHFYDG64K4VP0J2A"        // Czechia (CZK)
  const SALES_CHANNEL_ID = "sc_01KTTR1W2GDWQC8R6NE12V7MWT"  // Pusť to, co tě ničí
  const VARIANT_ID = "variant_01KTTR2PJATN1AP1YS6Q06NA5P"   // PTCTN2876287672, Paperback
  const SHIPPING_OPTION_ID = "so_01KTTR2B5J2XPRAHNQHHDQ0XVN" // Zásilkovna - Na adresu
  const EMAIL = "cxgsa@seznam.cz"
  const VARIABLE_SYMBOL = "202637953"

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
    logger.info(`[Dršata] Order already exists: ${already.id} (${already.metadata?.custom_order_number}) — skipping`)
    return
  }

  const address = {
    first_name: "Lubor",
    last_name: "Dršata",
    address_1: "28. pluku 241/46",
    city: "Praha 10",
    postal_code: "100 00",
    country_code: "cz",
  }

  const metadata: any = {
    created_by: "manual_bank_transfer_drsata",
    created_manually: true,
    project_id: "odpust-knizka",
    tags: "Pusť to, co tě ničí",
    payment_provider: "bank_transfer",
    payment_method: "bank_transfer",
    copied_payment_status: "paid",
    payment_captured: true,
    bank_transfer_reconciled: true,
    variable_symbol: VARIABLE_SYMBOL,
    bank_transfer_received_at: "2026-08-01",
    bank_account: "2502550298/2010",
    counter_account: "2200339569/2010",
    fakturoid_internal_id: "61169152",
    fakturoid_invoice_id: "2026-37953",
    fakturoid_invoice_number: "2026-37953",
    shipping_method: "zasilkovna_home",
    dextrum_status: "WAITING",
    recovered_from_cart_id: "cart_01KYWTVQ3CTJ2J5WFCMCGS52G7",
    supportbox_ticket_id: "01KYYP7HCM7FDRWHQDNWG54ZDT",
    manual_order_notes:
      "Zákazník nedokončil platbu na checkoutu — Fio pay-by-bank se nespojilo s bankou " +
      "(košík cart_01KYWTVQ3CTJ2J5WFCMCGS52G7 z 31. 7. 2026, v payment_journey_log ani jeden " +
      "záznam). Domluven bankovní převod, faktura 2026-37953 vystavena ručně 1. 8., platba " +
      "749 Kč dorazila na Fio týž den (VS 202637953). Adresa převzata z jeho objednávky " +
      "z 31. 10. 2024 (Fakturoid subject 23309554) — v košíku byla prázdná. Telefon neznámý → " +
      "Dextrum dostane \"000\". order.placed záměrně neemitován, aby nevznikla duplicitní faktura.",
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
      unit_price: 749,          // shodné s fakturou 2026-37953
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
  // The denormalized variant_sku/title columns are set too: the hold job reads the
  // variant relation, but admin and reporting read these columns.
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
      await orderModuleService.updateOrderLineItems(item.id, {
        variant_sku: "PTCTN2876287672",
        variant_title: "Paperback",
        product_title: "Pusť to, co tě ničí",
      })
    }
  } catch (e: any) {
    logger.warn(`[Dršata] tax line / sku backfill skipped: ${e.message}`)
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
  logger.info(`[Dršata] ORDER CREATED (no order.placed emitted)`)
  logger.info(`  order_id: ${orderId}`)
  logger.info(`  custom_order_number: ${customOrderNumber}`)
  logger.info(`  1× Pusť to, co tě ničí — 749 Kč`)
  logger.info(`  ship to: 28. pluku 241/46, 100 00 Praha 10`)
  logger.info(`  invoice 2026-37953 (VS ${VARIABLE_SYMBOL})`)
  logger.info(`  dextrum_order_map: WAITING, hold elapsed → cron will send`)
  logger.info("═══════════════════════════════════════════")
}
