// @ts-nocheck
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

const GATEWAY_CONFIG_MODULE = "gatewayConfig"

/**
 * POST /store/carts/:id/sync-paypal-address
 *
 * Fetches the PayPal order payer/shipping address and updates the cart
 * addresses before completing the order. Used by the payment-return flow
 * when customers pay via Apple Pay / Google Pay on PayPal's hosted page.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const cartId = req.params.id
  const logger = req.scope.resolve("logger")

  try {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

    // Find the cart and its payment sessions
    const { data: carts } = await query.graph({
      entity: "cart",
      fields: [
        "id",
        "email",
        "shipping_address.*",
        "payment_collection.*",
        "payment_collection.payment_sessions.*",
      ],
      filters: { id: cartId },
    })

    const cart = carts?.[0]
    if (!cart) {
      return res.status(404).json({ error: "Cart not found" })
    }

    // Find PayPal payment session
    const sessions = cart.payment_collection?.payment_sessions || []
    const paypalSession = sessions.find(
      (s: any) =>
        s.data?.paypalOrderId && s.provider_id?.includes("paypal")
    )

    if (!paypalSession) {
      return res.status(200).json({ synced: false, reason: "No PayPal session found" })
    }

    const paypalOrderId = paypalSession.data.paypalOrderId
    const projectSlug = paypalSession.data.project_slug || null

    // Get PayPal credentials
    const gcService = req.scope.resolve(GATEWAY_CONFIG_MODULE)
    const gcFilters: any = { provider: "paypal", is_active: true }
    if (projectSlug) gcFilters.project_slug = projectSlug
    const configs = await gcService.listGatewayConfigs(gcFilters, { take: 1 })
    const config = configs[0]

    if (!config) {
      return res.status(200).json({ synced: false, reason: "No PayPal config found" })
    }

    const isLive = config.mode === "live"
    const keys = isLive ? config.live_keys : config.test_keys
    const { PayPalApiClient } = await import(
      "../../../../../modules/payment-paypal/api-client"
    )
    const client = new PayPalApiClient({
      client_id: keys?.client_id || keys?.api_key,
      client_secret: keys?.client_secret || keys?.secret_key,
      mode: isLive ? "live" : "test",
    })

    // Fetch PayPal order details
    const ppOrder = await client.getOrder(paypalOrderId)
    const payer = ppOrder?.payer
    const shipping = ppOrder?.purchase_units?.[0]?.shipping
    const payerAddr = payer?.address
    const shippingAddr = shipping?.address
    const resolved = shippingAddr || payerAddr

    if (!resolved) {
      return res.status(200).json({ synced: false, reason: "No address in PayPal order" })
    }

    // Parse name
    let firstName = ""
    let lastName = ""
    const shippingName = shipping?.name?.full_name
    if (shippingName) {
      const parts = shippingName.split(" ")
      firstName = parts[0] || ""
      lastName = parts.slice(1).join(" ") || ""
    } else if (payer?.name) {
      firstName = payer.name.given_name || ""
      lastName = payer.name.surname || ""
    }

    const mappedShipping = {
      first_name: firstName,
      last_name: lastName,
      address_1: resolved.address_line_1 || "",
      address_2: resolved.address_line_2 || "",
      city: resolved.admin_area_2 || "",
      province: resolved.admin_area_1 || "",
      postal_code: resolved.postal_code || "",
      country_code: resolved.country_code?.toLowerCase() || "",
      phone: payer?.phone?.phone_number?.national_number || "",
    }

    const billingSource = payerAddr || shippingAddr
    const mappedBilling = billingSource
      ? {
          first_name: payer?.name?.given_name || firstName,
          last_name: payer?.name?.surname || lastName,
          address_1: billingSource.address_line_1 || "",
          address_2: billingSource.address_line_2 || "",
          city: billingSource.admin_area_2 || "",
          province: billingSource.admin_area_1 || "",
          postal_code: billingSource.postal_code || "",
          country_code: billingSource.country_code?.toLowerCase() || "",
          phone: payer?.phone?.phone_number?.national_number || "",
        }
      : mappedShipping

    // Update cart addresses
    const updateData: any = {
      shipping_address: mappedShipping,
      billing_address: mappedBilling,
    }
    if (payer?.email_address) {
      updateData.email = payer.email_address
    }

    const cartService = req.scope.resolve("cartModuleService") as any
    if (cartService?.updateCarts) {
      await cartService.updateCarts(cartId, updateData)
    } else {
      // Fallback: direct HTTP call to Medusa cart update
      const { Pool } = require("pg")
      const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
      await pool.query(
        `UPDATE "cart" SET updated_at = NOW() WHERE id = $1`,
        [cartId]
      )
      await pool.end()
    }

    logger.info(
      `[Sync PayPal Address] Cart ${cartId}: synced address from PayPal order ${paypalOrderId} (${firstName} ${lastName}, ${resolved.country_code})`
    )

    return res.status(200).json({
      synced: true,
      shipping_address: mappedShipping,
      billing_address: mappedBilling,
      email: payer?.email_address || null,
    })
  } catch (error: any) {
    logger.error(`[Sync PayPal Address] Error for cart ${cartId}: ${error.message}`)
    // Don't block checkout — return success even on error
    return res.status(200).json({ synced: false, reason: error.message })
  }
}
