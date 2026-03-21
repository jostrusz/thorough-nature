import { redirect } from "next/navigation"
import { isAdminAuthenticated, getAdminOrders, getAdminOrderStats } from "@lib/data/admin"
import AdminHeader from "@modules/admin/components/admin-header"
import StatsCards from "@modules/admin/components/stats-cards"
import OrdersList from "@modules/admin/components/orders-list"

export default async function OrdersPage({
  params,
}: {
  params: Promise<{ countryCode: string }>
}) {
  const { countryCode } = await params
  const authenticated = await isAdminAuthenticated()

  if (!authenticated) {
    redirect(`/${countryCode}/admin`)
  }

  let orders: any[] = []
  let count = 0
  let stats = null

  try {
    const [ordersData, statsData] = await Promise.all([
      getAdminOrders({ limit: 20, sort_by: "created_at", sort_dir: "DESC" }),
      getAdminOrderStats(),
    ])
    orders = ordersData.orders
    count = ordersData.filtered_count ?? ordersData.count
    stats = statsData
  } catch (err) {
    // Will show empty state
  }

  return (
    <div className="pb-20">
      <AdminHeader title="Orders HQ" countryCode={countryCode} />
      {stats && <StatsCards stats={stats} />}
      <OrdersList
        initialOrders={orders}
        initialCount={count}
        countryCode={countryCode}
      />
    </div>
  )
}
