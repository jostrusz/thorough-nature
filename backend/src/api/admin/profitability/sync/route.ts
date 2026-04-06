import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { PROFITABILITY_MODULE } from "../../../../modules/profitability"
import type ProfitabilityModuleService from "../../../../modules/profitability/service"

/** Fixed exchange rates to EUR */
const TO_EUR_RATES: Record<string, number> = {
  EUR: 1, SEK: 0.085, CZK: 0.040, PLN: 0.233, USD: 0.92, GBP: 1.16, HUF: 0.0025,
}
function toEur(amount: number, currencyCode: string): number {
  return amount * (TO_EUR_RATES[(currencyCode || "EUR").toUpperCase()] ?? 1)
}

/**
 * POST /admin/profitability/sync
 * Manually trigger a full sync: recalculate all projects for today
 */
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve(PROFITABILITY_MODULE) as ProfitabilityModuleService
  const queryService = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const logger = req.scope.resolve("logger") as any

  try {
    const today = new Date().toISOString().split("T")[0]
    const todayStart = `${today}T00:00:00.000Z`
    const todayEnd = `${today}T23:59:59.999Z`

    const projects = await service.listProjectConfigs(
      { is_active: true },
      { take: 100 }
    )

    let syncedCount = 0

    for (const project of projects) {
      const p = project as any

      try {
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
                "total",
                "tax_total",
                "items.*",
              ],
              filters: {
                sales_channel_id: p.sales_channel_id,
                created_at: { $gte: todayStart, $lte: todayEnd },
              },
            })

            for (const order of (orders || [])) {
              const o = order as any
              revenue += Number(o.total ?? 0)
              taxAmount += Number(o.tax_total ?? 0)
              orderCount++
              itemCount += (o.items || []).reduce(
                (sum: number, item: any) => sum + (Number(item.quantity) || 0), 0
              )
            }
          } catch (err: any) {
            logger.warn(`[ProfitSync] Failed to query orders for ${p.project_slug}: ${err.message}`)
          }
        }

        // Convert revenue from project currency to EUR
        const curr = ((p.currency_code as string) || "EUR").toUpperCase()
        const revenueEur = toEur(revenue, curr)
        const taxAmountEur = toEur(taxAmount, curr)

        // Calculate costs (already in EUR from project config)
        const bookCostTotal = itemCount * Number(p.book_cost_eur || 1.80)
        const shippingCostTotal = orderCount * Number(p.shipping_cost_eur || 5.00)
        const pickPackTotal = orderCount * Number(p.pick_pack_cost_eur || 1.50)
        const paymentFeeTotal = revenueEur * Number(p.payment_fee_rate || 0.03)

        // Get existing ad_spend (preserve from cron job, already in EUR)
        let adSpend = 0
        let refundAmount = 0
        const existing = await service.listDailyProjectStats(
          { project_id: p.id, date: today } as any,
          { take: 1 }
        )
        if (existing.length > 0) {
          adSpend = Number((existing[0] as any).ad_spend || 0)
          refundAmount = Number((existing[0] as any).refund_amount || 0)
        }

        const netProfit = revenueEur - taxAmountEur - refundAmount - adSpend
          - bookCostTotal - shippingCostTotal - pickPackTotal - paymentFeeTotal

        // Upsert daily stats (all values in EUR)
        if (existing.length > 0) {
          await service.updateDailyProjectStats({
            id: (existing[0] as any).id,
            revenue: revenueEur,
            tax_amount: taxAmountEur,
            order_count: orderCount,
            item_count: itemCount,
            book_cost_total: bookCostTotal,
            shipping_cost_total: shippingCostTotal,
            pick_pack_total: pickPackTotal,
            payment_fee_total: paymentFeeTotal,
            net_profit: netProfit,
            last_synced_at: new Date(),
          })
        } else {
          await service.createDailyProjectStats({
            project_id: p.id,
            date: today,
            revenue: revenueEur,
            tax_amount: taxAmountEur,
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
        logger.warn(`[ProfitSync] Failed to sync ${p.project_slug}: ${err.message}`)
      }
    }

    res.json({
      success: true,
      synced_projects: syncedCount,
      total_projects: projects.length,
      date: today,
      synced_at: new Date().toISOString(),
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
}
