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
 * Bundle pricing map: product_handle → { qty → total price in major units }
 * This is the server-side source of truth for bundle discounts.
 * Keyed by product HANDLE (environment-agnostic — same on staging + production).
 *
 * IMPORTANT: These prices are TAX-INCLUSIVE (final customer price).
 * The workflow sets is_tax_inclusive=true on line items so Medusa
 * extracts tax from within the price instead of adding it on top.
 */
const BUNDLE_PRICING: Record<string, Record<number, number>> = {
  // Lass Los Buch — "Lass los, was dich kaputt macht" (DE/AT/LU)
  "lass-los-was-dich-kaputt-macht": {
    1: 35,    // €35.00 incl. tax
    2: 59,    // €59.00 incl. tax (save €11)
    3: 79,    // €79.00 incl. tax (save €26)
    4: 99,    // €99.00 incl. tax (save €41)
  },
  // Loslatenboek — "Laat Los Wat Je Kapotmaakt"
  "laat-los-wat-je-kapotmaakt": {
    1: 35,    // €35.00 incl. tax
    2: 59,    // €59.00 incl. tax (save €11)
    3: 79,    // €79.00 incl. tax (save €26)
    4: 99,    // €99.00 incl. tax (save €41)
  },
  // Dehondenbijbel — "De Hondenbijbel"
  "de-hondenbijbel": {
    1: 35,    // €35.00 incl. tax
    2: 59,    // €59.00 incl. tax (save €11)
    3: 79,    // €79.00 incl. tax (save €26)
    4: 99,    // €99.00 incl. tax (save €41)
  },
  // DH Upsell — "Laat Los Wat Je Kapotmaakt (DH Upsell)"
  "laat-los-wat-je-kapotmaakt-dh": {
    1: 25,    // €25.00 incl. tax (upsell price, original €35)
  },
  // Loslatenboek Upsell — "Het Leven Dat Je Verdient"
  "het-leven-dat-je-verdient": {
    1: 23,    // €23.00 incl. tax (upsell price, original €36)
  },
  // Slapp Taget — "Släpp taget om det som förstör dig"
  "slapp-taget-om-det-som-forstor-dig": {
    1: 399,   // 399 kr incl. moms (6%)
    2: 699,   // 699 kr incl. moms (save 99 kr)
    3: 949,   // 949 kr incl. moms (save 248 kr)
    4: 1199,  // 1199 kr incl. moms (save 397 kr)
  },
  // Odpusc Ksiazka — "Odpuść to, co cię niszczy"
  "odpusc-to-co-cie-niszczy": {
    1: 129,   // 129 zł incl. VAT (23%)
    2: 199,   // 199 zł incl. VAT (save 39 zł)
    3: 279,   // 279 zł incl. VAT (save 78 zł)
    4: 359,   // 359 zł incl. VAT (save 117 zł)
  },
  // Psí superživot — hlavní produkt CZ
  "psi-superzivot": {
    1: 550,   // 550 Kč incl. DPH
    2: 899,   // 899 Kč incl. DPH (save 201 Kč)
    3: 1199,  // 1199 Kč incl. DPH (save 451 Kč)
    4: 1499,  // 1499 Kč incl. DPH (save 701 Kč)
  },
  // Kočičí bible — upsell produkt CZ
  "kocici-bible": {
    1: 399,   // 399 Kč incl. DPH (upsell price, original 550 Kč)
  },
  // Fee products (added as line items so they appear in order.total + invoices)
  "doprava-na-adresu": {
    1: 20,    // 20 Kč incl. DPH — home delivery surcharge
  },
  "priplatek-za-dobirku": {
    1: 30,    // 30 Kč incl. DPH — COD payment surcharge
  },
}

type AddBundleToCartInput = {
  cart_id: string
  variant_id: string
  quantity: number
}

/**
 * SKU-based bundle quantity map.
 * For projects using per-bundle variants (e.g. loslatenboek), the SKU encodes the bundle qty.
 * Pattern: BASE_SKU-{N} where N is the number of physical books.
 * Example: LLWJK-2 → bundle of 2 books → use BUNDLE_PRICING[handle][2]
 *
 * This is only used when quantity=1 and the SKU matches a known bundle pattern.
 * Other projects still send quantity > 1 and work as before.
 */
