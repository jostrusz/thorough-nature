import Anthropic from "@anthropic-ai/sdk"

/**
 * AI email generator — used by the flow executor when a flow node has
 * config.ai_generate=true. Generates a fully-personalized email (subject +
 * preheader + HTML body) for the given contact using their quiz answers +
 * the brand's author voice profile.
 *
 * Three "day templates" map to the psychological arc of the popup-quiz
 * nurture sequence:
 *   - day1 → validation + reframe (no sell)
 *   - day2 → story + micro-tool (still no sell)
 *   - day3 → soft book bridge (first pitch, risk-reversed)
 *
 * Model recommendation:
 *   day1 / day2 → claude-sonnet-4-6  (good balance, cheaper)
 *   day3        → claude-opus-4-7    (revenue-critical, worth extra tokens)
 *
 * Output is a simple but styled email body wrapped in the brand's standard
 * email shell (rose/mauve palette). Full Gmail/Outlook-safe HTML, not a
 * plain snippet.
 */

export type DayTemplate = "day1" | "day2" | "day3"
export type AiModel = "claude-sonnet-4-6" | "claude-opus-4-7" | "claude-haiku-4-5-20251001"

export type GenerateArgs = {
  contact: {
    first_name?: string | null
    email: string
    locale?: string | null
    properties?: Record<string, any> | null
  }
  brand: {
    id: string
    slug: string
    display_name?: string | null
    locale?: string | null
    brand_voice_profile?: any
    marketing_from_name?: string | null
  }
  dayTemplate: DayTemplate
  model?: AiModel
}

export type GeneratedEmail = {
  subject: string
  preheader: string
  html: string        // full HTML doc with brand shell + tracking-ready placeholders
  body_markdown: string // raw body (saved to metadata for debugging / regeneration)
  model_used: string
  generated_at: string
}

const DEFAULT_MODELS: Record<DayTemplate, AiModel> = {
  day1: "claude-sonnet-4-6",
  day2: "claude-sonnet-4-6",
  day3: "claude-opus-4-7",
}

// ─── System prompts per day ───────────────────────────────────────────

function systemPrompt(brand: GenerateArgs["brand"], locale: string, day: DayTemplate): string {
  const voice = brand.brand_voice_profile || {}
  const authorName = voice.author_name || brand.marketing_from_name || "Joris de Vries"
  const bookTitle = voice.book_title || "Laat los wat je kapotmaakt"
  const voiceTraits = Array.isArray(voice.voice_traits) ? voice.voice_traits.join(", ") : "reflective, vulnerable, specific, curious"
  const avoid = Array.isArray(voice.avoid_phrases) ? voice.avoid_phrases.join(", ") : "Dear customer, Dear reader, As an author..."
  const signature = voice.signature || authorName.split(" ")[0]

  const langName = { nl: "Dutch", cs: "Czech", de: "German", pl: "Polish", sv: "Swedish", en: "English" }[locale] || "Dutch"

  const perDayGuide = {
    day1: `
DAY 1 — VALIDATION + REFRAME (no sell).
Your job: make them feel deeply seen. Acknowledge their specific quiz answers,
reframe their pain as a learned pattern (not weakness), and leave one open
loop (the book won't be mentioned).

Structure:
  - Opening: reference their specific quiz answer (the subcategory / emotion)
  - Middle: one reframe insight, concrete and memorable, 2-3 paragraphs
  - End: one reflective question for tomorrow + your signature

Length: 280-350 words body, 4-6 short paragraphs.`,

    day2: `
DAY 2 — STORY + MICRO-TOOL (still no sell).
Your job: tell a short client story (anonymized or invented) that rhymes
with their situation, then give one 90-second technique they can do today.

Structure:
  - Opening: callback to yesterday's email (1 line)
  - Main: client story, 40-60% of email, with specific details
  - Tool: ONE concrete 90-second exercise, numbered steps
  - End: invite them to try it, mention tomorrow's email softly

Length: 320-400 words body, 5-7 short paragraphs.`,

    day3: `
DAY 3 — SOFT BOOK BRIDGE (first pitch, risk-reversed).
Your job: reflect the 2-day arc, name the pattern they've been showing,
and introduce the book as the "natural next step" — not as a product sell.

Structure:
  - Opening: quick reflection of days 1-2
  - Bridge: "If what we've talked about resonates, this book is where I
    took this exact theme and went 40 pages deeper on [their category]"
  - Social proof: 1 short reader testimonial (quote + first name)
  - Risk reversal: 30-day money back
  - CTA: link to book page (use placeholder {{ cta_url }})

Length: 320-400 words body, 5-7 paragraphs. Include CTA.`,
  }[day]

  return `You are ${authorName}, author of "${bookTitle}".

You are writing the ${day.toUpperCase()} email in a 3-day personalized
nurture sequence for a reader who took a self-reflection quiz on your
website and opted in for a personal insight.

VOICE: ${voiceTraits}. Speak as warm mentor, never as copywriter.
Use familiar "you" (tu / jij / du). Write in ${langName}.

CONSTRAINTS:
- NEVER use: ${avoid}
- No diagnostic labels (PTSD, depression, anxiety)
- No imperatives ("you must", "you should")
- No generic sayings ("time heals", "everyone feels this")
- Specific > vague. Sensory over abstract.

SIGNATURE: Sign as "${signature}" in italics at the end of the body.

${perDayGuide}

FORMAT — return ONLY valid JSON (no markdown code fences, no preamble):
{
  "subject": "<6-10 words, lowercase, curiosity hook or pattern-match>",
  "preheader": "<50-80 characters, complements subject, cliffhanger>",
  "body_markdown": "<body in markdown — use **bold** for 1-2 phrases, italics for emphasis, > for pull quotes, line breaks for paragraphs>"
}`
}

