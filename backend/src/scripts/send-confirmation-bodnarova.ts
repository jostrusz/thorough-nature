// @ts-nocheck
import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { EmailTemplates, resolveTemplateKey } from "../modules/email-notifications/templates"
import { resolveBillingEntity } from "../utils/resolve-billing-entity"
import { logEmailActivity } from "../utils/email-logger"
import { renderEmailToHtml } from "../utils/render-email-html"
import { getProjectEmailConfig, getEmailSubject } from "../utils/project-email-config"

/**
 * Order-confirmation e-mail for the manually created bank-transfer order
 * SK2026-32762 (Edita Bodnárová, see create-order-bodnarova-banktransfer.ts).
 *
 * Mirrors the order.placed subscriber's confirmation branch WITHOUT emitting
 * the event — order.placed would issue a second Fakturoid invoice, and
 * 2026-37047 already exists and is now marked paid.
 *
 * E-books are delivered separately via the resend_ebooks tool.
 *
 * Run: pnpm medusa exec ./src/scripts/send-confirmation-bodnarova.ts
 */

const ORDER_ID = "order_01KYSYXZH2QA4B6HXCC42D8FCM"
const LABEL = "Bodnárová"
const PAYMENT_METHOD = "Bankový prevod"

export default async function sendConfirmationBodnarova({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const orderModuleService = container.resolve(Modules.ORDER)
  const notificationModuleService = container.resolve(Modules.NOTIFICATION)

  // Idempotency: never mail the same customer twice on a re-run.
  const existing = await orderModuleService.retrieveOrder(ORDER_ID)
  if ((existing as any)?.metadata?.order_confirmation_sent === true) {
    logger.info(`[${LABEL}] Confirmation already sent for ${ORDER_ID} — skipping`)
    return
  }

  const order = await orderModuleService.retrieveOrder(ORDER_ID, {
    relations: ["items", "summary", "shipping_address", "billing_address", "shipping_methods"],
  })

  let shippingAddress: any = null
  try {
    if (order.shipping_address) {
      shippingAddress = await (orderModuleService as any).orderAddressService_.retrieve(
        order.shipping_address.id
      )
    }
  } catch {
    shippingAddress = order.shipping_address
  }

  let billingAddress: any = null
  try {
    if ((order as any).billing_address) {
      billingAddress = await (orderModuleService as any).orderAddressService_.retrieve(
        (order as any).billing_address.id
      )
    }
  } catch {
    // template falls back to the shipping address
  }

  const displayId =
    (order as any).metadata?.custom_order_number || (order as any).display_id || order.id

  let billingEntity: any = null
  try {
    billingEntity = await resolveBillingEntity(container, ORDER_ID)
  } catch (err: any) {
    logger.warn(`[${LABEL}] Could not resolve billing entity: ${err.message}`)
  }

  const projectConfig = getProjectEmailConfig(order)
  const templateKey = resolveTemplateKey(EmailTemplates.ORDER_PLACED, projectConfig.project)
  const emailSubject = getEmailSubject(projectConfig, "orderPlaced").replace("{id}", String(displayId))
  const emailPreview = getEmailSubject(projectConfig, "orderPlacedPreview")

  const emailData = {
    emailOptions: { replyTo: projectConfig.replyTo, subject: emailSubject },
    order,
    shippingAddress,
    billingAddress,
    paymentMethod: PAYMENT_METHOD,
    billingEntity,
    preview: emailPreview,
  }

  try {
    await notificationModuleService.createNotifications({
      to: order.email,
      channel: "email",
      template: templateKey,
      ...(projectConfig.fromEmail ? { from: projectConfig.fromEmail } : {}),
      data: emailData,
    })

    const htmlBody = await renderEmailToHtml(templateKey, emailData).catch(() => "")

    await logEmailActivity(orderModuleService, ORDER_ID, {
      template: "order_confirmation",
      subject: emailSubject,
      to: order.email,
      status: "sent",
      ...(htmlBody ? { html_body: htmlBody } : {}),
    }).catch((err) => logger.warn(`[${LABEL}] Could not log email activity: ${err.message}`))

    await orderModuleService.updateOrders(ORDER_ID, {
      metadata: { order_confirmation_sent: true },
    })

    logger.info("═══════════════════════════════════════════")
    logger.info(`[${LABEL}] CONFIRMATION SENT to ${order.email} (template ${templateKey})`)
    logger.info(`  order: ${displayId}`)
    logger.info(`  subject: ${emailSubject}`)
    logger.info("═══════════════════════════════════════════")
  } catch (error: any) {
    logger.error(`[${LABEL}] Failed: ${error.message}`)
    await logEmailActivity(orderModuleService, ORDER_ID, {
      template: "order_confirmation",
      subject: emailSubject,
      to: order.email,
      status: "failed",
      error_message: error.message,
    }).catch(() => {})
  }
}
