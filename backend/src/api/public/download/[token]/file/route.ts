// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { DIGITAL_DOWNLOAD_MODULE } from "../../../../../modules/digital-download"
import type DigitalDownloadModuleService from "../../../../../modules/digital-download/service"

/**
 * GET /public/download/:token/file?i=<index>
 *
 * Streams a single e-book file back to the browser with
 * `Content-Disposition: attachment`, which FORCES a real download instead of
 * opening the PDF inline. This is the only reliable way to make downloads work
 * on mobile / in-app mail browsers (WEB.DE, GMX, Gmail app, …) — the `download`
 * attribute on an <a> is ignored cross-origin, and public MinIO URLs serve PDFs
 * inline. Proxying with the attachment header fixes it for every client.
 *
 * Public route (no publishable key) — the opaque token IS the authorization.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    const { token } = req.params
    const index = Math.max(0, parseInt(String(req.query.i ?? "0"), 10) || 0)

    const downloadService = req.scope.resolve(
      DIGITAL_DOWNLOAD_MODULE
    ) as DigitalDownloadModuleService

    const [records] = await downloadService.listAndCountDigitalDownloads(
      { token },
      { take: 1 }
    )
    if (!records || records.length === 0) {
      return res.status(404).json({ message: "Download not found" })
    }

    const download = records[0]

    // Expiry check (same policy as the data route)
    if (new Date(download.expires_at) < new Date()) {
      return res.status(410).json({ message: "Download link expired", expired: true })
    }

    const files = (download.files as unknown as any[]) || []
    const file = files[index]
    if (!file || !file.key) {
      return res.status(404).json({ message: "File not found" })
    }

    // Build the internal MinIO URL (public-read bucket) — same construction as
    // the data route, but fetched server-side so we can override the header.
    const minioEndpointRaw =
      process.env.MINIO_PUBLIC_ENDPOINT || process.env.MINIO_ENDPOINT || ""
    const minioBucket = process.env.MINIO_BUCKET || "medusa-media"
    let endpoint = minioEndpointRaw
    if (!endpoint.startsWith("http")) endpoint = `https://${endpoint}`
    endpoint = endpoint.replace(/\/$/, "")
    const encodedKey = String(file.key)
      .split("/")
      .map((part: string) => encodeURIComponent(part))
      .join("/")
    const sourceUrl = `${endpoint}/${minioBucket}/${encodedKey}`

    const upstream = await fetch(sourceUrl)
    if (!upstream.ok) {
      console.error(`[Download File] upstream ${upstream.status} for ${file.key}`)
      return res.status(502).json({ message: "File temporarily unavailable" })
    }

    // Filename: prefer the human title, fall back to the key's basename.
    const rawName = (file.title || String(file.key).split("/").pop() || "ebook").trim()
    const baseName = rawName.toLowerCase().endsWith(".pdf") ? rawName : `${rawName}.pdf`
    // ASCII fallback (strip diacritics/non-ascii) + RFC 5987 UTF-8 variant.
    const asciiName = baseName.normalize("NFKD").replace(/[^\x20-\x7E]/g, "").replace(/"/g, "") || "ebook.pdf"
    const utf8Name = encodeURIComponent(baseName)

    res.setHeader("Content-Type", upstream.headers.get("content-type") || "application/pdf")
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${asciiName}"; filename*=UTF-8''${utf8Name}`
    )
    const len = upstream.headers.get("content-length")
    if (len) res.setHeader("Content-Length", len)
    res.setHeader("Cache-Control", "private, max-age=0, no-store")

    const buffer = Buffer.from(await upstream.arrayBuffer())
    return res.send(buffer)
  } catch (error: any) {
    console.error("[Download File] error:", error?.message || error)
    return res.status(500).json({ message: "Download failed" })
  }
}
