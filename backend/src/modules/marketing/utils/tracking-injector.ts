import { signToken } from "./tokens"

/**
 * Tracking injector — post-processes compiled HTML to:
 *   1. Rewrite every <a href="..."> to go through our click tracker
 *   2. Append an invisible 1x1 pixel that hits our open tracker
 *
 * Tokens are HMAC-signed so the target URL can't be rewritten by recipients.
 *
 * We skip rewriting for:
 *   - mailto: / tel: / sms: links
 *   - anchor links (#…)
 *   - already-pointing-to-tracking-domain links (no double-wrap)
 *   - list-unsubscribe-style links (they have their own token)
 */

export type InjectOptions = {
  /** Marketing message ID (for attribution) */
  messageId: string
  /** Brand ID (for attribution) */
  brandId: string
  /** Public base URL where /public/marketing/* is served */
  baseUrl: string
  /** If true, disable link rewriting (e.g. transactional-mirror). */
  skipLinkRewrite?: boolean
  /** If true, don't inject open pixel. */
  skipOpenPixel?: boolean
}

const SKIP_HREF_PREFIXES = [
  "mailto:",
  "tel:",
  "sms:",
  "javascript:",
  "data:",
  "#",
  "{{", // unresolved template variable — don't wrap it
]

function isTrackableHref(href: string): boolean {
  if (!href) return false
  const lower = href.trim().toLowerCase()
  return !SKIP_HREF_PREFIXES.some((p) => lower.startsWith(p))
}

/** Return a tracked URL for a given target. */
export function buildClickUrl(
  targetUrl: string,
  opts: { messageId: string; brandId: string; baseUrl: string }
): string {
  const token = signToken({
    t: "click",
    u: targetUrl,
    m: opts.messageId,
    b: opts.brandId,
  })
  const base = opts.baseUrl.replace(/\/+$/, "")
  return `${base}/public/marketing/c/${token}`
}

/** Build the open-pixel URL. */
export function buildOpenPixelUrl(opts: { messageId: string; brandId: string; baseUrl: string }): string {
  // NOTE: the existing /public/marketing/o/[token] route verifies with type "pixel"
  const token = signToken({
    t: "pixel",
    m: opts.messageId,
    b: opts.brandId,
  })
  const base = opts.baseUrl.replace(/\/+$/, "")
  return `${base}/public/marketing/o/${token}`
}

/** Build the unsubscribe URL (used by compiler/footer). */
export function buildUnsubscribeUrl(opts: {
  contactId: string
  brandId: string
  baseUrl: string
}): string {
  const token = signToken({
    t: "unsub",
    c: opts.contactId,
    b: opts.brandId,
  })
  const base = opts.baseUrl.replace(/\/+$/, "")
  return `${base}/public/marketing/u/${token}`
}

/**
 * Replace every trackable <a href="..."> with our click-tracking URL.
 * Preserves original attributes and inner HTML.
 */
function rewriteLinks(html: string, opts: InjectOptions): string {
  return html.replace(/<a\b([^>]*?)href\s*=\s*(["'])(.*?)\2([^>]*)>/gi, (full, pre, quote, href, post) => {
    if (!isTrackableHref(href)) return full
    // Don't re-wrap if it's already our tracker
    try {
      const u = new URL(href, opts.baseUrl)
      if (u.pathname.startsWith("/public/marketing/")) return full
    } catch {
      // relative URL or invalid — treat as trackable
    }
    const tracked = buildClickUrl(href, opts)
    return `<a${pre}href=${quote}${tracked}${quote}${post}>`
  })
}

/** Inject an open-pixel at the end of the body. */
function injectOpenPixel(html: string, opts: InjectOptions): string {
  const pixelUrl = buildOpenPixelUrl(opts)
  const pixel = `<img src="${pixelUrl}" alt="" width="1" height="1" style="display:block;border:0;outline:0;width:1px;height:1px;opacity:0.01" />`
  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `${pixel}</body>`)
  }
  return html + pixel
}

/** Main entry: apply all tracking injections to compiled HTML. */
export function injectTracking(html: string, opts: InjectOptions): string {
  let out = html
  if (!opts.skipLinkRewrite) out = rewriteLinks(out, opts)
  if (!opts.skipOpenPixel) out = injectOpenPixel(out, opts)
  return out
}
