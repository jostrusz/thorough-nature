// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * POST /store/klarna/authorize
 *
 * Called by the frontend after Klarna.Payments.authorize() returns an authorization_token.
 * Updates the payment session data with the token so that when cart.complete() calls
 * authorizePayment() on the Klarna provider, the token is available.
 *
 * Uses direct DB update to avoid Medusa entity validation issues with updatePaymentSession.
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

    // Find the Klarna payment session (prefer pending, fall back to any)
    const sessions = cart.payment_collection.payment_sessions || []
    const targetSession =
      sessions.find((s: any) => s.provider_id?.includes("klarna") && s.status === "pending") ||
      sessions.find((s: any) => s.provider_id?.includes("klarna"))

    if (!targetSession) {
      return res.status(400).json({ message: "No Klarna payment session found" })
    }

    logger.info(
      `[Klarna Authorize] Found session ${targetSession.id}, status=${targetSession.status}, adding authorizationToken`
    )

    // Build updated data with the authorization token
    const existingData = targetSession.data || {}
    const updatedData = {
      ...existingData,
      authorizationToken: authorization_token,
    }

    // Direct DB update — avoids Medusa's entity validation that requires amount/currency
    // We only update the data JSONB column, nothing else changes
    const pgConnection = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
    await pgConnection.raw(
      `UPDATE payment_session SET data = ?::jsonb, updated_at = NOW() WHERE id = ?`,
      [JSON.stringify(updatedData), targetSession.id]
    )

    logger.info(
      `[Klarna Authorize] Token saved for session ${targetSession.id}, cart ${cart_id}`
    )

    return res.json({
      success: true,
      message: "Authorization token saved to payment session",
    })
  } catch (error: any) {
    const logger = req.scope.resolve("logger")
    logger.error(`[Klarna Authorize] Error: ${error.message}`)
    console.error("[Klarna Authorize] Error:", error.message, error.stack)
    return res.status(500).json({
      message: error.message || "Failed to update payment session",
    })
  }
}
