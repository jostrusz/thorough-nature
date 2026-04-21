// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MARKETING_MODULE } from "../../../../../modules/marketing"
import type MarketingModuleService from "../../../../../modules/marketing/service"

const UPDATABLE_FIELDS = [
  "name",
  "description",
  "trigger",
  "definition",
  "status",
  "stats",
  "metadata",
  "goals",
  "re_entry_policy",
]

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const service = req.scope.resolve(MARKETING_MODULE) as unknown as MarketingModuleService
    const id = (req.params as any).id
    const [flow] = await service.listMarketingFlows({ id })
    if (!flow) {
      res.status(404).json({ error: "not_found" })
      return
    }
    res.json({ flow })
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "internal_error" })
  }
}

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const service = req.scope.resolve(MARKETING_MODULE) as unknown as MarketingModuleService
    const id = (req.params as any).id
    const body = (req.body as any) || {}

    const update: any = { id }
    for (const key of UPDATABLE_FIELDS) {
      if (key in body) update[key] = body[key]
    }

    const flow = await service.updateMarketingFlows(update)
    res.json({ flow })
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "internal_error" })
  }
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const service = req.scope.resolve(MARKETING_MODULE) as unknown as MarketingModuleService
    const id = (req.params as any).id
    await service.deleteMarketingFlows(id)
    res.status(200).json({ id, deleted: true })
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "internal_error" })
  }
}
