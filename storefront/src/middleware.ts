import { HttpTypes } from "@medusajs/types"
import { notFound } from "next/navigation"
import { NextRequest, NextResponse } from "next/server"

const BACKEND_URL = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL
const PUBLISHABLE_API_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY
const DEFAULT_REGION = process.env.NEXT_PUBLIC_DEFAULT_REGION || "us"

// MarketingHQ: Project domain mapping from env (static fallback)
// Format: "loslatenboek.nl=loslatenboek,example.com=other-project"
const PROJECT_DOMAINS: Record<string, string> = {}
const domainMapping = process.env.PROJECT_DOMAIN_MAP || ""
domainMapping.split(",").filter(Boolean).forEach((entry) => {
  const [domain, slug] = entry.split("=")
  if (domain && slug) PROJECT_DOMAINS[domain.trim()] = slug.trim()
})

// Dynamic domain resolution cache (fetched from backend DB)
const dynamicDomainCache: Map<string, { slug: string | null; resolvedAt: number }> = new Map()
const DOMAIN_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

async function resolveDomainFromBackend(domain: string): Promise<string | null> {
  const cached = dynamicDomainCache.get(domain)
  if (cached && Date.now() - cached.resolvedAt < DOMAIN_CACHE_TTL) {
    return cached.slug
  }

  try {
    const res = await fetch(
      `${BACKEND_URL}/public/domain-resolve?domain=${encodeURIComponent(domain)}`,
      { next: { revalidate: 300 } }
    )
    if (!res.ok) {
      dynamicDomainCache.set(domain, { slug: null, resolvedAt: Date.now() })
      return null
    }
    const data = await res.json()
    const slug = data.found ? data.project_slug : null
    dynamicDomainCache.set(domain, { slug, resolvedAt: Date.now() })
    return slug
  } catch {
    // On fetch error, cache null briefly (30s) to avoid hammering backend
    dynamicDomainCache.set(domain, { slug: null, resolvedAt: Date.now() - DOMAIN_CACHE_TTL + 30_000 })
    return null
  }
}

const regionMapCache = {
  regionMap: new Map<string, HttpTypes.StoreRegion>(),
  regionMapUpdated: Date.now(),
}

async function getRegionMap() {
  const { regionMap, regionMapUpdated } = regionMapCache

  if (
    !regionMap.keys().next().value ||
    regionMapUpdated < Date.now() - 3600 * 1000
  ) {
    // Fetch regions from Medusa. We can't use the JS client here because middleware is running on Edge and the client needs a Node environment.
    const { regions } = await fetch(`${BACKEND_URL}/store/regions`, {
      headers: {
        "x-publishable-api-key": PUBLISHABLE_API_KEY!,
      },
      next: {
        revalidate: 3600,
        tags: ["regions"],
      },
    }).then((res) => res.json())

    if (!regions?.length) {
      notFound()
    }

    // Create a map of country codes to regions.
    regions.forEach((region: HttpTypes.StoreRegion) => {
      region.countries?.forEach((c) => {
        regionMapCache.regionMap.set(c.iso_2 ?? "", region)
      })
    })

    regionMapCache.regionMapUpdated = Date.now()
  }

  return regionMapCache.regionMap
}

/**
 * Fetches regions from Medusa and sets the region cookie.
 * @param request
 * @param response
 */
async function getCountryCode(
  request: NextRequest,
  regionMap: Map<string, HttpTypes.StoreRegion | number>
) {
  try {
    let countryCode

    const vercelCountryCode = request.headers
      .get("x-vercel-ip-country")
      ?.toLowerCase()

    const urlCountryCode = request.nextUrl.pathname.split("/")[1]?.toLowerCase()

    if (urlCountryCode && regionMap.has(urlCountryCode)) {
      countryCode = urlCountryCode
    } else if (vercelCountryCode && regionMap.has(vercelCountryCode)) {
      countryCode = vercelCountryCode
    } else if (regionMap.has(DEFAULT_REGION)) {
      countryCode = DEFAULT_REGION
    } else if (regionMap.keys().next().value) {
      countryCode = regionMap.keys().next().value
    }

    return countryCode
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error(
        "Middleware.ts: Error getting the country code. Did you set up regions in your Medusa Admin and define a NEXT_PUBLIC_MEDUSA_BACKEND_URL environment variable?"
      )
    }
  }
}

