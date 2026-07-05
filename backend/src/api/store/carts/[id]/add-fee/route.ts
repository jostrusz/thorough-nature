import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { addBundleToCartWorkflow } from "../../../../../workflows/add-bundle-to-cart"

/**
 * POST /store/carts/:id/add-fee
 *
 * Add a fee product to the cart as a line item.
 * Looks up the fee variant by product handle — no hardcoded IDs needed.
 *
 * Body: { type: "delivery_fee" | "cod_fee" }
 */

const FEE_HANDLES: Record<string, string> = {
  delivery_fee: "doprava-na-adresu",
  cod_fee: "priplatek-za-dobirku",
}

export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  try {
    const { id: cartId } = req.params
    const { type } = req.body as { type: string }

    if (!type || !FEE_HANDLES[type]) {
      res.status(400).json({
        message: `Invalid fee type. Expected: ${Object.keys(FEE_HANDLES).join(", ")}`,
      })
      return
    }

    const handle = FEE_HANDLES[type]

    // Look up the fee product variant by handle
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as any
    const { data: products } = await query.graph({
      entity: "product",
      fields: ["id", "handle", "variants.id"],
      filters: { handle },
    })

    if (!products.length || !products[0].variants?.length) {
      res.status(404).json({
        message: `Fee product "${handle}" not found. Run seed-fee-products script first.`,
      })
      return
    }

    const variantId = products[0].variants[0].id

    // Currency-specific fee override. Currencies NOT listed here fall back to
    // BUNDLE_PRICING (CZK COD fee stays 30 Kč — unchanged). HUF = 30 CZK equivalent (≈490 Ft).
    const FEE_AMOUNTS: Record<string, Record<string, number>> = {
      cod_fee: { huf: 490 },
    }
    let unitPrice: number | undefined
    try {
      const { data: carts } = await query.graph({
        entity: "cart",
        fields: ["currency_code"],
        filters: { id: cartId },
      })
      const currency = (carts?.[0]?.currency_code || "").toLowerCase()
      unitPrice = FEE_AMOUNTS[type]?.[currency]
    } catch {
      // fall back to BUNDLE_PRICING
    }

    // Add to cart via bundle workflow (explicit unit_price wins; else BUNDLE_PRICING)
    const { result } = await addBundleToCartWorkflow(req.scope).run({
      input: {
        cart_id: cartId,
        variant_id: variantId,
        quantity: 1,
        ...(unitPrice !== undefined ? { unit_price: unitPrice } : {}),
      },
    })

    res.json(result)
  } catch (error: any) {
    console.error("[AddFee] Failed:", error.message)
    res.status(500).json({
      message: error.message || "Failed to add fee to cart",
    })
  }
}
