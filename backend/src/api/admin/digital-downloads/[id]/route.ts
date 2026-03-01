import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { DIGITAL_DOWNLOAD_MODULE } from "../../../../modules/digital-download"
import type DigitalDownloadModuleService from "../../../../modules/digital-download/service"

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { id } = req.params

  const service = req.scope.resolve(
    DIGITAL_DOWNLOAD_MODULE
  ) as DigitalDownloadModuleService

  try {
    const download = await service.retrieveDigitalDownload(id)
    return res.json({ digital_download: download })
  } catch {
    return res.status(404).json({ message: "Download not found" })
  }
}

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { id } = req.params

  const service = req.scope.resolve(
    DIGITAL_DOWNLOAD_MODULE
  ) as DigitalDownloadModuleService

  const data = req.body as any
  if (data.expires_at) {
    data.expires_at = new Date(data.expires_at)
  }

  const download = await service.updateDigitalDownloads({
    selector: { id },
    data,
  })

  return res.json({ digital_download: download })
}

export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { id } = req.params

  const service = req.scope.resolve(
    DIGITAL_DOWNLOAD_MODULE
  ) as DigitalDownloadModuleService

  await service.deleteDigitalDownloads(id)

  return res.json({ id, deleted: true })
}
