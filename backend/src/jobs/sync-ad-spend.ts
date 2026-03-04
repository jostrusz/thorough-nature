import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { PROFITABILITY_MODULE } from "../modules/profitability"
import { getAccountSpend } from "../modules/profitability/services/meta-ads.service"

/**
 * Sync Ad Spend Job
 *
 * Runs every 5 minutes:
 * 1. Load meta_ads_config to get the access token
 * 2. For each active project_config that has a meta_ad_account_id:
 *    a. Fetch today's spend from Meta Ads API
 *    b. Upsert daily_project_stats for today with the new ad_spend value
 * 3. Also recalculate today's revenue/orders from Medusa DB
 * 4. Recalculate net_profit for today
 */
export default async function syncAdSpendJob(container: MedusaContainer) {
  const logger = container.resolve("logger") as any
  const profitService = container.resolve(PROFITABILITY_MODULE) as any
  const queryService = container.resolve(ContainerRegistrationKeys.QUERY)

  try {
    const today = new Date().toISOString().split("T")[0]
    const todayStart = `${today}T00:00:00.000Z`
    const todayEnd = `${today}T23:59:59.999Z`

    // 1. Get Meta Ads token
    const metaConfigs = await profitService.listMetaAdsConfigs({}, { take: 1 })
    const metaConfig = metaConfigs[0]
    const hasValidToken = metaConfig?.access_token && metaConfig?.token_status === "valid"

    // 2. Get all active projects
    const projects = await profitService.listProjectConfigs(
      { is_active: true },
      { take: 100 }
    )

    if (projects.length === 0) return

    let syncedCount = 0
    let adSpendErrors = 0

    for (const project of projects) {
      const p = project as any

      try {
        // Fetch ad spend from Meta Ads API
        let adSpend = 0
        if (hasValidToken && p.meta_ad_account_id) {
          try {
            adSpend = await getAccountSpend(
              metaConfig.access_token,
              p.meta_ad_account_id,
              today,
              today
            )
          } catch (err: any) {
            adSpendErrors++
            logger.warn(`[SyncAdSpend] Failed to fetch ad spend for ${p.project_slug}: ${err.message}`)

            // If token expired, update status
            if (err.message.includes("expired") || err.message.includes("190")) {
              await profitService.updateMetaAdsConfigs({
                id: metaConfig.id,
                token_status: "expired",
              })
            }
          }
        }

        // Compute today's revenue & orders from Medusa DB
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
                "summary.raw_current_order_total.value",
                "summary.current_order_total",
                "summary.raw_current_order_tax_total.value",
                "summary.current_order_tax_total",
                "items.quantity",
              ],
              filters: {
                sales_channel_id: p.sales_channel_id,
                created_at: { $gte: todayStart, $lte: todayEnd },
              },
            })

            for (const order of (orders || [])) {
              const o = order as any
              revenue += Number(o.summary?.raw_current_order_total?.value ?? o.summary?.current_order_total ?? 0)
              taxAmount += Number(o.summary?.raw_current_order_tax_total?.value ?? o.summary?.current_order_tax_total ?? 0)
              orderCount++
              itemCount += (o.items || []).reduce(
                (sum: number, item: any) => sum + (Number(item.quantity) || 0), 0
              )
            }
          } catch (err: any) {
            logger.warn(`[SyncAdSpend] Failed to query orders for ${p.project_slug}: ${err.message}`)
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
          { project_id: p.id, date: today },
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
            date: today,
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

        syncedCount++
      } catch (err: any) {
        logger.error(`[SyncAdSpend] Failed to sync ${p.project_slug}: ${err.message}`)
      }
    }

    logger.info(
      `[SyncAdSpend] Synced ${syncedCount}/${projects.length} projects for ${today}` +
      (adSpendErrors > 0 ? ` (${adSpendErrors} ad spend errors)` : "")
    )
  } catch (error: any) {
    logger.error(`[SyncAdSpend] Job failed: ${error.message}`)
  }
}

export const config = {
  name: "sync-ad-spend",
  schedule: "*/5 * * * *", // Every 5 minutes
}
