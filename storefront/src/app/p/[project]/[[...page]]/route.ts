import { NextRequest, NextResponse } from "next/server"
import fs from "fs"
import path from "path"
import { gzipSync } from "zlib"
import { getProjectBySlug, ProjectConfig } from "@lib/projects"

// MIME types for static assets served from project pages folder
const STATIC_MIME_TYPES: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".eot": "application/vnd.ms-fontobject",
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ project: string; page?: string[] }> }
) {
  const { project: projectSlug, page } = await params

  const config = getProjectBySlug(projectSlug)
  if (!config) {
    return new NextResponse("Project not found", { status: 404 })
  }

  // Check if this is a request for a static asset (CSS, JS, images, fonts)
  const requestedPath = page?.join("/") || ""
  const ext = path.extname(requestedPath).toLowerCase()
  if (ext && ext !== ".html" && STATIC_MIME_TYPES[ext]) {
    const pagesDir = path.join(process.cwd(), "src", "projects", projectSlug, "pages")
    const assetPath = path.join(pagesDir, requestedPath)
    // Prevent directory traversal
    const resolvedAsset = path.resolve(assetPath)
    const inProjectDir = resolvedAsset.startsWith(pagesDir) && fs.existsSync(assetPath)

    // Fallback: if not in project dir, try public/ folder (for /images/, /icons/, logos etc.)
    const publicDir = path.join(process.cwd(), "public")
    const publicPath = path.join(publicDir, requestedPath)
    const resolvedPublic = path.resolve(publicPath)
    const inPublicDir = !inProjectDir && resolvedPublic.startsWith(publicDir) && fs.existsSync(publicPath)

    if (!inProjectDir && !inPublicDir) {
      return new NextResponse("Not found", { status: 404 })
    }
    const content = fs.readFileSync(inProjectDir ? assetPath : publicPath)
    // Fonts are immutable — cache 1 year; CSS/JS 1 hour; images 1 day
    const isFont = [".woff", ".woff2", ".ttf", ".eot"].includes(ext)
    const isCode = [".css", ".js"].includes(ext)
    const isCompressible = [".css", ".js", ".json", ".svg"].includes(ext)
    const cacheControl = isFont
      ? "public, max-age=31536000, immutable"
      : isCode
        ? "public, max-age=3600, s-maxage=3600"
        : "public, max-age=86400, s-maxage=604800"
    // Gzip text-based assets for faster transfer
    const acceptEncoding = request.headers.get("accept-encoding") || ""
    const useGzip = isCompressible && acceptEncoding.includes("gzip")
    const body = useGzip ? gzipSync(content) : content
    const headers: Record<string, string> = {
      "Content-Type": STATIC_MIME_TYPES[ext],
      "Cache-Control": cacheControl,
    }
    if (useGzip) headers["Content-Encoding"] = "gzip"
    return new NextResponse(body, { status: 200, headers })
  }

  // Resolve page name: /p/loslatenboek -> "", /p/loslatenboek/checkout -> "checkout"
  let pageName = page?.join("/") || ""

  // Strip .html extension if present (links in HTML use "checkout.html")
  pageName = pageName.replace(/\.html$/, "")

  // Look up the HTML filename
  const htmlFile = config.pages[pageName]
  if (!htmlFile) {
    // Fallback: check for advertorial page in database
    // For multi-segment paths (e.g. "prefix/slug"), use last segment as advertorial slug
    const segments = pageName.split("/").filter(Boolean)
    const advertorialSlug = segments[segments.length - 1] || pageName
    const advertorial = await fetchAdvertorial(config, advertorialSlug)
    if (advertorial) {
      return serveAdvertorial(request, config, advertorial)
    }
    return new NextResponse("Page not found", { status: 404 })
  }

  const filePath = path.join(process.cwd(), "src", "projects", projectSlug, "pages", htmlFile)
  if (!fs.existsSync(filePath)) {
    return new NextResponse("Page file not found", { status: 404 })
  }

  let html = fs.readFileSync(filePath, "utf-8")

  // Determine base path for links
  const isCustomDomain = request.headers.get("x-project-domain") === "true"
  const basePath = isCustomDomain ? "" : `/p/${projectSlug}`

  // Inject <base> tag so relative URLs (style.css, images) resolve correctly
  // Without this, /p/loslatenboek resolves "style.css" to /p/style.css instead of /p/loslatenboek/style.css
  html = html.replace(
    /<head([^>]*)>/i,
    `<head$1><base href="${basePath}/">`
  )

  // Resolve product/region IDs dynamically from Medusa API (handles are env-agnostic, IDs differ per env)
  await resolveProductIds(config)

  // Fetch project settings (order bump / upsell toggles) from backend
  const projectToggles = await fetchProjectSettings(config)

  // Inject PROJECT_CONFIG (replace external script reference)
  html = html.replace(
    /<script\s+src=["']js\/project-config\.js["'][^>]*><\/script>/gi,
    generateProjectConfigScript(config, basePath, projectToggles)
  )

  // Fetch pixel_id dynamically from backend admin settings (source of truth)
  const pixelId = await fetchPixelId(config)

  // Inject Facebook Pixel + CAPI tracking library (replace external script reference)
  html = html.replace(
    /<script\s+src=["']js\/pixel\.js["'][^>]*><\/script>/gi,
    generatePixelScript(config, pixelId)
  )

  // Inject analytics tracking script before </body>
  html = html.replace(
    /<\/body>/i,
    generateAnalyticsScript(config) + "\n</body>"
  )

  // Rewrite internal .html links to clean URLs with correct base path
  html = rewriteLinks(html, basePath, config)

  // Gzip HTML for faster transfer
  const acceptGzip = (request.headers.get("accept-encoding") || "").includes("gzip")
  const htmlBody = acceptGzip ? gzipSync(Buffer.from(html, "utf-8")) : html
  const htmlHeaders: Record<string, string> = {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "public, max-age=60, s-maxage=300",
  }
  if (acceptGzip) htmlHeaders["Content-Encoding"] = "gzip"
  return new NextResponse(htmlBody, { status: 200, headers: htmlHeaders })
}

/**
 * Resolve product IDs, variant IDs, region IDs, and publishable API key
 * dynamically from the Medusa API using product handles.
 * This makes config.json environment-agnostic (same handles work on staging + production).
 */
async function resolveProductIds(config: ProjectConfig): Promise<void> {
  try {
    const baseUrl = config.medusaUrl

    // 1. Resolve publishable API key by matching project's sales channel name
    // Each project has its own sales channel + publishable key — the global env var only covers Default Sales Channel
    // Re-resolve every 5 minutes to pick up admin changes without server restart
    const now = Date.now()
    const keyAge = now - ((config as any)._resolvedKeyAt || 0)
    if (config.salesChannelName && keyAge > 300_000) {
      try {
        const keyRes = await fetch(
          `${baseUrl}/project-key/${encodeURIComponent(config.salesChannelName)}`,
          { next: { revalidate: 300 } }
        )
        if (keyRes.ok) {
          const data = await keyRes.json()
          if (data.token) {
            config.publishableApiKey = data.token
            ;(config as any)._resolvedKeyAt = now
          }
        }
      } catch {
        // Backend unavailable — keep existing key from env var
      }
      if (!config.publishableApiKey) {
        config.publishableApiKey = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || ""
      }
    }

    const headers: Record<string, string> = {
      "x-publishable-api-key": config.publishableApiKey,
    }

    // 2. Resolve main product variant ID from handle
    if (config.mainProduct?.handle) {
      try {
        const res = await fetch(
          `${baseUrl}/store/products?handle=${config.mainProduct.handle}&fields=id,variants.id,variants.title,thumbnail,images`,
          { headers, next: { revalidate: 60 } }
        )
        if (res.ok) {
          const data = await res.json()
          const product = data.products?.[0]
          if (product) {
            config.mainProduct.variantId = product.variants?.[0]?.id || config.mainProduct.variantId
            if (product.thumbnail) config.mainProduct.thumbnail = product.thumbnail
          }
        }
      } catch (err) {
        console.warn("[resolveProductIds] Failed to resolve main product:", err)
      }
    }

    // 3. Resolve upsell product variant ID from handle
    if (config.upsellProduct?.handle) {
      try {
        const res = await fetch(
          `${baseUrl}/store/products?handle=${config.upsellProduct.handle}&fields=id,variants.id,variants.title`,
          { headers, next: { revalidate: 60 } }
        )
        if (res.ok) {
          const data = await res.json()
          const product = data.products?.[0]
          if (product) {
            config.upsellProduct.variantId = product.variants?.[0]?.id || config.upsellProduct.variantId
          }
        }
      } catch (err) {
        console.warn("[resolveProductIds] Failed to resolve upsell product:", err)
      }
    }

    // 4. Resolve region ID for default country
    if (config.defaultCountry) {
      try {
        const res = await fetch(`${baseUrl}/store/regions`, {
          headers, next: { revalidate: 300 },
        })
        if (res.ok) {
          const data = await res.json()
          const regions = data.regions || []
          for (const region of regions) {
            const countryCodes = (region.countries || []).map((c: any) => c.iso_2?.toLowerCase())
            if (countryCodes.includes(config.defaultCountry.toLowerCase())) {
              // Update all region mappings
              for (const key of Object.keys(config.regions)) {
                if (countryCodes.includes(key.toLowerCase())) {
                  config.regions[key] = region.id
                }
              }
              break
            }
          }
        }
      } catch (err) {
        console.warn("[resolveProductIds] Failed to resolve regions:", err)
      }
    }
  } catch (err) {
    console.warn("[resolveProductIds] Failed to resolve product IDs:", err)
  }
}

/**
 * Fetch pixel_id from backend admin API (source of truth).
 * Falls back to config.json facebookPixelId if backend is unreachable.
 * Result is cached per-request (Next.js fetch cache handles dedup).
 */
async function fetchPixelId(config: ProjectConfig): Promise<string> {
  try {
    const url = `${config.medusaUrl}/store/meta-pixel-config/${config.slug}`
    const res = await fetch(url, {
      headers: {
        "x-publishable-api-key": config.publishableApiKey || "",
      },
      next: { revalidate: 60 }, // Cache for 60s on server
    })

    if (res.ok) {
      const data = await res.json()
      if (data.enabled && data.pixel_id) {
        return data.pixel_id
      }
      // Pixel disabled in admin — return empty to skip injection
      if (data.enabled === false) {
        return ""
      }
    }
  } catch (e) {
    // Backend unreachable — fall through to config.json
    console.warn(`[Pixel] Failed to fetch pixel config from backend for ${config.slug}:`, e)
  }

  // Fallback: use static config.json value
  return config.facebookPixelId || ""
}

/**
 * Fetch project settings (order bump / upsell toggles) from backend.
 * Falls back to defaults (both enabled) if backend is unreachable.
 */
async function fetchProjectSettings(config: ProjectConfig): Promise<ProjectToggles> {
  try {
    const url = `${config.medusaUrl}/store/project-settings?project_id=${config.slug}`
    const res = await fetch(url, {
      headers: {
        "x-publishable-api-key": config.publishableApiKey || "",
      },
      next: { revalidate: 30 }, // Cache for 30s on server
    })

    if (res.ok) {
      const data = await res.json()
      if (data.project_setting) {
        return {
          orderBumpEnabled: data.project_setting.order_bump_enabled !== false,
          upsellEnabled: data.project_setting.upsell_enabled !== false,
          foxentryApiKey: data.project_setting.foxentry_api_key || null,
        }
      }
    }
  } catch (e) {
    console.warn(`[ProjectSettings] Failed to fetch for ${config.slug}:`, e)
  }

  // Defaults: everything enabled
  return { orderBumpEnabled: true, upsellEnabled: true, foxentryApiKey: null }
}

interface ProjectToggles {
  orderBumpEnabled: boolean
  upsellEnabled: boolean
  foxentryApiKey: string | null
}

/* ═══════════════════════════════════════════════════════════════════
 * ADVERTORIAL PAGE HELPERS
 * Fetch advertorial pages from the database and serve them with
 * Facebook Pixel + Analytics injection.
 * ═══════════════════════════════════════════════════════════════════ */

interface AdvertorialPage {
  id: string
  title: string
  slug: string
  url_prefix: string | null
  html_content: string
  meta_title: string | null
  meta_description: string | null
  og_image_url: string | null
  facebook_pixel_id: string | null
}

/**
 * Fetch a published advertorial page from the Medusa backend.
 * Returns the page data or null if not found / draft.
 * Cached for 60s via Next.js fetch cache.
 */
async function fetchAdvertorial(
  config: ProjectConfig,
  slug: string
): Promise<AdvertorialPage | null> {
  // Skip slugs that clearly aren't advertorials (contain dots = file extensions)
  if (slug.includes(".")) return null

  // Use advertorialProjectId if set (handles slug mismatch between storefront and profitability DB)
  const projectId = (config as any).advertorialProjectId || config.slug

  // Try /public/ first (no auth required), then fallback to /store/ (with API key)
  const endpoints = [
    `${config.medusaUrl}/public/advertorials/${encodeURIComponent(slug)}?project_id=${projectId}`,
    `${config.medusaUrl}/store/advertorials/${encodeURIComponent(slug)}?project_id=${projectId}`,
  ]

  for (const url of endpoints) {
    try {
      const headers: Record<string, string> = {}
      if (url.includes("/store/")) {
        headers["x-publishable-api-key"] = config.publishableApiKey || ""
      }
      const res = await fetch(url, {
        headers,
        next: { revalidate: 300 },
      })

      if (!res.ok) {
        console.warn(`[Advertorial] ${url} returned ${res.status}`)
        continue
      }

      const data = await res.json()
      if (data.found && data.page) {
        return data.page as AdvertorialPage
      }
    } catch (e) {
      console.warn(`[Advertorial] Failed to fetch "${slug}" from ${url}:`, e)
    }
  }

  return null
}

/**
 * Serve an advertorial page as a full HTML response with:
 * - Facebook Pixel injection (advertorial override or project default)
 * - Analytics tracker injection
 * - SEO meta tags injection (title, description, og:image)
 */
async function serveAdvertorial(
  request: NextRequest,
  config: ProjectConfig,
  advertorial: AdvertorialPage
): Promise<NextResponse> {
  let html = advertorial.html_content

  // --- 1. Determine Facebook Pixel ID ---
  // Use advertorial-specific pixel if set, otherwise fall back to project default
  let pixelId = advertorial.facebook_pixel_id || ""
  if (!pixelId) {
    pixelId = await fetchPixelId(config)
  }

  // --- 2. Inject SEO meta tags into <head> ---
  const metaTags = buildMetaTags(advertorial)
  if (metaTags) {
    if (/<head[^>]*>/i.test(html)) {
      html = html.replace(/<head([^>]*)>/i, `<head$1>${metaTags}`)
    } else if (/<html[^>]*>/i.test(html)) {
      // No <head> tag — inject one
      html = html.replace(/<html([^>]*)>/i, `<html$1><head>${metaTags}</head>`)
    } else {
      // Bare HTML — prepend
      html = `<head>${metaTags}</head>${html}`
    }
  }

  // --- 3. Inject Facebook Pixel script ---
  const pixelScript = generatePixelScript(config, pixelId)
  if (/<head[^>]*>/i.test(html)) {
    // Inject at end of <head> (before </head>)
    html = html.replace(/<\/head>/i, `${pixelScript}\n</head>`)
  } else {
    // Prepend pixel script
    html = `${pixelScript}\n${html}`
  }

  // --- 4. Inject Analytics tracker before </body> ---
  const analyticsScript = generateAnalyticsScript(config)
  if (/<\/body>/i.test(html)) {
    html = html.replace(/<\/body>/i, `${analyticsScript}\n</body>`)
  } else {
    // No </body> — append
    html = `${html}\n${analyticsScript}`
  }

  // --- 4b. Inject ViewContent tracking with correct catalog IDs ---
  // Advertorial HTML may contain custom fbq() calls with wrong product IDs.
  // Inject a proper ViewContent via MetaTracker with catalog IDs for CAPI deduplication.
  const catalogIds = (config as any).catalogContentIds || []
  const productName = config.mainProduct?.name || config.name || ""
  const productPrice = config.mainProduct?.price || 0
  const productCurrency = config.mainProduct?.currency || "EUR"
  if (catalogIds.length > 0) {
    const viewContentScript = `<script>
/* ── Advertorial ViewContent: fire with correct catalog IDs for CAPI ── */
if (typeof MetaTracker !== 'undefined') {
  MetaTracker.trackViewContent({
    content_name: ${JSON.stringify(productName)},
    content_ids: ${JSON.stringify(catalogIds)},
    value: ${productPrice},
    currency: ${JSON.stringify(productCurrency)}
  });
}
</script>`
    if (/<\/body>/i.test(html)) {
      html = html.replace(/<\/body>/i, `${viewContentScript}\n</body>`)
    } else {
      html = `${html}\n${viewContentScript}`
    }
  }

  // --- 5. Optimize images: add lazy loading + decoding async ---
  // Skip the first image (likely hero/LCP) — lazy-load the rest
  let imgCount = 0
  html = html.replace(/<img\b([^>]*?)(\s*\/?)>/gi, (match, attrs, close) => {
    imgCount++
    // Skip first image (hero/above-fold) for LCP performance
    if (imgCount === 1) return match
    // Don't double-add if already has loading attribute
    if (/loading\s*=/i.test(attrs)) return match
    return `<img${attrs} loading="lazy" decoding="async"${close}>`
  })

  // Gzip HTML for faster transfer
  const acceptGzip2 = (request.headers.get("accept-encoding") || "").includes("gzip")
  const htmlBody2 = acceptGzip2 ? gzipSync(Buffer.from(html, "utf-8")) : html
  const htmlHeaders2: Record<string, string> = {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "public, max-age=3600, s-maxage=86400",
  }
  if (acceptGzip2) htmlHeaders2["Content-Encoding"] = "gzip"
  return new NextResponse(htmlBody2, { status: 200, headers: htmlHeaders2 })
}

/**
 * Build SEO meta tags HTML string from advertorial page data.
 */
function buildMetaTags(advertorial: AdvertorialPage): string {
  const tags: string[] = []

  if (advertorial.meta_title) {
    tags.push(`<title>${escapeHtml(advertorial.meta_title)}</title>`)
    tags.push(`<meta property="og:title" content="${escapeHtml(advertorial.meta_title)}" />`)
  } else if (advertorial.title) {
    tags.push(`<title>${escapeHtml(advertorial.title)}</title>`)
    tags.push(`<meta property="og:title" content="${escapeHtml(advertorial.title)}" />`)
  }

  if (advertorial.meta_description) {
    tags.push(`<meta name="description" content="${escapeHtml(advertorial.meta_description)}" />`)
    tags.push(`<meta property="og:description" content="${escapeHtml(advertorial.meta_description)}" />`)
  }

  if (advertorial.og_image_url) {
    tags.push(`<meta property="og:image" content="${escapeHtml(advertorial.og_image_url)}" />`)
  }

  tags.push(`<meta property="og:type" content="article" />`)

  return tags.join("\n")
}

/**
 * Escape special HTML characters for safe insertion into attributes/content.
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

function generateProjectConfigScript(
  config: ProjectConfig,
  basePath: string,
  toggles: ProjectToggles
): string {
  const projectConfig = {
    slug: config.slug,
    projectId: (config as any).projectId || config.slug,
    medusaUrl: config.medusaUrl,
    publishableApiKey: config.publishableApiKey,
    mainProduct: config.mainProduct,
    upsellProduct: config.upsellProduct,
    bundleOptions: config.bundleOptions,
    regions: config.regions,
    paymentProviders: config.paymentProviders,
    mollieProfileId: (config as any).mollieProfileId || null,
    packetaApiKey: (config as any).packetaApiKey || null,
    shippingOptions: (config as any).shippingOptions || null,
    catalogContentIds: (config as any).catalogContentIds || null,
    defaultCountry: (config as any).defaultCountry || null,
    defaultPhonePrefix: (config as any).defaultPhonePrefix || null,
    // Feature toggles from admin
    orderBumpEnabled: toggles.orderBumpEnabled,
    upsellEnabled: toggles.upsellEnabled,
    foxentryApiKey: toggles.foxentryApiKey,
    // URLs with correct base path
    homeUrl: `${basePath}/`,
    checkoutUrl: `${basePath}/checkout`,
    upsellUrl: `${basePath}/upsell`,
    thankYouUrl: `${basePath}/thank-you`,
    contactUrl: `${basePath}/contact`,
    privacyUrl: `${basePath}/privacy`,
    termsUrl: `${basePath}/voorwaarden`,
    shippingUrl: `${basePath}/verzending`,
  }

  return `<script>
var PROJECT_CONFIG = ${JSON.stringify(projectConfig)};
PROJECT_CONFIG.getRegionId = function(countryCode) {
  return PROJECT_CONFIG.regions[countryCode] || PROJECT_CONFIG.regions['NL'] || Object.values(PROJECT_CONFIG.regions)[0];
};
</script>`
}

function generatePixelScript(config: ProjectConfig, pixelId: string): string {
  if (!pixelId) {
    return "<!-- Facebook Pixel: not configured -->"
  }

  // Embed all critical values directly — don't rely on PROJECT_CONFIG
  // (advertorial pages don't get PROJECT_CONFIG injected)
  const projectSlug = config.slug
  const medusaUrl = config.medusaUrl || ""
  const publishableApiKey = config.publishableApiKey || ""
  const catalogContentIds = (config as any).catalogContentIds || []

  return `<script>
/* ═══════════════════════════════════════════════════════════════════
 * META PIXEL + CONVERSIONS API (CAPI) TRACKING LIBRARY
 * Project: ${projectSlug} | Pixel: ${pixelId}
 *
 * Features:
 *  - Browser pixel (fbq) + server-side CAPI for every event
 *  - Identical event_id for deduplication (EMQ 8+/10)
 *  - fbclid capture → _fbc cookie for click attribution
 *  - Auto PageView on load
 * ═══════════════════════════════════════════════════════════════════ */

/* ── 1. Meta Pixel base code ─────────────────────────────────── */
!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){
n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];
t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window,document,'script',
'https://connect.facebook.net/en_US/fbevents.js');

