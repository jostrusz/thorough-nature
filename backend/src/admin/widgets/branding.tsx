// @ts-nocheck
import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { useEffect } from "react"

/**
 * Global branding widget — injects custom favicon and replaces
 * Medusa logo in sidebar with custom logo.
 *
 * UPDATE THESE URLs after uploading the logo/favicon image:
 */
const LOGO_URL = "https://bucket-production-b93e.up.railway.app:443/medusa-media/marketing-hq-logo.png"

function BrandingWidget() {
  useEffect(() => {
    // ═══ FAVICON ═══
    document.querySelectorAll("link[rel*='icon']").forEach((el) => el.remove())

    const link = document.createElement("link")
    link.rel = "icon"
    link.type = "image/png"
    link.href = LOGO_URL
    document.head.appendChild(link)

    const apple = document.createElement("link")
    apple.rel = "apple-touch-icon"
    apple.href = LOGO_URL
    document.head.appendChild(apple)

    // ═══ SIDEBAR LOGO ═══
    const replaceLogo = () => {
      // Find the Medusa "M" circle in the sidebar (top-left corner)
      const allSpans = document.querySelectorAll("span")
      allSpans.forEach((span) => {
        // Medusa renders a circle with "M" as the store icon
        if (span.textContent?.trim() === "M" && span.closest("a, button, div")) {
          const parent = span.closest("a, button") || span.parentElement
          if (!parent || parent.querySelector("#custom-admin-logo")) return

          const img = document.createElement("img")
          img.id = "custom-admin-logo"
          img.src = LOGO_URL
          img.alt = "Logo"
          img.style.cssText = "width: 24px; height: 24px; border-radius: 4px; object-fit: contain;"

          // Hide the M circle and insert logo
          span.style.display = "none"
          span.parentElement?.insertBefore(img, span)
        }
      })
    }

    replaceLogo()
    const t1 = setTimeout(replaceLogo, 500)
    const t2 = setTimeout(replaceLogo, 2000)
    const t3 = setTimeout(replaceLogo, 5000)

    // Also observe DOM changes to catch sidebar re-renders
    const observer = new MutationObserver(() => {
      if (!document.getElementById("custom-admin-logo")) {
        replaceLogo()
      }
    })
    observer.observe(document.body, { childList: true, subtree: true })

    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
      observer.disconnect()
    }
  }, [])

  return null
}

export const config = defineWidgetConfig({
  zone: "order.list.before",
})

export default BrandingWidget
