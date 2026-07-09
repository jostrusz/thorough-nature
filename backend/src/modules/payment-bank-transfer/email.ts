// @ts-nocheck
import { Resend } from "resend"

/**
 * Bank-transfer instruction e-mail (payment details + QR). Sent from the
 * bank-transfer INIT endpoint (cart-first flow — no order exists yet), so the
 * customer gets the IBAN/reference/QR the moment they choose the transfer.
 */

const BACKEND_URL =
  process.env.MEDUSA_BACKEND_URL || process.env.BACKEND_URL || "https://www.marketing-hq.eu"

export const EMAIL_I18N: Record<string, any> = {
  sk: { subject: "Dokončite platbu — objednávka", greeting: "Dobrý deň,", intro: "ďakujeme za objednávku! Zaplaťte ju prosím <b>bankovým prevodom</b> podľa údajov nižšie. Tovar odošleme <b>ihneď po pripísaní</b>.", amountToPay: "Suma na úhradu", details: "Údaje na prevod", recipient: "Príjemca", refL: "Referencia", vsL: "Variabilný symbol", amountL: "Suma", scan: "📲 Naskenujte QR v bankovej aplikácii", s1: "Otvorte bankovú aplikáciu", s2: "Zadajte údaje alebo naskenujte QR", s3: "Potvrďte platbu — odošleme tovar", notify: "🔔 Ozveme sa, keď platba dorazí (SEPA ~1 prac. deň).", help: "💬 Otázka? Odpovedzte na tento e-mail.", order: "Objednávka" },
  cs: { subject: "Dokončete platbu — objednávka", greeting: "Dobrý den,", intro: "děkujeme za objednávku! Zaplaťte ji prosím <b>bankovním převodem</b> podle údajů níže. Zboží odešleme <b>ihned po připsání</b>.", amountToPay: "Částka k úhradě", details: "Údaje k platbě", recipient: "Příjemce", refL: "Reference", vsL: "Variabilní symbol", amountL: "Částka", scan: "📲 Naskenujte QR v bankovní aplikaci", s1: "Otevřete bankovní aplikaci", s2: "Zadejte údaje nebo naskenujte QR", s3: "Potvrďte platbu — odešleme zboží", notify: "🔔 Ozveme se, jakmile platba dorazí (SEPA ~1 prac. den).", help: "💬 Dotaz? Odpovězte na tento e-mail.", order: "Objednávka" },
  de: { subject: "Zahlung abschließen — Bestellung", greeting: "Guten Tag,", intro: "danke für Ihre Bestellung! Bitte bezahlen Sie per <b>Banküberweisung</b> mit den Daten unten. Wir versenden <b>sofort nach Zahlungseingang</b>.", amountToPay: "Zu zahlender Betrag", details: "Überweisungsdaten", recipient: "Empfänger", refL: "Verwendungszweck", vsL: "Verwendungszweck", amountL: "Betrag", scan: "📲 QR in der Bank-App scannen", s1: "Öffnen Sie Ihre Bank-App", s2: "Daten eingeben oder QR scannen", s3: "Zahlung bestätigen — wir versenden", notify: "🔔 Wir melden uns, sobald die Zahlung eingeht (SEPA ~1 Werktag).", help: "💬 Frage? Antworten Sie einfach auf diese E-Mail.", order: "Bestellung" },
  nl: { subject: "Rond je betaling af — bestelling", greeting: "Beste,", intro: "bedankt voor je bestelling! Betaal deze via <b>bankoverschrijving</b> met de gegevens hieronder. We verzenden <b>zodra de betaling binnen is</b>.", amountToPay: "Te betalen bedrag", details: "Overschrijvingsgegevens", recipient: "Begunstigde", refL: "Kenmerk", vsL: "Kenmerk", amountL: "Bedrag", scan: "📲 Scan de QR in je bank-app", s1: "Open je bank-app", s2: "Voer de gegevens in of scan de QR", s3: "Bevestig de betaling — we verzenden", notify: "🔔 We laten het weten zodra de betaling binnen is (SEPA ~1 werkdag).", help: "💬 Vraag? Beantwoord deze e-mail.", order: "Bestelling" },
  pl: { subject: "Dokończ płatność — zamówienie", greeting: "Dzień dobry,", intro: "dziękujemy za zamówienie! Zapłać je <b>przelewem bankowym</b> według danych poniżej. Wyślemy towar <b>zaraz po zaksięgowaniu</b>.", amountToPay: "Kwota do zapłaty", details: "Dane do przelewu", recipient: "Odbiorca", refL: "Tytuł przelewu", vsL: "Tytuł przelewu", amountL: "Kwota", scan: "📲 Zeskanuj kod QR w aplikacji bankowej", s1: "Otwórz aplikację bankową", s2: "Wpisz dane lub zeskanuj QR", s3: "Potwierdź płatność — wyślemy towar", notify: "🔔 Odezwiemy się, gdy płatność dotrze (SEPA ~1 dzień roboczy).", help: "💬 Pytanie? Odpowiedz na tę wiadomość.", order: "Zamówienie" },
  sv: { subject: "Slutför betalningen — beställning", greeting: "Hej,", intro: "tack för din beställning! Betala den via <b>banköverföring</b> med uppgifterna nedan. Vi skickar <b>så snart betalningen kommit in</b>.", amountToPay: "Belopp att betala", details: "Betalningsuppgifter", recipient: "Mottagare", refL: "Referens", vsL: "Meddelande", amountL: "Belopp", scan: "📲 Skanna QR-koden i din bankapp", s1: "Öppna din bankapp", s2: "Ange uppgifterna eller skanna QR", s3: "Bekräfta betalningen — vi skickar", notify: "🔔 Vi hör av oss när betalningen kommit in (SEPA ~1 arbetsdag).", help: "💬 Fråga? Svara på detta mejl.", order: "Beställning" },
  no: { subject: "Fullfør betalingen — bestilling", greeting: "Hei,", intro: "takk for bestillingen! Betal den med <b>bankoverføring</b> etter opplysningene under. Vi sender <b>så snart betalingen er mottatt</b>.", amountToPay: "Beløp å betale", details: "Betalingsdetaljer", recipient: "Mottaker", refL: "Referanse", vsL: "Melding", amountL: "Beløp", scan: "📲 Skann QR-koden i bankappen", s1: "Åpne bankappen din", s2: "Skriv inn opplysningene eller skann QR", s3: "Bekreft betalingen — vi sender", notify: "🔔 Vi gir beskjed når betalingen er mottatt (SEPA ~1 virkedag).", help: "💬 Spørsmål? Svar på denne e-posten.", order: "Bestilling" },
  hu: { subject: "Fejezze be a fizetést — rendelés", greeting: "Jó napot,", intro: "köszönjük a rendelését! Kérjük, fizesse ki <b>banki átutalással</b> az alábbi adatokkal. Jóváírás után <b>azonnal küldjük</b>.", amountToPay: "Fizetendő összeg", details: "Átutalási adatok", recipient: "Kedvezményezett", refL: "Közlemény", vsL: "Közlemény", amountL: "Összeg", scan: "📲 Olvassa be a QR-kódot a banki appban", s1: "Nyissa meg a banki alkalmazását", s2: "Adja meg az adatokat vagy olvassa be a QR-t", s3: "Erősítse meg a fizetést — küldjük", notify: "🔔 Jelezni fogunk, amint a fizetés megérkezik (SEPA ~1 munkanap).", help: "💬 Kérdés? Válaszoljon erre az e-mailre.", order: "Rendelés" },
  fr: { subject: "Finalisez le paiement — commande", greeting: "Bonjour,", intro: "merci pour votre commande ! Payez-la par <b>virement bancaire</b> avec les informations ci-dessous. Nous expédions <b>dès réception</b>.", amountToPay: "Montant à payer", details: "Coordonnées du virement", recipient: "Bénéficiaire", refL: "Référence", vsL: "Référence", amountL: "Montant", scan: "📲 Scannez le QR dans votre application bancaire", s1: "Ouvrez votre application bancaire", s2: "Saisissez les infos ou scannez le QR", s3: "Confirmez le paiement — nous expédions", notify: "🔔 Nous vous préviendrons dès réception (SEPA ~1 jour ouvré).", help: "💬 Une question ? Répondez à cet e-mail.", order: "Commande" },
  es: { subject: "Completa el pago — pedido", greeting: "Hola,", intro: "¡gracias por tu pedido! Págalo por <b>transferencia bancaria</b> con los datos de abajo. Enviamos <b>en cuanto se reciba</b>.", amountToPay: "Importe a pagar", details: "Datos de la transferencia", recipient: "Beneficiario", refL: "Concepto", vsL: "Concepto", amountL: "Importe", scan: "📲 Escanea el QR en tu app bancaria", s1: "Abre tu aplicación bancaria", s2: "Introduce los datos o escanea el QR", s3: "Confirma el pago — enviamos", notify: "🔔 Te avisaremos en cuanto llegue el pago (SEPA ~1 día hábil).", help: "💬 ¿Dudas? Responde a este correo.", order: "Pedido" },
}

