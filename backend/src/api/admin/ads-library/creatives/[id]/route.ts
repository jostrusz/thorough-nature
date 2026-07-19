// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ADS_LIBRARY_MODULE } from "../../../../../modules/ads-library"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const svc = req.scope.resolve(ADS_LIBRARY_MODULE)
  const [row] = await svc.listAdCreatives({ id: req.params.id })
  if (!row) return res.status(404).json({ error: "not_found" })
  // include family members for the lineage strip
  const family = row.family_id
    ? await svc.listAdCreatives({ family_id: row.family_id })
    : [row]
  res.json({ creative: row, family })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const svc = req.scope.resolve(ADS_LIBRARY_MODULE)
  const b = req.body as any
  const patch: any = {}
  for (const k of ["name", "project_id", "language", "tag", "notes", "primary_texts",
    "headlines", "description_text", "cta_type", "link_url", "image_1x1_url", "image_9x16_url"]) {
    if (b[k] !== undefined) patch[k] = b[k]
  }
  const updated = await svc.updateAdCreatives({ id: req.params.id, ...patch })
  res.json({ creative: updated })
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const svc = req.scope.resolve(ADS_LIBRARY_MODULE)
  await svc.deleteAdCreatives(req.params.id)
  res.json({ deleted: true })
}
