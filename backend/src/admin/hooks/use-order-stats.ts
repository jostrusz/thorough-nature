import { useQuery } from "@tanstack/react-query"
import { sdk } from "../lib/sdk"

interface OrderStats {
  ordersToday: number
  revenueToday: number
  ordersYesterday: number
  revenueYesterday: number
  unfulfilled: number
  inTransit: number
}

export function useOrderStats() {
  return useQuery<OrderStats>({
    queryKey: ["custom-order-stats"],
    queryFn: async () => {
      const response = await sdk.client.fetch<OrderStats>(
        "/admin/custom-orders/stats"
      )
      return response
    },
    refetchInterval: 60000, // Refetch every 60 seconds
  })
}
