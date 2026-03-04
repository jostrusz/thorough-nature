/**
 * Generate a URL-safe slug from a title.
 * Handles CZ, SK, PL, NL, DE, SE, HU, DK diacritics.
 */
export function generateSlug(title: string): string {
  let slug = title

  // Special character replacements before NFD normalization
  const specialChars: Record<string, string> = {
    "\u0142": "l", // ł
    "\u0141": "L", // Ł
    "\u00DF": "ss", // ß
    "\u0111": "d", // đ
    "\u0110": "D", // Đ
    "\u00F8": "o", // ø
    "\u00D8": "O", // Ø
    "\u00E6": "ae", // æ
    "\u00C6": "AE", // Æ
  }

  for (const [char, replacement] of Object.entries(specialChars)) {
    slug = slug.replace(new RegExp(char, "g"), replacement)
  }

  // Normalize and strip combining diacritical marks
  slug = slug.normalize("NFD").replace(/[\u0300-\u036f]/g, "")

  // Lowercase
  slug = slug.toLowerCase()

  // Replace non-alphanumeric with hyphens
  slug = slug.replace(/[^a-z0-9]+/g, "-")

  // Collapse multiple hyphens
  slug = slug.replace(/-{2,}/g, "-")

  // Trim leading/trailing hyphens
  slug = slug.replace(/^-|-$/g, "")

  // Max 80 characters (cut on word boundary)
  if (slug.length > 80) {
    slug = slug.substring(0, 80)
    const lastHyphen = slug.lastIndexOf("-")
    if (lastHyphen > 40) {
      slug = slug.substring(0, lastHyphen)
    }
  }

  return slug
}
