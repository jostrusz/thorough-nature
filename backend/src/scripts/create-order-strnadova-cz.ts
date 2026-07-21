// @ts-nocheck
import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { DEXTRUM_MODULE } from "../modules/dextrum"

/**
 * One-off: recover a paid-but-orphaned Comgate order for Stanislava Strnadová.
 *
 * She submitted the checkout twice on 17 July 2026: first for 1 599 Kč (3-book
 * bundle, Comgate ORHA-I8AY-OGDD), then went back and submitted again for
 * 749 Kč (Comgate OWTC-AEBA-P9ZZ). The second submit OVERWROTE the payment
 * session on cart_01KXQ8D1TSX1GWWQ1FSMMRSPGT, so when she then paid the FIRST
 * transaction by bank transfer (07:25:27, 1 599 Kč), nothing could match it:
 * the webhook looks the cart up by transId and the reconcile cron polls the
 * transId stored on the session — both only ever saw the unpaid OWTC one.
 * Same failure mode as the Brite retry-overwrites-session bug.
 *
 * She has been waiting since 17 July, so a free copy of "Život, jaký si
 * zasloužíš" goes in as an apology. Shipping switched to home delivery because
 * the cart carried pickup shipping WITHOUT a pickup_place_code (the widget
 * never stored one — Packeta would reject the parcel).
 *
 * No order.placed emitted (runs against prod over the DB proxy, where the
 * internal Redis bus is unreachable) — dextrum_order_map is written directly
 * with an elapsed hold, and the confirmation is sent from the admin afterwards.
 *
 * Run: railway run -- npx medusa exec ./src/scripts/create-order-strnadova-cz.ts
 */
export default async function createOrderStrnadovaCz({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const orderModuleService = container.resolve(Modules.ORDER)
  const dextrumService = container.resolve(DEXTRUM_MODULE) as any

  const REGION_ID = "reg_01KKB4EZN0CHFYDG64K4VP0J2A"          // Czechia (CZK)
  const SALES_CHANNEL_ID = "sc_01KTTR1W2GDWQC8R6NE12V7MWT"    // Pusť to, co tě ničí
  const BOOK_VARIANT_ID = "variant_01KTTR2PJATN1AP1YS6Q06NA5P" // 3-book bundle line (533 × 3)
  const GIFT_VARIANT_ID = "variant_01KX5YHFSZQS76CZMTPX6Q7VF9" // Život, jaký si zasloužíš — 1 kniha
  const SHIPPING_OPTION_ID = "so_01KTTR2B5J2XPRAHNQHHDQ0XVN"  // Zásilkovna — doručení na adresu
  const EMAIL = "stana78@seznam.cz"
  const COMGATE_TRANS_ID = "ORHA-I8AY-OGDD"
  const PAID_AMOUNT = 1599

  // Idempotency: the paid transaction may only ever produce one order.
  const { data: existing } = await query.graph({
    entity: "order",
    fields: ["id", "display_id", "metadata"],
    filters: { email: EMAIL },
  })
  const already = (existing || []).find((o: any) => o?.metadata?.comgateTransId === COMGATE_TRANS_ID)
  if (already) {
    logger.info(`[Strnadová] Order already exists: ${already.id} (${already.metadata?.custom_order_number}) — skipping`)
    return
  }

  const address = {
    first_name: "Stanislava",
    last_name: "Strnadová",
    address_1: "Krhanická 716",
    city: "Praha",
    postal_code: "14200",
    country_code: "cz",
    phone: "+420724804044",
  }

  const metadata: any = {
    created_by: "manual_strnadova_cz_script",
    created_manually: true,
    project_id: "odpust-knizka",
    payment_provider: "comgate",
    payment_method: "comgate",
    comgateTransId: COMGATE_TRANS_ID,
    comgate_paid_at: "2026-07-17T05:25:27Z",
    copied_payment_status: "paid",
    recovered_from_cart: "cart_01KXQ8D1TSX1GWWQ1FSMMRSPGT",
    shipping_method: "zasilkovna_home",
    dextrum_status: "WAITING",
    goodwill_gift: "Život, jaký si zasloužíš (1 ks) — omluva za nevzniklou objednávku",
    manual_order_notes:
      "Zákaznice zaplatila 17. 7. 2026 přes Comgate 1 599 Kč (transakce ORHA-I8AY-OGDD, " +
      "bankovní převod), ale objednávka nevznikla: druhý pokus o odeslání checkoutu přepsal " +
      "payment session na košíku, takže zaplacená transakce osiřela a webhook ani reconcile " +
      "cron ji neuměly spárovat. Objednávka vytvořena ručně. Doprava přehozena z výdejního " +
      "místa na doručení na adresu, protože košík neměl uložený kód výdejního místa. " +
      "Přidána kniha Život, jaký si zasloužíš zdarma jako omluva za čekání.",
  }

  const newOrder = await orderModuleService.createOrders({
    currency_code: "czk",
    email: EMAIL,
    region_id: REGION_ID,
    sales_channel_id: SALES_CHANNEL_ID,
    shipping_address: address,
    billing_address: address,
    items: [
      {
        title: "Pusť to, co tě ničí",
        variant_id: BOOK_VARIANT_ID,
        quantity: 3,
        unit_price: 533,          // 3 × 533 = 1 599 Kč, exactly what she paid
        is_tax_inclusive: true,
      },
      {
        title: "Život, jaký si zasloužíš — dárek jako omluva",
        variant_id: GIFT_VARIANT_ID,
        quantity: 1,
        unit_price: 0,
        is_tax_inclusive: true,
      },
    ],
    shipping_methods: [{
      name: "Zásilkovna — doručení na adresu",
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

  // Hand off to the warehouse: elapsed hold → dextrum-order-hold cron sends it.
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
  logger.info(`[Strnadová] ORDER CREATED (no order.placed emitted)`)
  logger.info(`  order_id: ${orderId}`)
  logger.info(`  custom_order_number: ${customOrderNumber}`)
  logger.info(`  3× Pusť to = ${PAID_AMOUNT} Kč (paid via Comgate ${COMGATE_TRANS_ID})`)
  logger.info(`  + 1× Život, jaký si zasloužíš zdarma (omluva)`)
  logger.info(`  delivery: Zásilkovna na adresu → Krhanická 716, 142 00 Praha`)
  logger.info(`  TODO: send confirmation from admin (Send Order Notification)`)
  logger.info("═══════════════════════════════════════════")
}
