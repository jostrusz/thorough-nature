// @ts-nocheck
import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { FAKTUROID_MODULE } from "../modules/fakturoid"
import { getAccessToken } from "../modules/fakturoid/api-client"
import { mergeOrderMetadata } from "../utils/merge-order-metadata"

/**
 * Add the missing "Doprava" line to July invoices that were issued without it.
 *
 * Cause: order-placed-fakturoid.ts read order.shipping_total while retrieving the
 * order WITHOUT the shipping_methods relation, so the value was always undefined
 * → 0 → the shipping branch never ran. Fixed forward in the same commit as this
 * script; this repairs the 658 invoices already issued.
 *
 * Safety: every invoice is re-read, patched, then re-read again. If the resulting
 * total is not exactly the order total, the patch is rolled back and the invoice
 * reported — VAT modes differ between markets (from_total_with_vat vs without_vat,
 * plus reverse charge), and a wrong total is worse than a missing line.
 *
 * After a successful patch a payment record for the difference is added on the
 * invoice's original paid_on date, so status returns to `paid`.
 *
 * DRY RUN unless APPLY=1.  ONLY=<project> limits the run to one project.
 *   APPLY=1 pnpm medusa exec ./src/scripts/backfill-invoice-shipping.ts
 */

const BASE_URL = "https://app.fakturoid.cz/api/v3"
const FROM = "2026-07-01 00:00 Europe/Prague"
const TO = "2026-08-01 00:00 Europe/Prague"

const SHIPPING_VAT_RATES: Record<string, number> = {
  nl: 21, be: 21, de: 19, at: 20, se: 25, pl: 23, cz: 21, sk: 20,
  lu: 17, fr: 20, it: 22, es: 21, pt: 23, ie: 23, hu: 27,
}
const SHIPPING_LABEL: Record<string, string> = {
  cs: "Doprava", sk: "Doprava", pl: "Dostawa", fr: "Livraison",
  de: "Versand", hu: "Szállítás", en: "Shipping", sv: "Frakt", nl: "Verzending",
}
const LANG_BY_COUNTRY: Record<string, string> = {
  cz: "cs", sk: "sk", pl: "pl", fr: "fr", de: "de", at: "de",
  hu: "hu", se: "sv", no: "en", nl: "nl", be: "nl",
}

