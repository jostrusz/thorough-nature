/**
 * Segment evaluator — compiles a JSON segment DSL into a parameterized
 * SQL `WHERE` clause over `marketing_contact`.
 *
 * Supported query shapes:
 *
 *   { "all": [node, node, …] }      AND combinator
 *   { "any": [node, node, …] }      OR combinator
 *   { "not": node }                  NOT combinator
 *   { field: { op: value } }         leaf condition
 *
 * Supported field paths (lowered to SQL columns or subqueries):
 *
 *   contact.status                   → marketing_contact.status
 *   contact.country_code             → marketing_contact.country_code
 *   contact.locale                   → marketing_contact.locale
 *   contact.tags                     → json-array ("has" op only)
 *   contact.source                   → marketing_contact.source
 *   contact.subscribed_at            → marketing_contact.consent_at
 *   contact.created_at               → marketing_contact.created_at
 *
 *   order.count                      → COUNT(*) in last N days
 *   order.total_sum                  → SUM(total)
 *   order.last_at                    → MAX(created_at)
 *
 *   event.count(type=xxx, days=30)   → COUNT events of type in window
 *   event.last_at(type=xxx)          → MAX occurred_at for type
 *
 *   list.member(list_id)             → EXISTS marketing_list_membership
 *
 * Supported operators:
 *   eq, ne, gt, gte, lt, lte         (numeric + dates)
 *   in, nin                           (array membership)
 *   contains, starts, ends            (string)
 *   has                               (json-array contains element)
 *   before, after                     (dates — equivalent to lt/gt for readability)
 *   exists (true/false)               (column IS NULL / IS NOT NULL)
 *
 * Each compiled query returns a Postgres `WHERE` fragment + ordered params
 * ready to be spliced into SELECT ... FROM marketing_contact WHERE <frag>.
 */

export type SegmentNode =
  | { all: SegmentNode[] }
  | { any: SegmentNode[] }
  | { not: SegmentNode }
  | LeafCondition

export type LeafCondition = Record<string, OpRecord>
export type OpRecord =
  | { eq: any }
  | { ne: any }
  | { gt: any }
  | { gte: any }
  | { lt: any }
  | { lte: any }
  | { in: any[] }
  | { nin: any[] }
  | { contains: string }
  | { starts: string }
  | { ends: string }
  | { has: string }
  | { before: string }
  | { after: string }
  | { exists: boolean }

export type CompiledSegment = {
  sql: string            // WHERE fragment (no leading WHERE)
  params: any[]          // positional params ($1..$N)
  brandParamIndex: number // position of brand_id placeholder (caller injects)
}

type BuildCtx = {
  params: any[]
  brandId: string
  // placeholder index for brand_id — all brand-scoped subqueries use this
  brandParamIndex: number
}

function push(ctx: BuildCtx, value: any): string {
  ctx.params.push(value)
  return `$${ctx.params.length}`
}

function compileNode(node: SegmentNode, ctx: BuildCtx): string {
  if ((node as any).all) {
    const parts = (node as any).all.map((n: SegmentNode) => compileNode(n, ctx))
    return parts.length ? `(${parts.join(" AND ")})` : "TRUE"
  }
  if ((node as any).any) {
    const parts = (node as any).any.map((n: SegmentNode) => compileNode(n, ctx))
    return parts.length ? `(${parts.join(" OR ")})` : "FALSE"
  }
  if ((node as any).not) {
    return `NOT (${compileNode((node as any).not, ctx)})`
  }
  return compileLeaf(node as LeafCondition, ctx)
}

