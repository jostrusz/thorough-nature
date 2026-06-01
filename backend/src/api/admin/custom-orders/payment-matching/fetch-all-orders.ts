import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * Shared helper for the Payment Matcher endpoints.
 *
 * Fetches ALL orders in a date range by paginating through query.graph in
 * batches, instead of capping at a fixed `take`. The shipping address name
 * fields are requested directly on the graph (same-module relation), so there
 * is NO per-order address lookup (the previous N+1 retrieve loop is gone).
 */

const PAGE_SIZE = 1000
// Safety backstop so a malformed/empty date range can never loop forever.
const MAX_ORDERS = 200_000

export function buildDateFilters(from: string, to: string): Record<string, any> {
  const filters: Record<string, any> = {}
  if (from || to) {
    filters.created_at = {}
    if (from) filters.created_at.$gte = new Date(from).toISOString()
    if (to) {
      const toDate = new Date(to)
      toDate.setDate(toDate.getDate() + 1) // Include the full 'to' day
      filters.created_at.$lt = toDate.toISOString()
    }
  }
  return filters
}

export async function fetchAllOrders(
  scope: any,
  filters: Record<string, any>,
  order: "ASC" | "DESC" = "DESC"
): Promise<any[]> {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)

  const all: any[] = []
  let skip = 0

  while (skip < MAX_ORDERS) {
    const { data: page } = await query.graph({
      entity: "order",
      fields: [
        "id",
        "display_id",
        "created_at",
        "email",
        "currency_code",
        "total",
        "subtotal",
        "metadata",
        // Address name fields directly — no separate retrieve needed
        "shipping_address.id",
        "shipping_address.first_name",
        "shipping_address.last_name",
        "shipping_address.company",
        "payment_collections.*",
        "payment_collections.payments.*",
      ],
      filters,
      pagination: {
        skip,
        take: PAGE_SIZE,
        order: { created_at: order },
      },
    })

    all.push(...page)

    if (page.length < PAGE_SIZE) break
    skip += PAGE_SIZE
  }

  return all
}
