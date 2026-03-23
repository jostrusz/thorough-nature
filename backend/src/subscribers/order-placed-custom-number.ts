import { Modules } from "@medusajs/framework/utils"
import { SubscriberArgs, SubscriberConfig } from "@medusajs/medusa"
import { PROFITABILITY_MODULE } from "../modules/profitability/index.js"

// Project display names for order tags
const PROJECT_TAG_NAMES: Record<string, string> = {
  dehondenbijbel: "De Hondenbijbel",
  loslatenboek: "De Hondenbijbel",
  odpusc: "Odpuść",
  "odpusc-ksiazka": "Odpuść",
  slapp: "Släpp taget",
  "slapp-taget": "Släpp taget",
  "psi-superzivot": "Psí superživot",
  "lass-los": "Lass los",
}

/**
 * When an order is placed, generate a custom order number
 * in format: {COUNTRY}{YEAR}-{display_id}
 * e.g., NL2026-1111, BE2026-1112, SE2026-1113
 *
 * Also resolves project_id from sales_channel_id if missing,
 * and sets metadata.tags for Orders HQ display.
 *
 * Runs with a 2s delay so other subscribers (payment-metadata, etc.)
 * finish their metadata writes first. Then reads the fresh metadata,
 * merges in custom_order_number, and writes back the full object.
 */
export default async function orderPlacedCustomNumberHandler({
  event: { data },
  container,
}: SubscriberArgs<any>) {
  try {
    // Wait 2s for other order.placed subscribers to finish writing metadata
    await new Promise((resolve) => setTimeout(resolve, 2000))

    const orderModuleService = container.resolve(Modules.ORDER) as any
    const query = container.resolve("query") as any

    const { data: [order] } = await query.graph({
      entity: "order",
      fields: ["id", "display_id", "metadata", "sales_channel_id", "shipping_address.country_code", "billing_address.country_code"],
      filters: { id: data.id },
    })

    if (!order) return

    const existingMeta = (order as any).metadata || {}

    // Skip if custom_order_number already set
    if (existingMeta.custom_order_number) return

    const countryCode = (
      (order as any).shipping_address?.country_code ||
      (order as any).billing_address?.country_code ||
      ""
    ).toUpperCase()
    if (!countryCode) console.error(`[CustomNumber] Order ${data.id} missing country_code!`)
    const year = new Date().getFullYear()
    const displayId = (order as any).display_id
    const customOrderNumber = `${countryCode}${year}-${displayId}`

    // Resolve project_id: use existing metadata, or look up from sales_channel_id
    let projectId = existingMeta.project_id || ""
    if (!projectId && (order as any).sales_channel_id) {
      try {
        const profitService = container.resolve(PROFITABILITY_MODULE) as any
        const configs = await profitService.listProjectConfigs(
          { sales_channel_id: (order as any).sales_channel_id },
          { take: 1 }
        )
        if (configs?.length > 0) {
          projectId = configs[0].project_slug
          console.log(`[CustomNumber] Resolved project_id from sales_channel: ${projectId}`)
        }
      } catch (e: any) {
        console.warn(`[CustomNumber] Could not resolve project from sales_channel:`, e.message)
      }
    }

    // Set project tag from project_id
    const projectTag = projectId
      ? PROJECT_TAG_NAMES[projectId] || projectId
      : undefined

    // Merge with existing metadata to avoid overwriting other subscribers' fields
    await orderModuleService.updateOrders(data.id, {
      metadata: {
        ...existingMeta,
        custom_order_number: customOrderNumber,
        ...(projectId && !existingMeta.project_id ? { project_id: projectId } : {}),
        ...(projectTag && !existingMeta.tags ? { tags: projectTag } : {}),
      },
    })

    console.log(`[CustomNumber] Order ${data.id} → ${customOrderNumber}${projectTag ? ` | tag: ${projectTag}` : ""}`)
  } catch (error: any) {
    console.error("[CustomNumber] Error:", error.message)
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
