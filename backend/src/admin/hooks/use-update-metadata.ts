import { useMutation, useQueryClient } from "@tanstack/react-query"
import { sdk } from "../lib/sdk"

interface UpdateMetadataParams {
  orderId: string
  metadata: Record<string, any>
}

export function useUpdateMetadata() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ orderId, metadata }: UpdateMetadataParams) => {
      const response = await sdk.client.fetch(
        `/admin/custom-orders/${orderId}/metadata`,
        {
          method: "POST",
          body: { metadata },
        }
      )
      return response
    },
    onSuccess: (_data, variables) => {
      // Invalidate both the detail and list queries
      queryClient.invalidateQueries({
        queryKey: ["custom-order-detail", variables.orderId],
      })
      queryClient.invalidateQueries({
        queryKey: ["custom-orders-list"],
      })
      queryClient.invalidateQueries({
        queryKey: ["custom-order-stats"],
      })
    },
  })
}
