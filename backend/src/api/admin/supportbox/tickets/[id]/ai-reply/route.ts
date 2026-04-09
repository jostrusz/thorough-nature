// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SUPPORTBOX_MODULE } from "../../../../../../modules/supportbox"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import Anthropic from "@anthropic-ai/sdk"

/**
 * POST /admin/supportbox/tickets/:id/ai-reply
 *
 * Generates a customer support reply using Claude Opus.
 * Gathers full ticket context (conversation, customer, orders) and returns
 * structured output: identification, timeline, problem, reply, translation.
 */

const SYSTEM_PROMPT = `# Customer Support Assistant

## Role

Jsi AI asistent zákaznické podpory pro e-commerce s knihami a e-booky. Zpracováváš dotazy zákazníků v CZ, SK, NL, BE, DE, AT, LU, PL, HU, SE. Generuješ odpovědi v jazyce zákazníka + český překlad.

## Workflow

### 1 IDENTIFIKACE
→ jazyk, pohlaví, produkt

### 2 TIMELINE
→ chronologický přehled komunikace (česky)

### 3 PROBLÉM
→ stručný popis (in English)

### 4 ODPOVĚĎ
→ v jazyce zákazníka
→ NEPOUŽÍVEJ markdown formátování (žádné **, __, ##, atd.)

### 5 PŘEKLADY
→ překlad odpovědi do češtiny, thajštiny a angličtiny
→ NEPOUŽÍVEJ markdown formátování

## Výstupní formát

IMPORTANT: Return a valid JSON object with the following fields:
- "identification": string with language, gender, project info (in English)
- "timeline": string with chronological overview (in English)
- "problem": string with problem description (in English)
- "reply": string with the reply for the customer in their language, plain text without markdown
- "translation_cs": string with Czech translation of the reply, plain text without markdown
- "translation_th": string with Thai translation of the reply, plain text without markdown
- "translation_en": string with English translation of the reply, plain text without markdown

Return ONLY valid JSON, no markdown code blocks.

## Oslovení dle jazyka

| Jazyk | Muž | Žena | Neutrální |
|-------|-----|------|-----------|
| CZ | Dobrý den, pane [příjmení] | Dobrý den, paní [příjmení] | Dobrý den |
| SK | Dobrý deň, pán [príjmení] | Dobrý deň, pani [príjmení] | Dobrý deň |
| DE | Guten Tag, Herr [Nachname] | Guten Tag, Frau [Nachname] | Guten Tag |
| NL | Goedendag meneer [achternaam] | Goedendag mevrouw [achternaam] | Goedendag |
| PL | Dzień dobry, panie [nazwisko] | Dzień dobry, pani [nazwisko] | Dzień dobry |
| HU | Jó napot, uram | Jó napot, hölgyem | Jó napot |
| SE | Hej [förnamn] | Hej [förnamn] | Hej |

## GLS Tracking

Pro zásilky přes GLS použij tento formát tracking URL:
https://gls-group.eu/CZ/en/parcel-tracking?match={tracking_number}&postalCode={delivery_postal_code}

Kde {delivery_postal_code} je PSČ doručovací adresy zákazníka.

## Pravidla

- Timeline vždy česky, odpověď v jazyce zákazníka
- Tón přátelský, empatický + :) za poděkováním
- Podpis = autor dle produktu z databáze níže
- Chybí info → zdvořile požádej o doplnění
- Pokud zákazník neuvedl číslo objednávky a je potřeba, zdvořile o něj požádej
- NIKDY nepoužívej markdown formátování v odpovědi (žádné **, __, ##)

## DATABÁZE PRODUKTŮ

### CZ Kočičí bible
- Autor: Michal Peterka
- Web: kocicibible.cz
- E-mail: kniha@kocicibible.cz
- E-booky (bez knihy): https://drive.google.com/drive/folders/1-w5r-6yRI5LyxZwo3FVWvxPF9GjRx97q
- E-booky (s knihou): https://drive.google.com/drive/folders/1PhQ6zQFy5eKmcL-p_mQtgBuZE9Du5rsv

### CZ Psí superživot
- Autor: Michal Peterka
- Web: psi-superzivot.cz
- E-mail: podpora@psi-superzivot.cz
- E-booky: https://drive.google.com/file/d/1OhSkeRxhZXdW0WipUnL6XuSPO4gJ_WZP

### SK Mačacia biblia
- Autor: Michal Peterka
- Web: macaciabiblia.sk
- E-mail: pomoc@macaciabiblia.sk
- E-booky: https://drive.google.com/drive/folders/134FQsgqj5nroK4Dgn3zEbLTt8iDyvB2O

### NL/BE De Kattenbijbel
- Autor: Luuk van der Meer
- Web: bijbelderkatten.nl
- E-mail: boek@bijbelderkatten.nl
- E-booky (bez knihy): https://drive.google.com/drive/folders/1A_vB0zklYdK1nCOdV65QgWO3J4p2waBa
- E-booky (s knihou): https://drive.google.com/drive/folders/1qK-87rSmL14YuVED7duJFGr23lqZM1_L

### NL De Hondenbijbel
- Autor: Lars Vermeulen
- Web: dehondenbijbel.nl
- E-mail: support@dehondenbijbel.nl
- E-booky: https://drive.google.com/file/d/1-xBB7TOxlt0QwomYab9g23qq4N9HGtso

### NL Laat los wat je kapotmaakt
- Autor: Joris de Vries
- Web: loslatenboek.nl
- E-mail: devries@loslatenboek.nl
- E-booky: https://drive.google.com/drive/folders/1dEWjyyx-k_LrZ-uEm4iLNQu9u8Fj0CPl

### NL Atomaire Aantrekkingskracht
- Autor: Luuk van der Meer
- Web: atomaire-aantrekkingskracht.nl
- E-mail: vandermeer@atomaire-aantrekkingskracht.nl
- E-booky: https://drive.google.com/drive/folders/1hpPdmshyJRqlFoUsVtYK4gNRJ4ro6dzL

### DE/AT/LU Lass los, was dich kaputt macht
- Autor: Joris de Vries
- Web: lasslosbuch.de
- E-mail: buch@befreiungsbuch.de
- E-booky: https://drive.google.com/drive/folders/15_GK1BC3-wqBZ1J-hJD8TeDh-6fK_yD7

### HU Macskabiblia
- Autor: Nagy Zoltán
- Web: macskabiblia-konyv.hu
- E-mail: konyv@macskabiblia-konyv.hu
- E-booky (bez knihy): https://drive.google.com/drive/folders/1j5-bP6A_O2-ipFU4QA9FdccsGcMmhzX1
- E-booky (s knihou): https://drive.google.com/drive/folders/1GXJXxeUhyksgA2iCwSdWKTY4wPmaOuA7

### PL Biblia kotów
- Autor: Michał Peterka
- Web: biblia-kotow.pl
- E-mail: ksiazka@biblia-kotow.pl
- E-booky: https://drive.google.com/drive/folders/10oDIlbqQQcDKZWC2ytKKbdCWSg_Q7VCT

### PL Odpuść to, co cię niszczy
- Autor: Joris de Vries
- Web: odpusc-ksiazka.pl
- E-mail: biuro@odpusc-ksiazka.pl
- E-booky: https://drive.google.com/drive/folders/13pkndibLLOdnq9jaq4qKUjaoj5WWEu1W

### SE Släpp taget om det som förstör dig
- Autor: Joris de Vries
- Web: slapptagetboken.se
- E-mail: hej@slapptagetboken.com
- E-booky: https://drive.google.com/drive/folders/1j7qP5LpsuCvv7XiHal6BgXkjRDqY8kI-
`

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const logger = req.scope.resolve("logger")
  const supportboxService = req.scope.resolve(SUPPORTBOX_MODULE) as any
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { id } = req.params

  try {
    // ── 1. Fetch ticket + messages ──
    const ticket = await supportboxService.retrieveSupportboxTicket(id)
    const messages = await supportboxService.listSupportboxMessages(
      { ticket_id: id },
      { order: { created_at: "ASC" } }
    )

    // ── 2. Fetch all orders for this customer ──
    let allOrders: any[] = []
    if (ticket.from_email) {
      try {
        const { data: orders } = await query.graph({
          entity: "order",
          fields: [
            "id", "display_id", "status", "email", "total", "currency_code",
            "created_at", "canceled_at", "metadata",
            "items.*",
            "fulfillments.*", "fulfillments.labels.*",
            "shipping_address.*",
            "billing_address.*",
            "payment_collections.*", "payment_collections.payments.*",
            "payment_collections.payments.captures.*",
            "payment_collections.payments.refunds.*",
          ],
          filters: { email: ticket.from_email },
          pagination: { order: { created_at: "DESC" }, skip: 0, take: 200 },
        })
        allOrders = orders || []
      } catch (e) {
        // Order matching is best-effort
      }
    }

    // ── 3. Build conversation context ──
    const stripHtml = (html: string) =>
      html?.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim() || ""

    const conversationThread = messages.map((m: any) => {
      const direction = m.direction === "inbound" ? "ZÁKAZNÍK" : "PODPORA"
      const body = m.body_text || stripHtml(m.body_html) || "(prázdné)"
      const date = new Date(m.created_at).toLocaleString("cs-CZ", {
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      })
      const from = m.from_name ? `${m.from_name} <${m.from_email || ""}>` : m.from_email || ""
      return `[${date}] ${direction} (${from}):\n${body}`
    }).join("\n\n---\n\n")

    // ── 4. Build order context ──
    const orderContext = allOrders.map((o: any) => {
      const payments = (o.payment_collections || []).flatMap(
        (pc: any) => (pc.payments || []).map((p: any) => ({
          provider: p.provider_id,
          captured: !!p.captured_at,
          amount: p.amount,
          currency: p.currency_code,
          refunds: (p.refunds || []).map((r: any) => ({
            amount: r.amount,
            note: r.note,
            date: r.created_at,
          })),
        }))
      )

      const items = (o.items || []).map((i: any) =>
        `  - ${i.quantity}x ${i.title} (${i.unit_price} ${o.currency_code?.toUpperCase()})`
      ).join("\n")

      const addr = o.shipping_address
      const address = addr
        ? `${addr.first_name} ${addr.last_name}, ${addr.address_1}${addr.address_2 ? ", " + addr.address_2 : ""}, ${addr.postal_code} ${addr.city}, ${addr.country_code?.toUpperCase()}${addr.phone ? ", tel: " + addr.phone : ""}`
        : "N/A"

      const meta = o.metadata || {}
      const dextrumInfo = [
        meta.dextrum_status ? `Stav doručení: ${meta.dextrum_status}` : null,
        meta.dextrum_tracking_number ? `Tracking: ${meta.dextrum_tracking_number}` : null,
        meta.dextrum_tracking_link ? `Tracking URL: ${meta.dextrum_tracking_link}` : null,
        meta.dextrum_carrier ? `Dopravce: ${meta.dextrum_carrier}` : null,
        meta.dextrum_order_code ? `WMS kód: ${meta.dextrum_order_code}` : null,
        meta.shipping_method ? `Způsob dopravy: ${meta.shipping_method}` : null,
        meta.paczkomat_name || meta.packeta_point_name ? `Výdejní místo: ${meta.paczkomat_name || meta.packeta_point_name}` : null,
        meta.paczkomat_address || meta.packeta_point_address ? `Adresa výdejního místa: ${meta.paczkomat_address || meta.packeta_point_address}` : null,
      ].filter(Boolean)

      const refundInfo = payments.flatMap((p: any) =>
        p.refunds.map((r: any) => `  Refund: ${r.amount} ${p.currency?.toUpperCase()} (${r.note || "bez poznámky"}) - ${new Date(r.date).toLocaleDateString("cs-CZ")}`)
      )

      // Timeline from metadata
      const timeline = meta.dextrum_timeline || []
      const timelineStr = timeline.length > 0
        ? "\n  Timeline:\n" + timeline.map((t: any) => `    ${t.date ? new Date(t.date).toLocaleString("cs-CZ") : ""} - ${t.status}: ${t.detail || ""}`).join("\n")
        : ""

      return [
        `Objednávka #${o.display_id} (${o.status}) — ${o.currency_code?.toUpperCase()} ${o.total}`,
        `  Vytvořena: ${new Date(o.created_at).toLocaleString("cs-CZ")}`,
        o.canceled_at ? `  Zrušena: ${new Date(o.canceled_at).toLocaleString("cs-CZ")}` : null,
        `  Položky:\n${items}`,
        `  Doručovací adresa: ${address}`,
        `  Platba: ${payments.map((p: any) => `${p.provider} — ${p.amount} ${p.currency?.toUpperCase()} (${p.captured ? "zaplaceno" : "nezaplaceno"})`).join(", ") || "N/A"}`,
        ...dextrumInfo.map(d => `  ${d}`),
        ...refundInfo,
        timelineStr,
      ].filter(Boolean).join("\n")
    }).join("\n\n")

    // ── 5. Build user message ──
    const userMessage = `=== TICKET ===
Předmět: ${ticket.subject}
Od: ${ticket.from_name} <${ticket.from_email}>
Status: ${ticket.status}
Vytvořeno: ${new Date(ticket.created_at).toLocaleString("cs-CZ")}
AI label: ${ticket.ai_label || "N/A"}

=== KONVERZACE (${messages.length} zpráv) ===
${conversationThread}

=== OBJEDNÁVKY ZÁKAZNÍKA (${allOrders.length} nalezeno) ===
${orderContext || "Žádné objednávky nenalezeny pro tento e-mail"}
`

    // ── 6. Call Claude Opus ──
    const additionalInstructions = (req.body as any)?.instructions || ""
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const aiMessages: any[] = [{ role: "user", content: userMessage }]

    // If additional instructions provided, add them as a follow-up
    if (additionalInstructions.trim()) {
      aiMessages.push(
        { role: "assistant", content: "I'll generate the response now." },
        { role: "user", content: `ADDITIONAL INSTRUCTIONS FROM THE SUPPORT AGENT — follow these instructions to refine the reply:\n\n${additionalInstructions}\n\nGenerate the complete JSON response again with the refined reply and all translations.` }
      )
    }

    const response = await client.messages.create({
      model: "claude-opus-4-20250514",
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: aiMessages,
    })

    let aiText = response.content[0].type === "text" ? response.content[0].text : ""
    // Strip markdown code block markers if present
    aiText = aiText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim()

    let parsed: any
    try {
      parsed = JSON.parse(aiText)
    } catch (parseErr) {
      // If JSON parsing fails, return raw text
      logger.warn(`[SupportBox AI] Failed to parse JSON response, returning raw text`)
      parsed = {
        identification: "",
        timeline: "",
        problem: "",
        reply: aiText,
        translation_cs: "",
        translation_th: "",
        translation_en: "",
      }
    }

    logger.info(`[SupportBox AI] Generated reply for ticket ${id}`)

    res.json({
      success: true,
      data: {
        identification: parsed.identification || "",
        timeline: parsed.timeline || "",
        problem: parsed.problem || "",
        reply: parsed.reply || "",
        translation_cs: parsed.translation_cs || "",
        translation_th: parsed.translation_th || "",
        translation_en: parsed.translation_en || "",
      },
    })
  } catch (error: any) {
    logger.error(`[SupportBox AI] Failed to generate reply: ${error.message}`)
    res.status(500).json({ error: error.message })
  }
}
