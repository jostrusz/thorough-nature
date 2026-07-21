// @ts-nocheck
import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { DEXTRUM_MODULE } from "../modules/dextrum"

/**
 * One-off: manual cash-on-delivery order for Winklerné Hiripi Irén (Enying, HU).
 *
 * She tried to order "Engedd el, ami tönkretesz" on engeddelkonyv.hu twice and
 * the Barion payment failed both times, so no order was ever created. Over
 * e-mail (SupportBox, 17 + 20 July 2026) she sent her details and asked for a
 * cash-on-delivery order — she wants the book as a gift by Sunday.
 *
 * She asked for a "csomagpont" at Enying, Kossuth Lajos u. 6, but Packeta has
 * NO pickup point in Enying (checked all 1252 HU points — nearest is Lepsény,
 * ~7 km away), so that address is presumably an MPL PostaPont / Foxpost, which
 * we don't ship to. Agreed fallback: courier delivery to her home address.
 *
 * Does NOT emit `order.placed`: the script runs against production over the
 * DB proxy, where the internal Redis event bus is unreachable, so the event
 * would fire into a local bus and never reach production subscribers. Instead
 * the dextrum_order_map row is written directly with hold_until in the past —
 * the every-minute dextrum-order-hold cron forwards it to mySTOCK. Confirmation
 * e-mail is sent afterwards from the admin ("Send Order Notification").
 *
 * Run: railway run -- npx medusa exec ./src/scripts/create-order-winklerne-hu.ts
 */
export default async function createOrderWinklerneHu({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const orderModuleService = container.resolve(Modules.ORDER)
  const dextrumService = container.resolve(DEXTRUM_MODULE) as any

  const REGION_ID = "reg_01KWG6W2W6Z2YR8GVBRM3CEVHX"          // Hungary (HUF)
  const SALES_CHANNEL_ID = "sc_01KWG6W0N5K3E9AVYAKY38EQ8D"    // Engedd el
  const VARIANT_ID = "variant_01KWG6WMYKCZ14WF29MR1N6J1T"     // Engedd el, ami tönkretesz
  const COD_FEE_VARIANT_ID = "variant_01KNH0ECHJ8TJTB9ZKPBJBRRHT" // Příplatek za dobírku
  const SHIPPING_OPTION_ID = "so_01KWG6WEBKTHWESMJAJHB0ZZ54"  // Packeta - Házhozszállítás
  const EMAIL = "whiren60@gmail.com"
  const BOOK_PRICE = 10999
  const COD_FEE = 490

  // Idempotency: never create this order twice.
  const { data: existing } = await query.graph({
    entity: "order",
    fields: ["id", "display_id", "metadata"],
    filters: { email: EMAIL, sales_channel_id: SALES_CHANNEL_ID },
  })
  const already = (existing || []).find((o: any) => o?.metadata?.created_by === "manual_winklerne_hu_script")
  if (already) {
    logger.info(`[Winklerné] Order already exists: ${already.id} (${already.metadata?.custom_order_number}) — skipping`)
    return
  }

  const address = {
    first_name: "Irén",
    last_name: "Winklerné Hiripi",
    address_1: "Vas Gereben u. 6.",
    city: "Enying",
    postal_code: "8130",
    country_code: "hu",
    phone: "+36305777816",
  }

  const metadata: any = {
    created_by: "manual_winklerne_hu_script",
    created_manually: true,
    project_id: "engedd-el",
    payment_provider: "cod",
    payment_method: "cod",
    cod_fee: COD_FEE,
    shipping_method: "zasilkovna_home",
    dextrum_status: "WAITING",
    manual_order_notes:
      "Ügyfél kétszer próbált rendelni (Barion fizetés sikertelen), e-mailben kérte az " +
      "utánvétes rendelést (SupportBox, 2026-07-17 és 07-20). Enyingen nincs Packeta " +
      "csomagpont, ezért házhozszállítás a megadott címre. Vasárnapra ajándéknak kéri.",
  }

  const newOrder = await orderModuleService.createOrders({
    currency_code: "huf",
    email: EMAIL,
    region_id: REGION_ID,
    sales_channel_id: SALES_CHANNEL_ID,
    shipping_address: address,
    billing_address: address,
    items: [
      {
        title: "Engedd el, ami tönkretesz",
        variant_id: VARIANT_ID,
        quantity: 1,
        unit_price: BOOK_PRICE,
        is_tax_inclusive: true,
      },
      {
        title: "Utánvét díj",
        variant_id: COD_FEE_VARIANT_ID,
        quantity: 1,
        unit_price: COD_FEE,
        is_tax_inclusive: true,
      },
    ],
    shipping_methods: [{
      name: "Packeta - Házhozszállítás",
      amount: 0,
      shipping_option_id: SHIPPING_OPTION_ID,
    }],
    metadata,
  })

  const orderId = (newOrder as any).id
  const displayId = (newOrder as any).display_id
  const customOrderNumber = `HU${new Date().getFullYear()}-${displayId}`

  await orderModuleService.updateOrders(orderId, {
    metadata: { ...metadata, custom_order_number: customOrderNumber },
  })

  // Hand off to the warehouse: hold_until in the past → the every-minute
  // dextrum-order-hold cron picks it up on its next tick.
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
  logger.info(`[Winklerné] ORDER CREATED (no order.placed emitted)`)
  logger.info(`  order_id: ${orderId}`)
  logger.info(`  custom_order_number: ${customOrderNumber}`)
  logger.info(`  ${BOOK_PRICE} + ${COD_FEE} Ft utánvét = ${BOOK_PRICE + COD_FEE} Ft`)
  logger.info(`  delivery: Packeta courier → 8130 Enying, Vas Gereben u. 6.`)
  logger.info(`  dextrum_order_map: WAITING, hold elapsed → cron will send`)
  logger.info(`  TODO: send confirmation from admin (Send Order Notification)`)
  logger.info("═══════════════════════════════════════════")
}
