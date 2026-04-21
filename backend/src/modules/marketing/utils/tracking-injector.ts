import { signToken } from "./tokens"

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000
const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000

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
  /** UTM campaign — typically campaign slug or `flow_<slug>_<node_id>`. */
  utmCampaign?: string
  /** UTM medium — default "marketing". */
  utmMedium?: string
  /** UTM source — default "email". */
  utmSource?: string
}

const SKIP_HREF_PREFIXES = [
  "mailto:",
  "tel:",
  "sms:",
  "javascript:",
  "data:",
  "#",
  "{{",   // Liquid / Handlebars placeholder
  "{$",   // PHP / Resend-style placeholder
  "${",   // JS template-literal placeholder
  "<%",   // ERB / EJS placeholder
]

// Any URL that contains an unresolved template placeholder anywhere in its
// body (not just prefix) should be skipped — otherwise we wrap a broken URL
// into our tracker, and the customer gets a redirect to junk.
const UNRESOLVED_PATTERNS = [/\{\{/, /\{\$/, /\$\{/, /<%/]

function isTrackableHref(href: string): boolean {
  if (!href) return false
  const lower = href.trim().toLowerCase()
  if (SKIP_HREF_PREFIXES.some((p) => lower.startsWith(p))) return false
  if (UNRESOLVED_PATTERNS.some((re) => re.test(href))) return false
  return true
}

/** Return a tracked URL for a given target. */
export function buildClickUrl(
  targetUrl: string,
  opts: { messageId: string; brandId: string; baseUrl: string; linkLabel?: string }
): string {
  const token = signToken({
    t: "click",
    u: targetUrl,
    m: opts.messageId,
    b: opts.brandId,
    ...(opts.linkLabel ? { l: opts.linkLabel } : {}),
    exp: Date.now() + NINETY_DAYS_MS,
  })
  const base = opts.baseUrl.replace(/\/+$/, "")
  return `${base}/public/marketing/c/${token}`
}

/**
 * Append UTM parameters to a URL. Preserves any existing utm_* values the
 * author already set manually. Skips non-http(s) URLs and any URL whose host
 * matches "utm_ignored" hints (mailto, tel handled earlier by isTrackableHref).
 */
function appendUtm(
  targetUrl: string,
  utm: { source?: string; medium?: string; campaign?: string; content?: string; term?: string }
): string {
  try {
    const u = new URL(targetUrl)
    if (u.protocol !== "http:" && u.protocol !== "https:") return targetUrl
    const setIfAbsent = (k: string, v?: string) => {
      if (!v) return
      if (!u.searchParams.has(k)) u.searchParams.set(k, v)
    }
    setIfAbsent("utm_source", utm.source)
    setIfAbsent("utm_medium", utm.medium)
    setIfAbsent("utm_campaign", utm.campaign)
    setIfAbsent("utm_content", utm.content)
    setIfAbsent("utm_term", utm.term)
    return u.toString()
  } catch {
    return targetUrl
  }
}

/** Build the open-pixel URL. */
export function buildOpenPixelUrl(opts: { messageId: string; brandId: string; baseUrl: string }): string {
  // NOTE: the existing /public/marketing/o/[token] route verifies with type "pixel"
  const token = signToken({
    t: "pixel",
    m: opts.messageId,
    b: opts.brandId,
    exp: Date.now() + NINETY_DAYS_MS,
  })
  const base = opts.baseUrl.replace(/\/+$/, "")
  return `${base}/public/marketing/o/${token}`
}

/** Build the "view email in browser" URL for a given message. */
export function buildViewInBrowserUrl(opts: {
  messageId: string
  brandId: string
  baseUrl: string
}): string {
  const token = signToken({
    t: "view",
    m: opts.messageId,
    b: opts.brandId,
    exp: Date.now() + ONE_YEAR_MS,
  })
  const base = opts.baseUrl.replace(/\/+$/, "")
  return `${base}/public/marketing/view/${token}`
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
    exp: Date.now() + ONE_YEAR_MS,
  })
  const base = opts.baseUrl.replace(/\/+$/, "")
  return `${base}/public/marketing/u/${token}`
}

/**
 * Extract the `data-link-label="…"` attribute value from an anchor tag's
 * attribute string (combined pre + post fragments of the regex match).
 * Returns the raw label or null.
 */
function extractLinkLabel(attrs: string): string | null {
  const m = attrs.match(/\bdata-link-label\s*=\s*(["'])(.*?)\1/i)
  return m ? m[2].trim() || null : null
}

/**
 * Replace every trackable <a href="..."> with our click-tracking URL.
 * Preserves original attributes and inner HTML. Before signing, the target
 * URL gets UTM params appended so downstream analytics (GA / Plausible /
 * Meta) can attribute the click to this campaign/flow.
 */
function rewriteLinks(html: string, opts: InjectOptions): string {
  const utmDefaults = {
    source: opts.utmSource || "email",
    medium: opts.utmMedium || "marketing",
    campaign: opts.utmCampaign,
    content: opts.messageId,
  }

  let linkIndex = 0
  return html.replace(/<a\b([^>]*?)href\s*=\s*(["'])(.*?)\2([^>]*)>/gi, (full, pre, quote, href, post) => {
    if (!isTrackableHref(href)) return full
    // Don't re-wrap if it's already our tracker
    try {
      const u = new URL(href, opts.baseUrl)
      if (u.pathname.startsWith("/public/marketing/")) return full
    } catch {
      // relative URL or invalid — treat as trackable
    }
    linkIndex++
    const label = extractLinkLabel(pre + " " + post) || `link_${linkIndex}`
    const urlWithUtm = appendUtm(href, { ...utmDefaults, term: label })
    const tracked = buildClickUrl(urlWithUtm, { ...opts, linkLabel: label })
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
