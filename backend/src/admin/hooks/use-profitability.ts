import { useQuery } from "@tanstack/react-query"
import { sdk } from "../lib/sdk"

export type Period = "today" | "yesterday" | "this_week" | "this_month" | "custom"

export interface ProjectStats {
  project_id: string
  project_name: string
  project_slug: string
  flag_emoji: string
  country_tag: string
  revenue: number
  tax_amount: number
  order_count: number
  item_count: number
  refund_amount: number
  ad_spend: number
  book_cost_total: number
  shipping_cost_total: number
  pick_pack_total: number
  payment_fee_total: number
  net_profit: number
  profit_margin: number
}

export interface ProfitabilityTotals {
  revenue: number
  order_count: number
  ad_spend: number
  net_profit: number
}

export interface ProfitabilityResponse {
  projects: ProjectStats[]
  totals: ProfitabilityTotals
  period: string
  last_synced_at: string
}

export function useProfitability(
  period: Period,
  dateFrom?: string,
  dateTo?: string
) {
  const params = new URLSearchParams({ period })
  if (period === "custom" && dateFrom && dateTo) {
    params.set("date_from", dateFrom)
    params.set("date_to", dateTo)
  }

  return useQuery<ProfitabilityResponse>({
    queryKey: ["profitability", period, dateFrom, dateTo],
    queryFn: async () => {
      const response = await sdk.client.fetch<ProfitabilityResponse>(
        `/admin/profitability/stats?${params}`
      )
      return response
    },
    refetchInterval: period === "today" ? 60_000 : false,
    enabled: period !== "custom" || (!!dateFrom && !!dateTo),
  })
}
