// @ts-nocheck
import { SubscriberArgs, SubscriberConfig } from "@medusajs/medusa"
import { Resend } from "resend"
import { getProjectEmailConfig } from "../utils/project-email-config"
import { paymentReference, loadBankConfig } from "../modules/payment-bank-transfer/qr"

const BACKEND_URL =
  process.env.MEDUSA_BACKEND_URL || process.env.BACKEND_URL || "https://www.marketing-hq.eu"

// Locale fallback per project (used only if the email config has no locale).
const PROJECT_LOCALE: Record<string, string> = {
  "pusti-to-sk": "sk", "psi-superzivot": "cs", "lass-los": "de",
  loslatenboek: "nl", "het-leven": "nl", dehondenbijbel: "nl",
  "odpusc-ksiazka": "pl", "slapp-taget": "sv", "slipp-taket": "no", "engedd-el": "hu",
}

const EMAIL_I18N: Record<string, any> = {
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

function fmtIban(iban: string): string { return String(iban || "").replace(/(.{4})/g, "$1 ").trim() }

function fmtAmount(amount: number, currency: string, locale: string): string {
  const tags: Record<string, string> = { sk: "sk-SK", cs: "cs-CZ", hu: "hu-HU", fr: "fr-FR", es: "es-ES", nl: "nl-NL", no: "nb-NO", sv: "sv-SE", pl: "pl-PL" }
  try { return new Intl.NumberFormat(tags[locale] || "sk-SK", { style: "currency", currency }).format(Number(amount)) }
  catch { return Number(amount).toFixed(2) + " " + currency }
}

function row(k: string, v: string): string {
  return `<tr><td style="background:#FAF5F8;border:1px solid #EDD9E5;border-radius:10px;padding:11px 14px;">
    <div style="font-size:10.5px;text-transform:uppercase;letter-spacing:.4px;color:#9B7AAD;font-weight:600;">${k}</div>
    <div style="font-size:16px;font-weight:600;color:#2D1B3D;font-family:monospace;">${v}</div></td></tr><tr><td height="8"></td></tr>`
}

function buildHtml(t: any, o: any): string {
  const isEur = o.currency === "EUR"
  return `<div style="background:#EFE6EE;padding:20px 12px;font-family:'DM Sans',Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 8px 30px rgba(45,27,61,.12);">
  <tr><td style="background:linear-gradient(135deg,#2D1B3D,#4A2E5F);padding:22px 24px;text-align:center;">
    <div style="font-size:18px;font-weight:700;color:#fff;">✅ ${t.order} ${o.code}</div>
    <div style="font-size:13px;color:#C9AEDA;margin-top:4px;">${t.amountToPay}: ${o.amountDisplay}</div>
  </td></tr>
  <tr><td style="padding:24px 24px 8px;font-size:15px;color:#2D1B3D;line-height:1.55;">${t.greeting}<br>${t.intro}</td></tr>
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

export default async function orderPlacedBankTransferEmail({ event, container }: SubscriberArgs<{ id: string }>) {
  try {
    const orderId = event.data.id
    const query = container.resolve("query") as any
    const { data } = await query.graph({
      entity: "order",
      fields: ["id", "email", "display_id", "currency_code", "total", "metadata"],
      filters: { id: orderId },
    })
    const order = data && data[0]
    if (!order) return

    const meta = order.metadata || {}
    const isBankTransfer = meta.awaiting_bank_payment === true || meta.payment_method === "bank_transfer_sepa"
    if (!isBankTransfer) return
    if (meta.bank_transfer_email_sent === true) return // idempotent

    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey || !order.email) return

    const cfg = getProjectEmailConfig(order)
    const projectSlug = meta.project_id || meta.project_slug
    const locale = cfg.locale || PROJECT_LOCALE[projectSlug] || "sk"
    const t = EMAIL_I18N[locale] || EMAIL_I18N.sk

    const bank = await loadBankConfig(projectSlug)
    if (!bank || !bank.iban) return

    const currency = String(order.currency_code || bank.currency || "EUR").toUpperCase()
    const amount = Number(order.total) || 0
    const code = (meta.custom_display_id || (cfg.orderPrefix ? cfg.orderPrefix + "-" + order.display_id : "") || String(order.display_id))
    const reference = paymentReference(String(order.display_id || ""), currency)
    const amountDisplay = fmtAmount(amount, currency, locale)
    const qrUrl = (currency === "EUR" || currency === "CZK")
      ? `${BACKEND_URL}/public/bank-transfer-qr?order_id=${encodeURIComponent(order.id)}`
      : ""

    const html = buildHtml(t, {
      code, amountDisplay, iban: bank.iban, bic: bank.bic, beneficiary: bank.beneficiary,
      reference, currency, qrUrl,
    })

    const resend = new Resend(apiKey)
    await resend.emails.send({
      from: cfg.fromEmail || process.env.RESEND_FROM_EMAIL,
      to: order.email,
      replyTo: cfg.replyTo,
      subject: `${t.subject} ${code}`,
      html,
    })

    // idempotency stamp
    const { Pool } = require("pg")
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 })
    try {
      await pool.query(
        `UPDATE "order" SET metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb WHERE id = $2`,
        [JSON.stringify({ bank_transfer_email_sent: true, bank_transfer_email_sent_at: new Date().toISOString() }), order.id]
      )
    } finally { await pool.end().catch(() => {}) }

    console.log(`[Bank Transfer Email] sent to ${order.email} for order ${code}`)
  } catch (error: any) {
    console.error(`[Bank Transfer Email] failed: ${error.message}`)
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
