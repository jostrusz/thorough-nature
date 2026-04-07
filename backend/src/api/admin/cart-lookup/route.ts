import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * GET /admin/cart-lookup?cart_id=xxx  — look up cart with shipping address
 * GET /admin/cart-lookup?email=xxx   — find carts by email
 * GET /admin/cart-lookup?intent_id=xxx — find cart by Airwallex intent ID
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const cartId = req.query.cart_id as string
  const email = req.query.email as string
  const intentId = req.query.intent_id as string

  if (!cartId && !email && !intentId) {
    return res.status(400).json({ error: "Provide cart_id, email, or intent_id" })
  }

  try {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

    if (cartId) {
      // Direct cart lookup
      const { data } = await query.graph({
        entity: "cart",
        filters: { id: cartId },
        fields: [
          "id", "email", "created_at", "currency_code", "metadata",
          "shipping_address.*",
          "billing_address.*",
          "items.*",
          "items.variant.*",
          "items.variant.product.*",
        ],
      })
      return res.json({ cart: data[0] || null })
    }

    if (email) {
      // Find carts by email
      const { data } = await query.graph({
        entity: "cart",
        filters: { email },
        fields: [
          "id", "email", "created_at", "currency_code", "completed_at", "metadata",
          "shipping_address.*",
        ],
      })
      return res.json({ carts: data, count: data.length })
    }

    if (intentId) {
      // Find cart by Airwallex intent ID via raw SQL (intent stored in payment session data)
      const pgConnection = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)
      const result = await pgConnection.raw(`
        SELECT c.id, c.email, c.created_at, c.currency_code,
               sa.first_name, sa.last_name, sa.address_1, sa.address_2,
               sa.city, sa.postal_code, sa.country_code, sa.phone, sa.province
        FROM cart c
        LEFT JOIN cart_address sa ON sa.id = c.shipping_address_id
        JOIN cart_payment_collection cpc ON cpc.cart_id = c.id
        JOIN payment_collection pc ON pc.id = cpc.payment_collection_id
        JOIN payment_session ps ON ps.payment_collection_id = pc.id
        WHERE ps.data::text LIKE $1
        ORDER BY c.created_at DESC
        LIMIT 5
      `, [`%${intentId}%`])
      return res.json({ carts: result.rows || result })
    }
  } catch (error: any) {
    return res.status(500).json({ error: error.message })
  }
}
