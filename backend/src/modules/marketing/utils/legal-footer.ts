/**
 * Helpers for the brand legal-compliance footer that gets auto-injected
 * into outgoing marketing emails (campaigns, flows, test-sends).
 *
 * Each brand stores a `compliance_footer_html` field with their company
 * legal identity (name, address, IČO/VAT/BTW, privacy link, unsubscribe).
 * This is required by EU PECR / GDPR / Czech Act 480/2004 / Gmail bulk
 * sender 2024. We never want a marketing email to leave without it.
 *
 * Detection rule: skip injection ONLY if the candidate HTML already
 * contains the brand's LEGAL FINGERPRINT (company-name pattern or tax id).
 * Just having an unsubscribe link is NOT enough — many authors include a
 * minimal unsub link without legal info, and we still need the company
 * block. Old code used a hasUnsubMarker check which was wrong.
 */

/**
 * Extract a unique fingerprint from compliance_footer_html. Used to grep
 * a candidate body for "is the legal footer already there?".
 *
 * Matches in priority order:
 *   1. Capitalized words followed by a legal entity suffix
 *      (s.r.o. / OÜ / GmbH / B.V. / Ltd / LLC / sp. z o.o. / AB)
 *   2. Tax-id pattern (IČO / IČ / DIČ / VAT / BTW / USt / UID + value)
 *   3. Fallback: first 40 chars of stripped HTML text
 */
export function extractLegalMarker(footerHtml: string | null | undefined): string {
  if (!footerHtml) return "__no_marker__"
  const m = footerHtml.match(
    /([A-Z][\wÀ-ž'’\-\.]*(?:\s+[A-Z][\wÀ-ž'’\-\.]*)*\s+(?:s\.r\.o\.|OÜ|GmbH|BV|B\.V\.|Ltd|LLC|sp\. z o\.o\.|AB))/
  )
  if (m) return m[1]
  const tax = footerHtml.match(/(?:IČO|IČ|DIČ|VAT|BTW|USt|UID)[:\s]+\w+/i)
  if (tax) return tax[0]
  const text = footerHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
  return text.slice(0, 40) || "__no_marker__"
}

/**
 * Strip any "inline minimal footer" tables from the candidate HTML before
 * we inject the brand's legal footer.
 *
 * What counts as an inline minimal footer:
 *   - A <table> block that contains an unsubscribe placeholder
 *     ({{ unsubscribe_url }} / /public/marketing/u/ / etc.)
 *   - AND does NOT contain the brand's legal marker (company name)
 *
 * Why: many authors / AI generators include a one-line "Unsubscribe"
 * footer in their email body. The brand-level compliance_footer_html is
 * the single source of truth for the legal block, so we want exactly one
 * footer per email — the brand one.
 *
 * If the inline table already includes the brand legal marker, we leave
 * it alone (author intentionally pasted the full footer).
 */
function stripInlineUnsubFooters(html: string, legalMarker: string): string {
  // Match <table ...>...</table> blocks. Multi-line, lazy (non-greedy)
  // closing tag, case-insensitive on tags.
  const tableRe = /<table\b[^>]*>[\s\S]*?<\/table>/gi
  return html.replace(tableRe, (match) => {
    const hasUnsub = /\{\{\s*unsubscribe_url\s*\}\}|\{\$\s*unsubscribe(_url)?\s*\}|\$\{\s*unsubscribe_url\s*\}|<%=\s*unsubscribe_url\s*%>|\/public\/marketing\/u\//.test(match)
    if (!hasUnsub) return match
    // If this block already carries the brand legal marker, it IS the
    // brand footer (author pasted it manually) — keep it.
    if (legalMarker !== "__no_marker__" && match.includes(legalMarker)) return match
    // Otherwise, strip it. The brand footer will be injected next.
    return ""
  })
}

/**
 * Inject brand.compliance_footer_html into the candidate HTML.
 *
 * Behaviour:
 *   1. First strips any "inline minimal footer" (small <table> blocks with
 *      an unsub link but no legal marker — usually leftovers from authoring).
 *   2. If the brand legal marker is already present after stripping,
 *      no-op — author pasted the full legal footer themselves.
 *   3. Otherwise appends complianceFooterHtml before </body> (or at end
 *      if there's no </body>).
 *
 * Idempotent — calling twice returns identical output.
 */
export function injectLegalFooter(html: string, complianceFooterHtml: string | null | undefined): string {
  if (!html) return html
  if (!complianceFooterHtml) return html
  const marker = extractLegalMarker(complianceFooterHtml)
  // Strip any redundant inline unsub-only footers first.
  const stripped = stripInlineUnsubFooters(html, marker)
  // If after stripping, the legal marker is already present, we're done.
  if (stripped.includes(marker)) return stripped
  if (/<\/body>/i.test(stripped)) {
    return stripped.replace(/<\/body>/i, `${complianceFooterHtml}\n</body>`)
  }
  return stripped + "\n" + complianceFooterHtml
}