;(function () { var Y: any = { sk: "Vaša objednávka", cs: "Vaše objednávka", de: "Ihre Bestellung", nl: "Uw bestelling", pl: "Twoje zamówienie", sv: "Din beställning", no: "Din bestilling", hu: "Az Ön rendelése", fr: "Votre commande", es: "Tu pedido" }; for (var k in Y) { if (EMAIL_I18N[k]) EMAIL_I18N[k].yourOrder = Y[k] } })()

function fmtIban(iban: string): string { return String(iban || "").replace(/(.{4})/g, "$1 ").trim() }

export function fmtAmount(amount: number, currency: string, locale: string): string {
  const tags: Record<string, string> = { sk: "sk-SK", cs: "cs-CZ", hu: "hu-HU", fr: "fr-FR", es: "es-ES", nl: "nl-NL", no: "nb-NO", sv: "sv-SE", pl: "pl-PL" }
  try { return new Intl.NumberFormat(tags[locale] || "sk-SK", { style: "currency", currency }).format(Number(amount)) }
  catch { return Number(amount).toFixed(2) + " " + currency }
}

function row(k: string, v: string): string {
  return `<tr><td style="background:#FAF5F8;border:1px solid #EDD9E5;border-radius:10px;padding:11px 14px;">
    <div style="font-size:10.5px;text-transform:uppercase;letter-spacing:.4px;color:#9B7AAD;font-weight:600;">${k}</div>
    <div style="font-size:16px;font-weight:600;color:#2D1B3D;font-family:monospace;">${v}</div></td></tr><tr><td height="8"></td></tr>`
}

