// @ts-nocheck
import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { FAKTUROID_MODULE } from "../modules/fakturoid"
import {
  getAccessToken, searchSubject, createSubject, createInvoice,
  mapCountryToLanguage, getOSSMode,
} from "../modules/fakturoid/api-client"
import { mergeOrderMetadata } from "../utils/merge-order-metadata"
import * as fs from "fs"

/**
 * Issue the July invoices the order.placed subscriber never produced, for orders
 * that are paid and demonstrably have no invoice anywhere in Fakturoid.
 *
 * Verification before issuing (all three must come up empty — a duplicate tax
 * document is far worse than a missing one):
 *   1. /invoices.json?custom_id=<medusa order id>
 *   2. /invoices.json?custom_id=<gateway payment id>   (older code used this)
 *   3. every subject matching the customer e-mail → their invoices → match on
 *      order_number, or on same currency+total issued within ±5 days
 *
 * Step 3 exists because searchSubject() returns subjects[0] only, and customers
 * do have several subjects on one address (Anna Kopczuk has a personal and a
 * company one) — a single-subject check produces false "missing" results.
 *
 * Invoice payload mirrors order-placed-fakturoid.ts: same VAT tables, language,
 * OSS mode and vat_price_mode, issued_on/taxable_fulfillment_due backdated to the
 * order date, then marked paid on that date.
 *
 * DRY RUN unless APPLY=1.
 */

const BASE_URL = "https://app.fakturoid.cz/api/v3"
const IN = "/private/tmp/claude-501/-Users-jaroslavostruszka-thorough-nature--claude-worktrees-ecstatic-darwin-ecb123/ecba5ac1-a7d6-4d3e-b6d7-358c9c68bd04/scratchpad/to-issue.json"

const BOOK_VAT: Record<string, number> = {
  nl: 9, be: 6, de: 7, at: 10, se: 6, pl: 5, cz: 0, sk: 5,
  lu: 3, fr: 5, it: 4, es: 4, pt: 6, ie: 0, hu: 5, no: 0,
}
const SHIP_VAT: Record<string, number> = {
  nl: 21, be: 21, de: 19, at: 20, se: 25, pl: 23, cz: 21, sk: 20,
  lu: 17, fr: 20, it: 22, es: 21, pt: 23, ie: 23, hu: 27, no: 0,
}
const SHIP_LABEL: Record<string, string> = {
  cz: "Doprava", sk: "Doprava", pl: "Dostawa", fr: "Livraison",
  de: "Versand", at: "Versand", hu: "Szállítás", se: "Frakt",
  no: "Frakt", nl: "Verzending", be: "Verzending",
}

