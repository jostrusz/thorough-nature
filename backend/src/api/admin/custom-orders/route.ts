import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { IOrderModuleService } from "@medusajs/framework/types"

/**
 * Fast DB-level search: run a single SQL query against indexed text columns
 * (pg_trgm GIN indexes on email, metadata, address, tracking, payment data,
 * line item titles) and return matching order IDs. Scales to 100k+ orders.
 *
 * Applies country + delivery_status in SQL so LIMIT is respected.
 * paymentStatus is computed in JS after fetch, so we pull up to 400 candidates
 * to survive that post-filter.
 */
async function searchOrderIds(
  q: string,
  opts: { country?: string; deliveryStatus?: string; paymentStatus?: string },
  logger: any
): Promise<string[]> {
  const { Pool } = require("pg")
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
  try {
    const params: any[] = []
    const whereParts: string[] = [`o.deleted_at IS NULL`]

    // ── Tokenised "contains" fulltext ──
    // Split the query into words; EVERY word must appear somewhere on the order
    // (order-independent), each matched as a substring (ILIKE %word%). So
    // "beata o2" matches a customer named Beata with an o2.pl email, and
    // "129 odpusc" matches a 129-total Odpuść order.
    const fieldOr = (i: number) => `(
      o.display_id::text ILIKE $${i}
      OR o.id ILIKE $${i}
      OR o.email ILIKE $${i}
      OR o.metadata::text ILIKE $${i}
      OR sa.first_name ILIKE $${i} OR sa.last_name ILIKE $${i} OR sa.company ILIKE $${i}
      OR sa.address_1 ILIKE $${i} OR sa.address_2 ILIKE $${i} OR sa.city ILIKE $${i}
      OR sa.postal_code ILIKE $${i} OR sa.country_code ILIKE $${i} OR sa.phone ILIKE $${i}
      OR ba.first_name ILIKE $${i} OR ba.last_name ILIKE $${i} OR ba.company ILIKE $${i}
      OR li.title ILIKE $${i} OR li.variant_sku ILIKE $${i}
      OR li.variant_title ILIKE $${i} OR li.product_title ILIKE $${i}
      OR p.provider_id ILIKE $${i} OR p.data::text ILIKE $${i}
      OR fl.tracking_number ILIKE $${i}
    )`
    const tokens = q.trim().split(/\s+/).filter(Boolean).slice(0, 6)
    if (tokens.length === 0) tokens.push(q.trim())
    for (const tok of tokens) {
      params.push(`%${tok}%`)
      whereParts.push(fieldOr(params.length))
    }

    // Country filter
    if (opts.country) {
      const countries = opts.country.split(",").map((c) => c.trim().toUpperCase()).filter(Boolean)
      if (countries.length) {
        params.push(countries)
        whereParts.push(`UPPER(sa.country_code) = ANY($${params.length}::text[])`)
      }
    }

    // Delivery status filter
    if (opts.deliveryStatus) {
      if (opts.deliveryStatus === "new" || opts.deliveryStatus === "NEW") {
        whereParts.push(`(o.metadata->>'dextrum_status') IS NULL`)
      } else {
        params.push(opts.deliveryStatus)
        whereParts.push(`(o.metadata->>'dextrum_status') = $${params.length}`)
      }
    }

    // Cap candidates: if paymentStatus is a post-filter, pull more for margin
    const cap = opts.paymentStatus ? 400 : 50

    const sql = `
      SELECT o.id, MAX(o.created_at) AS created_at
      FROM "order" o
      LEFT JOIN order_address sa ON o.shipping_address_id = sa.id
      LEFT JOIN order_address ba ON o.billing_address_id = ba.id
      LEFT JOIN order_item oi ON oi.order_id = o.id AND oi.deleted_at IS NULL
      LEFT JOIN order_line_item li ON oi.item_id = li.id AND li.deleted_at IS NULL
      LEFT JOIN order_payment_collection opc ON opc.order_id = o.id AND opc.deleted_at IS NULL
      LEFT JOIN payment p ON p.payment_collection_id = opc.payment_collection_id AND p.deleted_at IS NULL
      LEFT JOIN order_fulfillment ofl ON ofl.order_id = o.id AND ofl.deleted_at IS NULL
      LEFT JOIN fulfillment_label fl ON fl.fulfillment_id = ofl.fulfillment_id AND fl.deleted_at IS NULL
      WHERE ${whereParts.join(" AND ")}
      GROUP BY o.id
      ORDER BY MAX(o.created_at) DESC
      LIMIT ${cap}
    `
    const { rows } = await pool.query(sql, params)
    return rows.map((r: any) => r.id)
  } catch (e: any) {
    logger?.warn?.(`[custom-orders search] SQL search failed: ${e.message}`)
    return []
  } finally {
    await pool.end().catch(() => {})
  }
}