export function buildHtml(t: any, o: any): string {
  const isEur = o.currency === "EUR"
  return `<div style="background:#EFE6EE;padding:20px 12px;font-family:'DM Sans',Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 8px 30px rgba(45,27,61,.12);">
  <tr><td style="background:linear-gradient(135deg,#2D1B3D,#4A2E5F);padding:22px 24px;text-align:center;">
    <div style="font-size:18px;font-weight:700;color:#fff;">✅ ${t.order} ${o.code}</div>
    <div style="font-size:13px;color:#C9AEDA;margin-top:4px;">${t.amountToPay}: ${o.amountDisplay}</div>
  </td></tr>
  <tr><td style="padding:24px 24px 8px;font-size:15px;color:#2D1B3D;line-height:1.55;">${t.greeting}<br>${t.intro}</td></tr>
  ${o.itemsHtml ? `<tr><td style="padding:14px 24px 4px;">
    <div style="font-size:11px;letter-spacing:.5px;color:#9B7AAD;font-weight:700;text-transform:uppercase;margin-bottom:8px;">${t.yourOrder}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FAF5F8;border:1px solid #EDD9E5;border-radius:12px;"><tr><td style="padding:6px 14px;">${o.itemsHtml}</td></tr></table>
  </td></tr>` : ""}
  ${o.qrUrl ? `<tr><td style="padding:14px 24px 4px;text-align:center;">
    <div style="display:inline-block;background:#FAF5F8;border:1px solid #EDD9E5;border-radius:14px;padding:16px;">
      <img src="${o.qrUrl}" width="180" height="180" alt="QR" style="display:block;border-radius:8px;"/>
      <div style="font-size:12px;color:#7A6189;margin-top:8px;">${t.scan}</div>
    </div></td></tr>` : ""}
  <tr><td style="padding:14px 24px 4px;text-align:center;">
    <div style="font-size:11px;letter-spacing:.6px;color:#9B7AAD;font-weight:600;">${t.amountToPay.toUpperCase()}</div>
    <div style="font-size:36px;font-weight:700;color:#C27BA0;">${o.amountDisplay}</div></td></tr>
  <tr><td style="padding:8px 24px;">
    <div style="font-size:11px;letter-spacing:.5px;color:#9B7AAD;font-weight:700;text-transform:uppercase;margin-bottom:10px;">${t.details}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;">
      ${row("IBAN", fmtIban(o.iban))}
      ${o.bic ? row("BIC / SWIFT", o.bic) : ""}
      ${o.beneficiary ? row(t.recipient, o.beneficiary) : ""}
      ${row(isEur ? t.refL : t.vsL, o.reference)}
      ${row(t.amountL, o.amountDisplay)}
    </table></td></tr>
  <tr><td style="padding:12px 24px 6px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${[t.s1, t.s2, t.s3].map((s: string, i: number) => `<tr>
        <td width="34" valign="top"><div style="width:26px;height:26px;border-radius:50%;background:#2D1B3D;color:#fff;font-size:13px;font-weight:700;text-align:center;line-height:26px;">${i + 1}</div></td>
        <td style="padding-bottom:9px;font-size:14px;font-weight:600;color:#2D1B3D;">${s}</td></tr>`).join("")}
    </table></td></tr>
  <tr><td style="padding:14px 24px 22px;">
    <div style="border-top:1px solid #F0E4EC;padding-top:14px;font-size:12.5px;color:#5A3D6B;line-height:1.7;">
      ${t.notify}<br>${t.help}</div></td></tr>
</table></div>`
}

