"use server"

import { getAdminToken, setAdminToken, removeAdminToken } from "./admin-cookies"

const BACKEND_URL =
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000"

async function adminFetch(path: string, options: RequestInit = {}) {
  const token = await getAdminToken()
  if (!token) {
    throw new Error("Not authenticated")
  }

  const res = await fetch(`${BACKEND_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      authorization: `Bearer ${token}`,
      ...options.headers,
    },
    cache: "no-store",
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`Admin API error ${res.status}: ${text}`)
  }

  return res.json()
}

// ── Auth ──

export async function adminLogin(email: string, password: string) {
  // Step 1: Authenticate to get token
  const authRes = await fetch(`${BACKEND_URL}/auth/user/emailpass`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  })

  if (!authRes.ok) {
    throw new Error("Invalid credentials")
  }

  const authData = await authRes.json()
  const token = authData.token

  if (!token) {
    throw new Error("No token received")
  }

  await setAdminToken(token)
  return { success: true }
}

export async function adminLogout() {
  await removeAdminToken()
  return { success: true }
}

export async function isAdminAuthenticated() {
  const token = await getAdminToken()
  return !!token
}

// ── Orders ──

export interface OrdersListParams {
  limit?: number
  offset?: number
  q?: string
  delivery_status?: string
  country?: string
  payment_status?: string
  sort_by?: string
  sort_dir?: string
}

export async function getAdminOrders(params: OrdersListParams = {}) {
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
  return adminFetch(`/admin/custom-orders${qs ? `?${qs}` : ""}`)
}

export async function getAdminOrder(orderId: string) {
  return adminFetch(`/admin/custom-orders/${orderId}`)
}

// ── Stats ──

export async function getAdminOrderStats() {
  return adminFetch("/admin/custom-orders/stats")
}

// ── Order Actions ──

export async function capturePayment(orderId: string, paymentId: string) {
  return adminFetch(`/admin/orders/${orderId}/fulfillments`, {
    method: "POST",
    body: JSON.stringify({ payment_id: paymentId }),
  })
}

export async function createFulfillment(
  orderId: string,
  data: { items: { id: string; quantity: number }[]; tracking_number?: string }
) {
  return adminFetch(`/admin/custom-orders/${orderId}/fulfill`, {
    method: "POST",
    body: JSON.stringify(data),
  })
}

export async function refundPayment(
  orderId: string,
  data: { amount: number; note?: string }
) {
  return adminFetch(`/admin/custom-orders/${orderId}/refund`, {
    method: "POST",
    body: JSON.stringify(data),
  })
}

export async function cancelOrder(orderId: string) {
  return adminFetch(`/admin/orders/${orderId}/cancel`, {
    method: "POST",
  })
}

export async function updateOrderMetadata(
  orderId: string,
  metadata: Record<string, unknown>
) {
  return adminFetch(`/admin/custom-orders/${orderId}`, {
    method: "POST",
    body: JSON.stringify({ metadata }),
  })
}
