import { Modules } from "@medusajs/framework/utils"
import { IOrderModuleService } from "@medusajs/framework/types"
import { SubscriberArgs, SubscriberConfig } from "@medusajs/medusa"
import { shouldSkipDuplicate } from "../utils/idempotency-guard"
import { mergeOrderMetadata } from "../utils/merge-order-metadata"

const NTFY_TOPIC = process.env.NTFY_TOPIC || "medusa-ntfy-obj-2026"
const NTFY_URL = `https://ntfy.sh/${NTFY_TOPIC}`

/**
 * Access token for a paid ntfy.sh tier. Without it we publish anonymously and
 * ntfy.sh applies its free-tier quota to the *Railway egress IP* (250 msg/day,
 * plus a 60-request burst that refills one per 5s). At 400+ orders a day that
 * quota runs out mid-morning, which is exactly what happened on 2026-07-28:
 * the server stored nothing after 07:06 UTC while this subscriber logged ~50
 * further "Notification sent" lines.
 */
const NTFY_TOKEN = process.env.NTFY_TOKEN || ""

/**
 * POST to ntfy and report whether it was actually accepted.
 *
 * fetch() resolves on 4xx/5xx, so the previous version logged success no matter
 * what ntfy answered — a five-hour outage looked perfectly healthy in the logs.
 *
 * A 429 is deliberately NOT retried. ntfy.sh temporarily blacklists IPs that
 * keep publishing through rate-limit responses, so retrying would turn a
 * recoverable quota stop into a hard block for every project on this host.
 */
async function publishToNtfy(
  body: string,
  title: string,
  orderRef: string
): Promise<boolean> {
  const headers: Record<string, string> = {
    Title: title,
    Priority: "high",
    Tags: "tada,moneybag",
  }
  if (NTFY_TOKEN) headers.Authorization = `Bearer ${NTFY_TOKEN}`

  let res: Response
  try {
    res = await fetch(NTFY_URL, { method: "POST", headers, body })
  } catch (err: any) {
    console.error(`[ntfy] order ${orderRef}: request failed — ${err.message}`)
    return false
  }

  if (res.ok) {
    console.log(`[ntfy] Notification sent for order ${orderRef}`)
    return true
  }

  const detail = (await res.text().catch(() => "")).slice(0, 300).trim()
  if (res.status === 429) {
    console.error(
      `[ntfy] order ${orderRef}: RATE LIMITED (429) — quota for this IP is spent, ` +
        `not retrying to avoid an IP block. Set NTFY_TOKEN to publish under a paid tier. ${detail}`
    )
  } else {
    console.error(`[ntfy] order ${orderRef}: REJECTED HTTP ${res.status} — ${detail}`)
  }
  return false
}

// Project display names
/**
 * Push-notification labels. Names follow lib/project-context.ts, shortened
 * where the full book title would not fit a phone notification.
 *
 * Every project_id that appears on a real order must be here — an unlisted one
 * falls through to the raw slug, which is how Norwegian orders were arriving as
 * "slipp-taket". Six projects were missing, including the two biggest
 * (loslatenboek, het-leven).
 *
 * The last two entries are not slugs but bad data seen in production:
 * "odpust-ksiazka" is a typo of odpusc-ksiazka (5 orders) and "Slipp taket" is
 * a display name written into project_id instead of the slug (2 orders). They
 * are mapped so the notification stays readable; the rows themselves still want
 * fixing at the source.
 */