// ─── User prompt construction ─────────────────────────────────────────

function userPrompt(args: GenerateArgs): string {
  const { contact, brand, dayTemplate } = args
  const props = contact.properties || {}
  const path = [
    props.quiz_category,
    props.quiz_subcategory,
    props.quiz_intensity,
    props.quiz_emotion,
  ].filter(Boolean)

  const locale = (contact.locale || brand.locale || "nl").slice(0, 2).toLowerCase()

  return `Write the ${dayTemplate} email for this reader:

Reader:
- First name: ${contact.first_name || "(unknown)"}
- Locale: ${locale}

Their quiz answers:
- Primary area: ${props.quiz_category || "(unknown)"}
- Specific focus: ${props.quiz_subcategory || "(unknown)"}
- Duration / intensity: ${props.quiz_intensity || "(unknown)"}
- Dominant feeling: ${props.quiz_emotion || "(unknown)"}

The reader's full quiz path: [${path.join(" → ")}]

Use their first name naturally in the opening (do not start with "Hi" or
"Hello" — instead weave it in: "${contact.first_name || "Dear"}, I thought
about what you wrote...").

Reflect their specific path — the combination of subcategory + emotion
should be visible in at least one reframe or story beat.`
}

// ─── Email shell wrapper ──────────────────────────────────────────────
//
// Wraps the AI-generated markdown body in the brand's standard email HTML
// skeleton (rose/mauve, Georgia, compliance-ready). We inject author name,
// book title, and the tracking-injected placeholders the dispatcher will
// later resolve per-send.
//
// The body is emitted from a very small markdown subset: paragraphs,
// **bold**, *italic*, > quote, numbered lists (1. ... 2. ...).
// Anything else is passed through as text.

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function mdInline(s: string): string {
  return escapeHtml(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong style="color:#1F1B16;">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em style="font-style:italic;">$1</em>')
}

function markdownToHtml(md: string): string {
  const lines = md.split(/\r?\n/)
  const out: string[] = []
  let inList = false
  let listBuf: string[] = []

  const flushList = () => {
    if (listBuf.length) {
      out.push(
        '<ol style="margin:0 0 22px 24px;padding:0;font-family:Georgia,serif;font-size:16px;line-height:1.65;color:#1F1B16;">' +
          listBuf.map(li => `<li style="margin:0 0 10px 0;">${li}</li>`).join("") +
          "</ol>"
      )
      listBuf = []
    }
    inList = false
  }

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) { flushList(); continue }

    const num = line.match(/^\d+\.\s+(.+)$/)
    if (num) {
      inList = true
      listBuf.push(mdInline(num[1]))
      continue
    }
    if (inList) flushList()

    if (line.startsWith("> ")) {
      out.push(
        `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 22px 0;">` +
          `<tr><td style="border-left:3px solid #C89BA5;padding:8px 0 8px 20px;font-family:Georgia,serif;font-style:italic;font-size:17px;line-height:1.6;color:#3A2530;">` +
          mdInline(line.slice(2)) +
          `</td></tr></table>`
      )
      continue
    }

    out.push(
      `<p style="margin:0 0 22px 0;font-family:Georgia,serif;font-size:16px;line-height:1.65;color:#1F1B16;">${mdInline(line)}</p>`
    )
  }
  flushList()
  return out.join("\n")
}

