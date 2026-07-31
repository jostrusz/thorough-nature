// @ts-nocheck
import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { DEXTRUM_MODULE } from "../modules/dextrum"

/**
 * One-off: bank-transfer order for Myra Louwes (het-leven).
 *
 * She tried to pay three times on 30. 7. — twice Brite pay-by-bank, once
 * iDEAL — and every attempt was aborted before the bank confirmed it
 * (payment_journey_log: brite_session_created, then no payment_return and no
 * webhook). Cart cart_01KYSA24QT98P6K690AJD918FM stayed uncompleted.
 * Support offered a bank transfer and issued invoice 2026-37197
 * (VS 202637197, 61 € incl. 9% NL book VAT) to the Revolut IBAN
 * LT93 3250 0759 9868 0394.
 *
 * The payment arrived on Revolut: 61,00 EUR, "Payment from M.h.
 * Louwes-camphuynder Cj H.g. Louwes", reference
 * "202637197  d.d.30 juli 2026 2 boeken", 30. 7. 2026 18:48 UTC.
 *
 * order.placed is NOT emitted — the Fakturoid invoice already exists and the
 * event would create a duplicate. Confirmation e-mail + e-books are sent
 * separately.
 *
 * Run: pnpm medusa exec ./src/scripts/create-order-louwes-banktransfer.ts
 */

const REGION_ID = "reg_01KJ9JF3JRFG9KS4ZMTZ9KRTKV"          // Netherlands, EUR
const SALES_CHANNEL_ID = "sc_01KP3WW1CYJC35W7VMTWXE32JQ"    // Het Leven Dat Je Verdient
const SHIPPING_OPTION_ID = "so_01KJ9JF3P8JV32D6P93KWQS19C"  // GLS — Gratis verzending

const BOOK_VARIANT_ID = "variant_01KP3WW3ZGQG8Q195T7FR7WW1H"    // HLDV62786284629
const UPSELL_VARIANT_ID = "variant_01KRB6ZGJ2BXNSGF64V4GJAG1F"  // LLWJK7824627392-2

const EMAIL = "myra.louwes@gmail.com"                       // e-mail from the cart; she reads it (replied to the abandonment mail)
const ALT_EMAIL = "myra.louwes@outlook.com"                 // she writes from this one on SupportBox
const CART_ID = "cart_01KYSA24QT98P6K690AJD918FM"
const VS = "202637197"
const FAKTUROID_INVOICE_ID = 61089648
const FAKTUROID_INVOICE_NUMBER = "2026-37197"
const FAKTUROID_INVOICE_URL = "https://app.fakturoid.cz/jaroslavostruszka/p/GMCvjCjJMg/2026-37197"
const PAID_AT = "2026-07-30T18:48:51Z"                      // Revolut topup completed_at
const REVOLUT_TX_ID = "6a6b9c91-a7e2-abac-bfa7-d25659a04052"
const BOOK_PRICE = 36
const UPSELL_PRICE = 25

const ADDRESS = {
  first_name: "Myra",
  last_name: "Louwes",
  address_1: "Jan Altinkweg 5",
  city: "Winsum",
  postal_code: "9951 MH",
  country_code: "nl",
  phone: "+31610791020",
}

