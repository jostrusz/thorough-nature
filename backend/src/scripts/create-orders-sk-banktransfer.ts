// @ts-nocheck
import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { DEXTRUM_MODULE } from "../modules/dextrum"

/**
 * One-off: recover three paid-but-unmatched Slovak bank transfers (pusti-to-sk).
 *
 * All three paid 32 € by SEPA transfer to Revolut on 20–21 July 2026, but no
 * order was created: the reconcile cron matches an incoming credit to a cart by
 * finding the cart's variable symbol inside the transfer text, and these Slovak
 * banks sent NO reference at all (Revolut shows only "Payment from <name>").
 * The carts therefore sat in the awaiting queue while the money was on the
 * account. A fourth cart (Mária Mĺkva, 34 €) is intentionally NOT included —
 * her payment never arrived.
 *
 * Both carts' line items are unreliable (customers clicked submit repeatedly,
 * so the book sits in the cart 2–3×), while every one of them paid for exactly
 * one copy — the orders are therefore built as 1 × 32 €.
 *
 * All three chose a Packeta pickup point but the widget never stored a
 * pickup_place_code, which Packeta rejects, so delivery is switched to courier
 * to their home address (approved by Jaroslav).
 *
 * No order.placed emitted (runs against prod over the DB proxy, internal Redis
 * unreachable) — dextrum_order_map is written directly with an elapsed hold;
 * confirmation + e-books are sent from the admin afterwards.
 *
 * Run: railway run -- npx medusa exec ./src/scripts/create-orders-sk-banktransfer.ts
 */

const REGION_ID = "reg_01KWVAZVNATPX01HH77MYWKG3M"           // Slovakia (EUR)
const SALES_CHANNEL_ID = "sc_01KWVAX8XTNTXHF9ZWH211Y6CF"     // Pusti to, čo ťa ničí
const VARIANT_ID = "variant_01KWVB0CS1A6XBKNB9M3SG5GFK"      // Pusti to, čo ťa ničí
const SHIPPING_OPTION_ID = "so_01KWVB06DRRS7ZP2E5AY6N3VR3"   // Packeta - Na adresu
const PRICE = 32

const CUSTOMERS = [
  {
    email: "tesarik@continens.eu",
    first_name: "Michal", last_name: "Tesárik",
    address_1: "J. Mudrocha 650/1", city: "Senica", postal_code: "90501",
    phone: "+421908831837",
    vs: "833208809",
    cart_id: "cart_01KY0Q8NYA1XMME2A8TVQQSS2A",
    revolut_txn: "6a5e94de-db22-ae0d-b3e1-77280a67d91e",
    paid_at: "2026-07-20T21:36:31Z",
  },
  {
    email: "adikast@gmail.com",
    first_name: "Andrea", last_name: "Jánošíková",
    address_1: "Ľ. Fullu 1966/11", city: "Zvolen", postal_code: "96001",
    phone: "+421905516555",
    vs: "095547580",
    cart_id: "cart_01KY1G5MR8P49VYZJ0SG3S61XF",
    revolut_txn: "6a5f1f4b-93a5-a835-97af-76d61c8da700",
    paid_at: "2026-07-21T07:27:08Z",
  },
  {
    email: "kristina.vojtylova@gmail.com",
    first_name: "Kristína", last_name: "Vojtylová",
    address_1: "Višňové 374", city: "Višňové", postal_code: "01323",
    phone: "+421911464277",
    vs: "206545468",
    cart_id: "cart_01KY1TRRBDPD9X12FHW6Q221V2",
    revolut_txn: "6a5f26a1-aebf-a4f9-841a-3df76cab8a2f",
    paid_at: "2026-07-21T07:58:26Z",
  },
]

export default async function createOrdersSkBankTransfer({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const orderModuleService = container.resolve(Modules.ORDER)
  const dextrumService = container.resolve(DEXTRUM_MODULE) as any

  for (const c of CUSTOMERS) {
    // Idempotency: one order per Revolut transaction, ever.
    const { data: existing } = await query.graph({
      entity: "order",
      fields: ["id", "display_id", "metadata"],
      filters: { email: c.email },
    })
    const already = (existing || []).find((o: any) => o?.metadata?.revolut_transaction_id === c.revolut_txn)
    if (already) {
      logger.info(`[SK Recovery] ${c.email}: order already exists (${already.metadata?.custom_order_number}) — skipping`)
      continue
    }

    const address = {
      first_name: c.first_name,
      last_name: c.last_name,
      address_1: c.address_1,
      city: c.city,
      postal_code: c.postal_code,
      country_code: "sk",
      phone: c.phone,
    }

    const metadata: any = {
      created_by: "manual_sk_banktransfer_recovery",
      created_manually: true,
      project_id: "pusti-to-sk",
      payment_provider: "bank_transfer",
      payment_method: "bank_transfer",
      copied_payment_status: "paid",
      variable_symbol: c.vs,
      bank_transfer_reference: c.vs,
      revolut_transaction_id: c.revolut_txn,
      bank_transfer_paid_at: c.paid_at,
      recovered_from_cart: c.cart_id,
      shipping_method: "zasilkovna_home",
      dextrum_status: "WAITING",
      manual_order_notes:
        `Zákazník zaplatil ${PRICE} € SEPA prevodom (Revolut ${c.revolut_txn}), ale objednávka ` +
        `nevznikla — banka neposlala variabilný symbol, takže reconcile cron platbu nemal ako ` +
        `spárovať s košíkom ${c.cart_id}. Objednávka vytvorená ručne. Doprava prehodená z ` +
        `odberného miesta na doručenie na adresu, pretože košík nemal uložený kód výdajne.`,
    }

    const newOrder = await orderModuleService.createOrders({
      currency_code: "eur",
      email: c.email,
      region_id: REGION_ID,
      sales_channel_id: SALES_CHANNEL_ID,
      shipping_address: address,
      billing_address: address,
      items: [{
        title: "Pusti to, čo ťa ničí",
        variant_id: VARIANT_ID,
        quantity: 1,
        unit_price: PRICE,
        is_tax_inclusive: true,
      }],
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
      metadata: { ...metadata, custom_order_number: customOrderNumber },
    })

    await dextrumService.createDextrumOrderMaps({
      medusa_order_id: orderId,
      display_id: String(displayId),
      project_code: "DEFAULT",
      mystock_order_code: customOrderNumber,
      delivery_status: "WAITING",
      delivery_status_updated_at: new Date().toISOString(),
      hold_until: new Date(Date.now() - 60_000).toISOString(),
    })

    logger.info(`[SK Recovery] ✅ ${c.first_name} ${c.last_name} → ${customOrderNumber} (${orderId}) · ${PRICE} € · Packeta na adresu`)
  }

  logger.info("[SK Recovery] hotovo — pošli potvrzení + e-booky z adminu")
}
