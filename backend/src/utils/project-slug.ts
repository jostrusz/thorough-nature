// @ts-nocheck
/**
 * Canonical form of a project identifier.
 *
 * Everything downstream (WMS routing, Fakturoid config lookup, ads library)
 * compares project ids with an exact string match, so a single display name
 * that slips into project_config poisons the whole chain. That happened live:
 * the NO sales channel carried `project_slug = "Slipp taket"` instead of
 * `slipp-taket`, and three paid orders ended up with no invoice, no order
 * number and (for one of them) no warehouse job at all.
 *
 * Slugifying on read makes a typo like that harmless: "Slipp taket",
 * "SLIPP TAKET" and "Slipp  Taket" all collapse to "slipp-taket", while an
 * already-correct slug passes through untouched.
 */
export function normalizeProjectSlug(value: any): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics (Släpp -> Slapp)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}
