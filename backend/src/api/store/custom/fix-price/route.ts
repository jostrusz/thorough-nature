import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows"

/**
 * POST /store/custom/fix-price
 * Temporary one-time endpoint to fix missing variant prices.
 * DELETE THIS ROUTE AFTER USE.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

    // Find the kocici-bible product
    const { data: products } = await query.graph({
      entity: "product",
      fields: ["id", "handle", "variants.id", "variants.sku", "variants.prices.*"],
      filters: { handle: "kocici-bible" },
    })

    if (!products.length) {
      res.json({ success: false, error: "Product kocici-bible not found" })
      return
    }

    const product = products[0]
    const variant = product.variants?.[0]

    if (!variant) {
      res.json({ success: false, error: "No variant found" })
      return
    }

    // Check existing prices
    const existingPrices = variant.prices || []
    console.log(`[FixPrice] Product: ${product.id}, Variant: ${variant.id}`)
    console.log(`[FixPrice] Existing prices:`, JSON.stringify(existingPrices))

    // Update variant with price using workflow
    const { result } = await updateProductsWorkflow(req.scope).run({
      input: {
        products: [{
          id: product.id,
          variants: [{
            id: variant.id,
            prices: [
              { amount: 550, currency_code: "czk" },
            ],
          }],
        }],
      },
    })

    // Also fix psi-superzivot if needed
    const { data: mainProducts } = await query.graph({
      entity: "product",
      fields: ["id", "handle", "variants.id", "variants.prices.*"],
      filters: { handle: "psi-superzivot" },
    })

    let mainFixed = false
    if (mainProducts.length) {
      const mainProduct = mainProducts[0]
      const mainVariant = mainProduct.variants?.[0]
      if (mainVariant) {
        const mainPrices = mainVariant.prices || []
        console.log(`[FixPrice] Main product prices:`, JSON.stringify(mainPrices))
        if (!mainPrices.length || !mainPrices.some((p: any) => p.currency_code === "czk")) {
          await updateProductsWorkflow(req.scope).run({
            input: {
              products: [{
                id: mainProduct.id,
                variants: [{
                  id: mainVariant.id,
                  prices: [{ amount: 550, currency_code: "czk" }],
                }],
              }],
            },
          })
          mainFixed = true
        }
      }
    }

    res.json({
      success: true,
      kocici_bible: {
        productId: product.id,
        variantId: variant.id,
        price_set: "550 CZK",
      },
      psi_superzivot_fixed: mainFixed,
    })
  } catch (error: any) {
    console.error("[FixPrice] Error:", error.message)
    res.status(500).json({ success: false, error: error.message })
  }
}
