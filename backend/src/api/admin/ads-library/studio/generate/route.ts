// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ADS_LIBRARY_MODULE } from "../../../../../modules/ads-library"
import { runStudioTextsJob } from "../../lib/studio-runner"

/**
 * POST /admin/ads-library/studio/generate
 * Body: { item_id, project_id, txt_model }
 * (Re)generates texts for a persistent Studio item. A previous result is
 * pushed into params.history so the generation history survives — nothing is
 * lost by regenerating.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const svc = req.scope.resolve(ADS_LIBRARY_MODULE)
  const b = (req.body || {}) as any
  if (!b.item_id || !b.project_id) {
    return res.status(400).json({ error: "item_id a project_id jsou povinné", message: "item_id a project_id jsou povinné" })
  }
  const [item] = await svc.listAdLocalizationJobs({ id: b.item_id })
  if (!item?.params?.studio) return res.status(404).json({ error: "studio položka nenalezena", message: "studio položka nenalezena" })
  if (item.status === "running" || item.status === "queued") {
    return res.status(409).json({ error: "generování už běží", message: "generování už běží" })
  }

  const p = item.params || {}
  const history = [...(p.history || [])]
  if (p.result) {
    history.push({
      at: new Date().toISOString().slice(0, 16).replace("T", " "),
      project: item.target_project, txt_model: p.txt_model,
      primaries: p.result.primaries, headlines: p.result.headlines, cost_usd: p.cost_usd ?? null,
    })
  }
  await svc.updateAdLocalizationJobs({
    id: item.id,
    target_project: b.project_id,
    status: "queued", error: null,
    steps: [
      { key: "describe", label: "Popis obrázku", status: "queued" },
      { key: "texts", label: "Texty ze vzorů", status: "queued" },
    ],
    params: {
      ...p, txt_model: b.txt_model || "claude-opus-4-8",
      result: null, cost_usd: null, history: history.slice(-5),
    },
  })
  const container = req.scope
  setImmediate(() => runStudioTextsJob(container, item.id))
  res.json({ job_id: item.id })
}
