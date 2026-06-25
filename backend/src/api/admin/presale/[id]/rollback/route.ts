// @ts-nocheck
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { PRESALE_MODULE } from "../../../../../modules/presale"
import type PresaleModuleService from "../../../../../modules/presale/service"
import { ALLOWED_FIELDS, buildSnapshot } from "../../utils"

/**
 * POST /admin/presale/:id/rollback
 * Body: { revision_id }. Restores the editable fields from a stored revision.
 * Snapshots the current state first, so a rollback is itself undoable.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const { id } = req.params
  const service = req.scope.resolve(PRESALE_MODULE) as PresaleModuleService

  try {
    const body = (req.body || {}) as Record<string, any>
    const revisionId = body.revision_id
    if (!revisionId) {
      res.status(400).json({ error: "revision_id is required" })
      return
    }

    const revision = (await service.retrievePresaleRevision(revisionId)) as any
    if ((revision as any).presale_id !== id) {
      res.status(400).json({ error: "revision does not belong to this presale page" })
      return
    }

    let snapshot: Record<string, any>
    try {
      snapshot = JSON.parse(revision.snapshot)
    } catch {
      res.status(500).json({ error: "corrupt revision snapshot" })
      return
    }

    const current = (await service.retrievePresalePage(id)) as any
    service
      .createPresaleRevisions({
        presale_id: id,
        snapshot: buildSnapshot(current),
        note: "auto before rollback",
      })
      .catch(() => {})

    const data: Record<string, any> = {}
    for (const key of ALLOWED_FIELDS) {
      if (snapshot[key] !== undefined) data[key] = snapshot[key]
    }

    const page = await service.updatePresalePages({ ...data, id })
    res.json({ page })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
}
