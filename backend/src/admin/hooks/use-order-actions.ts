import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { sdk } from "../lib/sdk"

// ═══════════════════════════════════════════
// Cancel Order
// ═══════════════════════════════════════════
export function useCancelOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (orderId: string) => {
      return sdk.admin.order.cancel(orderId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-order-detail"] })
      queryClient.invalidateQueries({ queryKey: ["custom-orders-list"] })
      queryClient.invalidateQueries({ queryKey: ["custom-order-stats"] })
    },
  })
}

// ═══════════════════════════════════════════
// Archive Order
// ═══════════════════════════════════════════
export function useArchiveOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (orderId: string) => {
      return sdk.admin.order.archive(orderId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-order-detail"] })
      queryClient.invalidateQueries({ queryKey: ["custom-orders-list"] })
    },
  })
}

// ═══════════════════════════════════════════
// Create Fulfillment
// ═══════════════════════════════════════════
export function useCreateFulfillment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      orderId,
      items,
    }: {
      orderId: string
      items: { id: string; quantity: number }[]
    }) => {
      return sdk.admin.order.createFulfillment(orderId, { items })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-order-detail"] })
      queryClient.invalidateQueries({ queryKey: ["custom-orders-list"] })
      queryClient.invalidateQueries({ queryKey: ["custom-order-stats"] })
    },
  })
}

// ═══════════════════════════════════════════
// Refund Payment
// ═══════════════════════════════════════════
export function useRefundPayment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      paymentId,
      amount,
      note,
    }: {
      paymentId: string
      amount: number
      note?: string
    }) => {
      return sdk.admin.payment.refund(paymentId, { amount, note })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-order-detail"] })
      queryClient.invalidateQueries({ queryKey: ["custom-orders-list"] })
      queryClient.invalidateQueries({ queryKey: ["custom-order-stats"] })
    },
  })
}

// ═══════════════════════════════════════════
// Duplicate Order
// ═══════════════════════════════════════════
export function useDuplicateOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (orderId: string) => {
      return sdk.client.fetch(`/admin/custom-orders/${orderId}/duplicate`, {
        method: "POST",
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-orders-list"] })
    },
  })
}

// ═══════════════════════════════════════════
// Send to BaseLinker
// ═══════════════════════════════════════════
export function useSendToBaseLinker() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (orderId: string) => {
      return sdk.client.fetch(`/admin/custom-orders/${orderId}/baselinker`, {
        method: "POST",
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-order-detail"] })
      queryClient.invalidateQueries({ queryKey: ["custom-orders-list"] })
    },
  })
}

// ═══════════════════════════════════════════
// Create Fakturoid Invoice
// ═══════════════════════════════════════════
export function useCreateFakturoidInvoice() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (orderId: string) => {
      return sdk.client.fetch(`/admin/custom-orders/${orderId}/fakturoid`, {
        method: "POST",
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-order-detail"] })
    },
  })
}

// ═══════════════════════════════════════════
// Customer Stats (order count + total spent)
// ═══════════════════════════════════════════
export function useCustomerStats(email: string | undefined) {
  return useQuery({
    queryKey: ["customer-stats", email],
    queryFn: async () => {
      const response = await sdk.client.fetch<{
        order_count: number
        total_spent: number
        currency: string
      }>(`/admin/custom-orders/customer-stats?email=${encodeURIComponent(email!)}`, {
        method: "GET",
      })
      return response
    },
    enabled: !!email,
  })
}
