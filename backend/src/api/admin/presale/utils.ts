// @ts-nocheck
import Anthropic from "@anthropic-ai/sdk"

/**
 * Generate a URL-safe slug from a title.
 * Handles CZ, SK, PL, NL, DE, SE, HU, DK, NO diacritics.
 */
export function generateSlug(title: string): string {
  let slug = title || ""

  const specialChars: Record<string, string> = {
    "ł": "l", // ł
    "Ł": "L", // Ł
    "ß": "ss", // ß
    "đ": "d", // đ
    "Đ": "D", // Đ
    "ø": "o", // ø
    "Ø": "O", // Ø
    "æ": "ae", // æ
    "Æ": "AE", // Æ
  }
  for (const [char, replacement] of Object.entries(specialChars)) {
    slug = slug.replace(new RegExp(char, "g"), replacement)
  }

  slug = slug.normalize("NFD").replace(/[̀-ͯ]/g, "")
  slug = slug.toLowerCase()
  slug = slug.replace(/[^a-z0-9]+/g, "-")
  slug = slug.replace(/-{2,}/g, "-")
  slug = slug.replace(/^-|-$/g, "")

  if (slug.length > 80) {
    slug = slug.substring(0, 80)
    const lastHyphen = slug.lastIndexOf("-")
    if (lastHyphen > 40) slug = slug.substring(0, lastHyphen)
  }

  return slug
}

/**
 * Whitelist of client-editable columns. Anything outside this list
 * (id, view_count, created_at, …) can never be mass-assigned.
 */
export const ALLOWED_FIELDS = [
  "domain",
  "slug",
  "title",
  "title_cs",
  "type",
  "html_content",
  "meta_title",
  "meta_description",
  "og_image_url",
  "facebook_pixel_id",
  "status",
  "publish_at",
] as const

export function pickAllowed(body: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {}
  if (!body || typeof body !== "object") return out
  for (const key of ALLOWED_FIELDS) {
    if (body[key] !== undefined) out[key] = body[key]
  }
  return out
}

/** Detect a Postgres unique-constraint violation so we can return 409, not 500. */
export function isUniqueViolation(error: any): boolean {
  if (!error) return false
  return (
    error.code === "23505" ||
    /duplicate key|idx_presale_page_domain_slug/i.test(error.message || "")
  )
}

/** Snapshot the editable fields of a page for the revision history. */
export function buildSnapshot(page: Record<string, any>): string {
  return JSON.stringify({
    domain: page.domain,
    slug: page.slug,
    title: page.title,
    title_cs: page.title_cs,
    type: page.type,
    html_content: page.html_content,
    meta_title: page.meta_title,
    meta_description: page.meta_description,
    og_image_url: page.og_image_url,
    facebook_pixel_id: page.facebook_pixel_id,
    status: page.status,
  })
}

/**
 * Translate a marketing headline using Anthropic (Haiku by default).
 * Uses the same ANTHROPIC_API_KEY the marketing AI already uses.
 */
export async function translateHeadline(
  title: string,
  targetLang = "cs"
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured")
  if (!title || !title.trim()) return ""

  const client = new Anthropic({ apiKey })
  const langNames: Record<string, string> = {
    cs: "Czech",
    en: "English",
    nl: "Dutch",
    de: "German",
    pl: "Polish",
    sv: "Swedish",
    no: "Norwegian",
  }
  const langName = langNames[targetLang] || targetLang

  const resp = await client.messages.create({
    model: process.env.PRESALE_AI_MODEL || "claude-haiku-4-5-20251001",
    max_tokens: 300,
    messages: [
      {
        role: "user",
        content:
          `Translate this marketing/advertorial headline to ${langName}. ` +
          `Keep it punchy and natural, preserve the emotional hook — do not translate literally. ` +
          `Return ONLY the translated headline, with no quotes and no explanation.\n\n` +
          `Headline: ${title}`,
      },
    ],
  })

  const block = resp.content?.[0]
  const text = block && block.type === "text" ? block.text : ""
  return text.trim()
}
