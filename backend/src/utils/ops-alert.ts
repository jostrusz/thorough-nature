// @ts-nocheck

/**
 * Ops alerting for payment safety-net / recovery failures.
 *
 * Sends to BOTH channels, fire-and-forget, never throws:
 *   1. ntfy.sh topic (legacy channel, kept for push subscribers)
 *   2. Email via Resend to OPS_ALERT_EMAIL (default: info@performance-marketing-solution.com)
 *
 * Email is the channel that is actually watched — ntfy alerts about stuck paid
 * carts went unnoticed for days before this existed.
 */

const NTFY_URL = process.env.SAFETY_NET_NTFY_URL || "https://ntfy.sh/medusa-ntfy-obj-2026"
const ALERT_EMAIL = process.env.OPS_ALERT_EMAIL || "info@performance-marketing-solution.com"

export async function sendOpsAlert(
  title: string,
  message: string,
  priority: "default" | "high" = "high"
): Promise<void> {
  await Promise.allSettled([sendNtfy(title, message, priority), sendEmail(title, message)])
}

async function sendNtfy(title: string, message: string, priority: string): Promise<void> {
  try {
    await fetch(NTFY_URL, {
      method: "POST",
      headers: {
        "Title": Buffer.from(title, "utf-8").toString("base64"),
        "X-Title-Encoding": "base64",
        "Priority": priority,
        "Tags": "warning,airwallex,safety_net",
      },
      body: message,
    })
  } catch {
    // alerting must never break the calling flow
  }
}

async function sendEmail(title: string, message: string): Promise<void> {
  try {
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) return
    const from = process.env.RESEND_FROM_EMAIL || process.env.RESEND_FROM
    if (!from) return
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [ALERT_EMAIL],
        subject: `⚠️ [Payment Alert] ${title}`,
        text: `${message}\n\n—\nAutomated alert from marketing-hq.eu backend (payment safety net).`,
      }),
    })
  } catch {
    // alerting must never break the calling flow
  }
}
