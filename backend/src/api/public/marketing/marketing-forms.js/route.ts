// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import fs from "fs"
import path from "path"

/**
 * GET /public/marketing/marketing-forms.js
 * Serves the storefront forms renderer JS.
 */

function resolveJsPath(): string | null {
  const candidates = [
    path.resolve(process.cwd(), "..", "storefront", "public", "marketing-forms.js"),
    path.resolve(process.cwd(), "storefront", "public", "marketing-forms.js"),
    path.resolve(__dirname, "../../../../../../../storefront/public/marketing-forms.js"),
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
        res.status(404).send("// marketing-forms.js not found")
        return
      }
      cachedContent = fs.readFileSync(p, "utf8")
    }
    res.setHeader("Content-Type", "application/javascript; charset=utf-8")
    res.setHeader("Cache-Control", "public, max-age=300")
    res.setHeader("Access-Control-Allow-Origin", "*")
    res.send(cachedContent)
  } catch (e: any) {
    res.status(500).send(`// marketing-forms.js serve failed: ${e.message}`)
  }
}
