import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { DIGITAL_DOWNLOAD_MODULE } from "../../../modules/digital-download"
import type DigitalDownloadModuleService from "../../../modules/digital-download/service"

export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve(
    DIGITAL_DOWNLOAD_MODULE
  ) as DigitalDownloadModuleService

  const downloads = await service.listDigitalDownloads()

  return res.json({ digital_downloads: downloads })
}

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const service = req.scope.resolve(
    DIGITAL_DOWNLOAD_MODULE
  ) as DigitalDownloadModuleService

  const { order_id, token, email, files, expires_at, metadata } = req.body as any

  if (!order_id || !token || !email || !files || !expires_at) {
    return res.status(400).json({
      message: "Missing required fields: order_id, token, email, files, expires_at",
    })
  }

  const download = await service.createDigitalDownloads({
    order_id,
    token,
    email,
    files,
    expires_at: new Date(expires_at),
    download_count: 0,
    metadata: metadata || null,
  })

  return res.status(201).json({ digital_download: download })
}
