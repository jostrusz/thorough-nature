// @ts-nocheck
import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { FAKTUROID_MODULE } from "../modules/fakturoid"
import { getAccessToken } from "../modules/fakturoid/api-client"
import * as fs from "fs"

/**
 * Dump every Fakturoid invoice issued since SINCE into one JSON file.
 *
 * Fakturoid v3 has no bulk-export endpoint — /invoices.json returns 40 per page —
 * so this walks the pages and concatenates. The result is the authoritative index
 * used to answer two questions that per-order lookups cannot answer reliably:
 *
 *   1. Does an invoice exist for order X?  (email→subject lookup gives false
 *      negatives: searchSubject() returns subjects[0] and some customers have
 *      several subjects on the same address)
 *   2. Which invoices are missing the "Doprava" line? (order-placed-fakturoid.ts
 *      reads order.shipping_total, which retrieveOrder never populates because
 *      shipping_methods is not in its relations list)
 *
 * Output: scratchpad/fakturoid-invoices.json
 *   pnpm medusa exec ./src/scripts/export-fakturoid-invoices.ts
 */

const BASE_URL = "https://app.fakturoid.cz/api/v3"
const SINCE = "2026-06-25T00:00:00+02:00"
const OUT =
  "/private/tmp/claude-501/-Users-jaroslavostruszka-thorough-nature--claude-worktrees-ecstatic-darwin-ecb123/ecba5ac1-a7d6-4d3e-b6d7-358c9c68bd04/scratchpad/fakturoid-invoices-2.json"

export default async function exportFakturoidInvoices({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const fakturoidService = container.resolve(FAKTUROID_MODULE) as any

  const configs = await fakturoidService.listFakturoidConfigs({})
  const config = configs.find((c: any) => c.enabled) || configs[0]
  if (!config) throw new Error("No Fakturoid config found")

  const t = await getAccessToken({
    slug: config.slug,
    client_id: config.client_id,
    client_secret: config.client_secret,
    user_agent_email: config.user_agent_email,
    access_token: config.access_token,
    token_expires_at: config.token_expires_at,
  })
  if (t.access_token !== config.access_token) {
    await fakturoidService.updateFakturoidConfigs({
      id: config.id,
      access_token: t.access_token,
      token_expires_at: t.expires_at,
    })
  }

  const h = {
    Authorization: `Bearer ${t.access_token}`,
    Accept: "application/json",
    "User-Agent": `MarketingHQ (${config.user_agent_email})`,
  }
  const acc = `${BASE_URL}/accounts/${config.slug}`

  const all: any[] = []
  let page = 1
  for (;;) {
    const url = `${acc}/invoices.json?since=${encodeURIComponent(SINCE)}&page=${page}`
    const res = await fetch(url, { headers: h })
    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, 3000))
      continue
    }
    if (!res.ok) {
      logger.warn(`[Export] page ${page} → HTTP ${res.status}, stopping`)
      break
    }
    const batch = await res.json()
    if (!Array.isArray(batch) || batch.length === 0) break
    all.push(...batch)
    if (page % 25 === 0) logger.info(`[Export] page ${page}, ${all.length} invoices so far`)
    page++
    if (page > 600) { logger.warn("[Export] page cap hit"); break }
  }

  // keep only what the analysis needs — the raw dump is ~10x larger
  const slim = all.map((i: any) => ({
    id: i.id,
    number: i.number,
    document_type: i.document_type,
    order_number: i.order_number,
    custom_id: i.custom_id,
    subject_id: i.subject_id,
    client_name: i.client_name,
    client_country: i.client_country,
    currency: i.currency,
    total: Number(i.total),
    status: i.status,
    issued_on: i.issued_on,
    locked: !!i.locked_at,
    cancelled: !!i.cancelled_at,
    paid_on: i.paid_on,
    payments: (i.payments || []).map((p: any) => ({ amount: Number(p.amount), paid_on: p.paid_on })),
    lines: (i.lines || []).map((l: any) => ({
      name: l.name,
      qty: Number(l.quantity),
      unit_price: Number(l.unit_price),
      vat_rate: l.vat_rate,
    })),
  }))

  fs.writeFileSync(OUT, JSON.stringify(slim))
  logger.info("═".repeat(60))
  logger.info(`[Export] ${slim.length} invoices → ${OUT}`)
  const types: any = {}
  for (const i of slim) types[i.document_type] = (types[i.document_type] || 0) + 1
  logger.info(`[Export] podle typu: ${JSON.stringify(types)}`)
  logger.info(`[Export] rozsah vystavení: ${slim.reduce((a, i) => i.issued_on < a ? i.issued_on : a, "9999")} → ${slim.reduce((a, i) => i.issued_on > a ? i.issued_on : a, "0")}`)
  logger.info("═".repeat(60))
}
