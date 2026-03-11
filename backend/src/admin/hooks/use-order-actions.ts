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
// Create Fulfillment (with optional tracking info)
// ═══════════════════════════════════════════
export function useCreateFulfillment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      orderId,
      items,
      trackingNumber,
      trackingUrl,
      carrier,
    }: {
      orderId: string
      items: { id: string; quantity: number }[]
      trackingNumber?: string
      trackingUrl?: string
      carrier?: string
    }) => {
      // 1. Create the fulfillment in Medusa
      const result = await sdk.admin.order.createFulfillment(orderId, { items })

      // 2. Save tracking info + set dextrum_status to PACKED (fulfilled)
      const metadata: Record<string, any> = {}
      if (trackingNumber) metadata.dextrum_tracking_number = trackingNumber
      if (trackingUrl) metadata.dextrum_tracking_url = trackingUrl
      if (carrier) metadata.dextrum_carrier = carrier
      // Set delivery status to PACKED when manually fulfilled
      if (!metadata.dextrum_status) metadata.dextrum_status = "PACKED"
      metadata.fulfilled_at = new Date().toISOString()

      if (Object.keys(metadata).length > 0) {
        await sdk.client.fetch(`/admin/custom-orders/${orderId}/metadata`, {
          method: "POST",
          body: { metadata },
        })
      }

      return result
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
      orderId,
      amount,
      note,
    }: {
      orderId: string
      amount: number
      note?: string
    }) => {
      const resp = await sdk.client.fetch(`/admin/custom-orders/${orderId}/refund`, {
        method: "POST",
        body: { amount, reason: note },
      })
      return resp as any
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-order-detail"] })
      queryClient.invalidateQueries({ queryKey: ["custom-orders-list"] })
      queryClient.invalidateQueries({ queryKey: ["custom-order-stats"] })
    },
  })
}

// ═══════════════════════════════════════════
// Capture Payment (Klarna, etc. — authorize-capture model)
// ═══════════════════════════════════════════
export function useCapturePayment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (orderId: string) => {
      return sdk.client.fetch(`/admin/custom-orders/${orderId}/capture`, {
        method: "POST",
      })
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
// Send to Dextrum (WMS)
// ═══════════════════════════════════════════
export function useSendToDextrum() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (orderId: string) => {
      return sdk.client.fetch(`/admin/dextrum/orders/${orderId}/send`, {
        method: "POST",
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-order-detail"] })
      queryClient.invalidateQueries({ queryKey: ["custom-orders-list"] })
      queryClient.invalidateQueries({ queryKey: ["custom-order-stats"] })
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
// Create Fakturoid Credit Note
// ═══════════════════════════════════════════
export function useCreateFakturoidCreditNote() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (orderId: string) => {
      return sdk.client.fetch(`/admin/custom-orders/${orderId}/fakturoid-credit`, {
        method: "POST",
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-order-detail"] })
    },
  })
}

// ═══════════════════════════════════════════
// Delete Fakturoid Invoice
// ═══════════════════════════════════════════
export function useDeleteFakturoidInvoice() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (orderId: string) => {
      return sdk.client.fetch(`/admin/custom-orders/${orderId}/fakturoid`, {
        method: "DELETE",
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-order-detail"] })
    },
  })
}

// ═══════════════════════════════════════════
// Create QuickBooks Invoice
// ═══════════════════════════════════════════
export function useCreateQBInvoice() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (orderId: string) => {
      return sdk.client.fetch(`/admin/custom-orders/${orderId}/quickbooks`, {
        method: "POST",
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-order-detail"] })
    },
  })
}

// ═══════════════════════════════════════════
// Delete QuickBooks Invoice
// ═══════════════════════════════════════════
export function useDeleteQBInvoice() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (orderId: string) => {
      return sdk.client.fetch(`/admin/custom-orders/${orderId}/quickbooks`, {
        method: "DELETE",
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-order-detail"] })
    },
  })
}

// ═══════════════════════════════════════════
// Create QuickBooks Credit Memo
// ═══════════════════════════════════════════
export function useCreateQBCreditMemo() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (orderId: string) => {
      return sdk.client.fetch(`/admin/custom-orders/${orderId}/quickbooks-credit`, {
        method: "POST",
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-order-detail"] })
    },
  })
}

// ═══════════════════════════════════════════
// Update Order Details (address, email, etc.)
// ═══════════════════════════════════════════
export function useUpdateOrderDetails() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      orderId,
      email,
      shipping_address,
      billing_address,
    }: {
      orderId: string
      email?: string
      shipping_address?: Record<string, any>
      billing_address?: Record<string, any>
    }) => {
      return sdk.client.fetch(`/admin/custom-orders/${orderId}/update`, {
        method: "POST",
        body: { email, shipping_address, billing_address },
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-order-detail"] })
      queryClient.invalidateQueries({ queryKey: ["custom-orders-list"] })
    },
  })
}

// ═══════════════════════════════════════════
// Customer Stats (order count + total spent)
// ═══════════════════════════════════════════
// ═══════════════════════════════════════════
// Resend E-books
// ═══════════════════════════════════════════
export function useResendEbooks() {
  return useMutation({
    mutationFn: async (orderId: string) => {
      return sdk.client.fetch(`/admin/custom-orders/${orderId}/resend-ebooks`, {
        method: "POST",
      })
    },
  })
}

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
