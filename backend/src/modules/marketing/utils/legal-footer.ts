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
 * Inject brand.compliance_footer_html into the candidate HTML if the
 * legal marker isn't already present. Idempotent — calling twice with
 * the same input returns identical output.
 *
 * Returns the (possibly augmented) HTML.
 */
export function injectLegalFooter(html: string, complianceFooterHtml: string | null | undefined): string {
  if (!html) return html
  if (!complianceFooterHtml) return html
  const marker = extractLegalMarker(complianceFooterHtml)
  if (html.includes(marker)) return html
  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `${complianceFooterHtml}\n</body>`)
  }
  return html + "\n" + complianceFooterHtml
}
