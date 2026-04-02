// @ts-nocheck
import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { useState, useEffect } from "react"

const BADGE_ID = "supportbox-sidebar-badge"

function injectBadge(count: number) {
  const existing = document.getElementById(BADGE_ID)
  if (existing) existing.remove()

  if (count <= 0) return

  const links = document.querySelectorAll("a[href*='/supportbox']")
  let targetLink: HTMLElement | null = null
  links.forEach((link) => {
    if (link.textContent?.replace(/\d+/g, "").includes("SupportBox") && !link.getAttribute("href")?.includes("/settings")) {
      targetLink = link as HTMLElement
    }
  })

  if (!targetLink) return

  const badge = document.createElement("span")
  badge.id = BADGE_ID
  badge.textContent = count > 99 ? "99+" : String(count)
  badge.style.cssText = `
    margin-left: auto;
    min-width: 18px;
    height: 18px;
    border-radius: 9px;
    background-color: #DC2626;
    color: #fff;
    font-size: 10px;
    font-weight: 700;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0 5px;
    line-height: 1;
    flex-shrink: 0;
  `

  targetLink.style.display = "flex"
  targetLink.style.alignItems = "center"
  targetLink.appendChild(badge)
}

function SupportBoxBadgeWidget() {
  const [count, setCount] = useState(0)

  useEffect(() => {
    let mounted = true

    const fetchCount = async () => {
      try {
        const response = await fetch("/admin/supportbox/tickets?status=new", {
          credentials: "include",
        })
        if (!response.ok) return
        const data = await response.json()
        if (mounted) setCount((data.tickets || []).length)
      } catch {}
    }

    fetchCount()
    const interval = setInterval(fetchCount, 15000)
    return () => { mounted = false; clearInterval(interval) }
  }, [])

  useEffect(() => {
    injectBadge(count)

    const observer = new MutationObserver(() => {
      if (!document.getElementById(BADGE_ID)) {
        injectBadge(count)
      }
    })
    observer.observe(document.body, { childList: true, subtree: true })

    return () => {
      observer.disconnect()
      const el = document.getElementById(BADGE_ID)
      if (el) el.remove()
    }
  }, [count])

  return null
}

export const config = defineWidgetConfig({
  zone: "order.list.before",
})

export default SupportBoxBadgeWidget
