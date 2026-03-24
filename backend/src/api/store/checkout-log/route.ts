import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

/**
 * POST /store/checkout-log
 *
 * Fire-and-forget logging endpoint called when a customer submits the checkout form.
 * Logs customer details + selected payment method to console (visible in Railway logs).
 */
export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  try {
    const {
      project_slug,
      email,
      first_name,
      last_name,
      phone,
      city,
      postal_code,
      country_code,
      payment_method,
      payment_provider,
      cart_total,
      bundle_qty,
    } = req.body as Record<string, any>

    const name = [first_name, last_name].filter(Boolean).join(" ") || "?"
    const location = [city, postal_code, (country_code || "").toUpperCase()].filter(Boolean).join(", ")
    const method = payment_method || "none"
    const provider = payment_provider ? `(${payment_provider})` : ""
    const total = cart_total != null ? `€${(Number(cart_total) / 100).toFixed(2)}` : ""
    const qty = bundle_qty ? `${bundle_qty}x` : ""

    console.log(
      `[Checkout Submit] ${project_slug || "?"} | ${email || "?"} | ${name} | ${location} | ${method} ${provider} | ${total} ${qty}`.trim()
    )

    if (phone) {
      console.log(`[Checkout Submit]   phone: ${phone}`)
    }

    res.status(200).json({ ok: true })
  } catch (error: any) {
    console.error(`[Checkout Submit] Error: ${error.message}`)
    res.status(200).json({ ok: true })
  }
}
