// @ts-nocheck
import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { DEXTRUM_MODULE } from "../modules/dextrum"

/**
 * One-off: manual bank-transfer order for Buchhandlung am Markt (Inh. Anke
 * Börner), Bad Salzungen — a German bookshop that ordered one copy of
 * "Lass los, was dich kaputt macht" by e-mail at trade terms (€25 incl.
 * shipping, agreed in SupportBox ticket 01KX33FSKKSFSBWAP8E72906J7).
 *
 * They paid €25 by bank transfer on 2026-07-17 (Revolut, VS 202632158) against
 * invoice 2026-32158, which was issued manually — but no order ever existed in
 * Medusa, so the warehouse never learned about it and the book was not shipped.
 *
 * Intentionally does NOT emit `order.placed`: the Fakturoid invoice already
 * exists, so the pipeline would issue a DUPLICATE one and send the customer an
 * unsolicited confirmation + e-book mail. Instead the dextrum_order_map row is
 * written directly with delivery_status=WAITING and hold_until in the past, so
 * the dextrum-order-hold cron picks it up on its next tick and forwards it to
 * mySTOCK.
 *
 * Run: pnpm medusa exec ./src/scripts/create-order-buchhandlung-markt.ts
 */
export default async function createOrderBuchhandlungMarkt({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const orderModuleService = container.resolve(Modules.ORDER)
  const dextrumService = container.resolve(DEXTRUM_MODULE) as any

  const REGION_ID = "reg_01KJ9JF3JRFG9KS4ZMTZ9KRTKV"        // Europe (EUR)
  const SALES_CHANNEL_ID = "sc_01KKAY49EQ3P0CSDDWEN7E5S2D"  // Lass Los
  const VARIANT_ID = "variant_01KKAY49TYXA3SRVZN9M20FNPS"   // LK98274676278, Taschenbuch
  const SHIPPING_OPTION_ID = "so_01KKAY49P9TFH0DXZRQPJKK33C" // Kostenloser Versand
  const EMAIL = "buhala@t-online.de"
  const VARIABLE_SYMBOL = "202632158"

  // Idempotency: bail if this order was already created.
  const { data: existing } = await query.graph({
    entity: "order",
    fields: ["id", "display_id", "metadata"],
    filters: { email: EMAIL, sales_channel_id: SALES_CHANNEL_ID },
  })
  const already = (existing || []).find(
    (o: any) => o?.metadata?.variable_symbol === VARIABLE_SYMBOL
  )
  if (already) {
    logger.info(`[Buchhandlung] Order already exists: ${already.id} (${already.metadata?.custom_order_number}) — skipping`)
    return
  }

  const address = {
    company: "Buchhandlung am Markt",
    first_name: "Anke",
    last_name: "Börner",
    address_1: "Markt 7",
    city: "Bad Salzungen",
    postal_code: "36433",
    country_code: "de",
  }

  const metadata: any = {
    created_by: "manual_buchhandlung_markt_script",
    created_manually: true,
    project_id: "lass-los",
    payment_provider: "bank_transfer",
    payment_method: "bank_transfer",
    copied_payment_status: "paid",
    variable_symbol: VARIABLE_SYMBOL,
    revolut_reference: "Verwend.202632158 — Payment from Anke Boerner Buchhandlung Am Markt",
    shipping_method: "zasilkovna_home",
    dextrum_status: "WAITING",
    fakturoid_invoice_id: 60698870,
    fakturoid_invoice_number: "2026-32158",
    b2b_trade_order: true,
    contact_person: "Janka Chudaske",
    supportbox_ticket_id: "01KX33FSKKSFSBWAP8E72906J7",
    manual_order_notes:
      "Buchhandelsbestellung per E-Mail (1 Ex., €25 inkl. Versand, Vorkasse). " +
      "Rechnung 2026-32158 bereits ausgestellt, Zahlung am 17.07.2026 eingegangen. " +
      "Auftrag manuell angelegt, weil die Bestellung nie im Shop entstanden ist.",
  }

  const newOrder = await orderModuleService.createOrders({
    currency_code: "eur",
    email: EMAIL,
    region_id: REGION_ID,
    sales_channel_id: SALES_CHANNEL_ID,
    shipping_address: address,
    billing_address: address,
    items: [{
      title: "Lass los, was dich kaputt macht",
      variant_id: VARIANT_ID,
      quantity: 1,
      unit_price: 25,          // agreed trade price, incl. shipping
      is_tax_inclusive: true,
    }],
    shipping_methods: [{
      name: "Kostenloser Versand",
      amount: 0,
      shipping_option_id: SHIPPING_OPTION_ID,
    }],
    metadata,
  })

  const orderId = (newOrder as any).id
  const displayId = (newOrder as any).display_id
  const customOrderNumber = `DE${new Date().getFullYear()}-${displayId}`

  await orderModuleService.updateOrders(orderId, {
    metadata: { ...metadata, custom_order_number: customOrderNumber },
  })

  // VAT 7% — German reduced rate for books (matches invoice 2026-32158).
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
        rate: 7,
        description: "VAT 7%",
      }])
    }
  } catch (e: any) {
    logger.warn(`[Buchhandlung] tax line skipped: ${e.message}`)
  }

  // Queue it for the warehouse. hold_until in the past → the every-minute
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
  logger.info(`[Buchhandlung] ORDER CREATED (no order.placed emitted)`)
  logger.info(`  order_id: ${orderId}`)
  logger.info(`  custom_order_number: ${customOrderNumber}`)
  logger.info(`  €25 incl. shipping, VAT 7%`)
  logger.info(`  paired invoice: 2026-32158 (VS ${VARIABLE_SYMBOL})`)
  logger.info(`  dextrum_order_map: WAITING, hold elapsed → cron will send`)
  logger.info("═══════════════════════════════════════════")
}
