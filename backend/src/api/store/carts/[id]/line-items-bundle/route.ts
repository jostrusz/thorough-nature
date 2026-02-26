import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { addBundleToCartWorkflow } from "../../../../../workflows/add-bundle-to-cart"

/**
 * POST /store/carts/:id/line-items-bundle
 *
 * Add a product to cart with bundle pricing.
 * If the variant+quantity matches a bundle tier, the unit_price is overridden.
 * Otherwise falls back to the variant's default price.
 *
 * Body: { variant_id: string, quantity: number }
 */
export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  try {
    const { id: cartId } = req.params
    const { variant_id, quantity } = req.body as {
      variant_id: string
      quantity: number
    }

    if (!variant_id || !quantity) {
      res.status(400).json({
        message: "variant_id and quantity are required",
      })
      return
    }

    const { result } = await addBundleToCartWorkflow(req.scope).run({
      input: {
        cart_id: cartId,
        variant_id,
        quantity: quantity || 1,
      },
    })

    res.json(result)
  } catch (error: any) {
    console.error("[Bundle] Add to cart failed:", error.message)
    res.status(500).json({
      message: error.message || "Failed to add bundle to cart",
    })
  }
}
