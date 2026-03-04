import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { PROFITABILITY_MODULE } from "../modules/profitability"
import { getAccountSpend } from "../modules/profitability/services/meta-ads.service"

/**
 * Nightly Stats Recalculation Job
 *
 * Runs daily at 00:05:
 * 1. Recalculates yesterday's final numbers from Medusa DB
 * 2. Fetches final ad spend for yesterday
 * 3. Ensures data integrity for completed days
 */
export default async function recalculateDailyStatsJob(container: MedusaContainer) {
  const logger = container.resolve("logger") as any
  const profitService = container.resolve(PROFITABILITY_MODULE) as any
  const queryService = container.resolve(ContainerRegistrationKeys.QUERY)

  try {
    // Calculate yesterday's date
    const now = new Date()
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().split("T")[0]
    const yesterdayStart = `${yesterdayStr}T00:00:00.000Z`
    const yesterdayEnd = `${yesterdayStr}T23:59:59.999Z`

    logger.info(`[RecalcStats] Recalculating stats for ${yesterdayStr}...`)

    // Get Meta Ads token for ad spend
    const metaConfigs = await profitService.listMetaAdsConfigs({}, { take: 1 })
    const metaConfig = metaConfigs[0]
    const hasValidToken = metaConfig?.access_token && metaConfig?.token_status === "valid"

    // Get all active projects
    const projects = await profitService.listProjectConfigs(
      { is_active: true },
      { take: 100 }
    )

    let syncedCount = 0

    for (const project of projects) {
      const p = project as any

      try {
        // Fetch final ad spend for yesterday
        let adSpend = 0
        if (hasValidToken && p.meta_ad_account_id) {
          try {
            adSpend = await getAccountSpend(
              metaConfig.access_token,
              p.meta_ad_account_id,
              yesterdayStr,
              yesterdayStr
            )
          } catch (err: any) {
            logger.warn(`[RecalcStats] Failed to fetch ad spend for ${p.project_slug}: ${err.message}`)
          }
        }

        // Get yesterday's orders from Medusa DB
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
                created_at: { $gte: yesterdayStart, $lte: yesterdayEnd },
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
            logger.warn(`[RecalcStats] Failed to query orders for ${p.project_slug}: ${err.message}`)
          }
        }

        // Calculate costs
        const bookCostTotal = itemCount * Number(p.book_cost_eur || 1.80)
        const shippingCostTotal = orderCount * Number(p.shipping_cost_eur || 5.00)
        const pickPackTotal = orderCount * Number(p.pick_pack_cost_eur || 1.50)
        const paymentFeeTotal = revenue * Number(p.payment_fee_rate || 0.03)

        // Preserve refund_amount from the existing row
        let refundAmount = 0
        const existing = await profitService.listDailyProjectStats(
          { project_id: p.id, date: yesterdayStr },
          { take: 1 }
        )
        if (existing.length > 0) {
          refundAmount = Number((existing[0] as any).refund_amount || 0)
        }

        const netProfit = revenue - taxAmount - refundAmount - adSpend
          - bookCostTotal - shippingCostTotal - pickPackTotal - paymentFeeTotal

        // Upsert
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
            date: yesterdayStr,
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
        logger.error(`[RecalcStats] Failed to recalc ${p.project_slug}: ${err.message}`)
      }
    }

    logger.info(`[RecalcStats] Recalculated ${syncedCount}/${projects.length} projects for ${yesterdayStr}`)
  } catch (error: any) {
    logger.error(`[RecalcStats] Job failed: ${error.message}`)
  }
}

export const config = {
  name: "recalculate-daily-stats",
  schedule: "5 0 * * *", // Every day at 00:05
}
