import { useMutation, useQueryClient } from "@tanstack/react-query"
import { sdk } from "../lib/sdk"

interface BulkActionParams {
  action: "update_metadata" | "export"
  order_ids?: string[]
  payload?: Record<string, any>
  date_from?: string
  date_to?: string
}

export function useBulkActions() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: BulkActionParams) => {
      const response = await sdk.client.fetch<any>(
        "/admin/custom-orders/bulk",
        {
          method: "POST",
          body: params,
        }
      )
      return response
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-orders-list"] })
      queryClient.invalidateQueries({ queryKey: ["custom-order-stats"] })
    },
  })
}
