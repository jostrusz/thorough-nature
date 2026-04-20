import { sanitizeHtml, htmlToPlainText } from "./sanitizer"

/**
 * Template compiler — turns a block-JSON template definition (or raw HTML)
 * into ready-to-send HTML + text versions.
 *
 * The block JSON format we support (intentionally simple, extendable):
 *
 *   {
 *     "root": {
 *       "background_color": "#f6f6f7",
 *       "content_background": "#ffffff",
 *       "width": 600
 *     },
 *     "blocks": [
 *       { "type": "text", "content": "<p>Hi {{ contact.first_name }}!</p>" },
 *       { "type": "heading", "level": 2, "content": "New release" },
 *       { "type": "image", "src": "https://...", "alt": "...", "width": 600 },
 *       { "type": "button", "href": "https://example.com", "label": "Read more", "bg": "#008060" },
 *       { "type": "divider" },
 *       { "type": "spacer", "height": 24 },
 *       { "type": "footer", "content": "{{ brand.name }} · <a href='{{ unsubscribe_url }}'>Unsubscribe</a>" }
 *     ]
 *   }
 *
 * Variable interpolation uses {{ path.to.value }} syntax. Supported paths:
 *   contact.* (first_name, last_name, email, ...)
 *   brand.*   (name, from_email, ...)
 *   order.*   (when available via flow context)
 *   unsubscribe_url (auto-generated per send)
 *   preferences_url (placeholder)
 *
 * For `editor_type === "html"` we skip block rendering and sanitize the
 * custom_html directly.
 */

type BlockJson = {
  root?: {
    background_color?: string
    content_background?: string
    width?: number
    text_color?: string
    font_family?: string
  }
  blocks?: TemplateBlock[]
}

type TemplateBlock =
  | { type: "text"; content: string }
  | { type: "heading"; level?: 1 | 2 | 3 | 4; content: string; align?: "left" | "center" | "right" }
  | { type: "image"; src: string; alt?: string; width?: number; href?: string }
  | { type: "button"; href: string; label: string; bg?: string; color?: string; align?: "left" | "center" | "right" }
  | { type: "divider"; color?: string }
  | { type: "spacer"; height?: number }
  | { type: "footer"; content: string }
  | { type: "html"; content: string }

export type TemplateInput = {
  subject: string
  preheader?: string
  editor_type?: "blocks" | "html" | "visual"
  block_json?: BlockJson | null
  custom_html?: string | null
}

export type CompileContext = {
  contact?: Record<string, any>
  brand?: Record<string, any>
  order?: Record<string, any>
  unsubscribe_url?: string
  preferences_url?: string
  [k: string]: any
}

export type CompiledTemplate = {
  subject: string
  preheader: string
  html: string       // full, rendered document (not yet tracking-injected)
  text: string
}

/**
 * Resolve template placeholders from context. Supports multiple common
 * syntaxes so campaign editors coming from different tools all "just work":
 *
 *   {{ contact.first_name }}                    Liquid / Handlebars (preferred)
 *   {{ first_name }}                            auto-fallback to ctx.contact.*
 *   {{ first_name|default:"vriend" }}           Liquid default filter
 *   {$unsubscribe_url}                          PHP-style / Resend-style
 *   ${unsubscribe_url}                          JS template-literal-style
 *   <%= unsubscribe_url %>                      ERB/EJS-style
 *
 * Missing / empty values become empty string — NEVER leak raw template
 * syntax into a sent email. With the default filter, the fallback is used.
 *
 * Resolution rules per match:
 *  1. Try ctx[part0][part1]... for dotted paths.
 *  2. If not found and path is single-segment, try ctx.contact[part0]
 *     (so `{{ first_name }}` works without the `contact.` prefix).
 *  3. Fallback to default string (or empty).
 */
