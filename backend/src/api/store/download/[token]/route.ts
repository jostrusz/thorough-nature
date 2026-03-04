import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { DIGITAL_DOWNLOAD_MODULE } from "../../../../modules/digital-download"
import type DigitalDownloadModuleService from "../../../../modules/digital-download/service"

// Project-specific contact emails
const PROJECT_SUPPORT_EMAILS: Record<string, string> = {
  dehondenbijbel: "support@travelbible.nl",
  loslatenboek: "devries@loslatenboek.nl",
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
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
    const meta = (download.metadata as Record<string, any>) || {}
    const projectId = meta.project_id || "loslatenboek"
    const supportEmail = PROJECT_SUPPORT_EMAILS[projectId] || PROJECT_SUPPORT_EMAILS.loslatenboek

    // Check expiry
    if (new Date(download.expires_at) < new Date()) {
      return res.status(410).json({
        message:
          `Deze download-link is verlopen. Neem contact op met ${supportEmail} voor een nieuwe link.`,
        expired: true,
        project_id: projectId,
      })
    }

    // Increment download count (MedusaService format: { id, ...fields })
    try {
      await downloadService.updateDigitalDownloads({
        id: download.id,
        download_count: (download.download_count || 0) + 1,
      })
    } catch (updateErr: any) {
      console.warn("[Download] Could not update download count:", updateErr.message)
    }

    // Build public file URLs from MinIO endpoint (bucket has public-read policy)
    const minioEndpoint = process.env.MINIO_ENDPOINT || ""
    const minioBucket = process.env.MINIO_BUCKET || "medusa-media"

    const files = (download.files as unknown as any[]) || []
    const filesWithUrls = files.map((file: any) => {
      let downloadUrl = ""
      try {
        let endpoint = minioEndpoint
        if (!endpoint.startsWith("http")) {
          endpoint = `https://${endpoint}`
        }
        endpoint = endpoint.replace(/\/$/, "")
        const encodedKey = file.key
          .split("/")
          .map((part: string) => encodeURIComponent(part))
          .join("/")
        downloadUrl = `${endpoint}/${minioBucket}/${encodedKey}`
      } catch (urlErr: any) {
        console.error(`[Download] Failed to build URL for ${file.key}:`, urlErr.message)
      }

      return {
        title: file.title,
        description: file.description,
        size: file.size,
        download_url: downloadUrl,
      }
    })

    return res.json({
      download: {
        order_id: download.order_id,
        email: download.email,
        expires_at: download.expires_at,
        download_count: (download.download_count || 0) + 1,
        project_id: projectId,
        files: filesWithUrls,
      },
    })
  } catch (error: any) {
    console.error("[Download] Route error:", error.message)
    return res.status(500).json({
      message: "Er is een fout opgetreden bij het ophalen van de download.",
    })
  }
}
