// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

/**
 * POST /store/klarna/authorize
 *
 * Called by the frontend after Klarna.Payments.authorize() returns an authorization_token.
 * Updates the payment session data with the token so that when cart.complete() calls
 * authorizePayment() on the Klarna provider, the token is available.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const { cart_id, authorization_token } = req.body as {
      cart_id: string
      authorization_token: string
    }

    if (!cart_id || !authorization_token) {
      return res.status(400).json({
        message: "cart_id and authorization_token are required",
      })
    }

    const logger = req.scope.resolve("logger")
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

    // Use QUERY graph to find the cart's payment collection and sessions
    const { data: carts } = await query.graph({
      entity: "cart",
      fields: [
        "id",
        "payment_collection.*",
        "payment_collection.payment_sessions.*",
      ],
      filters: { id: cart_id },
    })

    const cart = carts?.[0]
    if (!cart?.payment_collection) {
      return res.status(400).json({ message: "No payment collection found for cart" })
    }

    // Find the pending Klarna payment session
    const sessions = cart.payment_collection.payment_sessions || []
    const klarnaSession = sessions.find(
      (s: any) => s.provider_id?.includes("klarna") && s.status === "pending"
    )

    if (!klarnaSession) {
      // Also try finding any klarna session regardless of status
      const anyKlarnaSession = sessions.find(
        (s: any) => s.provider_id?.includes("klarna")
      )
      if (!anyKlarnaSession) {
        return res.status(400).json({ message: "No Klarna payment session found" })
      }
      // Use the found session even if not "pending"
      logger.info(`[Klarna Authorize] Found Klarna session with status: ${anyKlarnaSession.status}`)
    }

    const targetSession = klarnaSession || sessions.find(
      (s: any) => s.provider_id?.includes("klarna")
    )

    // Update the session data with the authorization token
    // Use the Payment module service via Modules enum (correct Medusa v2 resolution)
    const paymentModuleService = req.scope.resolve(Modules.PAYMENT) as any

    const updatedData = {
      ...targetSession.data,
      authorizationToken: authorization_token,
    }

    // Try different update methods depending on Medusa version
    if (typeof paymentModuleService.updatePaymentSession === "function") {
      await paymentModuleService.updatePaymentSession({
        id: targetSession.id,
        data: updatedData,
      })
    } else if (typeof paymentModuleService.updatePaymentSessions === "function") {
      await paymentModuleService.updatePaymentSessions({
        id: targetSession.id,
        data: updatedData,
      })
    } else {
      // Direct update via query if module service methods aren't available
      logger.warn("[Klarna Authorize] paymentModuleService update methods not found, trying direct approach")
      // Use the remote link / direct DB approach
      const pgConnection = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
      await pgConnection.raw(
        `UPDATE payment_session SET data = $1::jsonb WHERE id = $2`,
        [JSON.stringify(updatedData), targetSession.id]
      )
    }

    logger.info(
      `[Klarna Authorize] Token saved for session ${targetSession.id}, cart ${cart_id}`
    )

    return res.json({
      success: true,
      message: "Authorization token saved to payment session",
    })
  } catch (error: any) {
    console.error("[Klarna Authorize] Error:", error.message, error.stack)
    return res.status(500).json({
      message: error.message || "Failed to update payment session",
    })
  }
}
