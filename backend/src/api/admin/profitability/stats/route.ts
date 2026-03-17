import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { PROFITABILITY_MODULE } from "../../../../modules/profitability"
import type ProfitabilityModuleService from "../../../../modules/profitability/service"

type Period = "today" | "yesterday" | "this_week" | "this_month" | "custom"

/**
 * GET /admin/profitability/stats?period=today|yesterday|this_week|this_month|custom&date_from=YYYY-MM-DD&date_to=YYYY-MM-DD
 * Returns profitability data for all active projects for the given period
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve(PROFITABILITY_MODULE) as ProfitabilityModuleService

  try {
    const period = (req.query.period as Period) || "today"
    const dateFrom = req.query.date_from as string | undefined
    const dateTo = req.query.date_to as string | undefined

    // Validate custom period
    if (period === "custom" && (!dateFrom || !dateTo)) {
      res.status(400).json({ error: "date_from and date_to are required for custom period" })
      return
    }

    // Compute date range
    const { from, to } = getDateRange(period, dateFrom, dateTo)

    // Validate max 90 days
    const daysDiff = Math.ceil((new Date(to).getTime() - new Date(from).getTime()) / (1000 * 60 * 60 * 24)) + 1
    if (daysDiff > 90) {
      res.status(400).json({ error: "Maximum allowed range is 90 days" })
      return
    }

    // Get all active projects
    const projects = await service.listProjectConfigs(
      { is_active: true },
      { order: { display_order: "ASC" }, take: 100 }
    )

    // For "today", compute live from Medusa DB
    if (period === "today") {
      const liveStats = await computeLiveStats(req, service, projects, from)
      res.json(liveStats)
      return
    }

    // For historical periods, aggregate from daily_project_stats
    const projectStats = await Promise.all(
      projects.map(async (project: any) => {
        const stats = await service.listDailyProjectStats(
          {
            project_id: project.id,
            date: generateDateArray(from, to),
          } as any,
          { take: 100 }
        )

        const aggregated = aggregateStats(stats)
        const profitMargin = aggregated.revenue > 0
          ? (aggregated.net_profit / aggregated.revenue) * 100
          : 0

        return {
          project_id: project.id,
          project_name: project.project_name,
          project_slug: project.project_slug,
          flag_emoji: project.flag_emoji,
          country_tag: project.country_tag,
          ...aggregated,
          profit_margin: Math.round(profitMargin * 100) / 100,
        }
      })
    )

    const totals = {
      revenue: projectStats.reduce((sum, p) => sum + p.revenue, 0),
      order_count: projectStats.reduce((sum, p) => sum + p.order_count, 0),
      ad_spend: projectStats.reduce((sum, p) => sum + p.ad_spend, 0),
      net_profit: projectStats.reduce((sum, p) => sum + p.net_profit, 0),
    }

    res.json({
      projects: projectStats,
      totals,
      period,
      last_synced_at: new Date().toISOString(),
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
}

/**
 * Compute live stats for "today" from Medusa DB
 */
