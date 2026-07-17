/**
 * Maps a bundle variant SKU to the number of physical books it represents.
 *
 * On the checkout, customers pick a bundle *variant* (1/2/3/4 books) that is a
 * single order line item with quantity = 1 and a variant SKU like "ZJN-2".
 * The raw line-item quantity (1) therefore does NOT reflect how many books the
 * customer actually bought, which is confusing in transactional emails
 * ("2 książki • Ilość: 1"). This map lets the templates show the real count.
 *
 * Keep the quantities in sync with BUNDLE_SKU_MAP in:
 *   - api/admin/dextrum/orders/[id]/send/route.ts
 *   - jobs/dextrum-order-hold.ts
 * Order-bump upsell SKUs (e.g. "OTCCN64787237-2") are intentionally NOT here:
 * they are genuine single books shown as their own line item (Ilość: 1).
 */
export const BUNDLE_BOOK_COUNT: Record<string, number> = {
  "LLWJK-1": 1, "LLWJK-2": 2, "LLWJK-3": 3, "LLWJK-4": 4,
  "HLDV-1": 1, "HLDV-2": 2, "HLDV-3": 3, "HLDV-4": 4,
  "ZJN-1": 1, "ZJN-2": 2, "ZJN-3": 3, "ZJN-4": 4,
  // Život, jaký si zasloužíš (CZ). Pozor: varianta "1 kniha" nese v Meduse rovnou
  // fyzické SKU ZJSZ9827982789, ne "ZKZ-1" — a záměrně tu není. Bez záznamu spadne
  // displayBookQty na line quantity (=1), což je správně, a e-mail navíc ukáže
  // popisek "1 kniha • Množství: 1". "ZKZ-1" zůstává pro případ přeseedování.
  "ZKZ-1": 1, "ZKZ-2": 2, "ZKZ-3": 3, "ZKZ-4": 4,
}

function skuOf(item: any): string | undefined {
  return item?.variant_sku || item?.variant?.sku || undefined
}

/**
 * Number of books to display for an order line item:
 * (books per bundle) × line quantity for known bundles, else the raw quantity.
 */
export function displayBookQty(item: any): number {
  const sku = skuOf(item)
  const perBundle = sku ? BUNDLE_BOOK_COUNT[sku] : undefined
  const qty = item?.quantity || 1
  return perBundle ? perBundle * qty : qty
}

/**
 * True when the line item is a recognized multi-book bundle, so callers can
 * drop the now-redundant variant label (e.g. "2 książki") and just show count.
 */
export function isBookBundle(item: any): boolean {
  const sku = skuOf(item)
  return !!(sku && BUNDLE_BOOK_COUNT[sku] != null)
}
