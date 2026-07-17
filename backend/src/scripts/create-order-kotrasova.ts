// @ts-nocheck
import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

/**
 * One-off: create the manual bank-transfer order for Zdenka Kotrasová
 * (pusti-to-sk), who ordered by e-mail and paid €32 via Revolut (VS 202631865).
 *
 * Intentionally does NOT emit `order.placed` — the customer already received a
 * Fakturoid invoice (2026-31865) manually, so firing the pipeline would create
 * a DUPLICATE invoice and send an unsolicited confirmation/ebook e-mail.
 * Instead we set dextrum_status=WAITING by hand so the order shows in the WMS
 * queue and can be dispatched later, and we store the paired invoice id.
 *
 * Run: pnpm medusa exec ./src/scripts/create-order-kotrasova.ts
 */
export default async function createOrderKotrasova({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const orderModuleService = container.resolve(Modules.ORDER)

  const REGION_ID = "reg_01KWVAZVNATPX01HH77MYWKG3M"        // Slovakia (Pusti To SK)
  const SALES_CHANNEL_ID = "sc_01KWVAX8XTNTXHF9ZWH211Y6CF"  // pusti-to-sk
  const VARIANT_ID = "variant_01KWVB0CS1A6XBKNB9M3SG5GFK"
  const SHIPPING_OPTION_ID = "so_01KWVB06DRK51CQTSYYSA99TRP" // Packeta - Na odberné miesto
  const ZBOX_ID = "33496"                                    // Z-BOX Lučenec, Vajanského 2928/13

  // Idempotency: bail if we already made this order.
  const { data: existing } = await query.graph({
    entity: "order",
    fields: ["id", "display_id", "metadata"],
    filters: { email: "zdenkakotrasova@gmail.com", sales_channel_id: SALES_CHANNEL_ID },
  })
  const already = (existing || []).find(
    (o: any) => o?.metadata?.variable_symbol === "202631865"
  )
  if (already) {
    logger.info(`[Kotrasova] Order already exists: ${already.id} (${already.metadata?.custom_order_number}) — skipping`)
    return
  }

  const address = {
    first_name: "Zdenka",
    last_name: "Kotrasová",
    address_1: "Vajanského 71",
    city: "Lučenec",
    postal_code: "984 01",
    country_code: "sk",
    phone: "0907175987",
  }

  const metadata: any = {
    created_by: "manual_kotrasova_script",
    created_manually: true,
    project_id: "pusti-to-sk",
    payment_provider: "bank_transfer",
    payment_method: "bank_transfer",
    copied_payment_status: "paid",
    variable_symbol: "202631865",
    revolut_reference: "PhDr Zdenka Kotrasova Lucenec",
    shipping_method: "pickup",
    pickup_point_id: ZBOX_ID,
    pickup_place_code: ZBOX_ID,
    packeta_point_id: ZBOX_ID,
    pickup_point_name: "Z-BOX Lučenec, Vajanského 2928/13",
    dextrum_status: "WAITING",
    fakturoid_invoice_id: 60667660,
    fakturoid_invoice_number: "2026-31865",
    manual_order_notes: "Objednávka e-mailom + platba prevodom (Revolut €32). Faktúra 2026-31865 už vystavená a odoslaná. Odoslať na Z-BOX Vajanského, keď bude kniha na sklade.",
  }

  const newOrder = await orderModuleService.createOrders({
    currency_code: "eur",
    email: "zdenkakotrasova@gmail.com",
    region_id: REGION_ID,
    sales_channel_id: SALES_CHANNEL_ID,
    shipping_address: address,
    billing_address: address,
    items: [{
      title: "Pusti to, čo ťa ničí",
      variant_id: VARIANT_ID,
      quantity: 1,
      unit_price: 32,
      is_tax_inclusive: true,
    }],
    shipping_methods: [{
      name: "Packeta - Na odberné miesto",
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
    logger.warn(`[Kotrasova] tax line skipped: ${e.message}`)
  }

  logger.info("═══════════════════════════════════════════")
  logger.info(`[Kotrasova] ORDER CREATED (no order.placed emitted)`)
  logger.info(`  order_id: ${orderId}`)
  logger.info(`  custom_order_number: ${customOrderNumber}`)
  logger.info(`  Z-BOX: ${ZBOX_ID} (Vajanského)`)
  logger.info(`  dextrum_status: WAITING`)
  logger.info(`  paired invoice: 2026-31865`)
  logger.info("═══════════════════════════════════════════")
}