export default async function createOrderLouwesBankTransfer({ container }: ExecArgs) {
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
    project_id: "het-leven",
    payment_provider: "bank_transfer",
    payment_method: "bank_transfer",
    bank_transfer_vs: VS,
    bank_transfer_paid_at: PAID_AT,
    revolut_transaction_id: REVOLUT_TX_ID,
    payment_captured: true,
    copied_payment_status: "paid",
    shipping_method: "home_delivery",
    dextrum_status: "WAITING",
    original_cart_id: CART_ID,
    customer_alt_email: ALT_EMAIL,
    fakturoid_invoice_id: FAKTUROID_INVOICE_ID,
    fakturoid_invoice_number: FAKTUROID_INVOICE_NUMBER,
    fakturoid_invoice_url: FAKTUROID_INVOICE_URL,
    fakturoid_invoice_created: true,
    manual_order_notes:
      `Klantin probeerde op 30. 7. drie keer te betalen (2x Brite pay-by-bank, 1x iDEAL) — elke poging werd ` +
      `afgebroken voordat de bank hem bevestigde, cart ${CART_ID} bleef open. Support bood een bankoverschrijving ` +
      `aan en maakte factuur ${FAKTUROID_INVOICE_NUMBER} (VS ${VS}, 61 € incl. 9% btw). Betaling kwam binnen op ` +
      `Revolut 30. 7. 2026 18:48 UTC — 61,00 EUR, "Payment from M.h. Louwes-camphuynder Cj H.g. Louwes", ` +
      `kenmerk "${VS}  d.d.30 juli 2026 2 boeken". Bestelling handmatig aangemaakt, order.placed wordt niet ` +
      `geëmit (factuur bestaat al, anders ontstaat een duplicaat in Fakturoid).`,
  }

  const newOrder = await orderModuleService.createOrders({
    currency_code: "eur",
    email: EMAIL,
    region_id: REGION_ID,
    sales_channel_id: SALES_CHANNEL_ID,
    shipping_address: ADDRESS,
    billing_address: ADDRESS,
    items: [
      {
        title: "Het Leven Dat Je Verdient",
        variant_id: BOOK_VARIANT_ID,
        quantity: 1,
        unit_price: BOOK_PRICE,
        is_tax_inclusive: true,
      },
      {
        title: "Laat Los Wat Je Kapotmaakt - Upsell",
        variant_id: UPSELL_VARIANT_ID,
        quantity: 1,
        unit_price: UPSELL_PRICE,
        is_tax_inclusive: true,
      },
    ],
    shipping_methods: [{
      name: "GLS — Gratis verzending",
      amount: 0,
      shipping_option_id: SHIPPING_OPTION_ID,
    }],
    metadata,
  })

  const orderId = (newOrder as any).id
  const displayId = (newOrder as any).display_id
  const customOrderNumber = `NL${new Date().getFullYear()}-${displayId}`

  await orderModuleService.updateOrders(orderId, {
    metadata: {
      ...metadata,
      custom_order_number: customOrderNumber,
      custom_display_id: customOrderNumber,
      dextrum_order_code: customOrderNumber,
    },
  })

  // 9 % reduced VAT on books — matches vat_rate on the invoice lines.
  try {
    const { data: [fresh] } = await query.graph({
      entity: "order",
      fields: ["items.id"],
      filters: { id: orderId },
    })
    const items = (fresh as any)?.items || []
    if (items.length) {
      await orderModuleService.createOrderLineItemTaxLines(
        orderId,
        items.map((item: any) => ({
          item_id: item.id,
          code: "vat_reduced",
          rate: 9,
          description: "BTW 9%",
        }))
      )
    }
  } catch (e: any) {
    logger.warn(`tax lines skipped: ${e.message}`)
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
  logger.info(`Louwes ORDER CREATED (no order.placed emitted)`)
  logger.info(`  order_id: ${orderId}`)
  logger.info(`  custom_order_number: ${customOrderNumber}`)
  logger.info(`  ${BOOK_PRICE + UPSELL_PRICE} €, 2 boeken → ${ADDRESS.address_1}, ${ADDRESS.postal_code} ${ADDRESS.city}`)
  logger.info(`  tel: ${ADDRESS.phone}`)
  logger.info(`  bank transfer VS ${VS} (Revolut, ${PAID_AT})`)
  logger.info(`  fakturoid invoice: ${FAKTUROID_INVOICE_NUMBER} (id ${FAKTUROID_INVOICE_ID})`)
  logger.info(`  dextrum_order_map: WAITING, hold elapsed → cron verstuurt`)
  logger.info("═══════════════════════════════════════════")
}
