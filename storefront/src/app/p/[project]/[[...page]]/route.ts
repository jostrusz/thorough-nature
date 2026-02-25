import { NextRequest, NextResponse } from "next/server"
import fs from "fs"
import path from "path"
import { getProjectBySlug, ProjectConfig } from "@lib/projects"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ project: string; page?: string[] }> }
) {
  const { project: projectSlug, page } = await params

  const config = getProjectBySlug(projectSlug)
  if (!config) {
    return new NextResponse("Project not found", { status: 404 })
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

  // Inject PROJECT_CONFIG (replace external script reference)
  html = html.replace(
    /<script\s+src=["']js\/project-config\.js["']\s*><\/script>/gi,
    generateProjectConfigScript(config, basePath)
  )

  // Inject Facebook Pixel (replace external script reference)
  html = html.replace(
    /<script\s+src=["']js\/pixel\.js["']\s*><\/script>/gi,
    generatePixelScript(config)
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

function generateProjectConfigScript(config: ProjectConfig, basePath: string): string {
  const projectConfig = {
    medusaUrl: config.medusaUrl,
    publishableApiKey: config.publishableApiKey,
    mainProduct: config.mainProduct,
    upsellProduct: config.upsellProduct,
    bundleOptions: config.bundleOptions,
    regions: config.regions,
    paymentProviders: config.paymentProviders,
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

function generatePixelScript(config: ProjectConfig): string {
  if (!config.facebookPixelId) {
    return "<!-- Facebook Pixel: not configured -->"
  }
  return `<script>
!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${config.facebookPixelId}');
fbq('track', 'PageView');
</script>
<noscript><img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=${config.facebookPixelId}&ev=PageView&noscript=1"/></noscript>`
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