/* ── Init with advanced matching from localStorage (returning visitors) ── */
var _initMatch = {};
try {
  var _eid = localStorage.getItem('meta_external_id');
  if (_eid) _initMatch.external_id = _eid;
  var _sc = localStorage.getItem('medusa_customer');
  if (_sc) {
    var _c = JSON.parse(_sc);
    if (_c.email) _initMatch.em = _c.email.toLowerCase().trim();
    if (_c.phone) _initMatch.ph = _c.phone.replace(/[^0-9]/g, '');
    if (_c.first_name) _initMatch.fn = _c.first_name.toLowerCase().trim();
    if (_c.last_name) _initMatch.ln = _c.last_name.toLowerCase().trim();
    if (_c.city) _initMatch.ct = _c.city.toLowerCase().trim();
    if (_c.postal_code) _initMatch.zp = _c.postal_code.trim();
    if (_c.country_code) _initMatch.country = _c.country_code.toLowerCase().trim();
  }
} catch(e) {}
fbq('init', '${pixelId}', _initMatch);

/* ── 2. MetaTracker namespace ────────────────────────────────── */
window.MetaTracker = (function() {
  var PIXEL_ID = '${pixelId}';
  var PROJECT_ID = '${projectSlug}';
  var MEDUSA_URL = '${medusaUrl}';
  var API_KEY = '${publishableApiKey}';
  var CATALOG_CONTENT_IDS = ${JSON.stringify(catalogContentIds)};
  var CAPI_URL = MEDUSA_URL + '/store/meta-capi';

  /* ── Cookie helpers ──────────────────────────────────────── */
  function getCookie(name) {
    var match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? decodeURIComponent(match[2]) : null;
  }

  function setCookie(name, value, days) {
    var d = new Date();
    d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
    document.cookie = name + '=' + encodeURIComponent(value) +
      ';expires=' + d.toUTCString() +
      ';path=/;SameSite=Lax';
  }

  /* ── fbclid capture → _fbc cookie ───────────────────────── */
  function captureFbclid() {
    try {
      var url = new URL(window.location.href);
      var fbclid = url.searchParams.get('fbclid');
      if (fbclid) {
        // Always overwrite _fbc when fbclid is present in URL (fresh click)
        var fbc = 'fb.1.' + Date.now() + '.' + fbclid;
        setCookie('_fbc', fbc, 90);
        console.log('[MetaTracker] Captured fbclid → _fbc:', fbc.substring(0, 30) + '...');
      }
    } catch(e) { /* ignore */ }
  }

  function getFbc() {
    var fbc = getCookie('_fbc') || null;
    // Fallback: if no _fbc cookie but fbclid in URL, construct on the fly
    if (!fbc) {
      try {
        var fbclid = new URLSearchParams(window.location.search).get('fbclid');
        if (fbclid) {
          fbc = 'fb.1.' + Date.now() + '.' + fbclid;
          setCookie('_fbc', fbc, 90);
        }
      } catch(e) { /* ignore */ }
    }
    return fbc;
  }
  function getFbp() { return getCookie('_fbp') || null; }

  /* ── external_id: persistent visitor identifier ─────────── */
  function getExternalId() {
    var eid = null;
    try { eid = localStorage.getItem('meta_external_id'); } catch(e) {}
    if (!eid) {
      eid = 'v_' + Math.random().toString(36).substr(2, 12) + Math.random().toString(36).substr(2, 4);
      try { localStorage.setItem('meta_external_id', eid); } catch(e) {}
    }
    return eid;
  }

  /* ── Phone number: ensure country code prefix ─────────── */
  function ensurePhonePrefix(phone, prefix) {
    if (!phone || !prefix) return phone;
    // Already has country prefix
    if (phone.indexOf(prefix) === 0) return phone;
    // Remove leading 0 (local format) and prepend country code
    if (phone.charAt(0) === '0') phone = phone.substring(1);
    return prefix + phone;
  }

  /* ── UUID v4 generator (event_id) ───────────────────────── */
  function generateEventId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    // Fallback
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  /* ── Advanced matching: reinit pixel with PII ──────────── */
  var advancedMatchData = {};
  function setUserData(data) {
    if (data.em) advancedMatchData.em = data.em.toLowerCase().trim();
    if (data.ph) advancedMatchData.ph = data.ph.replace(/[^0-9]/g, '');
    if (data.fn) advancedMatchData.fn = data.fn.toLowerCase().trim();
    if (data.ln) advancedMatchData.ln = data.ln.toLowerCase().trim();
    if (data.ct) advancedMatchData.ct = data.ct.toLowerCase().trim();
    if (data.st) advancedMatchData.st = data.st.toLowerCase().trim();
    if (data.zp) advancedMatchData.zp = data.zp.trim();
    if (data.country) advancedMatchData.country = data.country.toLowerCase().trim();
    if (data.ge) advancedMatchData.ge = data.ge.toLowerCase().trim();
    if (data.db) advancedMatchData.db = data.db.trim();
    if (data.external_id) advancedMatchData.external_id = data.external_id;
    // Re-init pixel with ALL advanced matching data for browser-side matching
    try {
      var matchPayload = {};
      if (advancedMatchData.em) matchPayload.em = advancedMatchData.em;
      if (advancedMatchData.ph) matchPayload.ph = advancedMatchData.ph;
      if (advancedMatchData.fn) matchPayload.fn = advancedMatchData.fn;
      if (advancedMatchData.ln) matchPayload.ln = advancedMatchData.ln;
      if (advancedMatchData.ct) matchPayload.ct = advancedMatchData.ct;
      if (advancedMatchData.st) matchPayload.st = advancedMatchData.st;
      if (advancedMatchData.zp) matchPayload.zp = advancedMatchData.zp;
      if (advancedMatchData.country) matchPayload.country = advancedMatchData.country;
      if (advancedMatchData.ge) matchPayload.ge = advancedMatchData.ge;
      if (advancedMatchData.db) matchPayload.db = advancedMatchData.db;
      if (advancedMatchData.external_id) matchPayload.external_id = advancedMatchData.external_id;
      if (Object.keys(matchPayload).length > 0) {
        fbq('init', PIXEL_ID, matchPayload);
        console.log('[MetaTracker] Advanced matching updated:', Object.keys(matchPayload).join(', '));
      }
    } catch(e) { /* ignore */ }
  }

  /* ── Dedup state: prevent same event_id firing twice ────── */
  var firedEventIds = {};

  /* ── Wait for _fbp cookie (set by fbevents.js async load) ── */
  function waitForFbp(callback, maxWaitMs) {
    maxWaitMs = maxWaitMs || 1000;
    var interval = 50;
    var elapsed = 0;
    var fbp = getFbp();
    if (fbp) { callback(fbp); return; }
    var timer = setInterval(function() {
      elapsed += interval;
      fbp = getFbp();
      if (fbp || elapsed >= maxWaitMs) {
        clearInterval(timer);
        callback(fbp);
      }
    }, interval);
  }

  /* ── Send CAPI payload ─────────────────────────────────── */
  function sendCAPI(capiPayload, eventName) {
    try {
      fetch(CAPI_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-publishable-api-key': API_KEY
        },
        body: JSON.stringify(capiPayload),
        keepalive: true
      }).then(function(r) { return r.json(); }).then(function(res) {
        if (res.success) {
          console.log('[MetaTracker] CAPI: ' + eventName + ' ✓ fbtrace=' + (res.fbtrace_id || 'n/a'));
        } else {
          console.warn('[MetaTracker] CAPI: ' + eventName + ' ✗', res.error);
        }
      }).catch(function(e) {
        console.warn('[MetaTracker] CAPI fetch failed:', e);
      });
    } catch(e) {
      console.warn('[MetaTracker] CAPI send error:', e);
    }
  }

  /* ── Core tracking function ─────────────────────────────── */
  function trackEvent(eventName, customData, userData, options) {
    customData = customData || {};
    userData = userData || {};
    options = options || {};

    // Step 1: Use provided event_id or generate a new one
    var eventId = options.event_id || generateEventId();

    // Step 2: Prevent duplicate firing
    if (firedEventIds[eventId]) return eventId;
    firedEventIds[eventId] = true;

    // Step 3: Fire browser pixel FIRST (queued if fbevents.js not loaded yet)
    try {
      fbq('track', eventName, customData, { eventID: eventId });
      console.log('[MetaTracker] Browser pixel: ' + eventName + ' [' + eventId.substring(0,8) + ']');
    } catch(e) {
      console.warn('[MetaTracker] Browser pixel failed:', e);
    }

    // Step 4: Build CAPI payload
    var externalId = getExternalId();
    var defaultCountry = (window.PROJECT_CONFIG && window.PROJECT_CONFIG.defaultCountry) ? window.PROJECT_CONFIG.defaultCountry.toLowerCase() : '${((config as any).defaultCountry || "").toLowerCase()}';
    var defaultPhonePrefix = (window.PROJECT_CONFIG && window.PROJECT_CONFIG.defaultPhonePrefix) || '${(config as any).defaultPhonePrefix || ""}';

    function buildAndSendCAPI(fbpValue) {
      var capiPayload = {
        project_id: PROJECT_ID,
        event_name: eventName,
        event_id: eventId,
        event_time: Math.floor(Date.now() / 1000),
        event_source_url: window.location.href,
        referrer_url: document.referrer || undefined,
        user_data: {
          fbc: getFbc(),
          fbp: fbpValue || null,
          external_id: externalId,
          client_user_agent: navigator.userAgent,
          country: defaultCountry || undefined
        },
        custom_data: customData
      };

      // Merge stored advanced matching data into every CAPI call
      if (advancedMatchData.em) capiPayload.user_data.em = advancedMatchData.em;
      if (advancedMatchData.ph) capiPayload.user_data.ph = ensurePhonePrefix(advancedMatchData.ph, defaultPhonePrefix);
      if (advancedMatchData.fn) capiPayload.user_data.fn = advancedMatchData.fn;
      if (advancedMatchData.ln) capiPayload.user_data.ln = advancedMatchData.ln;
      if (advancedMatchData.ct) capiPayload.user_data.ct = advancedMatchData.ct;
      if (advancedMatchData.zp) capiPayload.user_data.zp = advancedMatchData.zp;
      if (advancedMatchData.country) capiPayload.user_data.country = advancedMatchData.country;
      if (advancedMatchData.st) capiPayload.user_data.st = advancedMatchData.st;

      // Override with any explicit user_data from caller
      if (userData.em) capiPayload.user_data.em = userData.em;
      if (userData.ph) capiPayload.user_data.ph = ensurePhonePrefix(userData.ph.replace(/[^0-9]/g, ''), defaultPhonePrefix);
      if (userData.fn) capiPayload.user_data.fn = userData.fn;
      if (userData.ln) capiPayload.user_data.ln = userData.ln;
      if (userData.ct) capiPayload.user_data.ct = userData.ct;
      if (userData.st) capiPayload.user_data.st = userData.st;
      if (userData.zp) capiPayload.user_data.zp = userData.zp;
      if (userData.country) capiPayload.user_data.country = userData.country;
      if (userData.external_id) capiPayload.user_data.external_id = userData.external_id;

      if (fbpValue) {
        console.log('[MetaTracker] CAPI sending with fbp: ' + fbpValue.substring(0, 20) + '...');
      } else {
        console.log('[MetaTracker] CAPI sending without fbp (cookie not available)');
      }

      sendCAPI(capiPayload, eventName);
    }

    // Step 5: Wait for _fbp cookie before sending CAPI
    // fbevents.js sets _fbp asynchronously — polling ensures we capture it
    // for proper browser↔server event deduplication
    waitForFbp(buildAndSendCAPI, 1000);

    return eventId;
  }

  /* ── Convenience methods ────────────────────────────────── */
  function trackPageView() {
    return trackEvent('PageView', {
      content_name: document.title || window.location.pathname,
      content_category: PROJECT_ID
    });
  }

  function trackViewContent(data) {
    return trackEvent('ViewContent', {
      content_type: 'product',
      content_ids: data.content_ids || [],
      content_name: data.content_name || '',
      value: data.value || 0,
      currency: data.currency || 'EUR'
    });
  }

  function trackAddToCart(data) {
    return trackEvent('AddToCart', {
      content_type: 'product',
      content_ids: data.content_ids || [],
      content_name: data.content_name || '',
      value: data.value || 0,
      currency: data.currency || 'EUR',
      num_items: data.num_items || 1
    });
  }

  function trackInitiateCheckout(data) {
    return trackEvent('InitiateCheckout', {
      content_type: 'product',
      content_ids: data.content_ids || [],
      value: data.value || 0,
      currency: data.currency || 'EUR',
      num_items: data.num_items || 1
    });
  }

  function trackAddPaymentInfo(data) {
    return trackEvent('AddPaymentInfo', {
      content_type: 'product',
      value: data.value || 0,
      currency: data.currency || 'EUR'
    });
  }

  function trackPurchase(data, userData, options) {
    var customData = {
      content_type: 'product',
      content_ids: data.content_ids || [],
      contents: data.contents || [],
      value: data.value || 0,
      currency: data.currency || 'EUR',
      num_items: data.num_items || 1,
      order_id: data.order_id || ''
    };
    if (data.customer_segmentation) customData.customer_segmentation = data.customer_segmentation;
    return trackEvent('Purchase', customData, userData, options);
  }

  /* ── Initialize: capture fbclid + restore saved user data ── */
  captureFbclid();
  // Always set external_id in advanced matching
  advancedMatchData.external_id = getExternalId();
  // Pre-fill advancedMatchData from localStorage for CAPI calls
  try {
    var _saved = localStorage.getItem('medusa_customer');
    if (_saved) {
      var _sd = JSON.parse(_saved);
      if (_sd.email) advancedMatchData.em = _sd.email.toLowerCase().trim();
      if (_sd.phone) advancedMatchData.ph = _sd.phone.replace(/[^0-9]/g, '');
      if (_sd.first_name) advancedMatchData.fn = _sd.first_name.toLowerCase().trim();
      if (_sd.last_name) advancedMatchData.ln = _sd.last_name.toLowerCase().trim();
      if (_sd.city) advancedMatchData.ct = _sd.city.toLowerCase().trim();
      if (_sd.postal_code) advancedMatchData.zp = _sd.postal_code.trim();
      if (_sd.country_code) advancedMatchData.country = _sd.country_code.toLowerCase().trim();
    }
  } catch(e) {}

  /* ── Public API ─────────────────────────────────────────── */
  return {
    trackEvent: trackEvent,
    trackPageView: trackPageView,
    trackViewContent: trackViewContent,
    trackAddToCart: trackAddToCart,
    trackInitiateCheckout: trackInitiateCheckout,
    trackAddPaymentInfo: trackAddPaymentInfo,
    trackPurchase: trackPurchase,
    generateEventId: generateEventId,
    setUserData: setUserData,
    getExternalId: getExternalId,
    getFbc: getFbc,
    getFbp: getFbp,
    PIXEL_ID: PIXEL_ID,
    PROJECT_ID: PROJECT_ID,
    CATALOG_CONTENT_IDS: CATALOG_CONTENT_IDS
  };
})();

