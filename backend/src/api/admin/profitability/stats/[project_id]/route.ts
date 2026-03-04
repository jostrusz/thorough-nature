import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { PROFITABILITY_MODULE } from "../../../../../modules/profitability"
import type ProfitabilityModuleService from "../../../../../modules/profitability/service"

type Period = "today" | "yesterday" | "this_week" | "this_month" | "custom"

/**
 * GET /admin/profitability/stats/:project_id?period=...&date_from=...&date_to=...
 * Returns detailed profitability data for a single project
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const { project_id } = req.params
  const service = req.scope.resolve(PROFITABILITY_MODULE) as ProfitabilityModuleService

  try {
    const period = (req.query.period as Period) || "today"
    const dateFrom = req.query.date_from as string | undefined
    const dateTo = req.query.date_to as string | undefined

    if (period === "custom" && (!dateFrom || !dateTo)) {
      res.status(400).json({ error: "date_from and date_to are required for custom period" })
      return
    }

    // Verify project exists
    const project = await service.retrieveProjectConfig(project_id)
    if (!project) {
      res.status(404).json({ error: "Project not found" })
      return
    }

    const { from, to } = getDateRange(period, dateFrom, dateTo)
    const dates = generateDateArray(from, to)

    // Get daily stats for the period
    const stats = await service.listDailyProjectStats(
      { project_id, date: dates } as any,
      { take: 100, order: { date: "ASC" } }
    )

    // Aggregate
    const aggregated = {
      revenue: stats.reduce((sum: number, s: any) => sum + Number(s.revenue || 0), 0),
      tax_amount: stats.reduce((sum: number, s: any) => sum + Number(s.tax_amount || 0), 0),
      order_count: stats.reduce((sum: number, s: any) => sum + Number(s.order_count || 0), 0),
      item_count: stats.reduce((sum: number, s: any) => sum + Number(s.item_count || 0), 0),
      refund_amount: stats.reduce((sum: number, s: any) => sum + Number(s.refund_amount || 0), 0),
      ad_spend: stats.reduce((sum: number, s: any) => sum + Number(s.ad_spend || 0), 0),
      book_cost_total: stats.reduce((sum: number, s: any) => sum + Number(s.book_cost_total || 0), 0),
      shipping_cost_total: stats.reduce((sum: number, s: any) => sum + Number(s.shipping_cost_total || 0), 0),
      pick_pack_total: stats.reduce((sum: number, s: any) => sum + Number(s.pick_pack_total || 0), 0),
      payment_fee_total: stats.reduce((sum: number, s: any) => sum + Number(s.payment_fee_total || 0), 0),
      net_profit: stats.reduce((sum: number, s: any) => sum + Number(s.net_profit || 0), 0),
    }

    const profitMargin = aggregated.revenue > 0
      ? (aggregated.net_profit / aggregated.revenue) * 100
      : 0

    res.json({
      project: {
        project_id: (project as any).id,
        project_name: (project as any).project_name,
        project_slug: (project as any).project_slug,
        flag_emoji: (project as any).flag_emoji,
        country_tag: (project as any).country_tag,
        ...aggregated,
        profit_margin: Math.round(profitMargin * 100) / 100,
      },
      daily_breakdown: stats.map((s: any) => ({
        date: s.date,
        revenue: Number(s.revenue || 0),
        order_count: Number(s.order_count || 0),
        ad_spend: Number(s.ad_spend || 0),
        net_profit: Number(s.net_profit || 0),
      })),
      period,
      last_synced_at: new Date().toISOString(),
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
}

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
      const diff = day === 0 ? 6 : day - 1
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
