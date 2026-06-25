// @ts-nocheck
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { PRESALE_MODULE } from "../../../../../modules/presale"
import type PresaleModuleService from "../../../../../modules/presale/service"

/**
 * GET /admin/presale/:id/preview
 * Returns the raw html_content as a standalone HTML document so the operator
 * can preview a draft (which is not yet live on the storefront) in a new tab.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const { id } = req.params
  const service = req.scope.resolve(PRESALE_MODULE) as PresaleModuleService

  try {
    const page = (await service.retrievePresalePage(id)) as any
    const html = page.html_content || `<!doctype html><meta charset="utf-8"><body style="font-family:sans-serif;padding:40px;color:#666">Tato presale stránka zatím nemá žádný obsah.</body>`
    res.setHeader("Content-Type", "text/html; charset=utf-8")
    res.setHeader("Cache-Control", "no-store")
    res.send(html)
  } catch (error: any) {
    res.status(404).setHeader("Content-Type", "text/html; charset=utf-8")
    res.send("<!doctype html><meta charset='utf-8'><body>Presale page not found</body>")
  }
}
