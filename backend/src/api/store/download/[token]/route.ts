import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { DIGITAL_DOWNLOAD_MODULE } from "../../../../modules/digital-download"
import type DigitalDownloadModuleService from "../../../../modules/digital-download/service"
import MinioFileProviderService from "../../../../modules/minio-file/service"

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const { token } = req.params

  const downloadService = req.scope.resolve(
    DIGITAL_DOWNLOAD_MODULE
  ) as DigitalDownloadModuleService

  // Find download record by token
  const [records] = await downloadService.listAndCountDigitalDownloads(
    { token },
    { take: 1 }
  )

  if (!records || records.length === 0) {
    return res.status(404).json({
      message: "Download niet gevonden",
    })
  }

  const download = records[0]

  // Check expiry
  if (new Date(download.expires_at) < new Date()) {
    return res.status(410).json({
      message: "Deze download-link is verlopen. Neem contact op met devries@loslatenboek.nl voor een nieuwe link.",
      expired: true,
    })
  }

  // Increment download count
  await downloadService.updateDigitalDownloads({
    selector: { id: download.id },
    data: {
      download_count: (download.download_count || 0) + 1,
    },
  })

  // Generate presigned URLs for each file
  const files = (download.files as unknown as any[]) || []
  let fileProvider: MinioFileProviderService | null = null

  try {
    fileProvider = req.scope.resolve("pp_minio-file_minio") as MinioFileProviderService
  } catch {
    // Fallback: try resolving directly
    try {
      fileProvider = req.scope.resolve("fp_minio") as MinioFileProviderService
    } catch {
      return res.status(500).json({
        message: "File provider niet beschikbaar",
      })
    }
  }

  const filesWithUrls = await Promise.all(
    files.map(async (file: any) => {
      let downloadUrl = ""
      try {
        downloadUrl = await fileProvider!.getPresignedDownloadUrl({
          fileKey: file.key,
        })
      } catch (error) {
        console.error(`Failed to generate presigned URL for ${file.key}:`, error)
      }

      return {
        title: file.title,
        description: file.description,
        size: file.size,
        download_url: downloadUrl,
      }
    })
  )

  return res.json({
    download: {
      order_id: download.order_id,
      email: download.email,
      expires_at: download.expires_at,
      download_count: download.download_count + 1,
      files: filesWithUrls,
    },
  })
}