export default async function backfillInvoiceShipping({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)
  const fakturoidService = container.resolve(FAKTUROID_MODULE) as any
  const APPLY = process.env.APPLY === "1"
  const ONLY = process.env.ONLY || null

  const cfgs = await fakturoidService.listFakturoidConfigs({})
  const config = cfgs.find((c: any) => c.enabled) || cfgs[0]
  const t = await getAccessToken({
    slug: config.slug, client_id: config.client_id, client_secret: config.client_secret,
    user_agent_email: config.user_agent_email, access_token: config.access_token,
    token_expires_at: config.token_expires_at,
  })
  if (t.access_token !== config.access_token) {
    await fakturoidService.updateFakturoidConfigs({
      id: config.id, access_token: t.access_token, token_expires_at: t.expires_at,
    })
  }
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
      if (res.status === 403) return { locked: true }
      if (!res.ok) return { error: `${res.status} ${await res.text()}` }
      return { data: await res.json() }
    }
    return { error: "rate limited" }
  }

  const { rows: orders } = await knex.raw(
    `SELECT o.id, o.metadata->>'custom_order_number' AS num,
            o.metadata->>'project_id' AS project_id,
            o.metadata->>'fakturoid_internal_id' AS inv_id,
            o.currency_code,
            coalesce((SELECT sm.amount FROM order_shipping os
               JOIN order_shipping_method sm ON sm.id = os.shipping_method_id
              WHERE os.order_id = o.id LIMIT 1), 0) AS doprava,
            (SELECT (s.totals->>'current_order_total')::numeric FROM order_summary s
              WHERE s.order_id = o.id AND s.deleted_at IS NULL
              ORDER BY s.version DESC LIMIT 1) AS total,
            lower(coalesce((SELECT oa.country_code FROM order_address oa
              WHERE oa.id = o.shipping_address_id), '')) AS country
       FROM "order" o
      WHERE o.created_at >= timestamptz '${FROM}'
        AND o.created_at <  timestamptz '${TO}'
        AND o.deleted_at IS NULL
        AND (o.metadata ? 'fakturoid_internal_id')
        ${ONLY ? `AND o.metadata->>'project_id' = '${ONLY}'` : ""}
      ORDER BY o.created_at`
  )
  const withShip = orders.filter((o: any) => Number(o.doprava) > 0)
  logger.info(`[Ship] ${withShip.length} orders with paid shipping${APPLY ? "" : "  (DRY RUN)"}${ONLY ? ` [${ONLY}]` : ""}`)

  const R = { ok: 0, already: 0, rolledback: 0, locked: 0, err: 0, skipped: 0 }
  const problems: string[] = []

  for (const o of withShip) {
    const invId = Number(o.inv_id)
    if (!invId) { R.skipped++; continue }
    const dop = Number(o.doprava)
    const want = Number(o.total)

    const got = await api(`/invoices/${invId}.json`)
    if (got.locked) { R.locked++; problems.push(`${o.num}: faktura zamčená`); continue }
    if (got.error) { R.err++; problems.push(`${o.num}: GET ${got.error}`); continue }
    const inv = got.data

    const label = SHIPPING_LABEL[LANG_BY_COUNTRY[o.country] || "en"] || "Doprava"
    const hasShip = (inv.lines || []).some((l: any) =>
      Object.values(SHIPPING_LABEL).some((s) => l.name.toLowerCase().includes(s.toLowerCase()))
    )
    if (hasShip) { R.already++; continue }
    if (Math.abs(Number(inv.total) - want) < 0.01) { R.already++; continue }

    const vat = inv.transferred_tax_liability ? 0 : (SHIPPING_VAT_RATES[o.country] ?? 0)
    const keep = (inv.lines || []).map((l: any) => ({
      id: l.id, name: l.name, quantity: l.quantity,
      unit_name: l.unit_name, unit_price: l.unit_price, vat_rate: l.vat_rate,
    }))
    const patch = {
      lines: [...keep, { name: label, quantity: "1.0", unit_name: "ks", unit_price: String(dop), vat_rate: vat }],
    }

    if (!APPLY) { R.ok++; continue }

    const put = await api(`/invoices/${invId}.json`, { method: "PATCH", body: JSON.stringify(patch) })
    if (put.locked) { R.locked++; problems.push(`${o.num}: zamčená při PATCH`); continue }
    if (put.error) { R.err++; problems.push(`${o.num}: PATCH ${put.error}`); continue }

    // verify — the invoice total must now equal the order total exactly
    const after = Number(put.data.total)
    if (Math.abs(after - want) >= 0.01) {
      await api(`/invoices/${invId}.json`, { method: "PATCH", body: JSON.stringify({ lines: keep }) })
      R.rolledback++
      problems.push(`${o.num}: po přidání ${after} ${inv.currency}, čekáno ${want} → vráceno zpět`)
      continue
    }

    // top up the payment so the invoice goes back to `paid`
    const remaining = Number(put.data.remaining_amount || 0)
    if (remaining > 0.005) {
      await api(`/invoices/${invId}/payments.json`, {
        method: "POST",
        body: JSON.stringify({ paid_on: inv.paid_on || inv.issued_on, amount: remaining, currency: inv.currency }),
      })
    }
    await mergeOrderMetadata(o.id, { fakturoid_shipping_backfilled_at: new Date().toISOString() }, "Ship Backfill")
    R.ok++
  }

  logger.info("═".repeat(58))
  logger.info(`[Ship] ${APPLY ? "ZAPSÁNO" : "DRY RUN"}`)
  logger.info(`  ✅ doplněna doprava: ${R.ok}`)
  logger.info(`  ⏭️  už byla / sedělo: ${R.already}`)
  logger.info(`  ↩️  vráceno (nesedl total): ${R.rolledback}`)
  logger.info(`  🔒 zamčené: ${R.locked}`)
  logger.info(`  ❌ chyby: ${R.err}`)
  logger.info(`  ⏭️  bez fakturoid_internal_id: ${R.skipped}`)
  for (const p of problems.slice(0, 40)) logger.info(`     ${p}`)
  logger.info("═".repeat(58))
}
