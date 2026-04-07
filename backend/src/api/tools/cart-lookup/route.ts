import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * GET /tools/cart-lookup?cart_id=xxx
 * GET /tools/cart-lookup?email=xxx
 * No auth required — diagnostic endpoint for investigating lost orders.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const cartId = req.query.cart_id as string
  const email = req.query.email as string

  if (!cartId && !email) {
    return res.status(400).json({ error: "Provide cart_id or email" })
  }

  try {
    const pgConnection = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION)

    if (cartId) {
      const result = await pgConnection.raw(`
        SELECT c.id, c.email, c.created_at, c.currency_code, c.completed_at,
               sa.first_name, sa.last_name, sa.address_1, sa.address_2,
               sa.city, sa.postal_code, sa.country_code, sa.phone, sa.province
        FROM cart c
        LEFT JOIN cart_address sa ON sa.id = c.shipping_address_id
        WHERE c.id = $1
      `, [cartId])
      const cart = (result.rows || result)[0]
      if (!cart) return res.status(404).json({ error: "Cart not found" })
      return res.json(cart)
    }

    if (email) {
      const result = await pgConnection.raw(`
        SELECT c.id, c.email, c.created_at, c.currency_code, c.completed_at,
               sa.first_name, sa.last_name, sa.address_1, sa.address_2,
               sa.city, sa.postal_code, sa.country_code, sa.phone
        FROM cart c
        LEFT JOIN cart_address sa ON sa.id = c.shipping_address_id
        WHERE c.email = $1
        ORDER BY c.created_at DESC
        LIMIT 10
      `, [email])
      return res.json({ carts: result.rows || result })
    }
  } catch (error: any) {
    return res.status(500).json({ error: error.message })
  }
}