export function interpolate(input: string, ctx: CompileContext): string {
  if (!input) return ""

  const resolve = (rawPath: string, fallback: string): string => {
    const parts = String(rawPath).split(".")
    let cur: any = ctx
    for (const p of parts) {
      if (cur == null) { cur = undefined; break }
      cur = cur[p]
    }
    if ((cur == null || cur === "") && parts.length === 1) {
      const contact: any = (ctx as any).contact
      if (contact && contact[parts[0]] != null && contact[parts[0]] !== "") {
        cur = contact[parts[0]]
      }
    }
    if (cur == null || cur === "") return fallback
    return String(cur)
  }

  // ── 1. {{ path }} and {{ path|default:"fallback" }} ────────────────────
  const handlebars = /\{\{\s*([a-zA-Z0-9_.]+)(?:\s*\|\s*default\s*:\s*(?:"([^"]*)"|'([^']*)'))?\s*\}\}/g
  let out = input.replace(handlebars, (_, path, dq, sq) => {
    return resolve(path, dq != null ? dq : (sq != null ? sq : ""))
  })

  // ── 2. {$path} — PHP / Resend legacy ─────────────────────────────────
  out = out.replace(/\{\$\s*([a-zA-Z0-9_.]+)\s*\}/g, (_, path) => resolve(path, ""))

  // ── 3. ${path} — JS template-literal style ────────────────────────────
  out = out.replace(/\$\{\s*([a-zA-Z0-9_.]+)\s*\}/g, (_, path) => resolve(path, ""))

  // ── 4. <%= path %> — ERB / EJS style ─────────────────────────────────
  out = out.replace(/<%=\s*([a-zA-Z0-9_.]+)\s*%>/g, (_, path) => resolve(path, ""))

  return out
}

/** Render a single block into HTML. */
function renderBlock(block: TemplateBlock, ctx: CompileContext): string {
  switch (block.type) {
    case "text": {
      const content = interpolate(block.content || "", ctx)
      return `<div style="padding:12px 24px;font-size:15px;line-height:1.6;color:inherit">${sanitizeHtml(content)}</div>`
    }
    case "heading": {
      const lvl = Math.max(1, Math.min(4, block.level ?? 2))
      const align = block.align || "left"
      const size = lvl === 1 ? 28 : lvl === 2 ? 22 : lvl === 3 ? 18 : 16
      return `<h${lvl} style="margin:0;padding:16px 24px 8px 24px;font-size:${size}px;line-height:1.3;text-align:${align};font-weight:600">${sanitizeHtml(
        interpolate(block.content || "", ctx)
      )}</h${lvl}>`
    }
    case "image": {
      const src = interpolate(block.src || "", ctx)
      if (!src) return ""
      const alt = sanitizeHtml(block.alt || "").replace(/"/g, "&quot;")
      const width = block.width ?? 600
      const wrap = (inner: string) => (block.href ? `<a href="${encodeURI(interpolate(block.href, ctx))}" style="text-decoration:none">${inner}</a>` : inner)
      const img = `<img src="${encodeURI(src)}" alt="${alt}" width="${width}" style="display:block;max-width:100%;height:auto;border:0">`
      return `<div style="padding:12px 24px;text-align:center">${wrap(img)}</div>`
    }
    case "button": {
      const href = encodeURI(interpolate(block.href, ctx))
      const label = sanitizeHtml(interpolate(block.label || "", ctx))
      const bg = block.bg || "#008060"
      const color = block.color || "#ffffff"
      const align = block.align || "center"
      return `<div style="padding:16px 24px;text-align:${align}">
  <a href="${href}" style="display:inline-block;background:${bg};color:${color};text-decoration:none;padding:12px 28px;border-radius:6px;font-weight:600;font-size:15px">${label}</a>
</div>`
    }
    case "divider": {
      const c = block.color || "#E1E3E5"
      return `<div style="padding:8px 24px"><hr style="border:0;border-top:1px solid ${c};margin:0"></div>`
    }
    case "spacer": {
      const h = Math.max(4, Math.min(200, block.height ?? 16))
      return `<div style="height:${h}px;line-height:${h}px;font-size:1px">&nbsp;</div>`
    }
    case "footer": {
      const content = interpolate(block.content || "", ctx)
      return `<div style="padding:24px;font-size:12px;color:#8C9196;text-align:center;line-height:1.6">${sanitizeHtml(content)}</div>`
    }
    case "html": {
      return sanitizeHtml(interpolate(block.content || "", ctx))
    }
    default:
      return ""
  }
}

/** Wrap content in a responsive email-safe document shell. */
function wrapDocument(
  innerHtml: string,
  opts: {
    subject: string
    preheader: string
    background_color: string
    content_background: string
    width: number
    text_color: string
    font_family: string
  }
): string {
  // Preheader trick: hidden text that shows as email preview in most clients.
  const preheaderHtml = opts.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${opts.background_color};opacity:0">${opts.preheader}${"&#8203;&#847; ".repeat(60)}</div>`
    : ""

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="format-detection" content="telephone=no">
<title>${sanitizeHtml(opts.subject)}</title>
<style>
  @media only screen and (max-width:640px){.em-container{width:100%!important;max-width:100%!important}.em-pad{padding-left:16px!important;padding-right:16px!important}}
  body{margin:0!important;padding:0!important;width:100%!important;background:${opts.background_color};font-family:${opts.font_family};color:${opts.text_color}}
  a{color:#2E5CE6}
  table,td{border-collapse:collapse}
  img{display:block;border:0;outline:0;text-decoration:none;-ms-interpolation-mode:bicubic}
</style>
</head>
<body style="margin:0;padding:0;background:${opts.background_color};font-family:${opts.font_family};color:${opts.text_color}">
${preheaderHtml}
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${opts.background_color}">
<tr><td align="center" style="padding:24px 12px">
  <table role="presentation" class="em-container" width="${opts.width}" cellspacing="0" cellpadding="0" border="0" style="width:${opts.width}px;max-width:100%;background:${opts.content_background};border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.05)">
    <tr><td class="em-pad">
${innerHtml}
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`
}

/** Main entry: compile a template to { html, text }. */
export function compileTemplate(input: TemplateInput, ctx: CompileContext = {}): CompiledTemplate {
  const subject = interpolate(input.subject || "", ctx)
  const preheader = interpolate(input.preheader || "", ctx)

  let bodyHtml = ""

  if (input.editor_type === "html") {
    bodyHtml = sanitizeHtml(interpolate(input.custom_html || "", ctx))
  } else {
    const bj: BlockJson = input.block_json || {}
    const blocks = Array.isArray(bj.blocks) ? bj.blocks : []
    bodyHtml = blocks.map((b) => renderBlock(b, ctx)).join("\n")
  }

  const root = (input.block_json?.root) || {}
  const fullHtml = wrapDocument(bodyHtml, {
    subject,
    preheader,
    background_color: root.background_color || "#f6f6f7",
    content_background: root.content_background || "#ffffff",
    width: Math.max(320, Math.min(800, root.width ?? 600)),
    text_color: root.text_color || "#1A1A1A",
    font_family: root.font_family || "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif",
  })

  const text = htmlToPlainText(fullHtml)

  return { subject, preheader, html: fullHtml, text }
}
