// File: backend/src/utils/render-email-html.ts
// Renders a React email template to HTML string for storage/preview.
// Uses the same generateEmailTemplate() that the Resend service uses,
// then renders via @react-email/render (same lib Resend SDK uses internally).

import { generateEmailTemplate } from '../modules/email-notifications/templates'

/**
 * Render a React email template to a full HTML string.
 *
 * @param templateKey - The email template key (e.g. "order-placed", "dh-order-placed")
 * @param data - The same data payload passed to createNotifications()
 * @returns The rendered HTML string, or empty string on failure
 */
export async function renderEmailToHtml(
  templateKey: string,
  data: unknown,
): Promise<string> {
  try {
    const reactElement = generateEmailTemplate(templateKey, data)
    // Dynamic import — @react-email/render is a transitive dependency via resend + @react-email/components
    const { render } = await import('@react-email/render')
    const html = await render(reactElement as React.ReactElement)
    return html
  } catch (err: any) {
    console.warn(`[renderEmailToHtml] Failed to render template "${templateKey}":`, err.message)
    return ''
  }
}
