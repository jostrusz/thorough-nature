// @ts-nocheck
import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { FAKTUROID_MODULE } from "../modules/fakturoid"
import { getAccessToken } from "../modules/fakturoid/api-client"
import { mergeOrderMetadata } from "../utils/merge-order-metadata"

/**
 * Backfill `fakturoid_invoice_id` & friends onto orders whose invoice WAS
 * created in Fakturoid but never linked back.
 *
 * Root cause: order-placed-fakturoid.ts wraps the metadata write in its own
 * try/catch (line ~347). When that write fails the invoice already exists and
 * is marked paid — only the back-reference is lost. 187 July orders are in this
 * state.
 *
 * Matching, in order of confidence:
 *   1. GET /invoices.json?custom_id=<medusa order id>   (exact, set by newer code)
 *   2. subject by e-mail → their invoices → order_number == custom_order_number
 *
 * A match is only written when BOTH currency and total agree with the order
 * (tolerance 0.01). Anything else is reported and left untouched — a wrong link
 * is worse than a missing one.
 *
 * DRY RUN by default. Pass --apply to write.
 *   pnpm medusa exec ./src/scripts/backfill-fakturoid-links.ts
 *   pnpm medusa exec ./src/scripts/backfill-fakturoid-links.ts --apply
 */

const BASE_URL = "https://app.fakturoid.cz/api/v3"
const FROM = "2026-07-01 00:00 Europe/Prague"
const TO = "2026-08-01 00:00 Europe/Prague"

function headers(token: string, email: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
    "User-Agent": `MarketingHQ (${email})`,
  }
}

async function fjson(url: string, token: string, email: string) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, { headers: headers(token, email) })
    if (res.status === 429) {
      // Fakturoid rate limit: back off and retry
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)))
      continue
    }
    if (!res.ok) return null
    return await res.json()
  }
  return null
}

