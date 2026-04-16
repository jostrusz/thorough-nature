// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import fs from "fs"
import path from "path"

/**
 * GET /public/marketing/marketing.js
 * Serves the storefront tracking snippet as a JS asset.
 *
 * Script is loaded cross-origin by storefronts:
 *   <script async src="https://www.marketing-hq.eu/public/marketing/marketing.js"
 *           data-brand="..." data-api="..."></script>
 */

// Resolve the file path once at module load. We look in two candidate locations
// so it works whether run inside the backend container or the monorepo root:
//   1) <cwd>/../storefront/public/marketing.js
//   2) <project-root>/storefront/public/marketing.js (fallback for dev)
function resolveJsPath(): string | null {
  const candidates = [
    path.resolve(process.cwd(), "..", "storefront", "public", "marketing.js"),
    path.resolve(process.cwd(), "storefront", "public", "marketing.js"),
    path.resolve(__dirname, "../../../../../../../storefront/public/marketing.js"),
  ]
  for (const p of candidates) {
    if (fs.existsSync(p)) return p
  }
  return null
}

let cachedContent: string | null = null

export async function GET(_req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    if (cachedContent === null) {
      const p = resolveJsPath()
      if (!p) {
        res.status(404).send("// marketing.js not found")
        return
      }
      cachedContent = fs.readFileSync(p, "utf8")
    }
    res.setHeader("Content-Type", "application/javascript; charset=utf-8")
    res.setHeader("Cache-Control", "public, max-age=300")
    res.setHeader("Access-Control-Allow-Origin", "*")
    res.send(cachedContent)
  } catch (e: any) {
    res.status(500).send(`// marketing.js serve failed: ${e.message}`)
  }
}
