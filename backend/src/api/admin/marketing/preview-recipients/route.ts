// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { RecipientResolver } from "../../../../modules/marketing/utils/recipient-resolver"

/**
 * Ad-hoc recipient preview — POST /admin/marketing/preview-recipients
 *
 * Counts recipients for a given brand + list_id + segment_id +
 * suppression_segment_ids combination WITHOUT requiring a saved campaign.
 *
 * Used by the campaign editor to show the live recipient count as the user
 * toggles lists / segments.
 *
 * Body:
 *   {
 *     brand_id: string (required),
 *     list_id?: string | null,
 *     segment_id?: string | null,
 *     suppression_segment_ids?: string[]
 *   }
 *
 * Response: { count: number, sample: string[] }
 *
 * NOTE: this reuses the same RecipientResolver as the real dispatcher, so
 * the count always matches what will actually be sent.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const body = (req.body as any) || {}
    const brand_id = body.brand_id
    if (!brand_id) {
      res.status(400).json({ error: "brand_id is required" })
      return
    }

    const resolver = new RecipientResolver()
    const recipients = await resolver.resolve({
      brandId: brand_id,
      listId: body.list_id || null,
      segmentId: body.segment_id || null,
      suppressionSegmentIds: Array.isArray(body.suppression_segment_ids)
        ? body.suppression_segment_ids
        : [],
    })

    res.json({
      count: recipients.length,
      sample: recipients.slice(0, 100).map((r: any) => r.email),
    })
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "internal_error" })
  }
}
