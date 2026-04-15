/**
 * Loslatenboek bundle variants:
 *   LLWJK-1 / LLWJK-2 / LLWJK-3 / LLWJK-4  → 1/2/3/4 physical books
 *
 * Sold as ONE line item with quantity=1 but represents N books. Display
 * surfaces (cart, thank-you page, emails) need to show the real book count,
 * otherwise the customer sees "1x" even though multiple books are shipped.
 */

const LLWJK_BUNDLE_RE = /^LLWJK-([1-4])$/i

export function getBundleBookCount(
  sku: string | null | undefined,
  lineQuantity: number = 1
): number | null {
  if (!sku) return null
  const m = LLWJK_BUNDLE_RE.exec(sku)
  if (!m) return null
  return parseInt(m[1], 10) * Math.max(1, lineQuantity)
}

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