/**
 * Middleware to handle region selection and onboarding status.
 */
export async function middleware(request: NextRequest) {
  const hostname = request.headers.get("host") || ""
  const cleanHost = hostname.split(":")[0].replace(/^www\./, "")
  const pathname = request.nextUrl.pathname

  // ─── Static / well-known paths — skip middleware entirely ───
  if (pathname.startsWith("/.well-known")) {
    return NextResponse.next()
  }

  // ─── Digital download page — no country code needed ───
  if (pathname.startsWith("/download/")) {
    return NextResponse.next()
  }

  // ─── MarketingHQ: Project domain routing ───
  // 1. Check static env map first (instant), 2. Fallback to backend DB (cached)
  let projectSlug = PROJECT_DOMAINS[cleanHost]
  if (!projectSlug) {
    projectSlug = (await resolveDomainFromBackend(cleanHost)) || ""
  }
  if (projectSlug) {
    const projectPath = pathname === "/" ? "" : pathname.replace(/^\//, "")
    const rewriteUrl = new URL(`/p/${projectSlug}/${projectPath}`, request.url)
    rewriteUrl.search = request.nextUrl.search
    const response = NextResponse.rewrite(rewriteUrl)
    response.headers.set("x-project-domain", "true")
    return response
  }

  // ─── MarketingHQ: /p/ path passthrough ───
  // Let project route handler serve the HTML directly
  if (pathname.startsWith("/p/")) {
    return NextResponse.next()
  }

  // ─── Existing Medusa storefront logic ───
  const searchParams = request.nextUrl.searchParams
  const isOnboarding = searchParams.get("onboarding") === "true"
  const cartId = searchParams.get("cart_id")
  const checkoutStep = searchParams.get("step")
  const onboardingCookie = request.cookies.get("_medusa_onboarding")
  const cartIdCookie = request.cookies.get("_medusa_cart_id")

  const regionMap = await getRegionMap()

  const countryCode = regionMap && (await getCountryCode(request, regionMap))

  const urlHasCountryCode =
    countryCode && request.nextUrl.pathname.split("/")[1].includes(countryCode)

  // check if one of the country codes is in the url
  if (
    urlHasCountryCode &&
    (!isOnboarding || onboardingCookie) &&
    (!cartId || cartIdCookie)
  ) {
    return NextResponse.next()
  }

  const redirectPath =
    request.nextUrl.pathname === "/" ? "" : request.nextUrl.pathname

  const queryString = request.nextUrl.search ? request.nextUrl.search : ""

  let redirectUrl = request.nextUrl.href

  let response = NextResponse.redirect(redirectUrl, 307)

  // If no country code is set, we redirect to the relevant region.
  if (!urlHasCountryCode && countryCode) {
    redirectUrl = `${request.nextUrl.origin}/${countryCode}${redirectPath}${queryString}`
    response = NextResponse.redirect(`${redirectUrl}`, 307)
  }

  // If a cart_id is in the params, we set it as a cookie and redirect to the address step.
  if (cartId && !checkoutStep) {
    redirectUrl = `${redirectUrl}&step=address`
    response = NextResponse.redirect(`${redirectUrl}`, 307)
    response.cookies.set("_medusa_cart_id", cartId, { maxAge: 60 * 60 * 24 })
  }

  // Set a cookie to indicate that we're onboarding. This is used to show the onboarding flow.
  if (isOnboarding) {
    response.cookies.set("_medusa_onboarding", "true", { maxAge: 60 * 60 * 24 })
  }

  return response
}

export const config = {
  matcher: ["/((?!api|_next/static|favicon.ico|\\.well-known|.*\\.png|.*\\.jpg|.*\\.jpeg|.*\\.gif|.*\\.svg|.*\\.webp|.*\\.ico).*)"], // prevents redirecting on static files
}
