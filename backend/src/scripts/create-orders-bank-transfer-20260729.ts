// @ts-nocheck
import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { DEXTRUM_MODULE } from "../modules/dextrum"

/**
 * One-off: two bank transfers that landed on Revolut EUR on 2026-07-29, each
 * paying for a book whose order never made it into Medusa.
 *
 *   Robert Pepernoot   35 EUR  01:11 UTC  ref 202636376
 *     Klarna checkout failed twice on tijdomloslaten.nl (cart …KYM1RWY9…), so
 *     invoice 2026-36376 was issued by hand and he paid it by transfer.
 *     Ships to a campsite, NOT his home address — he is at Wielseweg 3,
 *     Zeewolde for three weeks from 28.07.2026. Billing stays Ropta 69.
 *
 *   Nicole Kuppens     35 EUR  01:44 UTC  ref "Hondenbijbel Debie-Kuppens"
 *     Paid via Brite on 14.07. from dehondenbijbel.nl; the transaction
 *     registered as aborted so no order was created, but the money left her
 *     account. Refunded 23.07., re-paid by transfer 28.07.
 *     She used two mail addresses (nicole.kuppens66@gmail.com first, then
 *     hotmail) across five carts — the phone below comes from those carts,
 *     since the support thread never carried one.
 *
 * Emits nothing. order.placed would issue a SECOND Fakturoid invoice for
 * Pepernoot (2026-36376 already exists and is paid) and would issue an unwanted
 * one for Kuppens, who explicitly declined it ("neen een factuur is niet
 * nodig"). Confirmation mail and e-books are handled separately.
 *
 * created_manually: true is what lets the hold cron ship these — the payment
 * was verified on the bank statement, not inside Medusa, so no payment
 * collection exists. awaiting_bank_payment is deliberately NOT set: that flag
 * is the SEPA-QR gate for money that has not arrived yet.
 *
 * Run: pnpm medusa exec ./src/scripts/create-orders-bank-transfer-20260729.ts
 */

const REGION_ID = "reg_01KJ9JF3JRFG9KS4ZMTZ9KRTKV"          // Europe (EUR)
const SHIPPING_OPTION_ID = "so_01KJ9JF3P8JV32D6P93KWQS19C"  // GLS — Gratis verzending

const ORDERS = [
  {
    label: "Pepernoot",
    email: "robertpepernoot@hotmail.com",
    salesChannelId: "sc_01KJ9JF3G5WQJNN0XN0WA7D7SS",  // Loslatenboek
    variantId: "variant_01KJYFMPYYH6PFK9XV5WJH0FM9",  // LLWJK-1
    title: "Laat Los Wat Je Kapotmaakt",
    projectId: "loslatenboek",
    tags: "Laat Los Wat Je Kapotmaakt",
    unitPrice: 35,
    revolutTxId: "6a695350-981d-aba8-b88c-20ca5daa6883",
    paidAt: "2026-07-29T01:11:45.888Z",
    // Camp site — he is only there until ~18.08.2026.
    shippingAddress: {
      first_name: "Robert",
      last_name: "Pepernoot",
      address_1: "Wielseweg 3",
      city: "Zeewolde",
      postal_code: "3896 LA",
      country_code: "nl",
      phone: "0644904593",
    },
    billingAddress: {
      first_name: "Robert",
      last_name: "Pepernoot",
      address_1: "Ropta 69",
      city: "Drachten",
      postal_code: "9202 KG",
      country_code: "nl",
      phone: "0644904593",
    },
    tax: { code: "vat_reduced", rate: 9, description: "BTW 9%" },
    extraMeta: {
      variable_symbol: "202636376",
      fakturoid_internal_id: "61023920",
      fakturoid_invoice_id: "2026-36376",
      fakturoid_invoice_number: "2026-36376",
      recovered_from_cart_id: "cart_01KYM1RWY9A07YPW6SGDRZG9MY",
      delivery_address_is_temporary: true,
      delivery_address_valid_until: "2026-08-18",
    },
    notes:
      "Klarna checkout op tijdomloslaten.nl faalde 2× (cart_01KYM1RWY9A07YPW6SGDRZG9MY). " +
      "Factuur 2026-36376 handmatig uitgegeven, betaald per overboeking op 29.07.2026 (35 EUR, " +
      "Revolut, VS 202636376). Order handmatig aangemaakt — geen order.placed, want de factuur " +
      "bestaat al. LET OP: bezorgadres is een camping, klant is daar 3 weken vanaf 28.07.2026.",
  },
  {
    label: "Kuppens",
    email: "debie-kuppens@hotmail.com",
    salesChannelId: "sc_01KJYJNCCA3VPZE8Y5FGHXTTZX",  // Dehondenbijbel
    variantId: "variant_01KJYFMV5ZXCMD40J91AG2DM1S",  // DH8672749223
    title: "De Hondenbijbel",
    projectId: "dehondenbijbel",
    tags: "De Hondenbijbel",
    unitPrice: 35,
    revolutTxId: "6a695b13-142a-a6a2-bc75-047edd3ffa04",
    paidAt: "2026-07-29T01:44:53.094Z",
    shippingAddress: {
      first_name: "Nicole",
      last_name: "Kuppens",
      address_1: "Berkenbos 51",
      city: "Balen",
      postal_code: "2490",
      country_code: "be",
      phone: "+32472779507",
    },
    billingAddress: null,  // same as shipping
    tax: { code: "vat_reduced", rate: 6, description: "BTW 6%" },
    extraMeta: {
      bank_transfer_reference: "Hondenbijbel Debie-Kuppens",
      recovered_from_cart_id: "cart_01KXGR0YZDTXKQ13B0K1JB08FD",
      supportbox_ticket_id: "01KY0CS6GYAS3EZXE4NQ9J7TN1",
      original_brite_attempt_at: "2026-07-14",
      invoice_declined_by_customer: true,
    },
    notes:
      "Betaalde 14.07.2026 via Brite vanaf dehondenbijbel.nl, maar de transactie werd als " +
      "afgebroken geregistreerd — geen order, geld wél afgeschreven. Op 23.07. terugbetaald, " +
      "op 28.07. per overboeking opnieuw betaald (35 EUR, Revolut, ontvangen 29.07. 01:44). " +
      "Order handmatig aangemaakt — geen order.placed: klant wil GEEN factuur. " +
      "Telefoon komt uit haar verlaten carts van 14.07. Ticket 01KY0CS6GYAS3EZXE4NQ9J7TN1.",
  },
]