/**
 * Build + send the bank-transfer instruction e-mail via Resend. Returns
 * { ok, error }. Never throws.
 */
export async function sendBankTransferEmail(p: {
  to: string; from: string; replyTo?: string; locale: string;
  code: string; iban: string; bic?: string; beneficiary?: string;
  reference: string; amount: number; currency: string; cartId?: string; orderId?: string;
  items?: Array<{ title: string; quantity: number; unit_price: number }>;
}): Promise<{ ok: boolean; error?: any }> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey || !p.to) return { ok: false, error: "no api key / recipient" }
  const t = EMAIL_I18N[p.locale] || EMAIL_I18N.sk
  const amountDisplay = fmtAmount(p.amount, p.currency, p.locale)
  const qrUrl = (p.currency === "EUR" || p.currency === "CZK")
    ? `${BACKEND_URL}/public/bank-transfer-qr?${p.cartId ? "cart_id=" + encodeURIComponent(p.cartId) : "order_id=" + encodeURIComponent(p.orderId || "")}`
    : ""

  // Order line items (transactional signal → better inbox placement).
  const items = Array.isArray(p.items) ? p.items : []
  const itemsHtml = items.map((it) =>
    `<table role="presentation" width="100%"><tr>
      <td style="font-size:14px;color:#2D1B3D;padding:5px 0;">${it.quantity}× ${it.title}</td>
      <td style="font-size:14px;font-weight:600;color:#2D1B3D;text-align:right;white-space:nowrap;">${fmtAmount(Number(it.unit_price) * Number(it.quantity), p.currency, p.locale)}</td>
    </tr></table>`
  ).join("")
  const itemsText = items.map((it) => `- ${it.quantity}× ${it.title}: ${fmtAmount(Number(it.unit_price) * Number(it.quantity), p.currency, p.locale)}`).join("\n")

  const html = buildHtml(t, {
    code: p.code, amountDisplay, iban: p.iban, bic: p.bic, beneficiary: p.beneficiary,
    reference: p.reference, currency: p.currency, qrUrl, itemsHtml,
  })
  const refLabel = p.currency === "EUR" ? t.refL : t.vsL
  const text = [
    `${t.order} ${p.code}`,
    `${t.greeting.replace(/,$/, "")}`,
    t.intro.replace(/<\/?b>/g, ""),
    items.length ? `\n${t.yourOrder}:\n${itemsText}` : "",
    `\n${t.amountToPay}: ${amountDisplay}`,
    `\n${t.details}:`,
    `IBAN: ${p.iban}`,
    p.bic ? `BIC/SWIFT: ${p.bic}` : "",
    p.beneficiary ? `${t.recipient}: ${p.beneficiary}` : "",
    `${refLabel}: ${p.reference}`,
    `${t.amountL}: ${amountDisplay}`,
    `\n${t.notify.replace(/^🔔 /, "")}`,
    `${t.help.replace(/^💬 /, "")}`,
  ].filter(Boolean).join("\n")

  try {
    const resend = new Resend(apiKey)
    const { error } = await resend.emails.send({
      from: p.from, to: p.to, replyTo: p.replyTo,
      subject: `${t.subject} ${p.code}`, html, text,
    })
    if (error) return { ok: false, error }
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e.message }
  }
}
