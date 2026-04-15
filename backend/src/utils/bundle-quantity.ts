/**
 * Loslatenboek bundle variants:
 *   LLWJK-1, LLWJK-2, LLWJK-3, LLWJK-4  → 1/2/3/4 physical books
 *
 * Each bundle is sold as one line item (quantity=1) but represents N physical
 * copies. Warehouse uses this mapping to ship correct number of books; display
 * surfaces (emails, thank-you page) must use it too, otherwise the customer
 * sees "Aantal: 1" even though they ordered multiple books.
 */

const LLWJK_BUNDLE_RE = /^LLWJK-([1-4])$/i

/**
 * If the SKU is a Loslatenboek bundle, returns the physical book count
 * (multiplied by line item quantity). Otherwise returns null — caller should
 * fall back to regular line item quantity.
 */
export function getBundleBookCount(
  sku: string | null | undefined,
  lineQuantity: number = 1
): number | null {
  if (!sku) return null
  const m = LLWJK_BUNDLE_RE.exec(sku)
  if (!m) return null
  const perBundle = parseInt(m[1], 10)
  return perBundle * Math.max(1, lineQuantity)
}

/**
 * Localized "N books" label for a bundle. Returns null for non-bundle SKUs.
 * Locale: nl (default), de, en.
 */
export function getBundleBookLabel(
  sku: string | null | undefined,
  lineQuantity: number = 1,
  locale: "nl" | "de" | "en" = "nl"
): string | null {
  const count = getBundleBookCount(sku, lineQuantity)
  if (count == null) return null
  if (locale === "de") return count === 1 ? "1 Buch" : `${count} Bücher`
  if (locale === "en") return count === 1 ? "1 book" : `${count} books`
  return count === 1 ? "1 boek" : `${count} boeken`
}
