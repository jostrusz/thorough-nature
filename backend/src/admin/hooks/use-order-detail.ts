import { useQuery } from "@tanstack/react-query"
import { sdk } from "../lib/sdk"

export function useOrderDetail(orderId: string | undefined) {
  return useQuery({
    queryKey: ["custom-order-detail", orderId],
    queryFn: async () => {
      const response = await sdk.admin.order.retrieve(orderId!, {
        fields:
          "+email,+metadata,+items.*,+items.variant.*,+items.variant.product.*,+shipping_address.*,+billing_address.*,+shipping_methods.*,+fulfillments.*,+fulfillments.items.*,+payment_collections.*,+payment_collections.payments.*",
      })
      return response
    },
    enabled: !!orderId,
  })
}
