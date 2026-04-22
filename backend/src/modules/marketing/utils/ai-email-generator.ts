import Anthropic from "@anthropic-ai/sdk"

/**
 * AI email generator — used by the flow executor when a flow node has
 * config.ai_generate=true. Generates a fully-personalized email (subject +
 * preheader + brand-template HTML body) for the given contact using their
 * quiz answers + the brand's author voice profile.
 *
 * ARCHITECTURE
 * ────────────
 * 1. Sonnet 4.6 (or Opus 4.7 for day 3) is given the contact's quiz path
 *    + the brand voice profile + a list of structural BLOCK TYPES that
 *    map 1:1 to the brand template (paragraph / inline_quote / tile_quote /
 *    atmosphere / numbered_list / cta / signature / ps / pps).
 * 2. Sonnet returns JSON with `subject`, `preheader`, and `blocks[]`.
 * 3. `renderBlocks()` turns each block into the exact HTML snippet defined
 *    by `email-previews/BRAND-TEMPLATE.html` — so every AI-generated email
 *    inherits brand colors / fonts / spacing automatically.
 * 4. `wrapInBrandShell()` wraps everything in the deliverability-hardened
 *    shell (head, MSO conditional, dark-mode overrides, role=article,
 *    hidden preheader, view-in-browser, secondary CTA).
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

// ── Block schema returned by Sonnet ────────────────────────────────────
// Maps 1:1 to a section in email-previews/BRAND-TEMPLATE.html.

export type Block =
  | { type: "greeting"; text: string }
  | { type: "paragraph"; text: string; highlight?: { phrase: string; color?: "yellow" | "red" } }
  | { type: "inline_quote"; text: string }
  | { type: "tile_quote"; text: string; attribution?: string }
  | { type: "atmosphere"; emoji: string }
  | { type: "numbered_list"; intro: string; items: { lead: string; body: string }[] }
  | { type: "cta"; label?: string; url?: string }
  | { type: "ps"; text: string }
  | { type: "pps"; text: string }

export type AiResponse = {
  subject: string
  preheader: string
  blocks: Block[]
}

export type GeneratedEmail = {
  subject: string
  preheader: string
  html: string
  blocks: Block[]            // raw blocks, saved to metadata for re-rendering / debugging
  model_used: string
  generated_at: string
}

// Day 1 = first impression, the "wow he sees me" moment that determines
// whether the reader opens the next 2 emails. Using Opus for day 1 is
// 5× more expensive than Sonnet but worth it — this is the email that
// converts an opt-in into an engaged lead. Day 2 stays on Sonnet (story
// + tool, more mechanical), Day 3 stays on Opus (revenue-critical pitch).
const DEFAULT_MODELS: Record<DayTemplate, AiModel> = {
  day1: "claude-opus-4-7",
  day2: "claude-sonnet-4-6",
  day3: "claude-opus-4-7",
}

// ─── System prompt — teach Sonnet the block grammar ──────────────────

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
DAY 1 — WELCOME + PROBLEM → WHY → TASTE OF SOLUTION + soft book mention.
Goal: build a relationship. Make them feel like a friend wrote to them
(not a brand). Give a small taste of how the problem can be solved so
they trust you have answers. End with a casual book mention (NO hard CTA,
NO button — just a one-line "I write about this more in my book…").

Required arc — follow this order strictly:

  1. THANK + WELCOME (1 short paragraph)
     Casually thank them for taking the quiz. Welcome them warmly. Tone
     of voice: like a friend who's glad to hear from them. NEVER say
     "thank you for signing up" — say something like "fijn dat je de
     quiz hebt ingevuld" / "díky, že sis na to udělala chvíli".

  2. SURFACE THE PROBLEM (1-2 paragraphs + inline_quote of THEIR sentence)
     Quote their K4 sentence verbatim in an inline_quote block. Around it,
     gently say "I read this three times" / "this stayed with me" — show
     you actually heard them.

  3. WHY THIS HAPPENS (2 paragraphs — the reframe)
     Explain WHY this pattern shows up. Frame it as a LEARNED RESPONSE,
     not a personality flaw. Reference their K3 trigger ("ve 3 ráno",
     "ráno po probuzení", etc.) and their K2 target ("tvá máma", "tvůj
     bývalý" — never the generic word "rodič" or "partner"). One sentence
     should be a clean reframe — wrap it in a "highlight" phrase.

  4. SMALL TASTE OF SOLUTION (1 short paragraph + atmosphere emoji)
     Give them ONE micro-insight or one-sentence reframe trick they can
     hold onto today. Not a full exercise — just enough that they feel
     "oh, that's actually useful." This builds trust that you have
     answers, not just empathy.

  5. OPEN LOOP — TEASE NEXT EMAIL (1 paragraph)
     Tell them what's coming tomorrow. Be specific: "Zítra ti pošlu
     příběh Marie, která tu samou větu nosila 14 let — a ten jeden
     90sekundový moment, kdy se to zlomilo." Make them want to open it.

  6. SOFT BOOK MENTION (1 paragraph — casual, not salesy)
     Mention the book ${bookTitle} in passing as the place where you go
     deeper into this exact pattern. Phrase like a friend recommending,
     not a marketer pitching: "O tomhle vzorci píšu mnohem víc v mé
     knize ${bookTitle} — ale o tom víc za pár dní. Teď se soustřeď na
     to nejdůležitější: že to vidíš." NO button, NO link, NO price.

  7. SIGNATURE (auto-added) + PS + PPS
     PS = a soft reflective question tied to their situation.
     PPS = invite them to reply with one word. High engagement signal.

Block flow (use these blocks, in this order):
  greeting → paragraph (thank+welcome) → paragraph (intro to their words)
  → inline_quote (their K4 sentence) → paragraph (validate)
  → paragraph (WHY — learned pattern, with highlight) → paragraph (more WHY)
  → atmosphere (1 emoji) → paragraph (taste of solution)
  → paragraph (open loop / what's tomorrow)
  → paragraph (soft book mention) → ps → pps

DO NOT include: cta, tile_quote, numbered_list. Day 1 is conversation,
not landing page.

Length: 350-450 words total across paragraph blocks. Friendly, lots of
short sentences (5-12 words). Read it back to yourself — if any sentence
sounds like a brand wrote it, rewrite it.`,

    day2: `
DAY 2 — STORY + 90-SECOND TOOL (still no sell, NO cta block).
Your job: tell one short client story that rhymes with their situation,
then give exactly ONE numbered tool with 2-3 steps.

Structure:
  greeting → 1-line callback to day 1 → 4-5 story paragraphs → atmosphere
  → numbered_list (2-3 items) → 2 reflective paragraphs → ps → pps
NO cta on day 2.

Length: 320-400 words across all paragraph blocks combined.`,

    day3: `
DAY 3 — SOFT BOOK BRIDGE (first pitch, risk-reversed, INCLUDE cta).
Your job: reflect the 2-day arc, name their pattern, introduce the book
as the natural next step. End with a real CTA block.

Structure:
  greeting → 2-3 reflection paragraphs → tile_quote (1 line from book +
  attribution) → 2 bridge paragraphs (why this book, for them specifically)
  → cta block → 1-2 closing paragraphs → ps → pps

Length: 320-400 words across paragraphs combined. CTA is mandatory.`,
  }[day]

  return `You are ${authorName}, author of "${bookTitle}".

You are writing the ${day.toUpperCase()} email in a 3-day personalized
nurture sequence for a reader who took a self-reflection quiz on the website.

═══ VOICE — read this twice before writing anything ═══
You are NOT writing marketing copy. You are writing to a friend.
A real friend who happens to know what they're going through.

The tone must feel:
  • CONVERSATIONAL — short sentences. Sometimes fragments. Like speech.
  • FRIENDLY — warm, not formal. Use the reader's first name naturally.
  • HUMAN — admit uncertainty, share a tiny piece of yourself, leave
    room for the reader to disagree.
  • PERSONAL — like a 1-on-1 message, not a broadcast.

Brand voice traits to layer on top: ${voiceTraits}.

Write in ${langName}. Use familiar "you" (tu / jij / du / Du / ty).

Style markers that signal "friend wrote this":
  • Subject line: lowercase IS allowed (and preferred — feels personal).
  • Body text: STRICT NORMAL CAPITALIZATION. Every sentence starts with
    a capital letter. Proper nouns capitalized. After "—" or ":" the
    next sentence still starts with a capital. After "..." continuation
    of the same sentence stays lowercase, but a new sentence starts caps.
    NEVER write all-lowercase paragraphs in the body — that's a tell
    that an AI wrote it badly. Write like a literate friend, not like
    a Twitter post.
  • Contractions ("it's", "you're", "ik heb", "je bent" — never "het is")
  • Open with curiosity or recognition, never with "I want to tell you"
  • One thought per sentence. Vary length: short. medium. then a longer.
  • Occasional aside in parentheses (like a friend would)
  • At least once: write something a marketer would never write
    (e.g. "I almost didn't send this email", "I'm not sure this lands")

CONSTRAINTS — what would BREAK the friend illusion
───────────────────────────────────────────────────
- NEVER use: ${avoid}
- No diagnostic labels (PTSD, depression, anxiety)
- No imperatives ("you must", "you should", "imagine if…")
- No generic sayings ("time heals", "everyone feels this", "you're not alone")
- No corporate transitions ("furthermore", "moreover", "in conclusion")
- No exclamation marks unless quoting someone
- No "Dear" anything. No "I hope this finds you well."
- Specific > vague. Sensory over abstract. One real detail beats ten adjectives.
- Em-dash (—) preferred over hyphen, smart quotes preferred over straight.

SIGNATURE: A signature block is added automatically as "${signature}" — do
NOT include a signature block yourself.

${perDayGuide}

═══ AVAILABLE BLOCK TYPES (compose only from these) ═════════════════════
{ "type": "greeting",      "text": "Hoi {first_name}," }
{ "type": "paragraph",     "text": "...", "highlight"?: { "phrase": "<exact substring of text>", "color"?: "yellow"|"red" } }
{ "type": "inline_quote",  "text": "<1-2 sentences, no surrounding quotes>" }
{ "type": "tile_quote",    "text": "<1-2 sentences>", "attribution"?: "uit ${bookTitle}" }
{ "type": "atmosphere",    "emoji": "😶" }                    // single emoji visual breath
{ "type": "numbered_list", "intro": "...", "items": [ { "lead": "...", "body": "..." }, ... ] }   // max 3 items
{ "type": "cta",           "label"?: "<button text>", "url"?: "<defaults to brand book URL>" }
{ "type": "ps",            "text": "..." }
{ "type": "pps",           "text": "..." }

═══ STYLE RULES ════════════════════════════════════════════════════════
- "highlight" should be used 1-3× per email max — only the lines that LAND
- Atmosphere emoji: max 1 per email
- All paragraphs: 1-3 sentences each, never wall-of-text
- pps is great for "reply to me with one word" — high engagement signal

FORMAT — return ONLY valid JSON (no markdown code fences, no preamble):
{
  "subject":   "<6-10 words, ALL LOWERCASE OK — friend-vibe>",
  "preheader": "<50-80 chars, complements subject, cliffhanger — NORMAL sentence case (capital first letter, lowercase after)>",
  "blocks":    [ ... array of block objects ... ]
}

CAPITALIZATION RULES — re-stating because models forget:
  ✅ subject:   "wat je jezelf fluistert als het stil wordt"   (lowercase OK)
  ✅ preheader: "Over die ene zin die blijft hangen."          (sentence case)
  ✅ paragraph: "Ahoj Anno, díky žes na to udělala chvíli."    (NORMAL caps)
  ❌ paragraph: "ahoj anno, díky žes na to udělala chvíli."    (NEVER all-lower)`
}

// ─── User prompt — the reader's actual quiz data ──────────────────────

function userPrompt(args: GenerateArgs): string {
  const { contact, brand, dayTemplate } = args
  const props = contact.properties || {}

  const area      = props.quiz_area         ?? props.quiz_category
  const target    = props.quiz_target       ?? props.quiz_subcategory
  const trigger   = props.quiz_trigger      ?? props.quiz_intensity
  const sentence  = props.quiz_own_sentence ?? props.quiz_emotion

  const clean = (v: any): string => {
    if (!v) return "(unknown)"
    const s = String(v)
    return s.startsWith("custom:") ? s.slice(7) : s
  }

  const path = [area, target, trigger, sentence].filter(Boolean).map(clean)
  const locale = (contact.locale || brand.locale || "nl").slice(0, 2).toLowerCase()

  return `Write the ${dayTemplate} email for this reader:

Reader:
- First name: ${contact.first_name || "(unknown)"}
- Locale: ${locale}

Their quiz answers:
- Broad area of struggle:        ${clean(area)}
- Specific person / thing / focus: ${clean(target)}
- When it most surfaces (trigger): ${clean(trigger)}
- The sentence they keep telling themselves: "${clean(sentence)}"

Their full quiz path: [${path.join(" → ")}]

CRITICAL personalization rules:
1. Quote their "sentence" VERBATIM in the first 3 sentences — either as
   the greeting body or in an inline_quote block right after greeting.
2. Name the specific target by what it is — write "tvůj táta" not
   "tvůj rodič", "tvůj bývalý" not "tvůj partner".
3. Reference the trigger moment ("ve 3 ráno", "v autě", "po probuzení")
   at least once — readers experience it as mind-reading.
4. Greeting is always: { "type": "greeting", "text": "Hoi ${contact.first_name || "Friend"}," }
   (or locale-equivalent: "Ahoj" for cs, "Hallo" for de, etc.)`
}

// ═══ RENDERER ══════════════════════════════════════════════════════════
// Each Block type maps to an HTML snippet whose styling is locked to
// email-previews/BRAND-TEMPLATE.html. Renderer guarantees output looks
// like a hand-written brand email regardless of what Sonnet returns.

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

// Convert "—" to em-dash entity, smart-quote curly quotes around the
// content of the email (only used inside paragraph text, not inside HTML).
function smartTypography(s: string): string {
  return escapeHtml(s).replace(/--/g, "&mdash;").replace(/\.\.\./g, "&hellip;")
}

// Apply a single highlight inside a paragraph's text. Looks for an exact
// substring match (post-escape) and wraps it in the .hl-yellow / .hl-red
// span. If the phrase isn't found, paragraph is rendered unchanged.
function applyHighlight(escapedText: string, hl?: { phrase: string; color?: "yellow" | "red" }): string {
  if (!hl || !hl.phrase) return escapedText
  const phraseEsc = escapeHtml(hl.phrase)
  const cls = hl.color === "red" ? "hl-red" : "hl-yellow"
  if (!escapedText.includes(phraseEsc)) return escapedText
  return escapedText.replace(phraseEsc, `<span class="${cls}">${phraseEsc}</span>`)
}

function renderParagraph(text: string, hl?: { phrase: string; color?: "yellow" | "red" }): string {
  const safe = applyHighlight(smartTypography(text), hl)
  return `<p style="margin:0 0 22px 0;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.65;color:#1F1B16;">${safe}</p>`
}

function renderGreeting(text: string): string {
  return `<p style="margin:0 0 22px 0;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.65;color:#1F1B16;">${smartTypography(text)}</p>`
}

function renderInlineQuote(text: string): string {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:6px 0 22px 0;">
    <tr><td style="border-left:3px solid #C89BA5;padding:8px 0 8px 20px;font-family:Georgia,'Times New Roman',serif;font-style:italic;font-size:17px;line-height:1.6;color:#3A2530;">&ldquo;${smartTypography(text)}&rdquo;</td></tr>
  </table>`
}

function renderTileQuote(text: string, attribution?: string): string {
  const attr = attribution
    ? `<br><br><span style="font-size:13px;font-style:normal;color:#9C6B74;letter-spacing:1px;text-transform:uppercase;">— ${smartTypography(attribution)}</span>`
    : ""
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:6px 0 22px 0;">
    <tr><td style="background:#F4E8EE;border-left:3px solid #C89BA5;padding:22px 26px;font-family:Georgia,'Times New Roman',serif;font-style:italic;font-size:17px;line-height:1.65;color:#2E1F25;">&ldquo;${smartTypography(text)}&rdquo;${attr}</td></tr>
  </table>`
}

function renderAtmosphere(emoji: string): string {
  return `<p style="margin:0 0 22px 0;font-size:24px;line-height:1.2;">${escapeHtml(emoji)}</p>`
}

function renderNumberedList(intro: string, items: { lead: string; body: string }[]): string {
  const trimmedItems = (items || []).slice(0, 3)
  const rows = trimmedItems.map((it, idx) => {
    const num = idx + 1
    const sep = idx < trimmedItems.length - 1
      ? `<tr><td colspan="2" style="height:18px;line-height:18px;">&nbsp;</td></tr>`
      : ""
    return `<tr>
      <td width="34" valign="top" style="padding:0 12px 0 0;">
        <div style="width:30px;height:30px;line-height:30px;text-align:center;background:#1F1B16;color:#FFFFFF;border-radius:50%;font-family:Georgia,serif;font-size:15px;font-weight:700;">${num}</div>
      </td>
      <td valign="top" style="padding-top:4px;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.65;color:#1F1B16;">
        <strong>${smartTypography(it.lead)}</strong><br>
        ${smartTypography(it.body)}
      </td>
    </tr>${sep}`
  }).join("")
  return `<p style="margin:0 0 18px 0;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.65;color:#1F1B16;">${smartTypography(intro)}</p>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 22px 0;">${rows}</table>`
}

function renderCta(label: string, url: string, displayUrl: string): string {
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:14px auto 6px auto;">
    <tr><td align="center" style="border-radius:4px;background:#1F1B16;">
      <a href="${escapeHtml(url)}" data-link-label="cta_main" class="em-cta" title="${escapeHtml(label)}" style="display:inline-block;padding:18px 38px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:16px;font-weight:700;letter-spacing:0.3px;color:#FFFFFF;text-decoration:none;border-radius:4px;">
        ${escapeHtml(label)}
      </a>
    </td></tr>
  </table>
  <p style="margin:6px 0 22px 0;text-align:center;font-family:-apple-system,'Segoe UI',sans-serif;font-size:13px;color:#8A7884;">${escapeHtml(displayUrl)}</p>`
}

function renderSignature(name: string): string {
  return `<p style="margin:6px 0 0 0;font-style:italic;font-family:Georgia,serif;font-size:20px;color:#1F1B16;">${escapeHtml(name)}</p>`
}

function renderPsBlock(ps?: string, pps?: string): string {
  if (!ps && !pps) return ""
  const psLine = ps
    ? `<p style="margin:0 0 14px 0;font-family:Georgia,'Times New Roman',serif;font-size:15px;line-height:1.65;color:#3A2D33;"><strong style="letter-spacing:0.5px;">P.S.</strong>&nbsp;&nbsp;${smartTypography(ps)}</p>`
    : ""
  const ppsLine = pps
    ? `<p style="margin:0;font-style:italic;font-family:Georgia,'Times New Roman',serif;font-size:15px;line-height:1.65;color:#3A2D33;"><strong style="font-style:normal;letter-spacing:0.5px;">P.P.S.</strong>&nbsp;&nbsp;${smartTypography(pps)}</p>`
    : ""
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:18px 0 0 0;">
    <tr><td style="border-top:1px dashed #E8D7DE;padding-top:22px;">${psLine}${ppsLine}</td></tr>
  </table>`
}

// Walk the block array → emit ordered HTML. PS / PPS are pulled out and
// rendered last (always inside the dashed-divider P.S. block).
function renderBlocks(
  blocks: Block[],
  ctx: { authorName: string; ctaUrl: string; ctaLabel: string }
): string {
  let psText: string | undefined
  let ppsText: string | undefined
  const out: string[] = []

  for (const b of blocks || []) {
    switch (b.type) {
      case "greeting":     out.push(renderGreeting(b.text)); break
      case "paragraph":    out.push(renderParagraph(b.text, b.highlight)); break
      case "inline_quote": out.push(renderInlineQuote(b.text)); break
      case "tile_quote":   out.push(renderTileQuote(b.text, b.attribution)); break
      case "atmosphere":   out.push(renderAtmosphere(b.emoji)); break
      case "numbered_list":out.push(renderNumberedList(b.intro, b.items)); break
      case "cta":          out.push(renderCta(b.label || ctx.ctaLabel, b.url || ctx.ctaUrl, displayHost(b.url || ctx.ctaUrl))); break
      case "ps":           psText = b.text; break
      case "pps":          ppsText = b.text; break
    }
  }

  // Signature is always last in the card, before the P.S. block.
  out.push(renderSignature(ctx.authorName))
  out.push(renderPsBlock(psText, ppsText))
  return out.join("\n")
}

function displayHost(url: string): string {
  try { return new URL(url).host.replace(/^www\./, "") } catch { return url }
}

// ═══ BRAND SHELL ═══════════════════════════════════════════════════════
// Mirrors email-previews/BRAND-TEMPLATE.html exactly. Only the
// `{{ inner }}` slot is replaced with renderBlocks() output.

function wrapInBrandShell(args: {
  subject: string
  preheader: string
  innerHtml: string
  locale: string
  ctaUrl: string
  secondaryCtaLabel: string
}): string {
  const { subject, preheader, innerHtml, locale, ctaUrl, secondaryCtaLabel } = args
  const subjEsc = escapeHtml(subject)
  const localeEsc = escapeHtml(locale)
  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="${localeEsc}" style="background:#faf5f8;">
<head>
<meta charset="UTF-8">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="format-detection" content="telephone=no">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<base target="_blank">
<title>${subjEsc}</title>
<!--[if mso]><style type="text/css">body, table, td { font-family: Georgia, 'Times New Roman', serif !important; }</style><![endif]-->
<style type="text/css">
  html { background:#faf5f8; }
  body { margin:0 !important; padding:0 !important; width:100% !important; background:#faf5f8 !important; }
  table, td { border-collapse:collapse; mso-table-lspace:0pt; mso-table-rspace:0pt; }
  img { display:block; border:0; outline:none; text-decoration:none; -ms-interpolation-mode:bicubic; max-width:100%; height:auto; }
  a { color:#8C2E54; }
  a:hover { color:#6B2240; }
  .hl-yellow { background: linear-gradient(180deg, transparent 55%, #FFE66D 55%); padding: 0 2px; font-weight: 600; }
  .hl-red { background: linear-gradient(180deg, transparent 55%, #F4A9A9 55%); padding: 0 2px; font-weight: 600; }
  @media only screen and (max-width:640px) {
    .em-container { width:100% !important; max-width:100% !important; }
    .em-pad { padding-left:22px !important; padding-right:22px !important; }
    .em-body-text { font-size:16px !important; line-height:1.6 !important; }
    .em-cta { display:block !important; width:100% !important; box-sizing:border-box !important; }
  }
  @media (prefers-color-scheme: dark) {
    .em-bg { background:#faf5f8 !important; }
    .em-card { background:#FFFFFF !important; }
    .em-text { color:#1F1B16 !important; }
  }
  [data-ogsc] .em-bg { background:#faf5f8 !important; }
  [data-ogsc] .em-card { background:#FFFFFF !important; }
  [data-ogsc] .em-text { color:#1F1B16 !important; }
</style>
</head>
<body bgcolor="#faf5f8" style="margin:0;padding:0;background:#faf5f8;font-family:Georgia,'Times New Roman',serif;color:#1F1B16;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#faf5f8;opacity:0;">${escapeHtml(preheader)}
&#8203;&#847; &#8203;&#847; &#8203;&#847; &#8203;&#847; &#8203;&#847; &#8203;&#847; &#8203;&#847; &#8203;&#847; &#8203;&#847; &#8203;&#847; &#8203;&#847; &#8203;&#847; &#8203;&#847; &#8203;&#847; &#8203;&#847; &#8203;&#847; &#8203;&#847; &#8203;&#847; &#8203;&#847; &#8203;&#847; &#8203;&#847; &#8203;&#847; &#8203;&#847; &#8203;&#847; &#8203;&#847; &#8203;&#847; &#8203;&#847; &#8203;&#847; &#8203;&#847; &#8203;&#847; &#8203;&#847;
</div>
<div role="article" aria-roledescription="email" aria-label="${subjEsc}" lang="${localeEsc}">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#faf5f8" class="em-bg" style="background:#faf5f8;">
<tr><td bgcolor="#faf5f8" align="center" class="em-bg" style="background:#faf5f8;padding:28px 14px 40px 14px;">

  <!-- View-in-browser strip (dispatcher fills in localized vars) -->
  <table role="presentation" class="em-container" width="600" cellspacing="0" cellpadding="0" border="0" style="width:600px;max-width:100%;">
    <tr><td align="center" style="padding:0 14px 12px 14px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;color:#8A7884;">
      {{ view_in_browser_text }}
      <a href="{{ view_in_browser_url }}" title="{{ view_in_browser_label }}" style="color:#8A7884;text-decoration:underline;">{{ view_in_browser_label }}</a>.
    </td></tr>
  </table>

  <!-- Main card -->
  <table role="presentation" class="em-container em-card" width="600" cellspacing="0" cellpadding="0" border="0" style="width:600px;max-width:100%;background:#FFFFFF;border-radius:4px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.04);">
    <tr><td class="em-pad em-body-text em-text" style="padding:48px 44px 36px 44px;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.65;color:#1F1B16;">
${innerHtml}
    </td></tr>
  </table>

  <!-- Secondary text CTA (always present, links back to brand site) -->
  <table role="presentation" class="em-container" width="600" cellspacing="0" cellpadding="0" border="0" style="width:600px;max-width:100%;margin-top:22px;">
    <tr><td align="center" style="padding:0 8px;">
      <a href="${escapeHtml(ctaUrl)}" data-link-label="cta_secondary" title="${escapeHtml(secondaryCtaLabel)}" style="display:inline-block;font-family:-apple-system,'Segoe UI',sans-serif;font-size:14px;color:#8C2E54;text-decoration:underline;letter-spacing:0.3px;">
        ${escapeHtml(secondaryCtaLabel)}
      </a>
    </td></tr>
  </table>

</td></tr>
</table>
</div>
</body>
</html>`
}

// ═══ PUBLIC API ════════════════════════════════════════════════════════

export async function generateAiEmail(args: GenerateArgs): Promise<GeneratedEmail> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured")

  const locale = (args.contact.locale || args.brand.locale || "nl").slice(0, 2).toLowerCase()
  const model = args.model || DEFAULT_MODELS[args.dayTemplate]
  const client = new Anthropic({ apiKey })

  const resp = await client.messages.create({
    model,
    max_tokens: 3500,
    system: systemPrompt(args.brand, locale, args.dayTemplate),
    messages: [{ role: "user", content: userPrompt(args) }],
  })

  const raw = (resp.content?.[0] as any)?.text || ""
  const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim()
  const parsed = JSON.parse(cleaned) as AiResponse
  if (!parsed.subject || !Array.isArray(parsed.blocks) || parsed.blocks.length === 0) {
    throw new Error("ai_response_incomplete")
  }

  const voice = args.brand.brand_voice_profile || {}
  const authorName = voice.signature || (voice.author_name || args.brand.marketing_from_name || "Joris").split(" ")[0]
  const ctaUrl = voice.cta_url || `https://${args.brand.slug}.nl`
  const ctaLabel = voice.cta_label || "Bekijk het boek →"
  const secondaryCtaLabel = voice.secondary_cta_label || `Bekijk ${voice.book_title || "het boek"} →`

  const innerHtml = renderBlocks(parsed.blocks, { authorName, ctaUrl, ctaLabel })
  const html = wrapInBrandShell({
    subject: parsed.subject,
    preheader: parsed.preheader || "",
    innerHtml,
    locale,
    ctaUrl,
    secondaryCtaLabel,
  })

  return {
    subject: parsed.subject,
    preheader: parsed.preheader || "",
    html,
    blocks: parsed.blocks,
    model_used: model,
    generated_at: new Date().toISOString(),
  }
}
