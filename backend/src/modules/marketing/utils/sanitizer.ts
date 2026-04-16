/**
 * Minimal HTML sanitizer for user-supplied email HTML.
 *
 * Removes: <script>, <iframe>, <object>, <embed>, <form>, on* handlers,
 *          javascript: URLs, dangerous tags generally.
 * Allows: all standard email-safe tags + inline styles.
 *
 * We don't use a full HTML parser here to keep the bundle small — email
 * HTML is usually well-formed enough that regex is sufficient. For defence
 * in depth the rendered HTML also goes through the tracking injector,
 * which sanity-checks links.
 */

const DANGEROUS_TAGS = [
  "script",
  "iframe",
  "object",
  "embed",
  "form",
  "input",
  "button",
  "textarea",
  "select",
  "option",
  "meta",
  "link",
  "base",
  "frame",
  "frameset",
  "applet",
  "audio",
  "video",
  "source",
]

export function sanitizeHtml(html: string): string {
  if (!html) return ""
  let out = html

  // Remove HTML comments (can hide content)
  out = out.replace(/<!--[\s\S]*?-->/g, "")

  // Strip dangerous tag pairs and their content
  for (const tag of DANGEROUS_TAGS) {
    const pairRe = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?</${tag}>`, "gi")
    const selfRe = new RegExp(`<${tag}\\b[^>]*/?>`, "gi")
    out = out.replace(pairRe, "").replace(selfRe, "")
  }

  // Strip on* event handlers (onclick=, onerror=, onload=, ...)
  out = out.replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, "")
  out = out.replace(/\son[a-z]+\s*=\s*'[^']*'/gi, "")
  out = out.replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, "")

  // Neutralise javascript: / data:text/html URLs in href / src attributes
  out = out.replace(/(href|src)\s*=\s*"(javascript:[^"]*)"/gi, '$1="#"')
  out = out.replace(/(href|src)\s*=\s*'(javascript:[^']*)'/gi, "$1='#'")
  out = out.replace(/(href|src)\s*=\s*"(data:text\/html[^"]*)"/gi, '$1="#"')
  out = out.replace(/(href|src)\s*=\s*'(data:text\/html[^']*)'/gi, "$1='#'")

  // <style> is allowed (emails need CSS) but strip expression() (legacy IE XSS)
  out = out.replace(/expression\s*\(/gi, "expression_blocked(")

  return out
}

/** Derive a plain-text version from HTML (for text/plain multipart). */
export function htmlToPlainText(html: string): string {
  if (!html) return ""
  let text = html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
  return text
}
