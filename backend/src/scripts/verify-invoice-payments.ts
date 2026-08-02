// @ts-nocheck
import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { FAKTUROID_MODULE } from "../modules/fakturoid"
import { getAccessToken } from "../modules/fakturoid/api-client"

/**
 * Check that every shipping-repaired invoice has payment records summing to its
 * total, and top up the difference where it does not.
 *
 * Why this exists: backfill-invoice-shipping.ts decided whether to add a payment
 * from `remaining_amount`. That field turns out to mirror `total` even on fully
 * paid invoices (verified on 2026-34251 and 2026-36893: total == remaining while
 * payments already covered them), so the guard `remaining > 0` was meaningless
 * and the top-up POST never produced a correct amount. The invoices ended up with
 * the right lines and totals but payments short by exactly the postage.
 *
 * The reliable measure is sum(payments[].amount) vs total, which is what this uses.
 *
 * DRY RUN unless APPLY=1.
 */

const BASE_URL = "https://app.fakturoid.cz/api/v3"

export default async function verifyInvoicePayments({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const fakturoidService = container.resolve(FAKTUROID_MODULE) as any
  const APPLY = process.env.APPLY === "1"

  const cfgs = await fakturoidService.listFakturoidConfigs({})
  const config = cfgs.find((c: any) => c.enabled) || cfgs[0]
  const t = await getAccessToken({
    slug: config.slug, client_id: config.client_id, client_secret: config.client_secret,
    user_agent_email: config.user_agent_email, access_token: config.access_token,
    token_expires_at: config.token_expires_at,
  })
  const H = {
    Authorization: `Bearer ${t.access_token}`,
    Accept: "application/json",
    "Content-Type": "application/json",
    "User-Agent": `MarketingHQ (${config.user_agent_email})`,
  }
  const acc = `${BASE_URL}/accounts/${config.slug}`

  async function api(path: string, init?: any) {
    for (let a = 0; a < 4; a++) {
      const res = await fetch(`${acc}${path}`, { headers: H, ...(init || {}) })
      if (res.status === 429) { await new Promise(r => setTimeout(r, 2000 * (a + 1))); continue }
      if (!res.ok) return { error: `${res.status} ${(await res.text()).slice(0, 120)}` }
      return { data: await res.json() }
    }
    return { error: "rate limited" }
  }

  const { rows } = await knex.raw(
    `SELECT metadata->>'custom_order_number' AS num,
            metadata->>'fakturoid_internal_id' AS inv,
            metadata->>'project_id' AS proj
       FROM "order"
      WHERE metadata ? 'fakturoid_shipping_backfilled_at'
      ORDER BY metadata->>'project_id'`
  )
  logger.info(`[VerPay] ${rows.length} invoices to check${APPLY ? "" : "  (DRY RUN)"}`)

  const R = { ok: 0, topped: 0, short: 0, err: 0 }
  const detail: string[] = []
  let shortSum: Record<string, number> = {}

  for (const r of rows) {
    const got = await api(`/invoices/${r.inv}.json`)
    if (got.error) { R.err++; detail.push(`${r.num}: ${got.error}`); continue }
    const inv = got.data
    const total = Number(inv.total)
    const paid = (inv.payments || []).reduce((s: number, p: any) => s + Number(p.amount || 0), 0)
    const diff = Math.round((total - paid) * 100) / 100

    if (Math.abs(diff) < 0.01) { R.ok++; continue }
    R.short++
    shortSum[inv.currency] = (shortSum[inv.currency] || 0) + diff
    if (detail.length < 15) detail.push(`${r.num} (${r.proj}): total ${total} ${inv.currency}, zaplaceno ${paid} → chybí ${diff}`)

    if (APPLY && diff > 0) {
      const add = await api(`/invoices/${r.inv}/payments.json`, {
        method: "POST",
        body: JSON.stringify({
          paid_on: inv.paid_on || inv.issued_on,
          amount: diff,
          currency: inv.currency,
        }),
      })
      if (add.error) { R.err++; detail.push(`${r.num}: POST platby ${add.error}`) }
      else R.topped++
    }
  }

  logger.info("═".repeat(58))
  logger.info(`[VerPay] ${APPLY ? "ZAPSÁNO" : "DRY RUN"}`)
  logger.info(`  ✅ platby sedí s totalem: ${R.ok}`)
  logger.info(`  ⚠️  chybí doplatek:        ${R.short}`)
  logger.info(`  ➕ doplaceno:             ${R.topped}`)
  logger.info(`  ❌ chyby:                 ${R.err}`)
  logger.info(`  součet chybějícího: ${JSON.stringify(shortSum)}`)
  for (const d of detail) logger.info(`     ${d}`)
  logger.info("═".repeat(58))
}
