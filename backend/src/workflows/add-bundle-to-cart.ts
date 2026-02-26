// @ts-nocheck
import {
  createWorkflow,
  createStep,
  StepResponse,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import {
  addToCartWorkflow,
  acquireLockStep,
  releaseLockStep,
  useQueryGraphStep,
} from "@medusajs/medusa/core-flows"

/**
 * Bundle pricing map: variant_id → { qty → total price in major units }
 * This is the server-side source of truth for bundle discounts.
 *
 * To add a new project's bundle pricing, add a new entry here keyed by variant_id.
 */
const BUNDLE_PRICING: Record<string, Record<number, number>> = {
  // Loslatenboek — "Laat Los Wat Je Kapotmaakt"
  "variant_01KJ9YQH8CA1DR2A77HNQ5AZTQ": {
    1: 35,    // €35.00
    2: 59,    // €59.00 (save €11)
    3: 79,    // €79.00 (save €26)
    4: 99,    // €99.00 (save €41)
  },
}

type AddBundleToCartInput = {
  cart_id: string
  variant_id: string
  quantity: number
}

/**
 * Step: Calculate bundle unit price
 * Looks up bundle total for the variant+qty, then computes per-unit price.
 */
const calculateBundlePriceStep = createStep(
  "calculate-bundle-price",
  async (input: { variant_id: string; quantity: number }) => {
    const { variant_id, quantity } = input
    const variantPricing = BUNDLE_PRICING[variant_id]

    if (variantPricing && variantPricing[quantity] !== undefined) {
      // Bundle price found — compute per-unit price
      const totalPrice = variantPricing[quantity]
      const unitPrice = totalPrice / quantity
      return new StepResponse(unitPrice)
    }

    // No bundle pricing — return null (use default variant price)
    return new StepResponse(null)
  }
)

/**
 * Workflow: Add bundle items to cart with custom pricing
 *
 * 1. Retrieve cart to get currency
 * 2. Calculate bundle unit price
 * 3. Acquire lock on cart
 * 4. Add items via addToCartWorkflow (with optional unit_price override)
 * 5. Refetch cart
 * 6. Release lock
 */
export const addBundleToCartWorkflow = createWorkflow(
  "add-bundle-to-cart",
  function (input: AddBundleToCartInput) {
    // Step 1: Calculate the bundle unit price
    const bundleUnitPrice = calculateBundlePriceStep({
      variant_id: input.variant_id,
      quantity: input.quantity,
    })

    // Step 2: Prepare item data with optional unit_price
    const itemToAdd = transform(
      { input, bundleUnitPrice },
      (data) => {
        const item: any = {
          variant_id: data.input.variant_id,
          quantity: data.input.quantity,
        }
        if (data.bundleUnitPrice !== null) {
          item.unit_price = data.bundleUnitPrice
        }
        return [item]
      }
    )

    // Step 3: Acquire lock on cart
    acquireLockStep({
      key: input.cart_id,
      timeout: 2,
      ttl: 10,
    })

    // Step 4: Add to cart (uses unit_price if provided)
    addToCartWorkflow.runAsStep({
      input: {
        cart_id: input.cart_id,
        items: itemToAdd,
      },
    })

    // Step 5: Refetch the updated cart
    const { data: updatedCarts } = useQueryGraphStep({
      entity: "cart",
      filters: { id: input.cart_id },
      fields: ["id", "items.*"],
    }).config({ name: "refetch-cart" })

    // Step 6: Release the lock
    releaseLockStep({
      key: input.cart_id,
    })

    return new WorkflowResponse({
      cart: updatedCarts[0],
    })
  }
)
