import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { PROFITABILITY_MODULE } from "../modules/profitability"
import { getAccountSpend } from "../modules/profitability/services/meta-ads.service"

/**
 * Sync Ad Spend Job
 *
 * Runs every 5 minutes:
 * - Recalculates today + yesterday for all active projects
 * - Fetches ad spend from Meta Ads API
 * - Recalculates revenue/orders from Medusa DB
 * - Upserts daily_project_stats
 */
export default async function syncAdSpendJob(container: MedusaContainer) {
  const logger = container.resolve("logger") as any
  const profitService = container.resolve(PROFITABILITY_MODULE) as any
  const queryService = container.resolve(ContainerRegistrationKeys.QUERY)

  try {
    // Calculate today and yesterday dates in Europe/Prague timezone
    const now = new Date()
    const pragueFmt = (d: Date) => d.toLocaleDateString("sv-SE", { timeZone: "Europe/Prague" })
    const today = pragueFmt(now)

    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = pragueFmt(yesterday)

    const datesToSync = [today, yesterdayStr]

    // Get Meta Ads token
    const metaConfigs = await profitService.listMetaAdsConfigs({}, { take: 1 })
    const metaConfig = metaConfigs[0]
    const hasValidToken = metaConfig?.access_token && metaConfig?.token_status === "valid"

    // Get all active projects
    const projects = await profitService.listProjectConfigs(
      { is_active: true },
      { take: 100 }
    )

    if (projects.length === 0) return

    let syncedCount = 0

    for (const project of projects) {
      const p = project as any

      for (const date of datesToSync) {
        try {
          await syncProjectDay({
            project: p,
            date,
            hasValidToken,
            metaConfig,
            profitService,
            queryService,
            logger,
          })
          syncedCount++
        } catch (err: any) {
          logger.error(`[SyncAdSpend] Failed to sync ${p.project_slug} for ${date}: ${err.message}`)
        }
      }
    }

    logger.info(`[SyncAdSpend] Synced ${syncedCount} project-days (${projects.length} projects × ${datesToSync.length} days)`)
  } catch (error: any) {
    logger.error(`[SyncAdSpend] Job failed: ${error.message}`)
  }
}

/**
 * Sync a single project for a single day.
 * Shared logic used by both sync-ad-spend and recalculate-daily-stats.
 */
export async function syncProjectDay({
  project,
  date,
  hasValidToken,
  metaConfig,
  profitService,
  queryService,
  logger,
}: {
  project: any
  date: string
  hasValidToken: boolean
  metaConfig: any
  profitService: any
  queryService: any
  logger: any
}) {
  const p = project
  // Convert Prague-local day boundaries to UTC for DB queries
  const offsetMs = getPragueOffsetMs(date)
  const dayStart = new Date(new Date(`${date}T00:00:00.000Z`).getTime() - offsetMs).toISOString()
  const dayEnd = new Date(new Date(`${date}T23:59:59.999Z`).getTime() - offsetMs).toISOString()

  // Fetch ad spend from Meta Ads API
  let adSpend = 0
  if (hasValidToken && p.meta_ad_account_id) {
    try {
      adSpend = await getAccountSpend(
        metaConfig.access_token,
        p.meta_ad_account_id,
        date,
        date
      )
    } catch (err: any) {
      logger.warn(`[SyncAdSpend] Failed to fetch ad spend for ${p.project_slug} (${date}): ${err.message}`)

      if (err.message.includes("expired") || err.message.includes("190")) {
        await profitService.updateMetaAdsConfigs({
          id: metaConfig.id,
          token_status: "expired",
        })
      }
    }
  }

  // Compute revenue & orders from Medusa DB
  let revenue = 0
  let taxAmount = 0
  let orderCount = 0
  let itemCount = 0

  if (p.sales_channel_id) {
    try {
      const { data: orders } = await queryService.graph({
        entity: "order",
        fields: [
          "id",
          "total",
          "tax_total",
          "items.*",
        ],
        filters: {
          sales_channel_id: p.sales_channel_id,
          created_at: { $gte: dayStart, $lte: dayEnd },
        },
      })

      for (const order of (orders || [])) {
        const o = order as any
        revenue += Number(o.total ?? 0)
        taxAmount += Number(o.tax_total ?? 0)
        orderCount++
        itemCount += (o.items || []).reduce(
          (sum: number, item: any) => sum + (Number(item?.quantity) || 0), 0
        )
      }
    } catch (err: any) {
      logger.warn(`[SyncAdSpend] Failed to query orders for ${p.project_slug} (${date}): ${err.message}`)
    }
  }

  // Calculate costs
  const bookCostTotal = itemCount * Number(p.book_cost_eur || 1.80)
  const shippingCostTotal = orderCount * Number(p.shipping_cost_eur || 5.00)
  const pickPackTotal = orderCount * Number(p.pick_pack_cost_eur || 1.50)
  const paymentFeeTotal = revenue * Number(p.payment_fee_rate || 0.03)

  // Get existing stats row (preserve refund_amount)
  let refundAmount = 0
  const existing = await profitService.listDailyProjectStats(
    { project_id: p.id, date },
    { take: 1 }
  )
  if (existing.length > 0) {
    refundAmount = Number((existing[0] as any).refund_amount || 0)
  }

  const netProfit = revenue - taxAmount - refundAmount - adSpend
    - bookCostTotal - shippingCostTotal - pickPackTotal - paymentFeeTotal

  // Upsert daily stats
  if (existing.length > 0) {
    await profitService.updateDailyProjectStats({
      id: (existing[0] as any).id,
      revenue,
      tax_amount: taxAmount,
      order_count: orderCount,
      item_count: itemCount,
      ad_spend: adSpend,
      book_cost_total: bookCostTotal,
      shipping_cost_total: shippingCostTotal,
      pick_pack_total: pickPackTotal,
      payment_fee_total: paymentFeeTotal,
      net_profit: netProfit,
      last_synced_at: new Date(),
    })
  } else {
    await profitService.createDailyProjectStats({
      project_id: p.id,
      date,
      revenue,
      tax_amount: taxAmount,
      order_count: orderCount,
      item_count: itemCount,
      refund_amount: refundAmount,
      ad_spend: adSpend,
      book_cost_total: bookCostTotal,
      shipping_cost_total: shippingCostTotal,
      pick_pack_total: pickPackTotal,
      payment_fee_total: paymentFeeTotal,
      net_profit: netProfit,
      last_synced_at: new Date(),
    })
  }
}

/**
 * Get Europe/Prague timezone offset in milliseconds for a given date.
 * Handles CET (UTC+1) and CEST (UTC+2) automatically.
 */
function getPragueOffsetMs(dateStr: string): number {
  const d = new Date(`${dateStr}T12:00:00Z`)
  const utcStr = d.toLocaleString("en-US", { timeZone: "UTC" })
  const pragueStr = d.toLocaleString("en-US", { timeZone: "Europe/Prague" })
  return new Date(pragueStr).getTime() - new Date(utcStr).getTime()
}

export const config = {
  name: "sync-ad-spend",
  schedule: "*/5 * * * *",
}