export default async function backfillFakturoidLinks({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const fakturoidService = container.resolve(FAKTUROID_MODULE) as any
  const APPLY = process.env.APPLY === "1" || process.argv.includes("--apply")

  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)

  const { rows: orders } = await knex.raw(
    `SELECT o.id, o.email, o.currency_code,
            o.metadata->>'project_id' AS project_id,
            o.metadata->>'custom_order_number' AS order_number,
            (o.created_at AT TIME ZONE 'Europe/Prague')::date AS den,
            (SELECT (s.totals->>'current_order_total')::numeric FROM order_summary s
              WHERE s.order_id = o.id AND s.deleted_at IS NULL
              ORDER BY s.version DESC LIMIT 1) AS total
       FROM "order" o
      WHERE o.created_at >= timestamptz '${FROM}'
        AND o.created_at <  timestamptz '${TO}'
        AND o.deleted_at IS NULL
        AND NOT (o.metadata ? 'fakturoid_invoice_id')
      ORDER BY den, o.id`
  )

  logger.info(`[Backfill] ${orders.length} orders without an invoice link${APPLY ? "" : "  (DRY RUN)"}`)

  // one token per project config
  const tokenCache = new Map<string, { token: string; slug: string; email: string }>()
  async function credsFor(projectId: string) {
    if (tokenCache.has(projectId)) return tokenCache.get(projectId)
    const configs = await fakturoidService.listFakturoidConfigs({ project_id: projectId })
    const config = configs?.[0]
    if (!config || !config.enabled) return null
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
    const entry = { token: t.access_token, slug: config.slug, email: config.user_agent_email }
    tokenCache.set(projectId, entry)
    return entry
  }

  const out = { linked: [], mismatch: [], notfound: [], noconfig: [], nototal: [] }

  for (const o of orders) {
    if (!o.project_id) { out.noconfig.push({ ...o, why: "no project_id" }); continue }
    const c = await credsFor(o.project_id)
    if (!c) { out.noconfig.push({ ...o, why: `no active config for ${o.project_id}` }); continue }
    const acc = `${BASE_URL}/accounts/${c.slug}`

    // 1) exact match on custom_id
    let inv = null
    const byCustom = await fjson(
      `${acc}/invoices.json?custom_id=${encodeURIComponent(o.id)}`, c.token, c.email
    )
    if (Array.isArray(byCustom) && byCustom.length) inv = byCustom[0]

    // 2) subject by e-mail → match on order_number
    if (!inv && o.email) {
      const subs = await fjson(
        `${acc}/subjects/search.json?query=${encodeURIComponent(o.email)}`, c.token, c.email
      )
      const subject = Array.isArray(subs) && subs.length ? subs[0] : null
      if (subject) {
        const list = await fjson(`${acc}/invoices.json?subject_id=${subject.id}`, c.token, c.email)
        if (Array.isArray(list)) {
          inv =
            list.find((i: any) => o.order_number && i.order_number === o.order_number) ||
            list.find((i: any) => i.custom_id === o.id) ||
            null
        }
      }
    }

    if (!inv) { out.notfound.push(o); continue }
    if (o.total == null) { out.nototal.push({ ...o, invoice: inv.number }); continue }

    const orderTotal = Number(o.total)
    const invTotal = Number(inv.total)
    const curOk = String(inv.currency).toLowerCase() === String(o.currency_code).toLowerCase()
    const sumOk = Math.abs(invTotal - orderTotal) < 0.01

    if (!curOk || !sumOk) {
      out.mismatch.push({
        order: o.order_number || o.id, den: o.den, project: o.project_id,
        order_total: orderTotal, order_cur: o.currency_code,
        invoice: inv.number, inv_total: invTotal, inv_cur: inv.currency,
        reason: !curOk ? "MĚNA" : "ČÁSTKA",
      })
      continue
    }

    out.linked.push({
      order: o.order_number || o.id, den: o.den, project: o.project_id,
      invoice: inv.number, total: `${invTotal} ${inv.currency}`, status: inv.status,
    })

    if (APPLY) {
      await mergeOrderMetadata(o.id, {
        fakturoid_invoice_id: inv.number,
        fakturoid_internal_id: String(inv.id),
        fakturoid_invoice_number: inv.number,
        fakturoid_invoice_url: inv.public_html_url,
        fakturoid_link_backfilled_at: new Date().toISOString(),
      }, "Fakturoid Backfill")
    }
  }

  const line = "═".repeat(60)
  logger.info(line)
  logger.info(`[Backfill] ${APPLY ? "ZAPSÁNO" : "DRY RUN"}`)
  logger.info(`  ✅ sedí částka i měna → link:  ${out.linked.length}`)
  logger.info(`  ⚠️  nesedí (nezapsáno):        ${out.mismatch.length}`)
  logger.info(`  ❌ faktura nenalezena:         ${out.notfound.length}`)
  logger.info(`  ⏭️  bez konfigurace projektu:  ${out.noconfig.length}`)
  logger.info(`  ⏭️  bez součtu objednávky:     ${out.nototal.length}`)
  logger.info(line)

  if (out.mismatch.length) {
    logger.info("NESEDÍ — ponecháno beze změny:")
    for (const m of out.mismatch)
      logger.info(`  ${m.reason}  ${m.order} (${m.project}, ${m.den}): objednávka ${m.order_total} ${m.order_cur} × faktura ${m.invoice} = ${m.inv_total} ${m.inv_cur}`)
  }
  if (out.notfound.length) {
    logger.info("FAKTURA NENALEZENA:")
    for (const n of out.notfound)
      logger.info(`  ${n.order_number || n.id} (${n.project_id}, ${n.den}) ${n.total} ${n.currency_code} ${n.email}`)
  }
  if (out.noconfig.length) {
    logger.info("BEZ KONFIGURACE:")
    for (const n of out.noconfig) logger.info(`  ${n.order_number || n.id}: ${n.why}`)
  }

  const byProject = {}
  for (const l of out.linked) byProject[l.project] = (byProject[l.project] || 0) + 1
  logger.info("NALINKOVÁNO podle projektů: " + JSON.stringify(byProject))
}
