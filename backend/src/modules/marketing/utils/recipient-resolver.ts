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
  listId?: string | null
  segmentId?: string | null
  suppressionSegmentIds?: string[] | null
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
    const { brandId, listId, segmentId, suppressionSegmentIds } = input

    // Load segment query if present
    let segmentQuery: SegmentNode | null = null
    if (segmentId) {
      const { rows } = await this.pool.query(
        `SELECT query FROM marketing_segment
         WHERE id = $1 AND brand_id = $2 AND deleted_at IS NULL
         LIMIT 1`,
        [segmentId, brandId]
      )
      segmentQuery = rows[0]?.query || null
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

    // List membership (optional)
    if (listId) {
      baseParams.push(listId)
      const listParamIdx = baseParams.length
      baseWhere.push(
        `EXISTS (SELECT 1 FROM marketing_list_membership m
                 WHERE m.list_id = $${listParamIdx} AND m.contact_id = c.id AND m.deleted_at IS NULL)`
      )
    }

    // Segment query (optional)
    if (segmentQuery) {
      const compiled = compileSegment(segmentQuery, brandId)
      // compiled.params[0] = brandId — already in our baseParams as $1,
      // so we need to remap compiled placeholders to continue from our current count.
      // Easiest: drop compiled.params[0] and re-number remaining to start at baseParams.length + 1
      const remaining = compiled.params.slice(1)
      const offset = baseParams.length - 1 // shift all $2.. to next index
      const remapped = compiled.sql.replace(/\$(\d+)/g, (_, d) => {
        const num = Number(d)
        if (num === 1) return `$1` // brand_id shared
        return `$${num + offset}`
      })
      baseWhere.push(`(${remapped})`)
      baseParams.push(...remaining)
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
        const compiled = compileSegment(suppQuery, brandId)
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
