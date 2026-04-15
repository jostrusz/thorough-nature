import { useQuery, keepPreviousData } from "@tanstack/react-query"
import { sdk } from "../lib/sdk"

interface OrdersListParams {
  limit?: number
  offset?: number
  q?: string
  delivery_status?: string
  country?: string
  payment_status?: string
  sort_by?: string
  sort_dir?: string
}

interface OrdersListResponse {
  orders: any[]
  count: number
  filtered_count: number
}

export function useOrdersList(params: OrdersListParams) {
  return useQuery<OrdersListResponse>({
    queryKey: ["custom-orders-list", params],
    queryFn: async ({ signal }) => {
      const searchParams = new URLSearchParams()
      if (params.limit) searchParams.set("limit", String(params.limit))
      if (params.offset) searchParams.set("offset", String(params.offset))
      if (params.q) searchParams.set("q", params.q)
      if (params.delivery_status)
        searchParams.set("delivery_status", params.delivery_status)
      if (params.country) searchParams.set("country", params.country)
      if (params.payment_status)
        searchParams.set("payment_status", params.payment_status)
      if (params.sort_by) searchParams.set("sort_by", params.sort_by)
      if (params.sort_dir) searchParams.set("sort_dir", params.sort_dir)

      const qs = searchParams.toString()
      // Pass the AbortSignal so stale requests get cancelled when the user
      // keeps typing (React Query aborts on queryKey change).
      const response = await sdk.client.fetch<OrdersListResponse>(
        `/admin/custom-orders${qs ? `?${qs}` : ""}`,
        { signal } as any
      )
      return response
    },
    placeholderData: keepPreviousData,
    // Don't auto-refetch while actively searching — it blows away results
    // as the user types. Only poll on the default (unsearched) list.
    refetchInterval: params.q ? false : 10000,
    refetchIntervalInBackground: false,
    // Keep previous results visible during refetch → no flicker to empty state
    staleTime: params.q ? 30_000 : 0,
  })
}