/* ── 3. Auto-fire PageView with deduplication ────────────── */
MetaTracker.trackPageView();
</script>
<noscript><img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1"/></noscript>`
}

function generateAnalyticsScript(config: ProjectConfig): string {
  const projectSlug = config.slug
  const apiBase = config.medusaUrl
  const apiKey = config.publishableApiKey || ""

  return `<script>
/* ═══════════════════════════════════════════════════════════════════
 * ANALYTICS TRACKER — Visitor tracking, sessions, heartbeat
 * Project: ${projectSlug}
 * ═══════════════════════════════════════════════════════════════════ */
window.AnalyticsTracker = (function() {
  var PROJECT_ID = '${projectSlug}';
  var API_BASE = '${apiBase}';
  var API_KEY = '${apiKey}';

  /* ── Cookie/Storage helpers ─────────────────────────────── */
  function getCookie(name) {
    var match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? decodeURIComponent(match[2]) : null;
  }
  function setCookie(name, value, days) {
    var d = new Date();
    d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
    document.cookie = name + '=' + encodeURIComponent(value) +
      ';expires=' + d.toUTCString() + ';path=/;SameSite=Lax';
  }

  /* ── UUID v4 generator ──────────────────────────────────── */
  function uuid() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  /* ── Visitor ID (2-year cookie) ─────────────────────────── */
  var visitorId = getCookie('_an_vid');
  if (!visitorId) {
    visitorId = uuid();
    setCookie('_an_vid', visitorId, 730);
  }

  /* ── Session ID (sessionStorage, 30-min timeout via cookie) */
  var sessionId = sessionStorage.getItem('_an_sid');
  var sessionCookie = getCookie('_an_sactive');
  if (!sessionId || !sessionCookie) {
    sessionId = uuid();
    sessionStorage.setItem('_an_sid', sessionId);
  }
  setCookie('_an_sactive', '1', 0.02083); // 30 min

  /* ── UTM capture ────────────────────────────────────────── */
  var utmParams = {};
  try {
    var url = new URL(window.location.href);
    ['utm_source','utm_medium','utm_campaign','utm_content','utm_term'].forEach(function(p) {
      var v = url.searchParams.get(p);
      if (v) { utmParams[p] = v; sessionStorage.setItem(p, v); }
      else { var saved = sessionStorage.getItem(p); if (saved) utmParams[p] = saved; }
    });
    var fbclid = url.searchParams.get('fbclid');
    if (fbclid) { utmParams.fbclid = fbclid; sessionStorage.setItem('fbclid', fbclid); }
    else { var saved = sessionStorage.getItem('fbclid'); if (saved) utmParams.fbclid = saved; }
  } catch(e) { /* ignore */ }

  /* ── API helper ─────────────────────────────────────────── */
  function sendToAPI(endpoint, data) {
    try {
      fetch(API_BASE + '/store/analytics/' + endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-publishable-api-key': API_KEY },
        body: JSON.stringify(data),
        keepalive: true
      }).catch(function() {});
    } catch(e) { /* never block UI */ }
  }

  /* ── Track Page View ────────────────────────────────────── */
  var pageStartTime = Date.now();
  var pvData = {
    project_id: PROJECT_ID,
    visitor_id: visitorId,
    session_id: sessionId,
    page_url: window.location.href,
    page_path: window.location.pathname,
    referrer: document.referrer || null,
    fbc: getCookie('_fbc') || null,
    fbp: getCookie('_fbp') || null
  };
  // Merge UTM params
  for (var k in utmParams) { if (utmParams.hasOwnProperty(k)) pvData[k] = utmParams[k]; }
  sendToAPI('pageview', pvData);
  console.log('[Analytics] PageView tracked, session=' + sessionId.substring(0,8) + '...');

  /* ── Scroll tracking ────────────────────────────────────── */
  var maxScroll = 0;
  window.addEventListener('scroll', function() {
    var scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    var docHeight = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight) - window.innerHeight;
    if (docHeight > 0) {
      var pct = Math.round((scrollTop / docHeight) * 100);
      if (pct > maxScroll) maxScroll = pct;
    }
  }, { passive: true });

  /* ── Heartbeat (every 15s) ──────────────────────────────── */
  var heartbeatInterval = setInterval(function() {
    var elapsed = Math.round((Date.now() - pageStartTime) / 1000);
    sendToAPI('heartbeat', {
      session_id: sessionId,
      time_on_page: elapsed,
      scroll_depth: maxScroll
    });
    setCookie('_an_sactive', '1', 0.02083); // refresh session timeout
  }, 15000);

  /* ── Beacon on page unload ──────────────────────────────── */
  window.addEventListener('pagehide', function() {
    clearInterval(heartbeatInterval);
    var elapsed = Math.round((Date.now() - pageStartTime) / 1000);
    var data = JSON.stringify({
      session_id: sessionId,
      time_on_page: elapsed,
      scroll_depth: maxScroll
    });
    try {
      navigator.sendBeacon(
        API_BASE + '/store/analytics/heartbeat',
        new Blob([data], { type: 'application/json' })
      );
    } catch(e) { /* fallback: fire and forget */ }
  });

  /* ── Track Conversion Events ────────────────────────────── */
  function trackEvent(eventType, eventData) {
    sendToAPI('event', {
      project_id: PROJECT_ID,
      session_id: sessionId,
      visitor_id: visitorId,
      event_type: eventType,
      event_data: eventData || {},
      page_url: window.location.href
    });
    console.log('[Analytics] Event: ' + eventType);
  }

  /* ── Share IDs with MetaTracker ─────────────────────────── */
  window.__analytics_visitor_id = visitorId;
  window.__analytics_session_id = sessionId;

  /* ── Public API ─────────────────────────────────────────── */
  return {
    trackEvent: trackEvent,
    visitorId: visitorId,
    sessionId: sessionId,
    PROJECT_ID: PROJECT_ID
  };
})();
</script>`
}

function rewriteLinks(html: string, basePath: string, config: ProjectConfig): string {
  // Map of .html filenames to clean URL paths
  const htmlToClean: Record<string, string> = {}
  for (const [pageName, htmlFile] of Object.entries(config.pages)) {
    if (pageName === "") {
      // index.html -> basePath/ or just basePath
      htmlToClean[htmlFile] = `${basePath}/`
    } else {
      htmlToClean[htmlFile] = `${basePath}/${pageName}`
    }
  }

  // Replace href="checkout.html" -> href="/p/loslatenboek/checkout" etc.
  for (const [htmlFile, cleanUrl] of Object.entries(htmlToClean)) {
    const escaped = htmlFile.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    html = html.replace(
      new RegExp(`(href|action)=["']${escaped}["']`, "g"),
      `$1="${cleanUrl}"`
    )
  }

  return html
}