export default async function issueMissingInvoices({ container }: ExecArgs) {
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
  if (t.access_token !== config.access_token) {
    await fakturoidService.updateFakturoidConfigs({
      id: config.id, access_token: t.access_token, token_expires_at: t.expires_at,
    })
  }
  const creds = {
    slug: config.slug, client_id: config.client_id,
    client_secret: config.client_secret, user_agent_email: config.user_agent_email,
  }
  const H = {
    Authorization: `Bearer ${t.access_token}`,
    Accept: "application/json",
    "Content-Type": "application/json",
    "User-Agent": `MarketingHQ (${config.user_agent_email})`,
  }
  const acc = `${BASE_URL}/accounts/${config.slug}`

  async function api(path: string) {
    for (let a = 0; a < 4; a++) {
      try {
        const ctl = new AbortController()
        const timer = setTimeout(() => ctl.abort(), 20_000)
        const res = await fetch(`${acc}${path}`, { headers: H, signal: ctl.signal })
        clearTimeout(timer)
        if (res.status === 429 || res.status >= 500) { await new Promise(r => setTimeout(r, 1500 * (a + 1))); continue }
        if (!res.ok) return null
        return await res.json()
      } catch { if (a === 3) return null; await new Promise(r => setTimeout(r, 1500 * (a + 1))) }
    }
    return null
  }

  const all: any[] = JSON.parse(fs.readFileSync(IN, "utf8"))
  // Company customers are excluded — reverse charge needs a VAT ID we do not hold.
  const CORPORATE = /^(info|kontakt|office|biuro|admin|sales|faktur)@|@(.*\.)?(skipper-co|arpaconstruct|magona|europe)\./i
  const items = all.filter((o: any) => !CORPORATE.test(o.email || ""))
  const skippedCorp = all.length - items.length
  logger.info(`[Issue] ${items.length} orders (${skippedCorp} firemních vynecháno)${APPLY ? "" : "  (DRY RUN)"}`)

  const R = { issued: 0, exists: 0, err: 0 }
  const found: string[] = []
  const errs: string[] = []

  for (const o of items) {
    // ── verification ──────────────────────────────────────────────
    let hit: any = null
    const byOrderId = await api(`/invoices.json?custom_id=${encodeURIComponent(o.id)}`)
    if (Array.isArray(byOrderId) && byOrderId.length) hit = byOrderId[0]

    if (!hit) {
      const { rows: pr } = await knex.raw(
        `SELECT p.data FROM order_payment_collection opc
           JOIN payment p ON p.payment_collection_id = opc.payment_collection_id
          WHERE opc.order_id = ? LIMIT 1`, [o.id]
      )
      const d = pr?.[0]?.data || {}
      const gwId = d.intentId || d.airwallexPaymentIntentId || d.id || d.paypalOrderId || d.klarnaOrderId
      if (gwId) {
        const byGw = await api(`/invoices.json?custom_id=${encodeURIComponent(String(gwId))}`)
        if (Array.isArray(byGw) && byGw.length) hit = byGw[0]
      }
    }

    if (!hit && o.email) {
      const subs = await api(`/subjects/search.json?query=${encodeURIComponent(o.email)}`)
      for (const s of (Array.isArray(subs) ? subs : [])) {
        const list = await api(`/invoices.json?subject_id=${s.id}`)
        for (const inv of (Array.isArray(list) ? list : [])) {
          if (inv.document_type !== "invoice") continue
          if (inv.order_number && inv.order_number === o.num) { hit = inv; break }
          const sameMoney =
            String(inv.currency).toLowerCase() === String(o.cur).toLowerCase() &&
            Math.abs(Number(inv.total) - Number(o.total)) < 0.01
          const days = Math.abs(
            (new Date(inv.issued_on).getTime() - new Date(o.den).getTime()) / 86400000
          )
          if (sameMoney && days <= 5) { hit = inv; break }
        }
        if (hit) break
      }
    }

    if (hit) {
      R.exists++
      found.push(`${o.num} → už existuje ${hit.number} (${hit.total} ${hit.currency}, ${hit.issued_on})`)
      if (APPLY) {
        await mergeOrderMetadata(o.id, {
          fakturoid_invoice_id: hit.number,
          fakturoid_internal_id: String(hit.id),
          fakturoid_invoice_number: hit.number,
          fakturoid_invoice_url: hit.public_html_url,
          fakturoid_link_backfilled_at: new Date().toISOString(),
        }, "Issue/Link")
      }
      continue
    }

    if (!APPLY) { R.issued++; continue }

    // ── issue ─────────────────────────────────────────────────────
    try {
      const { rows: ar } = await knex.raw(
        `SELECT oa.first_name, oa.last_name, oa.address_1, oa.city, oa.postal_code,
                lower(oa.country_code) AS country
           FROM "order" o
           LEFT JOIN order_address oa ON oa.id = COALESCE(o.billing_address_id, o.shipping_address_id)
          WHERE o.id = ?`, [o.id]
      )
      const a = ar?.[0] || {}
      const country = (a.country || o.zeme || "").toLowerCase()

      // Customers do type the town into the postal-code box ("42143 Västra
      // Frölunda", "NEUVILLE EN FERRAIN (59960)") and Fakturoid rejects anything
      // over 20 chars. Keep the digit group, fall back to a hard truncate.
      const rawZip = (a.postal_code || "").trim()
      const zip = rawZip.length <= 20
        ? rawZip
        : (rawZip.match(/\d[\d\s]{2,9}\d/)?.[0]?.trim() || rawZip.slice(0, 20))

      let subject = await searchSubject(creds, t.access_token, o.email || "")
      if (!subject) {
        subject = await createSubject(creds, t.access_token, {
          name: [a.first_name, a.last_name].filter(Boolean).join(" ") || o.email,
          email: o.email,
          street: a.address_1 || undefined,
          city: a.city || undefined,
          zip: zip || undefined,
          country: country ? country.toUpperCase() : undefined,
        })
      }
      if (!subject) { R.err++; errs.push(`${o.num}: subject se nepodařilo založit`); continue }

      const { rows: li } = await knex.raw(
        `SELECT li.title, li.unit_price, oi.quantity
           FROM order_item oi JOIN order_line_item li ON li.id = oi.item_id
          WHERE oi.order_id = ?`, [o.id]
      )
      const lines: any[] = li.map((l: any) => ({
        name: l.title, quantity: Number(l.quantity), unit_price: Number(l.unit_price),
        unit_name: "ks", vat_rate: BOOK_VAT[country] ?? 0,
      }))
      if (!lines.length) { R.err++; errs.push(`${o.num}: žádné položky`); continue }
      const dop = Number(o.doprava || 0)
      if (dop > 0) {
        lines.push({
          name: SHIP_LABEL[country] || "Doprava", quantity: 1, unit_price: dop,
          unit_name: "ks", vat_rate: SHIP_VAT[country] ?? 0,
        })
      }

      const invoice = await createInvoice(creds, t.access_token, {
        subject_id: subject.id,
        custom_id: o.id,
        order_number: o.num,
        currency: String(o.cur).toUpperCase(),
        language: mapCountryToLanguage(country, config.default_language || "en"),
        oss: getOSSMode(country),
        vat_price_mode: "from_total_with_vat",
        payment_method: "card",
        issued_on: o.den,
        taxable_fulfillment_due: o.den,
        lines,
      })
      if (!invoice) { R.err++; errs.push(`${o.num}: createInvoice vrátilo null`); continue }

      const total = Number(invoice.total)
      if (Math.abs(total - Number(o.total)) >= 0.01) {
        R.err++
        errs.push(`⚠️ ${o.num}: faktura ${invoice.number} zní na ${total} ${invoice.currency}, objednávka ${o.total} — ZKONTROLOVAT`)
      }

      // pay it on the original date
      await fetch(`${acc}/invoices/${invoice.id}/payments.json`, {
        method: "POST", headers: H,
        body: JSON.stringify({ paid_on: o.den, amount: total, currency: invoice.currency }),
      })

      await mergeOrderMetadata(o.id, {
        fakturoid_invoice_id: invoice.number,
        fakturoid_internal_id: String(invoice.id),
        fakturoid_invoice_number: invoice.number,
        fakturoid_invoice_url: invoice.public_html_url,
        fakturoid_invoice_created: true,
        fakturoid_issued_retroactively_at: new Date().toISOString(),
      }, "Issue")
      R.issued++
      logger.info(`[Issue] ${o.num} → ${invoice.number} (${total} ${invoice.currency})`)
    } catch (e: any) {
      R.err++; errs.push(`${o.num}: ${e.message}`)
    }
  }

  logger.info("═".repeat(58))
  logger.info(`[Issue] ${APPLY ? "ZAPSÁNO" : "DRY RUN"}`)
  logger.info(`  🧾 vystaveno:            ${R.issued}`)
  logger.info(`  ⏭️  už existovalo:        ${R.exists}`)
  logger.info(`  ❌ chyby:                ${R.err}`)
  for (const f of found) logger.info(`   ${f}`)
  for (const e of errs) logger.info(`   ${e}`)
  logger.info("═".repeat(58))
}