/**
 * Filtered (non-search) listing at the DB level so total count + pagination are
 * correct across the WHOLE dataset, not just the current page. Handles country,
 * delivery_status (dextrum_status) and project (metadata.project_id) in SQL.
 * paymentStatus stays a JS post-filter (computed, COD-aware) — see GET.
 *
 * Returns the page of order IDs (in sort order) plus the grand total matching
 * the filters via COUNT(*) OVER().
 */
async function queryFilteredOrderIds(
  opts: {
    country?: string
    deliveryStatus?: string
    project?: string
    actionNeeded?: boolean
    sortBy: string
    sortDir: string
    limit: number
    offset: number
  },
  logger: any
): Promise<{ ids: string[]; total: number }> {
  const { Pool } = require("pg")
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
  try {
    const params: any[] = []
    const whereParts: string[] = [`o.deleted_at IS NULL`]

    // Country (comma list) → shipping address country_code
    if (opts.country) {
      const countries = opts.country.split(",").map((c) => c.trim().toUpperCase()).filter(Boolean)
      if (countries.length) {
        params.push(countries)
        whereParts.push(`UPPER(sa.country_code) = ANY($${params.length}::text[])`)
      }
    }

    // Delivery / warehouse status (comma list) → metadata.dextrum_status
    if (opts.deliveryStatus) {
      const statuses = opts.deliveryStatus.split(",").map((s) => s.trim()).filter(Boolean)
      const ors: string[] = []
      const concrete: string[] = []
      for (const s of statuses) {
        if (s === "new" || s === "NEW") {
          ors.push(`(o.metadata->>'dextrum_status') IS NULL`)
        } else {
          concrete.push(s)
        }
      }
      if (concrete.length) {
        params.push(concrete)
        ors.push(`(o.metadata->>'dextrum_status') = ANY($${params.length}::text[])`)
      }
      if (ors.length) whereParts.push(`(${ors.join(" OR ")})`)
    }

    // Action needed (triage): stuck >2 days, stock allocation issue, or safety-net recovered.
    if (opts.actionNeeded) {
      whereParts.push(`(
        (o.metadata->>'dextrum_status') = 'ALLOCATION_ISSUE'
        OR (
          ((o.metadata->>'dextrum_status') IS NULL OR (o.metadata->>'dextrum_status') IN ('NEW','WAITING','IMPORTED'))
          AND o.created_at < NOW() - INTERVAL '2 days'
        )
        OR (o.metadata->>'completed_by') ILIKE '%safety_net%'
      )`)
    }

    // Project (comma list of project_id aliases) → metadata.project_id / project
    if (opts.project) {
      const projects = opts.project.split(",").map((p) => p.trim()).filter(Boolean)
      if (projects.length) {
        params.push(projects)
        const idx = params.length
        whereParts.push(
          `((o.metadata->>'project_id') = ANY($${idx}::text[]) OR (o.metadata->>'project') = ANY($${idx}::text[]))`
        )
      }
    }

    // Sort — only columns reachable without computed totals. total/customer fall
    // back to created_at here; total is re-sorted per page in JS after hydration.
    const dir = opts.sortDir === "ASC" ? "ASC" : "DESC"
    let orderBy = `o.created_at ${dir}`
    if (opts.sortBy === "display_id") orderBy = `o.display_id ${dir}`
    else if (opts.sortBy === "customer") orderBy = `LOWER(sa.last_name) ${dir} NULLS LAST, LOWER(sa.first_name) ${dir} NULLS LAST`

    params.push(opts.limit)
    const limitIdx = params.length
    params.push(opts.offset)
    const offsetIdx = params.length

    const sql = `
      SELECT o.id, COUNT(*) OVER() AS total_count
      FROM "order" o
      LEFT JOIN order_address sa ON o.shipping_address_id = sa.id
      WHERE ${whereParts.join(" AND ")}
      ORDER BY ${orderBy}
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `
    const { rows } = await pool.query(sql, params)
    return {
      ids: rows.map((r: any) => r.id),
      total: rows.length ? Number(rows[0].total_count) : 0,
    }
  } catch (e: any) {
    logger?.warn?.(`[custom-orders filter] SQL filter failed: ${e.message}`)
    return { ids: [], total: 0 }
  } finally {
    await pool.end().catch(() => {})
  }
}

