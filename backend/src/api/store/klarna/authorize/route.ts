import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

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

    // Get the payment module service
    const paymentModuleService = req.scope.resolve("paymentModuleService") as any

    // Get the cart to find the payment collection
    const cartService = req.scope.resolve("cartModuleService") as any
    const cart = await cartService.retrieveCart(cart_id, {
      relations: ["payment_collection", "payment_collection.payment_sessions"],
    })

    if (!cart?.payment_collection) {
      return res.status(400).json({ message: "No payment collection found for cart" })
    }

    // Find the pending Klarna payment session
    const klarnaSession = cart.payment_collection.payment_sessions?.find(
      (s: any) => s.provider_id?.startsWith("pp_klarna") && s.status === "pending"
    )

    if (!klarnaSession) {
      return res.status(400).json({ message: "No pending Klarna payment session found" })
    }

    // Update the session data with the authorization token
    const updatedData = {
      ...klarnaSession.data,
      authorizationToken: authorization_token,
    }

    await paymentModuleService.updatePaymentSession({
      id: klarnaSession.id,
      data: updatedData,
    })

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
