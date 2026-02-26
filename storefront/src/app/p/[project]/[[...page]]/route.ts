import { NextRequest, NextResponse } from "next/server"
import fs from "fs"
import path from "path"
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
    const assetPath = path.join(process.cwd(), "src", "projects", projectSlug, "pages", requestedPath)
    // Prevent directory traversal
    const pagesDir = path.join(process.cwd(), "src", "projects", projectSlug, "pages")
    if (!path.resolve(assetPath).startsWith(pagesDir) || !fs.existsSync(assetPath)) {
      return new NextResponse("Not found", { status: 404 })
    }
    const content = fs.readFileSync(assetPath)
    return new NextResponse(content, {
      status: 200,
      headers: {
        "Content-Type": STATIC_MIME_TYPES[ext],
        "Cache-Control": "public, max-age=3600, s-maxage=86400",
      },
    })
  }

  // Resolve page name: /p/loslatenboek -> "", /p/loslatenboek/checkout -> "checkout"
  let pageName = page?.join("/") || ""

  // Strip .html extension if present (links in HTML use "checkout.html")
  pageName = pageName.replace(/\.html$/, "")

  // Look up the HTML filename
  const htmlFile = config.pages[pageName]
  if (!htmlFile) {
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

  // Fetch project settings (order bump / upsell toggles) from backend
  const projectToggles = await fetchProjectSettings(config)

  // Inject PROJECT_CONFIG (replace external script reference)
  html = html.replace(
    /<script\s+src=["']js\/project-config\.js["']\s*><\/script>/gi,
    generateProjectConfigScript(config, basePath, projectToggles)
  )

  // Fetch pixel_id dynamically from backend admin settings (source of truth)
  const pixelId = await fetchPixelId(config)

  // Inject Facebook Pixel + CAPI tracking library (replace external script reference)
  html = html.replace(
    /<script\s+src=["']js\/pixel\.js["']\s*><\/script>/gi,
    generatePixelScript(config, pixelId)
  )

  // Inject analytics tracking script before </body>
  html = html.replace(
    /<\/body>/i,
    generateAnalyticsScript(config) + "\n</body>"
  )

  // Rewrite internal .html links to clean URLs with correct base path
  html = rewriteLinks(html, basePath, config)

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=60, s-maxage=300",
    },
  })
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

function generateProjectConfigScript(
  config: ProjectConfig,
  basePath: string,
  toggles: ProjectToggles
): string {
  const projectConfig = {
    slug: config.slug,
    medusaUrl: config.medusaUrl,
    publishableApiKey: config.publishableApiKey,
    mainProduct: config.mainProduct,
    upsellProduct: config.upsellProduct,
    bundleOptions: config.bundleOptions,
    regions: config.regions,
    paymentProviders: config.paymentProviders,
    mollieProfileId: (config as any).mollieProfileId || null,
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

  // The pixel ID and project slug are embedded in the tracking library
  const projectSlug = config.slug

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

fbq('init', '${pixelId}');

/* ── 2. MetaTracker namespace ────────────────────────────────── */
window.MetaTracker = (function() {
  var PIXEL_ID = '${pixelId}';
  var PROJECT_ID = '${projectSlug}';
  var CAPI_URL = (window.PROJECT_CONFIG && window.PROJECT_CONFIG.medusaUrl || '') + '/store/meta-capi';

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
      if (fbclid && !getCookie('_fbc')) {
        var fbc = 'fb.1.' + Date.now() + '.' + fbclid;
        setCookie('_fbc', fbc, 90);
        console.log('[MetaTracker] Captured fbclid → _fbc:', fbc.substring(0, 30) + '...');
      }
    } catch(e) { /* ignore */ }
  }

  function getFbc() { return getCookie('_fbc') || null; }
  function getFbp() { return getCookie('_fbp') || null; }

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

  /* ── Dedup state: prevent same event_id firing twice ────── */
  var firedEventIds = {};

  /* ── Core tracking function ─────────────────────────────── */
  function trackEvent(eventName, customData, userData) {
    customData = customData || {};
    userData = userData || {};

    // Step 1: Generate unique event_id
    var eventId = generateEventId();

    // Step 2: Prevent duplicate firing
    if (firedEventIds[eventId]) return eventId;
    firedEventIds[eventId] = true;

    // Step 3: Fire browser pixel FIRST
    try {
      fbq('track', eventName, customData, { eventID: eventId });
      console.log('[MetaTracker] Browser pixel: ' + eventName + ' [' + eventId.substring(0,8) + ']');
    } catch(e) {
      console.warn('[MetaTracker] Browser pixel failed:', e);
    }

    // Step 4: Fire CAPI with IDENTICAL event_id
    var capiPayload = {
      project_id: PROJECT_ID,
      event_name: eventName,
      event_id: eventId,
      event_time: Math.floor(Date.now() / 1000),
      event_source_url: window.location.href,
      user_data: {
        fbc: getFbc(),
        fbp: getFbp()
      },
      custom_data: customData
    };

    // Merge any additional user_data from caller
    if (userData.em) capiPayload.user_data.em = userData.em;
    if (userData.ph) capiPayload.user_data.ph = userData.ph;
    if (userData.fn) capiPayload.user_data.fn = userData.fn;
    if (userData.ln) capiPayload.user_data.ln = userData.ln;
    if (userData.ct) capiPayload.user_data.ct = userData.ct;
    if (userData.st) capiPayload.user_data.st = userData.st;
    if (userData.zp) capiPayload.user_data.zp = userData.zp;
    if (userData.country) capiPayload.user_data.country = userData.country;
    if (userData.external_id) capiPayload.user_data.external_id = userData.external_id;

    // Send CAPI asynchronously (don't block UI)
    try {
      fetch(CAPI_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-publishable-api-key': (window.PROJECT_CONFIG && window.PROJECT_CONFIG.publishableApiKey) || ''
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

    return eventId;
  }

  /* ── Convenience methods ────────────────────────────────── */
  function trackPageView() {
    return trackEvent('PageView', {});
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

  function trackPurchase(data, userData) {
    return trackEvent('Purchase', {
      content_type: 'product',
      content_ids: data.content_ids || [],
      contents: data.contents || [],
      value: data.value || 0,
      currency: data.currency || 'EUR',
      num_items: data.num_items || 1,
      order_id: data.order_id || ''
    }, userData);
  }

  /* ── Initialize: capture fbclid on every page ──────────── */
  captureFbclid();

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
    getFbc: getFbc,
    getFbp: getFbp,
    PIXEL_ID: PIXEL_ID,
    PROJECT_ID: PROJECT_ID
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