// Compute payment status from order data (same logic as frontend orders-table.tsx)
function getPaymentStatus(order: any): string {
  if (order.metadata?.payment_captured) return "paid"

  const isCOD = (order.payment_collections || []).some((pc: any) =>
    (pc.payments || []).some((p: any) => (p.provider_id || "").includes("cod"))
  ) || order.metadata?.payment_provider === "cod" || order.metadata?.payment_method === "cod"
  if (isCOD) return "pending"

  if (order.payment_collections?.length) {
    const pcs = order.payment_collections as any[]
    const activePC = pcs.find((pc: any) =>
      pc.status === "captured" || pc.status === "completed"
    ) || pcs.find((pc: any) =>
      pc.status !== "canceled"
    ) || pcs[pcs.length - 1]

    if (activePC.status === "captured" || activePC.status === "completed") return "paid"
    if (activePC.status === "refunded") return "refunded"
    if (activePC.status === "partially_refunded") return "partially_refunded"
    if (activePC.status === "authorized") return "authorized"
    return activePC.status || "pending"
  }
  if (order.metadata?.copied_payment_status) return order.metadata.copied_payment_status
  return "pending"
}

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  try {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const orderModuleService: IOrderModuleService = req.scope.resolve(Modules.ORDER)

    const limit = parseInt(req.query.limit as string) || 20
    const offset = parseInt(req.query.offset as string) || 0
    const search = (req.query.q as string) || ""
    const deliveryStatus = (req.query.delivery_status as string) || ""
    const country = (req.query.country as string) || ""
    const paymentStatus = (req.query.payment_status as string) || ""
    const project = (req.query.project as string) || ""
    const actionNeeded = req.query.action_needed === "true"
    const sortBy = (req.query.sort_by as string) || "created_at"
    const sortDir = (req.query.sort_dir as string) || "DESC"

    const filters: Record<string, any> = {}
    const isSearching = !!search
    // DB-level filter path: country/delivery/project/action-needed are pushed into
    // SQL so the grand total + pagination span the whole dataset (not just one page).
    const hasDbFilter = !isSearching && !!(country || deliveryStatus || project || actionNeeded)

    // ── FAST PATH: DB-level search via indexed ILIKE ─────────────────────
    // When user is searching, resolve matching order IDs via SQL (uses pg_trgm
    // GIN indexes on email/metadata/address/tracking/payment/line items),
    // then hydrate only those ~50 orders via query.graph with full fields.
    let searchOrderIdsList: string[] | null = null
    let dbFilterTotal = 0
    let dbFilterIds: string[] = []
    if (isSearching) {
      const logger: any = (req.scope as any).resolve?.(ContainerRegistrationKeys.LOGGER)
      searchOrderIdsList = await searchOrderIds(
        search.trim(),
        { country, deliveryStatus, paymentStatus },
        logger
      )
      if (searchOrderIdsList.length === 0) {
        res.json({ orders: [], count: 0, filtered_count: 0 })
        return
      }
      filters.id = searchOrderIdsList
    } else if (hasDbFilter) {
      const logger: any = (req.scope as any).resolve?.(ContainerRegistrationKeys.LOGGER)
      const filtered = await queryFilteredOrderIds(
        { country, deliveryStatus, project, actionNeeded, sortBy, sortDir, limit, offset },
        logger
      )
      dbFilterTotal = filtered.total
      dbFilterIds = filtered.ids
      if (dbFilterIds.length === 0) {
        res.json({ orders: [], count: dbFilterTotal, filtered_count: 0 })
        return
      }
      filters.id = dbFilterIds
    }

    const { data: orders, metadata } = await query.graph({
      entity: "order",
      fields: [
        "id",
        "display_id",
        "created_at",
        "updated_at",
        "email",
        "currency_code",
        "total",
        "subtotal",
        "shipping_total",
        "tax_total",
        "status",
        "metadata",
        "items.*",
        "items.variant.*",
        "items.variant.product.*",
        "shipping_address.*",
        "billing_address.*",
        "fulfillments.*",
        "payment_collections.*",
        "payment_collections.payments.*",
      ],
      filters,
      pagination: {
        skip: (isSearching || hasDbFilter) ? 0 : offset,
        take: isSearching
          ? searchOrderIdsList!.length
          : hasDbFilter
            ? dbFilterIds.length
            : limit,
        order: {
          [sortBy]: sortDir,
        },
      },
    })

    // Preserve SQL sort order — query.graph by id set may reorder.
    if (hasDbFilter && dbFilterIds.length) {
      const pos = new Map(dbFilterIds.map((id, i) => [id, i]))
      ;(orders as any[]).sort(
        (a, b) => (pos.get(a.id) ?? 0) - (pos.get(b.id) ?? 0)
      )
    }

    // Medusa v2 query.graph returns shipping_address as null — resolve via orderModuleService
    try {
      const orderIds = (orders as any[]).map((o: any) => o.id)
      if (orderIds.length > 0) {
        // Step 1: Get orders with address relations (returns address as { id: "..." })
        const ordersWithRels = await orderModuleService.listOrders(
          { id: orderIds },
          { relations: ["shipping_address", "billing_address"], select: ["id"] }
        )

        // Step 2: Collect all address IDs
        const addressIds: string[] = []
        for (const o of ordersWithRels as any[]) {
          if (o.shipping_address?.id) addressIds.push(o.shipping_address.id)
          if (o.billing_address?.id) addressIds.push(o.billing_address.id)
        }
        const uniqueAddrIds = [...new Set(addressIds)]

        // Step 3: Fetch full address data via orderAddressService_
        if (uniqueAddrIds.length > 0) {
          const addressService = (orderModuleService as any).orderAddressService_
          let addressMap = new Map<string, any>()

          if (addressService) {
            try {
              // Try batch list
              const addresses = await addressService.list({ id: uniqueAddrIds })
              addressMap = new Map(addresses.map((a: any) => [a.id, a]))
            } catch {
              // Fallback: retrieve individually
              const results = await Promise.all(
                uniqueAddrIds.map((id: string) =>
                  addressService.retrieve(id).catch(() => null)
                )
              )
              for (const addr of results) {
                if (addr?.id) addressMap.set(addr.id, addr)
              }
            }
          }

          // Step 4: Map addresses back to query.graph orders
          const relMap = new Map<string, any>()
          for (const o of ordersWithRels as any[]) {
            relMap.set(o.id, {
              shipping_id: o.shipping_address?.id,
              billing_id: o.billing_address?.id,
            })
          }

          for (const order of orders as any[]) {
            const rel = relMap.get(order.id)
            if (rel?.shipping_id && addressMap.has(rel.shipping_id)) {
              order.shipping_address = addressMap.get(rel.shipping_id)
            }
            if (rel?.billing_id && addressMap.has(rel.billing_id)) {
              order.billing_address = addressMap.get(rel.billing_id)
            }
          }
        }
      }
    } catch (addrErr: any) {
      console.warn("Could not resolve order addresses:", addrErr.message)
    }

    // Client-side filtering (Medusa query.graph doesn't support metadata/computed field filtering)
    let filteredOrders = orders

    // payment_status (comma list) — always a JS post-filter (computed, COD-aware).
    if (paymentStatus) {
      const wanted = paymentStatus.split(",").map((s) => s.trim()).filter(Boolean)
      filteredOrders = filteredOrders.filter((o: any) =>
        wanted.includes(getPaymentStatus(o))
      )
    }

    // country / delivery_status are applied in SQL on the DB-filter path; only
    // re-apply them in JS for the search path (which doesn't pre-filter them).
    if (!hasDbFilter) {
      if (deliveryStatus) {
        if (deliveryStatus === "new" || deliveryStatus === "NEW") {
          // New orders = no dextrum_status set yet
          filteredOrders = filteredOrders.filter(
            (o: any) => !o.metadata?.dextrum_status
          )
        } else {
          filteredOrders = filteredOrders.filter(
            (o: any) => o.metadata?.dextrum_status === deliveryStatus
          )
        }
      }

      if (country) {
        const countries = country.split(",").map((c) => c.trim().toUpperCase())
        filteredOrders = filteredOrders.filter((o: any) =>
          countries.includes(o.shipping_address?.country_code?.toUpperCase())
        )
      }
    }

    // total sort isn't expressible in the SQL filter (computed) — sort the
    // hydrated page in JS so at least the visible page is correctly ordered.
    if (hasDbFilter && sortBy === "total") {
      filteredOrders = [...filteredOrders].sort((a: any, b: any) => {
        const av = Number(a.total) || 0
        const bv = Number(b.total) || 0
        return sortDir === "ASC" ? av - bv : bv - av
      })
    }

    // Legacy JS-side search (kept as safety net; normally disabled since
    // SQL path handles matching now). Skip when SQL search was used.
    if (search && !isSearching) {
      const q = search.toLowerCase().trim()
      // Normalized version for phone/tracking number matching (strip spaces, dashes, +)
      const qDigits = q.replace(/[\s\-+()]/g, "")
      filteredOrders = filteredOrders.filter((o: any) => {
        // Order identifiers
        if (String(o.display_id).includes(q)) return true
        if (o.id?.toLowerCase().includes(q)) return true

        // Customer email
        if (o.email?.toLowerCase().includes(q)) return true

        // Shipping address fields
        const sa = o.shipping_address
        if (sa) {
          if (sa.first_name?.toLowerCase().includes(q)) return true
          if (sa.last_name?.toLowerCase().includes(q)) return true
          if ((sa.first_name + " " + sa.last_name).toLowerCase().includes(q)) return true
          if (sa.address_1?.toLowerCase().includes(q)) return true
          if (sa.address_2?.toLowerCase().includes(q)) return true
          if (sa.city?.toLowerCase().includes(q)) return true
          if (sa.postal_code?.toLowerCase().includes(q)) return true
          if (sa.country_code?.toLowerCase().includes(q)) return true
          if (sa.phone?.includes(q)) return true
          if (qDigits && sa.phone?.replace(/[\s\-+()]/g, "").includes(qDigits)) return true
          if (sa.company?.toLowerCase().includes(q)) return true
        }

        // Billing address fields
        const ba = o.billing_address
        if (ba) {
          if (ba.first_name?.toLowerCase().includes(q)) return true
          if (ba.last_name?.toLowerCase().includes(q)) return true
          if (ba.company?.toLowerCase().includes(q)) return true
        }

        // Order items — product names, variant titles, SKUs
        if (o.items) {
          for (const item of o.items) {
            if (item.title?.toLowerCase().includes(q)) return true
            if (item.variant_title?.toLowerCase().includes(q)) return true
            if (item.variant_sku?.toLowerCase().includes(q)) return true
            if (item.variant?.sku?.toLowerCase().includes(q)) return true
            if (item.variant?.product?.title?.toLowerCase().includes(q)) return true
          }
        }

        // Payment info
        if (o.payment_collections) {
          for (const pc of o.payment_collections) {
            if (pc.payments) {
              for (const p of pc.payments) {
                if (p.provider_id?.toLowerCase().includes(q)) return true
                if (p.data?.id?.toLowerCase().includes(q)) return true
              }
            }
          }
        }

        // Metadata — tags, custom/mystock order number, tracking, payment IDs, notes
        const m = o.metadata
        if (m) {
          // Generic fallback: stringify entire metadata and substring match.
          // Catches any *_id / tracking / payment ref / custom key we haven't
          // explicitly listed below.
          try {
            if (JSON.stringify(m).toLowerCase().includes(q)) return true
          } catch {}
          if (m.tags?.toString().toLowerCase().includes(q)) return true
          if (m.custom_order_number?.toString().toLowerCase().includes(q)) return true
          if (m.mystock_order_code?.toString().toLowerCase().includes(q)) return true
          if (m.dextrum_status?.toString().toLowerCase().includes(q)) return true
          if (m.note?.toString().toLowerCase().includes(q)) return true
          if (m.project?.toString().toLowerCase().includes(q)) return true
          // Tracking numbers
          if (m.dextrum_tracking_number?.toString().toLowerCase().includes(q)) return true
          if (m.tracking_number?.toString().toLowerCase().includes(q)) return true
          // Payment gateway IDs
          if (m.paypal_transaction_id?.toString().toLowerCase().includes(q)) return true
          if (m.paypalOrderId?.toString().toLowerCase().includes(q)) return true
          if (m.paypalCaptureId?.toString().toLowerCase().includes(q)) return true
          if (m.stripePaymentIntentId?.toString().toLowerCase().includes(q)) return true
          if (m.airwallexPaymentIntentId?.toString().toLowerCase().includes(q)) return true
          if (m.klarnaOrderId?.toString().toLowerCase().includes(q)) return true
        }

        // Fulfillments — tracking numbers from shipment labels
        if (o.fulfillments) {
          for (const f of o.fulfillments) {
            if (f.labels) {
              for (const l of f.labels) {
                if (l.tracking_number?.toLowerCase().includes(q)) return true
              }
            }
            // Some providers stash tracking in fulfillment.data
            if (f.data) {
              try {
                if (JSON.stringify(f.data).toLowerCase().includes(q)) return true
              } catch {}
            }
          }
        }

        // Currency
        if (o.currency_code?.toLowerCase().includes(q)) return true

        // Total as string (e.g. searching "35" finds €35 orders)
        if (o.total != null && String(o.total).includes(q)) return true

        return false
      })
    }

    // When searching, cap results to 50 (SQL may return up to 400 candidates
    // to survive the paymentStatus post-filter).
    if (isSearching) {
      filteredOrders = filteredOrders.slice(0, 50)
    }

    // Strip html_body from email_activity_log to keep list response lean
    // (html_body is only needed on the order detail page, not the list)
    for (const o of filteredOrders as any[]) {
      if (o.metadata?.email_activity_log) {
        o.metadata.email_activity_log = o.metadata.email_activity_log.map(
          (entry: any) => {
            const { html_body, ...rest } = entry
            return rest
          }
        )
      }
    }

    res.json({
      orders: filteredOrders,
      // On the DB-filter path the grand total comes from COUNT(*) OVER() so
      // pagination spans the whole filtered set, not just this page.
      count: hasDbFilter ? dbFilterTotal : ((metadata as any)?.count ?? orders.length),
      filtered_count: hasDbFilter ? dbFilterTotal : filteredOrders.length,
    })
  } catch (error: any) {
    console.error("Custom orders list error:", error)
    res.status(500).json({ error: error.message || "Failed to fetch orders" })
  }
}
