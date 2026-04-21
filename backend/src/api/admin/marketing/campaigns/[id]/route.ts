// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MARKETING_MODULE } from "../../../../../modules/marketing"
import type MarketingModuleService from "../../../../../modules/marketing/service"

const UPDATABLE_FIELDS = [
  "name",
  "subject",
  "preheader",
  "from_name",
  "from_email",
  "reply_to",
  "custom_html",
  "template_id",
  "list_id",
  "segment_id",
  "suppression_segment_ids",
  "send_at",
  "ab_test",
  "metadata",
]

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const service = req.scope.resolve(MARKETING_MODULE) as unknown as MarketingModuleService
    const id = (req.params as any).id
    const [campaign] = await service.listMarketingCampaigns({ id })
    if (!campaign) {
      res.status(404).json({ error: "not_found" })
      return
    }
    res.json({ campaign })
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "internal_error" })
  }
}

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const service = req.scope.resolve(MARKETING_MODULE) as unknown as MarketingModuleService
    const id = (req.params as any).id
    const body = (req.body as any) || {}

    const [existing] = await service.listMarketingCampaigns({ id })
    if (!existing) {
      res.status(404).json({ error: "not_found" })
      return
    }

    const status = (existing as any).status
    if (status !== "draft" && status !== "scheduled") {
      res.status(400).json({ error: `cannot update campaign in status '${status}'` })
      return
    }

    const update: any = { id }
    for (const key of UPDATABLE_FIELDS) {
      if (key in body) {
        if (key === "send_at" && body.send_at) {
          update.send_at = new Date(body.send_at)
        } else {
          update[key] = body[key]
        }
      }
    }

    const campaign = await service.updateMarketingCampaigns(update)
    res.json({ campaign })
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "internal_error" })
  }
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const service = req.scope.resolve(MARKETING_MODULE) as unknown as MarketingModuleService
    const id = (req.params as any).id

    const [existing] = await service.listMarketingCampaigns({ id })
    if (!existing) {
      res.status(404).json({ error: "not_found" })
      return
    }

    // Draft → hard delete (no attribution / messages to preserve).
    // Anything else (scheduled / sending / sent / cancelled) → soft-hide:
    // set deleted_at so the list view filters it out, but marketing_message,
    // marketing_attribution, and analytics history stay intact.
    const status = String((existing as any).status || "")
    if (status === "draft") {
      await service.deleteMarketingCampaigns(id)
      res.status(200).json({ id, deleted: true, hidden: false })
    } else {
      await service.updateMarketingCampaigns({ id, deleted_at: new Date() } as any)
      res.status(200).json({ id, deleted: false, hidden: true })
    }
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "internal_error" })
  }
}