async function computeLiveStats(
  req: MedusaRequest,
  service: ProfitabilityModuleService,
  projects: any[],
  todayStr: string
) {
  const queryService = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const logger = req.scope.resolve("logger") as any
  const todayStart = `${todayStr}T00:00:00.000Z`
  const todayEnd = `${todayStr}T23:59:59.999Z`

  const projectStats = await Promise.all(
    projects.map(async (project: any) => {
      // Check if we have cached stats for today
      const cachedStats = await service.listDailyProjectStats(
        { project_id: project.id, date: todayStr } as any,
        { take: 1 }
      )

      // Get today's orders from Medusa DB for this project's sales channel
      let revenue = 0
      let taxAmount = 0
      let orderCount = 0
      let itemCount = 0
      let refundAmount = 0

      try {
        if (project.sales_channel_id) {
          const { data: orders } = await queryService.graph({
            entity: "order",
            fields: [
              "id",
              "summary.raw_current_order_total.value",
              "summary.current_order_total",
              "summary.raw_current_order_tax_total.value",
              "summary.current_order_tax_total",
              "items.*",
            ],
            filters: {
              sales_channel_id: project.sales_channel_id,
              created_at: { $gte: todayStart, $lte: todayEnd },
            },
          })

          for (const order of (orders || [])) {
            const orderObj = order as any
            const total = orderObj.summary?.raw_current_order_total?.value
              ?? orderObj.summary?.current_order_total
              ?? 0
            const tax = orderObj.summary?.raw_current_order_tax_total?.value
              ?? orderObj.summary?.current_order_tax_total
              ?? 0

            revenue += Number(total)
            taxAmount += Number(tax)
            orderCount++
            itemCount += (orderObj.items || []).reduce(
              (sum: number, item: any) => sum + (Number(item.quantity) || 0), 0
            )
          }
        }
      } catch (err: any) {
        logger.warn(`[ProfitStats] Failed to query orders for ${project.project_slug}: ${err.message}`)
      }

      // Use cached ad_spend from the cron job
      const adSpend = cachedStats.length > 0
        ? Number((cachedStats[0] as any).ad_spend || 0)
        : 0

      // Calculate costs
      const bookCostTotal = itemCount * Number(project.book_cost_eur || 1.80)
      const shippingCostTotal = orderCount * Number(project.shipping_cost_eur || 5.00)
      const pickPackTotal = orderCount * Number(project.pick_pack_cost_eur || 1.50)
      const paymentFeeTotal = revenue * Number(project.payment_fee_rate || 0.03)

      const netProfit = revenue - taxAmount - refundAmount - adSpend
        - bookCostTotal - shippingCostTotal - pickPackTotal - paymentFeeTotal

      const profitMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0

      return {
        project_id: project.id,
        project_name: project.project_name,
        project_slug: project.project_slug,
        flag_emoji: project.flag_emoji,
        country_tag: project.country_tag,
        revenue: Math.round(revenue * 100) / 100,
        tax_amount: Math.round(taxAmount * 100) / 100,
        order_count: orderCount,
        item_count: itemCount,
        refund_amount: Math.round(refundAmount * 100) / 100,
        ad_spend: Math.round(adSpend * 100) / 100,
        book_cost_total: Math.round(bookCostTotal * 100) / 100,
        shipping_cost_total: Math.round(shippingCostTotal * 100) / 100,
        pick_pack_total: Math.round(pickPackTotal * 100) / 100,
        payment_fee_total: Math.round(paymentFeeTotal * 100) / 100,
        net_profit: Math.round(netProfit * 100) / 100,
        profit_margin: Math.round(profitMargin * 100) / 100,
      }
    })
  )

  const totals = {
    revenue: Math.round(projectStats.reduce((sum, p) => sum + p.revenue, 0) * 100) / 100,
    order_count: projectStats.reduce((sum, p) => sum + p.order_count, 0),
    ad_spend: Math.round(projectStats.reduce((sum, p) => sum + p.ad_spend, 0) * 100) / 100,
    net_profit: Math.round(projectStats.reduce((sum, p) => sum + p.net_profit, 0) * 100) / 100,
  }

  return {
    projects: projectStats,
    totals,
    period: "today",
    last_synced_at: new Date().toISOString(),
  }
}

/**
 * Get date range from period
 */
function getDateRange(period: Period, dateFrom?: string, dateTo?: string): { from: string; to: string } {
  const now = new Date()
  const fmt = (d: Date) => d.toISOString().split("T")[0]

  switch (period) {
    case "today":
      return { from: fmt(now), to: fmt(now) }
    case "yesterday": {
      const yesterday = new Date(now)
      yesterday.setDate(yesterday.getDate() - 1)
      return { from: fmt(yesterday), to: fmt(yesterday) }
    }
    case "this_week": {
      const startOfWeek = new Date(now)
      const day = startOfWeek.getDay()
      const diff = day === 0 ? 6 : day - 1 // Monday start
      startOfWeek.setDate(startOfWeek.getDate() - diff)
      return { from: fmt(startOfWeek), to: fmt(now) }
    }
    case "this_month": {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      return { from: fmt(startOfMonth), to: fmt(now) }
    }
    case "custom":
      return { from: dateFrom!, to: dateTo! }
    default:
      return { from: fmt(now), to: fmt(now) }
  }
}

/**
 * Generate array of date strings between from and to
 */
function generateDateArray(from: string, to: string): string[] {
  const dates: string[] = []
  const current = new Date(from)
  const end = new Date(to)

  while (current <= end) {
    dates.push(current.toISOString().split("T")[0])
    current.setDate(current.getDate() + 1)
  }

  return dates
}

/**
 * Aggregate multiple daily_project_stats rows into one summary
 */
function aggregateStats(stats: any[]) {
  return {
    revenue: stats.reduce((sum, s) => sum + Number(s.revenue || 0), 0),
    tax_amount: stats.reduce((sum, s) => sum + Number(s.tax_amount || 0), 0),
    order_count: stats.reduce((sum, s) => sum + Number(s.order_count || 0), 0),
    item_count: stats.reduce((sum, s) => sum + Number(s.item_count || 0), 0),
    refund_amount: stats.reduce((sum, s) => sum + Number(s.refund_amount || 0), 0),
    ad_spend: stats.reduce((sum, s) => sum + Number(s.ad_spend || 0), 0),
    book_cost_total: stats.reduce((sum, s) => sum + Number(s.book_cost_total || 0), 0),
    shipping_cost_total: stats.reduce((sum, s) => sum + Number(s.shipping_cost_total || 0), 0),
    pick_pack_total: stats.reduce((sum, s) => sum + Number(s.pick_pack_total || 0), 0),
    payment_fee_total: stats.reduce((sum, s) => sum + Number(s.payment_fee_total || 0), 0),
    net_profit: stats.reduce((sum, s) => sum + Number(s.net_profit || 0), 0),
  }
}
