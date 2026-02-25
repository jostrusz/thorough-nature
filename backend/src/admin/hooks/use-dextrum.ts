import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { sdk } from "../lib/sdk"

// ═══════════════════════════════════════════
// Get Dextrum Config
// ═══════════════════════════════════════════
export function useDextrumConfig() {
  return useQuery({
    queryKey: ["dextrum-config"],
    queryFn: async () => {
      const response = await sdk.client.fetch<{ config: any }>("/admin/dextrum")
      return response.config
    },
  })
}

// ═══════════════════════════════════════════
// Save Dextrum Config
// ═══════════════════════════════════════════
export function useSaveDextrumConfig() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: Record<string, any>) => {
      return sdk.client.fetch("/admin/dextrum", {
        method: "POST",
        body: data,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dextrum-config"] })
    },
  })
}

// ═══════════════════════════════════════════
// Test Connection
// ═══════════════════════════════════════════
export function useTestDextrumConnection() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      return sdk.client.fetch<{ ok: boolean; message: string }>(
        "/admin/dextrum/test-connection",
        { method: "POST" }
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dextrum-config"] })
    },
  })
}

// ═══════════════════════════════════════════
// Send Order to WMS
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
// List Dextrum Orders
// ═══════════════════════════════════════════
export function useDextrumOrders(params?: { status?: string; limit?: number }) {
  return useQuery({
    queryKey: ["dextrum-orders", params],
    queryFn: async () => {
      const searchParams = new URLSearchParams()
      if (params?.status) searchParams.set("status", params.status)
      if (params?.limit) searchParams.set("limit", String(params.limit))
      const qs = searchParams.toString()
      return sdk.client.fetch<{ orders: any[]; count: number }>(
        `/admin/dextrum/orders${qs ? `?${qs}` : ""}`
      )
    },
    refetchInterval: 60000, // Refresh every 60s
  })
}

// ═══════════════════════════════════════════
// Dextrum Inventory
// ═══════════════════════════════════════════
export function useDextrumInventory(params?: { q?: string; low_stock?: boolean; limit?: number }) {
  return useQuery({
    queryKey: ["dextrum-inventory", params],
    queryFn: async () => {
      const searchParams = new URLSearchParams()
      if (params?.q) searchParams.set("q", params.q)
      if (params?.low_stock) searchParams.set("low_stock", "true")
      if (params?.limit) searchParams.set("limit", String(params.limit))
      const qs = searchParams.toString()
      return sdk.client.fetch<{ inventory: any[]; count: number; last_sync: string | null; last_sync_products: number; last_sync_updated: number }>(
        `/admin/dextrum/inventory${qs ? `?${qs}` : ""}`
      )
    },
    refetchInterval: 120000, // Refresh every 2 min
  })
}

// ═══════════════════════════════════════════
// Sync Dextrum Inventory
// ═══════════════════════════════════════════
export function useSyncDextrumInventory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      return sdk.client.fetch<{ success: boolean; products: number; updated: number }>(
        "/admin/dextrum/inventory/sync",
        { method: "POST" }
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dextrum-inventory"] })
      queryClient.invalidateQueries({ queryKey: ["dextrum-config"] })
    },
  })
}
