// @ts-nocheck
import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { FAKTUROID_MODULE } from "../modules/fakturoid"
import { getAccessToken } from "../modules/fakturoid/api-client"
import * as fs from "fs"

/**
 * Restate the payment record on invoices whose shipping line was added later, so
 * the recorded amount equals what the customer actually paid.
 *
 * Fakturoid refuses `POST /payments` on an invoice it considers settled
 * ("Payment cannot be added to already paid invoice"), and offers no PATCH for a
 * payment — so the only route is delete + recreate at the full amount. The
 * original paid_on, variable_symbol and bank_account_id are carried over, so the
 * new record is the old one with a corrected amount.
 *
 * Order matters: the invoice is briefly unpaid between the two calls, so the
 * recreate is retried hard and any invoice left without a payment is reported by
 * number for manual repair.
 *
 * ONE=<invoice_id> repairs a single invoice (use to sanity-check first).
 * DRY RUN unless APPLY=1.
 */

const BASE_URL = "https://app.fakturoid.cz/api/v3"
const IN = "/private/tmp/claude-501/-Users-jaroslavostruszka-thorough-nature--claude-worktrees-ecstatic-darwin-ecb123/ecba5ac1-a7d6-4d3e-b6d7-358c9c68bd04/scratchpad/topup.json"
const CONCURRENCY = 4

export default async function fixInvoicePaymentAmounts({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const fakturoidService = container.resolve(FAKTUROID_MODULE) as any
  const APPLY = process.env.APPLY === "1"
  const ONE = process.env.ONE ? Number(process.env.ONE) : null

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

  async function call(path: string, init?: any, tries = 5) {
    for (let a = 0; a < tries; a++) {
      try {
        const ctl = new AbortController()
        const timer = setTimeout(() => ctl.abort(), 20_000)
        const res = await fetch(`${acc}${path}`, { headers: H, signal: ctl.signal, ...(init || {}) })
        clearTimeout(timer)
        if (res.status === 429 || res.status >= 500) {
          await new Promise(r => setTimeout(r, 1500 * (a + 1))); continue
        }
        if (res.status === 204) return { ok: true }
        if (!res.ok) return { error: `${res.status} ${(await res.text()).slice(0, 140)}` }
        return { ok: true, data: await res.json() }
      } catch (e: any) {
        if (a === tries - 1) return { error: e.message }
        await new Promise(r => setTimeout(r, 1500 * (a + 1)))
      }
    }
    return { error: "retries exhausted" }
  }

  let items: any[] = JSON.parse(fs.readFileSync(IN, "utf8"))
  if (ONE) items = items.filter((i: any) => i[0] === ONE)
  logger.info(`[FixPay] ${items.length} invoices${APPLY ? "" : "  (DRY RUN)"}${ONE ? `  [jen ${ONE}]` : ""}`)

  const R = { fixed: 0, already: 0, err: 0, orphan: 0 }
  const errs: string[] = []
  let cursor = 0

  async function handle(one: any) {
    const [id, number] = one
    const got = await call(`/invoices/${id}.json`)
    if (got.error) { R.err++; errs.push(`${number}: GET ${got.error}`); return }
    const inv = got.data
    const total = Number(inv.total)
    const pays = inv.payments || []
    const sum = pays.reduce((s: number, p: any) => s + Number(p.amount), 0)
    if (Math.abs(total - sum) < 0.01) { R.already++; return }
    if (pays.length !== 1) {
      R.err++; errs.push(`${number}: ${pays.length} plateb — přeskočeno, chce ruční zásah`); return
    }
    const old = pays[0]
    if (!APPLY) { R.fixed++; return }

    const del = await call(`/invoices/${id}/payments/${old.id}.json`, { method: "DELETE" })
    if (del.error) { R.err++; errs.push(`${number}: DELETE ${del.error}`); return }

    const body: any = { paid_on: old.paid_on, amount: total, currency: inv.currency }
    if (old.variable_symbol) body.variable_symbol = old.variable_symbol
    if (old.bank_account_id) body.bank_account_id = old.bank_account_id

    const add = await call(`/invoices/${id}/payments.json`, { method: "POST", body: JSON.stringify(body) }, 8)
    if (add.error) {
      R.orphan++
      errs.push(`⚠️ ${number} (id ${id}): platba smazána, nová SELHALA — ${add.error}  [${total} ${inv.currency}, ${old.paid_on}]`)
      return
    }
    R.fixed++
  }

  async function worker() {
    for (;;) {
      const i = cursor++
      if (i >= items.length) return
      await handle(items[i])
      if (i % 100 === 0) logger.info(`[FixPay] ${i}/${items.length}`)
    }
  }
  await Promise.all(Array.from({ length: ONE ? 1 : CONCURRENCY }, () => worker()))

  logger.info("═".repeat(58))
  logger.info(`[FixPay] ${APPLY ? "ZAPSÁNO" : "DRY RUN"}`)
  logger.info(`  ✅ opraveno:        ${R.fixed}`)
  logger.info(`  ⏭️  už sedělo:      ${R.already}`)
  logger.info(`  ❌ chyby:           ${R.err}`)
  logger.info(`  🚨 BEZ PLATBY:      ${R.orphan}   ← vyžadují ruční zápis`)
  for (const e of errs.slice(0, 30)) logger.info(`   ${e}`)
  logger.info("═".repeat(58))
}