const PROJECT_NAMES: Record<string, string> = {
  loslatenboek: "Laat los (NL)",
  "het-leven": "Het leven dat je verdient (NL)",
  dehondenbijbel: "De Hondenbijbel (NL)",
  odpusc: "Odpuść (PL)",
  "odpusc-ksiazka": "Odpuść (PL)",
  "zycie-zaslugy": "Życie, jakiego nigdy… (PL)",
  "biblia-kotow": "Biblia kotów (PL)",
  slapp: "Släpp taget (SE)",
  "slapp-taget": "Släpp taget (SE)",
  "slipp-taket": "Slipp taket (NO)",
  "lass-los": "Lass los (DE/AT)",
  "lache-livre": "Lâche prise (FR)",
  suelta: "Suelta lo que te destruye (ES)",
  larga: "Larga o que te destrói (PT)",
  "engedd-el": "Engedd el (HU)",
  "odpust-knizka": "Pusť to, co tě ničí (CZ)",
  "pusti-to-sk": "Pusti to, čo ťa ničí (SK)",
  "zivot-zaslugy": "Život, jaký si zasloužíš (CZ)",
  "psi-superzivot": "Psí superživot (CZ)",
  "kocici-bible": "Kočičí bible (CZ)",
  "macacia-biblia": "Mačacia biblia (SK)",
  // known bad values on existing orders
  "odpust-ksiazka": "Odpuść (PL)",
  "Slipp taket": "Slipp taket (NO)",
}

// Currency symbols
const CURRENCY_SYMBOLS: Record<string, string> = {
  eur: "€",
  pln: "zł",
  sek: "kr",
  nok: "kr", // Norwegian krone — was missing, so NO orders showed a bare number
  dkk: "kr",
  czk: "Kč",
  usd: "$",
  gbp: "£",
  huf: "Ft",
}

/**
 * Subscriber: order.placed → Push notification via ntfy.sh
 *
 * Sends a celebratory push notification to iOS when a new order is placed.
 */
export default async function orderPlacedNtfyHandler({
  event: { data },
  container,
}: SubscriberArgs<any>) {
  try {
    const orderService: IOrderModuleService = container.resolve(Modules.ORDER)

    // ── Idempotency: prevent duplicate push notifications after server restart ──
    if (await shouldSkipDuplicate(orderService, data.id, 'ntfy_notification_sent', 'ntfy')) return

    const order = await orderService.retrieveOrder(data.id, {
      relations: ["items", "summary", "shipping_address"],
    })

    if (!order) return

    const metadata = (order.metadata || {}) as Record<string, any>
    const projectId = metadata.project_id || "unknown"
    const projectName = PROJECT_NAMES[projectId] || projectId

    // Get order total
    const total = (order.summary as any)?.current_order_total
      || (order.summary as any)?.total
      || 0
    const currency = order.currency_code?.toLowerCase() || "eur"
    const symbol = CURRENCY_SYMBOLS[currency] || currency.toUpperCase()

    // Totals are ALWAYS in major units (project convention) — never divide.
    // The old `total > 1000 ? total/100` heuristic broke CZK orders >= 1000 Kc
    // (e.g. 1599 Kc showed as "15.99 Kc").
    const amount = Number(total || 0).toFixed(2)

    // Customer info
    const shipping = order.shipping_address as any
    const customerName = shipping
      ? `${shipping.first_name || ""} ${shipping.last_name || ""}`.trim()
      : order.email || "Unknown"
    const country = shipping?.country_code?.toUpperCase() || ""

    // Item count
    const itemCount = (order.items || []).reduce(
      (sum: number, item: any) => sum + (item.quantity || 1),
      0
    )

    // Build display number
    const displayNumber = (order as any).display_id
      || metadata.custom_order_number
      || order.id.slice(-8)

    // Send ntfy notification (use base64-encoded UTF-8 title to avoid non-ASCII header error)
    const title = `Nova objednavka`
    const body = [
      `${amount} ${symbol} | ${projectName}`,
      `${customerName}${country ? ` (${country})` : ""}`,
    ].join("\n")

    const delivered = await publishToNtfy(body, title, String(displayNumber))

    // The idempotency guard sets its flag BEFORE we publish, so a failed send
    // would otherwise be remembered as done and never retried. Clear it so a
    // redelivered order.placed can have another go once the quota resets.
    if (!delivered) {
      await mergeOrderMetadata(data.id, { ntfy_notification_sent: false }, "ntfy")
    }
  } catch (error: any) {
    // Never let notification errors crash the order flow
    console.error("[ntfy] Failed to send notification:", error.message)
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