function wrapInEmailShell(args: {
  subject: string
  preheader: string
  bodyHtml: string
  signature: string
  locale: string
  includeCta?: boolean
  ctaLabel?: string
  ctaUrl?: string
}): string {
  const { subject, preheader, bodyHtml, signature, locale, includeCta, ctaLabel, ctaUrl } = args
  const ctaBlock = includeCta
    ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:18px auto 14px auto;">
         <tr><td align="center" style="border-radius:4px;background:#1F1B16;">
           <a href="${escapeHtml(ctaUrl || "{{ cta_url }}")}" data-link-label="cta_main" style="display:inline-block;padding:16px 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;font-weight:700;letter-spacing:0.3px;color:#FFFFFF;text-decoration:none;border-radius:4px;">
             ${escapeHtml(ctaLabel || "Bekijk het boek →")}
           </a>
         </td></tr>
       </table>`
    : ""

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="${escapeHtml(locale)}" style="background:#faf5f8;">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="format-detection" content="telephone=no">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light">
<base target="_blank">
<title>${escapeHtml(subject)}</title>
<style>
  body { margin:0 !important; padding:0 !important; width:100% !important; background:#faf5f8 !important; }
  table, td { border-collapse:collapse; }
</style>
</head>
<body bgcolor="#faf5f8" style="margin:0;padding:0;background:#faf5f8;font-family:Georgia,'Times New Roman',serif;color:#1F1B16;">
<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:#faf5f8;opacity:0;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#faf5f8" style="background:#faf5f8;">
<tr><td align="center" style="padding:28px 14px 40px;">
  <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:600px;max-width:100%;background:#FFFFFF;border-radius:4px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.04);">
    <tr><td style="padding:40px 44px 8px 44px;">
${bodyHtml}
${ctaBlock}
      <p style="margin:26px 0 0 0;font-family:Georgia,serif;font-style:italic;font-size:20px;color:#1F1B16;">${escapeHtml(signature)}</p>
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`
}

// ─── Public API ───────────────────────────────────────────────────────

export async function generateAiEmail(args: GenerateArgs): Promise<GeneratedEmail> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured")

  const locale = (args.contact.locale || args.brand.locale || "nl").slice(0, 2).toLowerCase()
  const model = args.model || DEFAULT_MODELS[args.dayTemplate]
  const client = new Anthropic({ apiKey })

  const resp = await client.messages.create({
    model,
    max_tokens: 2500,
    system: systemPrompt(args.brand, locale, args.dayTemplate),
    messages: [{ role: "user", content: userPrompt(args) }],
  })

  const raw = (resp.content?.[0] as any)?.text || ""
  const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim()
  const parsed = JSON.parse(cleaned) as { subject: string; preheader: string; body_markdown: string }
  if (!parsed.subject || !parsed.body_markdown) throw new Error("ai_response_incomplete")

  const voice = args.brand.brand_voice_profile || {}
  const signature = voice.signature || (voice.author_name || args.brand.marketing_from_name || "Joris").split(" ")[0]

  const bodyHtml = markdownToHtml(parsed.body_markdown)
  const html = wrapInEmailShell({
    subject: parsed.subject,
    preheader: parsed.preheader || "",
    bodyHtml,
    signature,
    locale,
    includeCta: args.dayTemplate === "day3",
    ctaLabel: voice.cta_label || "Bekijk het boek →",
    ctaUrl: voice.cta_url || undefined,
  })

  return {
    subject: parsed.subject,
    preheader: parsed.preheader || "",
    html,
    body_markdown: parsed.body_markdown,
    model_used: model,
    generated_at: new Date().toISOString(),
  }
}
