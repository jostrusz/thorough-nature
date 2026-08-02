// @ts-nocheck
import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { FAKTUROID_MODULE } from "../modules/fakturoid"
import { getAccessToken } from "../modules/fakturoid/api-client"
import * as fs from "fs"

/**
 * Record the missing part-payment on invoices whose shipping line was added
 * retroactively by backfill-invoice-shipping.ts.
 *
 * That script decided whether to top up from `remaining_amount`, which turns out
 * to mirror `total` even on fully paid invoices — so the guard was meaningless
 * and no top-up was ever recorded. The invoices carry correct lines and totals
 * but their payments are short by exactly the postage.
 *
 * Input: scratchpad/topup.json — [invoice_id, number, currency, amount, paid_on,
 * order_number] computed offline from a fresh paginated export (sum(payments)
 * vs total). Reading a prepared list keeps this run to one POST per invoice;
 * 661 sequential GET+POST pairs timed out at ~31 minutes.
 *
 * DRY RUN unless APPLY=1.
 */

const BASE_URL = "https://app.fakturoid.cz/api/v3"
const IN = "/private/tmp/claude-501/-Users-jaroslavostruszka-thorough-nature--claude-worktrees-ecstatic-darwin-ecb123/ecba5ac1-a7d6-4d3e-b6d7-358c9c68bd04/scratchpad/topup.json"
const CONCURRENCY = 5

export default async function topupInvoicePayments({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
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

  const items: any[] = JSON.parse(fs.readFileSync(IN, "utf8"))
  logger.info(`[TopUp] ${items.length} invoices to top up${APPLY ? "" : "  (DRY RUN)"}`)

  const R = { ok: 0, err: 0 }
  const errs: string[] = []
  let cursor = 0

  async function post(one: any) {
    const [id, number, currency, amount, paid_on] = one
    for (let a = 0; a < 4; a++) {
      try {
        const ctl = new AbortController()
        const timer = setTimeout(() => ctl.abort(), 20_000)
        const res = await fetch(`${acc}/invoices/${id}/payments.json`, {
          method: "POST",
          headers: H,
          signal: ctl.signal,
          body: JSON.stringify({ paid_on, amount, currency }),
        })
        clearTimeout(timer)
        if (res.status === 429) { await new Promise(r => setTimeout(r, 2000 * (a + 1))); continue }
        if (!res.ok) {
          const body = (await res.text()).slice(0, 120)
          if (res.status >= 500) { await new Promise(r => setTimeout(r, 1500 * (a + 1))); continue }
          R.err++; if (errs.length < 20) errs.push(`${number}: ${res.status} ${body}`)
          return
        }
        R.ok++
        return
      } catch (e: any) {
        if (a === 3) { R.err++; if (errs.length < 20) errs.push(`${number}: ${e.message}`) }
        else await new Promise(r => setTimeout(r, 1500 * (a + 1)))
      }
    }
  }

  async function worker() {
    for (;;) {
      const i = cursor++
      if (i >= items.length) return
      if (APPLY) await post(items[i])
      else R.ok++
      if (i % 100 === 0) logger.info(`[TopUp] ${i}/${items.length}`)
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()))

  logger.info("═".repeat(58))
  logger.info(`[TopUp] ${APPLY ? "ZAPSÁNO" : "DRY RUN"}  ok=${R.ok}  chyb=${R.err}`)
  for (const e of errs) logger.info(`   ${e}`)
  logger.info("═".repeat(58))
}
