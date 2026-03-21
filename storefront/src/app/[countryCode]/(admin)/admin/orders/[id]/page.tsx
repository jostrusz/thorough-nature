import { redirect } from "next/navigation"
import { isAdminAuthenticated, getAdminOrder } from "@lib/data/admin"
import AdminHeader from "@modules/admin/components/admin-header"
import OrderDetailView from "@modules/admin/components/order-detail-view"

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ countryCode: string; id: string }>
}) {
  const { countryCode, id } = await params
  const authenticated = await isAdminAuthenticated()

  if (!authenticated) {
    redirect(`/${countryCode}/admin`)
  }

  let order: any = null

  try {
    const data = await getAdminOrder(id)
    order = data.order || data
  } catch {
    // Will show error state
  }

  if (!order) {
    return (
      <div>
        <AdminHeader
          title="Order"
          countryCode={countryCode}
          showBack
          backHref={`/${countryCode}/admin/orders`}
        />
        <div className="px-4 py-12 text-center text-sm text-slate-400">
          Order not found
        </div>
      </div>
    )
  }

  const orderNumber =
    order.metadata?.custom_order_number || `#${order.display_id}`

  return (
    <div>
      <AdminHeader
        title={orderNumber}
        countryCode={countryCode}
        showBack
        backHref={`/${countryCode}/admin/orders`}
      />
      <OrderDetailView order={order} countryCode={countryCode} />
    </div>
  )
}