const BUNDLE_SKU_PATTERNS: RegExp[] = [
  /^LLWJK-(\d+)$/,   // loslatenboek: LLWJK-1, LLWJK-2, LLWJK-3, LLWJK-4
]

function extractBundleQtyFromSku(sku: string | null): number | null {
  if (!sku) return null
  for (const pattern of BUNDLE_SKU_PATTERNS) {
    const match = sku.match(pattern)
    if (match) return parseInt(match[1], 10)
  }
  return null
}

/**
 * Step: Calculate bundle unit price
 * Resolves product handle + SKU from variant_id, looks up bundle total, computes per-unit price.
 *
 * Two modes:
 * 1. Per-bundle variant (loslatenboek): quantity=1, SKU encodes bundle qty (LLWJK-2 → 2 books)
 *    → Price = BUNDLE_PRICING[handle][skuBundleQty], unitPrice = price (since qty=1)
 * 2. Legacy (other projects): quantity=N, single variant
 *    → Price = BUNDLE_PRICING[handle][N], unitPrice = price / N
 */
const calculateBundlePriceStep = createStep(
  "calculate-bundle-price",
  async (input: { variant_id: string; quantity: number }, { container }) => {
    const { variant_id, quantity } = input

    // Resolve product handle + SKU from variant_id
    const query = container.resolve("query") as any
    let productHandle: string | null = null
    let variantSku: string | null = null
    try {
      const { data: variants } = await query.graph({
        entity: "product_variant",
        fields: ["id", "sku", "product.handle"],
        filters: { id: variant_id },
      })
      productHandle = variants?.[0]?.product?.handle || null
      variantSku = variants?.[0]?.sku || null
    } catch {
      // Fallback: no handle found
    }

    if (productHandle) {
      const variantPricing = BUNDLE_PRICING[productHandle]
      if (variantPricing) {
        // Check if SKU encodes bundle quantity (per-bundle variant approach)
        const skuBundleQty = extractBundleQtyFromSku(variantSku)

        if (skuBundleQty && quantity === 1 && variantPricing[skuBundleQty] !== undefined) {
          // Per-bundle variant: SKU tells us the real bundle qty, quantity=1
          // Total price IS the unit price since we're adding 1 item
          const totalPrice = variantPricing[skuBundleQty]
          return new StepResponse(totalPrice)
        }

        if (variantPricing[quantity] !== undefined) {
          // Legacy mode: quantity encodes bundle qty
          const totalPrice = variantPricing[quantity]
          const unitPrice = totalPrice / quantity
          return new StepResponse(unitPrice)
        }
      }
    }

    // No bundle pricing — return null (use default variant price)
    return new StepResponse(null)
  }
)

/**
 * Workflow: Add bundle items to cart with custom pricing
 *
 * 1. Calculate bundle unit price
 * 2. Prepare item data (with unit_price + is_tax_inclusive)
 * 3. Acquire lock on cart
 * 4. Add items via addToCartWorkflow
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

    // Step 2: Prepare item data with optional unit_price + is_tax_inclusive
    const itemToAdd = transform(
      { input, bundleUnitPrice },
      (data) => {
        const item: any = {
          variant_id: data.input.variant_id,
          quantity: data.input.quantity,
        }
        if (data.bundleUnitPrice !== null) {
          item.unit_price = data.bundleUnitPrice
          // Bundle prices in BUNDLE_PRICING are tax-inclusive (final customer price).
          // Without this flag, Medusa treats custom unit_price as tax-exclusive
          // and adds tax on top (e.g. €99 → €107.91 instead of €99 incl. tax).
          // Note: region.is_tax_inclusive is stored via PricePreference model,
          // not directly on the region entity, so we can't query it via graph.
          item.is_tax_inclusive = true
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

    // Step 4: Add to cart (uses unit_price + is_tax_inclusive if provided)
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