export default async function createOrdersBankTransfer20260729({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const orderModuleService = container.resolve(Modules.ORDER)
  const dextrumService = container.resolve(DEXTRUM_MODULE) as any

  for (const spec of ORDERS) {
    // Idempotency: the Revolut transaction id is the natural key here.
    const { data: existing } = await query.graph({
      entity: "order",
      fields: ["id", "display_id", "metadata"],
      filters: { email: spec.email, sales_channel_id: spec.salesChannelId },
    })
    const already = (existing || []).find(
      (o: any) => o?.metadata?.revolut_transaction_id === spec.revolutTxId
    )
    if (already) {
      logger.info(`[${spec.label}] Order already exists: ${already.id} (${already.metadata?.custom_order_number}) — skipping`)
      continue
    }

    const metadata: any = {
      created_by: "manual_bank_transfer_20260729",
      created_manually: true,
      project_id: spec.projectId,
      tags: spec.tags,
      payment_provider: "bank_transfer",
      payment_method: "bank_transfer",
      copied_payment_status: "paid",
      payment_captured: true,
      bank_transfer_reconciled: true,
      revolut_transaction_id: spec.revolutTxId,
      bank_transfer_received_at: spec.paidAt,
      dextrum_status: "WAITING",
      manual_order_notes: spec.notes,
      ...spec.extraMeta,
    }

    const newOrder = await orderModuleService.createOrders({
      currency_code: "eur",
      email: spec.email,
      region_id: REGION_ID,
      sales_channel_id: spec.salesChannelId,
      shipping_address: spec.shippingAddress,
      billing_address: spec.billingAddress || spec.shippingAddress,
      items: [{
        title: spec.title,
        variant_id: spec.variantId,
        quantity: 1,
        unit_price: spec.unitPrice,
        is_tax_inclusive: true,
      }],
      shipping_methods: [{
        name: "GLS — Gratis verzending",
        amount: 0,
        shipping_option_id: SHIPPING_OPTION_ID,
      }],
      metadata,
    })

    const orderId = (newOrder as any).id
    const displayId = (newOrder as any).display_id
    // Same scheme as the order-placed-custom-number subscriber: shipping country.
    const prefix = String(spec.shippingAddress.country_code || "").toUpperCase()
    const customOrderNumber = `${prefix}${new Date().getFullYear()}-${displayId}`

    await orderModuleService.updateOrders(orderId, {
      metadata: { ...metadata, custom_order_number: customOrderNumber },
    })

    // Reduced book VAT — NL 9 %, BE 6 %, matching every other order in each market.
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
          code: spec.tax.code,
          rate: spec.tax.rate,
          description: spec.tax.description,
        }])
      }
    } catch (e: any) {
      logger.warn(`[${spec.label}] tax line skipped: ${e.message}`)
    }

    // Queue for the warehouse. hold_until in the past → the every-minute
    // dextrum-order-hold cron forwards it to mySTOCK on its next tick.
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
    logger.info(`[${spec.label}] ORDER CREATED (no order.placed emitted)`)
    logger.info(`  order_id: ${orderId}`)
    logger.info(`  custom_order_number: ${customOrderNumber}`)
    logger.info(`  ${spec.unitPrice} EUR, 1 ks, ${spec.title}`)
    logger.info(`  ship to: ${spec.shippingAddress.address_1}, ${spec.shippingAddress.postal_code} ${spec.shippingAddress.city} (${prefix})`)
    logger.info(`  revolut tx: ${spec.revolutTxId} (${spec.paidAt})`)
    logger.info(`  dextrum_order_map: WAITING, hold elapsed → cron will send`)
    logger.info("═══════════════════════════════════════════")
  }
}
