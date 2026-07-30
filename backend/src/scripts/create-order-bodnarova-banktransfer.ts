// @ts-nocheck
import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { DEXTRUM_MODULE } from "../modules/dextrum"

/**
 * One-off: bank-transfer order for Edita Bodnárová (pusti-to-sk).
 *
 * She abandoned the checkout on 29. 7. and asked on SupportBox whether she
 * could pay by transfer from her homebanking (COD is not offered). Support
 * asked for the delivery details, she sent them, and invoice 2026-37047
 * (VS 202637047, 32 € incl. 5% SK book VAT) was issued to the Revolut IBAN
 * LT93 3250 0759 9868 0394. The invoice's own private note says the order has
 * to be created by hand once the money lands.
 *
 * The payment arrived on Revolut: 32,00 EUR, "Payment from Edita Bodnarova",
 * reference 202637047, 30. 7. 2026 16:27 UTC.
 *
 * order.placed is NOT emitted — the Fakturoid invoice already exists and the
 * event would create a duplicate. Confirmation e-mail + e-books are sent
 * separately.
 *
 * Run: pnpm medusa exec ./src/scripts/create-order-bodnarova-banktransfer.ts
 */

const REGION_ID = "reg_01KWVAZVNATPX01HH77MYWKG3M"         // Slovakia (Pusti To SK), EUR
const SALES_CHANNEL_ID = "sc_01KWVAX8XTNTXHF9ZWH211Y6CF"   // Pusti To SK
const VARIANT_ID = "variant_01KWVB0CS1A6XBKNB9M3SG5GFK"    // Pusti to, čo ťa ničí (PTCN6764786297)
const SHIPPING_OPTION_ID = "so_01KWVB06DRRS7ZP2E5AY6N3VR3" // Packeta - Na adresu

const EMAIL = "e.bodnarova@gmail.com"
const VS = "202637047"
const FAKTUROID_INVOICE_ID = 61076116
const FAKTUROID_INVOICE_NUMBER = "2026-37047"
const FAKTUROID_INVOICE_URL = "https://app.fakturoid.cz/jaroslavostruszka/p/uPE4c2cxyA/2026-37047"
const PAID_AT = "2026-07-30T16:27:39Z"                     // Revolut topup completed_at
const REVOLUT_TX_ID = "6a6b7b7a-eb08-ab4a-b5a0-48ec257d9081"
const PRICE = 32

const ADDRESS = {
  first_name: "Edita",
  last_name: "Bodnárová",
  address_1: "Novozámocká 1347/61",
  city: "Zvolen",
  postal_code: "960 01",
  country_code: "sk",
  phone: "+421911913448",
}

export default async function createOrderBodnarovaBankTransfer({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const orderModuleService = container.resolve(Modules.ORDER)
  const dextrumService = container.resolve(DEXTRUM_MODULE) as any

  // Idempotence — never create the same transfer twice.
  const { data: existing } = await query.graph({
    entity: "order",
    fields: ["id", "display_id", "metadata"],
    filters: { email: EMAIL },
  })
  const already = (existing || []).find((o: any) => o?.metadata?.bank_transfer_vs === VS)
  if (already) {
    logger.info(`Order already exists: ${already.id} (${already.metadata?.custom_order_number}) — skipping`)
    return
  }

  const metadata: any = {
    created_by: "manual_bank_transfer_recovery",
    created_manually: true,
    project_id: "pusti-to-sk",
    payment_provider: "bank_transfer",
    payment_method: "bank_transfer",
    bank_transfer_vs: VS,
    bank_transfer_paid_at: PAID_AT,
    revolut_transaction_id: REVOLUT_TX_ID,
    payment_captured: true,
    copied_payment_status: "paid",
    shipping_method: "home_delivery",
    dextrum_status: "WAITING",
    fakturoid_invoice_id: FAKTUROID_INVOICE_ID,
    fakturoid_invoice_number: FAKTUROID_INVOICE_NUMBER,
    fakturoid_invoice_url: FAKTUROID_INVOICE_URL,
    fakturoid_invoice_created: true,
    manual_order_notes:
      `Zákazníčka nedokončila checkout 29. 7., na SupportBoxe požiadala o platbu prevodom cez ` +
      `homebanking (dobierku neponúkame). Support si vyžiadal doručovacie údaje a vystavil faktúru ` +
      `${FAKTUROID_INVOICE_NUMBER} (VS ${VS}, ${PRICE} € vrátane 5 % DPH). Platba dorazila na Revolut ` +
      `30. 7. 2026 16:27 UTC — 32,00 EUR, "Payment from Edita Bodnarova", referencia ${VS}. ` +
      `Objednávka vytvorená ručne, order.placed sa neemituje (faktúra už existuje, inak by vznikol ` +
      `duplikát vo Fakturoide).`,
  }

  const newOrder = await orderModuleService.createOrders({
    currency_code: "eur",
    email: EMAIL,
    region_id: REGION_ID,
    sales_channel_id: SALES_CHANNEL_ID,
    shipping_address: ADDRESS,
    billing_address: ADDRESS,
    items: [{
      title: "Pusti to, čo ťa ničí",
      variant_id: VARIANT_ID,
      quantity: 1,
      unit_price: PRICE,
      is_tax_inclusive: true,
    }],
    // Invoice has a single 32 € line with no shipping — delivery is free here.
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
    metadata: {
      ...metadata,
      custom_order_number: customOrderNumber,
      custom_display_id: customOrderNumber,
      dextrum_order_code: customOrderNumber,
    },
  })

  // 5 % reduced VAT on books — matches vat_rate on the invoice line.
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
        code: "reduced-vat-sk",
        rate: 5,
        description: "Slovak Book VAT (5%)",
      }])
    }
  } catch (e: any) {
    logger.warn(`tax line skipped: ${e.message}`)
  }

  // hold_until in the past → the Dextrum cron picks it up on the next run.
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
  logger.info(`Bodnárová ORDER CREATED (no order.placed emitted)`)
  logger.info(`  order_id: ${orderId}`)
  logger.info(`  custom_order_number: ${customOrderNumber}`)
  logger.info(`  ${PRICE} €, 1 ks → ${ADDRESS.address_1}, ${ADDRESS.postal_code} ${ADDRESS.city}`)
  logger.info(`  tel: ${ADDRESS.phone}`)
  logger.info(`  bank transfer VS ${VS} (Revolut, ${PAID_AT})`)
  logger.info(`  fakturoid invoice: ${FAKTUROID_INVOICE_NUMBER} (id ${FAKTUROID_INVOICE_ID})`)
  logger.info(`  dextrum_order_map: WAITING, hold elapsed → cron odošle`)
  logger.info("═══════════════════════════════════════════")
}
