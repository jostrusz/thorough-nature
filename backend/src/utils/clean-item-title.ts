/**
 * Strips internal "upsell" markers from a product/line-item title before it is
 * shown to the customer in transactional emails.
 *
 * Post-purchase upsell products are named with an internal suffix so they can
 * be told apart in the catalog (e.g. a one-click upsell variant priced lower
 * than the standalone book). Those markers must never reach the customer — they
 * read like a technical label and make people think the second book isn't a
 * real part of their order (see ticket NL2026-12519).
 *
 * Examples:
 *   "Laat Los Wat Je Kapotmaakt - Upsell"    → "Laat Los Wat Je Kapotmaakt"
 *   "Het Leven Dat Je Verdient - Upsell"     → "Het Leven Dat Je Verdient"
 *   "Laat Los Wat Je Kapotmaakt (DH Upsell)" → "Laat Los Wat Je Kapotmaakt"
 *
 * Returns '' for empty input so callers can keep their own fallback string
 * (`cleanItemTitle(x) || 'Item'`).
 */
export function cleanItemTitle(title?: string | null): string {
  if (!title) return ''
  return String(title)
    // trailing parenthetical that mentions upsell, e.g. " (DH Upsell)"
    .replace(/\s*\([^)]*upsell[^)]*\)\s*$/i, '')
    // trailing " - Upsell" / " – Upsell" / " — Upsell" suffix
    .replace(/\s*[-–—]\s*upsell\s*$/i, '')
    .trim()
}
