import { Pool } from "pg"
import { compileSegment, SegmentNode } from "./segment-evaluator"

/**
 * Recipient resolver — given a campaign (list + segment + suppression
 * segments), returns the final list of contact IDs + emails to send to.
 *
 * Resolution strategy:
 *   1. Start set = union of all contacts in list_id (if set) AND all
 *      contacts matching segment_id (if set).
 *   2. Apply suppression: remove contacts whose email is in
 *      marketing_suppression for this brand.
 *   3. Apply suppression_segment_ids: subtract contacts matching each.
 *   4. Hard filter: status must be "subscribed".
 *
 * Returns deduplicated rows ordered by created_at DESC.
 */

export type RecipientInput = {
  brandId: string
  /** @deprecated single-list input, kept for backward compat. Prefer listIds. */
  listId?: string | null
  /** Multiple lists — recipient must be a member of ANY (union, dedup-safe). */
  listIds?: string[] | null
  /** @deprecated single-segment input, kept for backward compat. Prefer segmentIds. */
  segmentId?: string | null
  /** Multiple segments — recipient must match ANY (union). */
  segmentIds?: string[] | null
  suppressionSegmentIds?: string[] | null
}

/** Normalize singular + plural inputs into a clean string[] (deduped, no empties). */
function normalizeIds(plural?: string[] | null, singular?: string | null): string[] {
  const out: string[] = []
  if (Array.isArray(plural)) {
    for (const v of plural) if (v) out.push(String(v))
  }
  if (singular) out.push(String(singular))
  return Array.from(new Set(out))
}

export type Recipient = {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  locale: string | null
  country_code: string | null
}

export class RecipientResolver {
  private pool: Pool
  constructor(pool?: Pool) {
    if (pool) {
      this.pool = pool
    } else {
      this.pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 3 })
    }
  }

  async resolve(input: RecipientInput): Promise<Recipient[]> {
    const { brandId, suppressionSegmentIds } = input
    const listIds = normalizeIds(input.listIds, input.listId)
    const segmentIds = normalizeIds(input.segmentIds, input.segmentId)

    // Load brand's project_id so segment subqueries can scope cross-module
    // data (e.g. the "order" table) to just this brand's project. Without
    // this, an email-match join would leak orders across brands that share
    // the same customer email.
    let projectId: string | null = null
    try {
      const { rows: brandRows } = await this.pool.query(
        `SELECT project_id FROM marketing_brand WHERE id = $1 LIMIT 1`,
        [brandId]
      )
      projectId = (brandRows[0]?.project_id as string | undefined) ?? null
    } catch {
      projectId = null
    }

    // Load segment queries if present (one per selected segment)
    const segmentQueries: SegmentNode[] = []
    for (const segId of segmentIds) {
      const { rows } = await this.pool.query(
        `SELECT query FROM marketing_segment
         WHERE id = $1 AND brand_id = $2 AND deleted_at IS NULL
         LIMIT 1`,
        [segId, brandId]
      )
      if (rows[0]?.query) segmentQueries.push(rows[0].query)
    }

    // Build the base set
    // We always filter: brand match, not deleted, status = subscribed, no suppression
    const baseWhere: string[] = []
    const baseParams: any[] = [brandId]

    baseWhere.push(`c.brand_id = $1`)
    baseWhere.push(`c.deleted_at IS NULL`)
    baseWhere.push(`c.status = 'subscribed'`)

    // Suppression list (hard bounces, unsubscribes, complaints)
    baseWhere.push(
      `NOT EXISTS (SELECT 1 FROM marketing_suppression s
                   WHERE s.brand_id = $1
                     AND lower(s.email) = lower(c.email)
                     AND s.deleted_at IS NULL)`
    )

    // List membership (optional) — member of ANY selected list (union).
    // Single base row per contact (EXISTS, not JOIN) → inherently dedup-safe
    // even when a contact belongs to several of the selected lists.
    if (listIds.length > 0) {
      baseParams.push(listIds)
      const listParamIdx = baseParams.length
      baseWhere.push(
        `EXISTS (SELECT 1 FROM marketing_list_membership m
                 WHERE m.list_id = ANY($${listParamIdx}::text[]) AND m.contact_id = c.id AND m.deleted_at IS NULL)`
      )
    }

    // Segment queries (optional) — match ANY selected segment (union, OR).
    if (segmentQueries.length > 0) {
      const orClauses: string[] = []
      for (const segmentQuery of segmentQueries) {
        const compiled = compileSegment(segmentQuery, brandId, projectId)
        // compiled.params[0] = brandId — already in our baseParams as $1, so we
        // remap compiled placeholders to continue from our current param count.
        const remaining = compiled.params.slice(1)
        const offset = baseParams.length - 1 // shift all $2.. to next index
        const remapped = compiled.sql.replace(/\$(\d+)/g, (_, d) => {
          const num = Number(d)
          if (num === 1) return `$1` // brand_id shared
          return `$${num + offset}`
        })
        orClauses.push(`(${remapped})`)
        baseParams.push(...remaining)
      }
      baseWhere.push(`(${orClauses.join(" OR ")})`)
    }

    // Suppression segments (exclude)
    if (suppressionSegmentIds && suppressionSegmentIds.length > 0) {
      for (const suppId of suppressionSegmentIds) {
        const { rows } = await this.pool.query(
          `SELECT query FROM marketing_segment WHERE id = $1 AND brand_id = $2 AND deleted_at IS NULL LIMIT 1`,
          [suppId, brandId]
        )
        const suppQuery = rows[0]?.query
        if (!suppQuery) continue
        const compiled = compileSegment(suppQuery, brandId, projectId)
        const remaining = compiled.params.slice(1)
        const offset = baseParams.length - 1
        const remapped = compiled.sql.replace(/\$(\d+)/g, (_, d) => {
          const num = Number(d)
          if (num === 1) return `$1`
          return `$${num + offset}`
        })
        baseWhere.push(`NOT (${remapped})`)
        baseParams.push(...remaining)
      }
    }

    const sql = `
      SELECT c.id, c.email, c.first_name, c.last_name, c.locale, c.country_code
      FROM marketing_contact c
      WHERE ${baseWhere.join(" AND ")}
      ORDER BY c.created_at DESC
      LIMIT 200000
    `
    const { rows } = await this.pool.query(sql, baseParams)
    return rows as Recipient[]
  }

  /** Count recipients without loading the full list (for segment preview). */
  async count(input: RecipientInput): Promise<number> {
    const recipients = await this.resolve(input)
    return recipients.length
  }
}