function compileLeaf(cond: LeafCondition, ctx: BuildCtx): string {
  const [field, opRec] = Object.entries(cond)[0] || []
  if (!field || !opRec) return "TRUE"
  const [op, value] = Object.entries(opRec as any)[0] || []

  // ───────────────────────────────────────────────────────────
  // contact.*  (direct column access on marketing_contact)
  // ───────────────────────────────────────────────────────────
  if (field.startsWith("contact.")) {
    const col = field.slice("contact.".length)
    const COLUMN_MAP: Record<string, string> = {
      status: "c.status",
      country_code: "c.country_code",
      locale: "c.locale",
      source: "c.source",
      subscribed_at: "c.consent_at",
      created_at: "c.created_at",
    }
    const sqlCol = COLUMN_MAP[col]
    if (!sqlCol) return "TRUE"
    return applyOp(sqlCol, op, value, ctx)
  }

  // ───────────────────────────────────────────────────────────
  // contact.tags (JSONB array)
  // ───────────────────────────────────────────────────────────
  if (field === "contact.tags") {
    if (op === "has") {
      const p = push(ctx, value)
      return `(c.tags IS NOT NULL AND c.tags::jsonb @> to_jsonb(ARRAY[${p}]::text[]))`
    }
    return "TRUE"
  }

  // ───────────────────────────────────────────────────────────
  // order.count — orders in last N days (value can be { days, op_value })
  // but we keep it simple: operator applies to count in all time unless
  // a "within_days" field is provided in the condition.
  // ───────────────────────────────────────────────────────────
  if (field === "order.count" || field === "order.total_sum" || field === "order.last_at") {
    const agg = field === "order.count"
      ? "COUNT(*)"
      : field === "order.total_sum"
      ? "COALESCE(SUM(total),0)"
      : "MAX(created_at)"
    // We join on orders by email match — marketing_contact.email = order.email
    const subquery = `(SELECT ${agg} FROM "order" o WHERE o.deleted_at IS NULL AND lower(o.email) = lower(c.email))`
    return applyOp(subquery, op, value, ctx)
  }

  // ───────────────────────────────────────────────────────────
  // event.count / event.last_at
  // ───────────────────────────────────────────────────────────
  if (field.startsWith("event.")) {
    // field can carry extra in the condition record, e.g.:
    //   { "event.count": { gt: 3, type: "page_viewed", days: 30 } }
    const extra = opRec as any
    const eventType = extra.type || null
    const days = typeof extra.days === "number" ? Math.max(0, extra.days) : null

    const subField = field === "event.count" ? "COUNT(*)" : "MAX(occurred_at)"
    const brandP = `$${ctx.brandParamIndex}`
    let where = `brand_id = ${brandP} AND (contact_id = c.id OR lower(email) = lower(c.email))`
    if (eventType) where += ` AND type = ${push(ctx, eventType)}`
    if (days) where += ` AND occurred_at > NOW() - INTERVAL '${days} days'`

    const subquery = `(SELECT ${subField} FROM marketing_event WHERE ${where})`
    return applyOp(subquery, op, value, ctx)
  }

  // ───────────────────────────────────────────────────────────
  // list.member(list_id)
  // ───────────────────────────────────────────────────────────
  if (field === "list.member") {
    // value is the list id
    const listId = String(value || "")
    const p = push(ctx, listId)
    return `EXISTS (SELECT 1 FROM marketing_list_membership m WHERE m.list_id = ${p} AND m.contact_id = c.id AND m.deleted_at IS NULL)`
  }

  return "TRUE"
}

function applyOp(sqlCol: string, op: string, value: any, ctx: BuildCtx): string {
  switch (op) {
    case "eq":
      return `${sqlCol} = ${push(ctx, value)}`
    case "ne":
      return `${sqlCol} <> ${push(ctx, value)}`
    case "gt":
      return `${sqlCol} > ${push(ctx, value)}`
    case "gte":
      return `${sqlCol} >= ${push(ctx, value)}`
    case "lt":
      return `${sqlCol} < ${push(ctx, value)}`
    case "lte":
      return `${sqlCol} <= ${push(ctx, value)}`
    case "in": {
      if (!Array.isArray(value) || value.length === 0) return "FALSE"
      const ps = value.map((v) => push(ctx, v)).join(",")
      return `${sqlCol} IN (${ps})`
    }
    case "nin": {
      if (!Array.isArray(value) || value.length === 0) return "TRUE"
      const ps = value.map((v) => push(ctx, v)).join(",")
      return `${sqlCol} NOT IN (${ps})`
    }
    case "contains":
      return `${sqlCol} ILIKE ${push(ctx, `%${value}%`)}`
    case "starts":
      return `${sqlCol} ILIKE ${push(ctx, `${value}%`)}`
    case "ends":
      return `${sqlCol} ILIKE ${push(ctx, `%${value}`)}`
    case "before":
      return `${sqlCol} < ${push(ctx, value)}`
    case "after":
      return `${sqlCol} > ${push(ctx, value)}`
    case "exists":
      return value === false ? `${sqlCol} IS NULL` : `${sqlCol} IS NOT NULL`
    default:
      return "TRUE"
  }
}

/**
 * Compile a segment definition into a SQL WHERE fragment + params.
 *
 * Usage:
 *   const { sql, params, brandParamIndex } = compileSegment(
 *     segment.query, brandId
 *   )
 *   const finalSql = `SELECT c.* FROM marketing_contact c
 *                     WHERE c.brand_id = $${brandParamIndex}
 *                       AND c.deleted_at IS NULL
 *                       AND ${sql}`
 *   pool.query(finalSql, params)
 */
export function compileSegment(query: SegmentNode, brandId: string): CompiledSegment {
  const ctx: BuildCtx = {
    params: [brandId], // $1 is always brand_id
    brandId,
    brandParamIndex: 1,
  }
  const sql = compileNode(query, ctx) || "TRUE"
  return {
    sql,
    params: ctx.params,
    brandParamIndex: ctx.brandParamIndex,
  }
}
