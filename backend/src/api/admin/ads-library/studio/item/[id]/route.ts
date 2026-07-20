// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ADS_LIBRARY_MODULE } from "../../../../../../modules/ads-library"

/** DELETE /admin/ads-library/studio/item/:id — remove a Studio item (the
 *  saved library card, if any, is untouched). */
export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const svc = req.scope.resolve(ADS_LIBRARY_MODULE)
  const [item] = await svc.listAdLocalizationJobs({ id: req.params.id })
  if (!item?.params?.studio) return res.status(404).json({ error: "studio položka nenalezena", message: "studio položka nenalezena" })
  await svc.deleteAdLocalizationJobs(req.params.id)
  res.json({ deleted: true })
}
