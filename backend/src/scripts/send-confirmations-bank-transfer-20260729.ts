// @ts-nocheck
import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { EmailTemplates, resolveTemplateKey } from "../modules/email-notifications/templates"
import { resolveBillingEntity } from "../utils/resolve-billing-entity"
import { logEmailActivity } from "../utils/email-logger"
import { renderEmailToHtml } from "../utils/render-email-html"
import { getProjectEmailConfig, getEmailSubject } from "../utils/project-email-config"

/**
 * Order-confirmation e-mails for the two manually created bank-transfer orders
 * from 2026-07-29 (see create-orders-bank-transfer-20260729.ts). Mirrors the
 * order.placed subscriber's confirmation branch WITHOUT emitting the event —
 * order.placed would also issue a Fakturoid invoice, which is exactly what both
 * of these orders must avoid (Pepernoot already has 2026-36376; Kuppens
 * declined an invoice outright).
 *
 * E-books are delivered separately via the resend_ebooks tool.
 *
 * Run: pnpm medusa exec ./src/scripts/send-confirmations-bank-transfer-20260729.ts
 */

const TARGETS = [
  { label: "Pepernoot", orderId: "order_01KYNTAYKS4MGZ28YM3J802E4A", paymentMethod: "Bankoverschrijving" },
  { label: "Kuppens", orderId: "order_01KYNTB3DY8PH6N4B0KGZP7EXS", paymentMethod: "Bankoverschrijving" },
]

export default async function sendConfirmationsBankTransfer20260729({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const orderModuleService = container.resolve(Modules.ORDER)
  const notificationModuleService = container.resolve(Modules.NOTIFICATION)

  for (const target of TARGETS) {
    const { label, orderId } = target

    // Idempotency: never mail the same customer twice on a re-run.
    const existing = await orderModuleService.retrieveOrder(orderId)
    if ((existing as any)?.metadata?.order_confirmation_sent === true) {
      logger.info(`[${label}] Confirmation already sent for ${orderId} — skipping`)
      continue
    }

    const order = await orderModuleService.retrieveOrder(orderId, {
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
      billingEntity = await resolveBillingEntity(container, orderId)
    } catch (err: any) {
      logger.warn(`[${label}] Could not resolve billing entity: ${err.message}`)
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
      paymentMethod: target.paymentMethod,
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

      await logEmailActivity(orderModuleService, orderId, {
        template: "order_confirmation",
        subject: emailSubject,
        to: order.email,
        status: "sent",
        ...(htmlBody ? { html_body: htmlBody } : {}),
      }).catch((err) => logger.warn(`[${label}] Could not log email activity: ${err.message}`))

      await orderModuleService.updateOrders(orderId, {
        metadata: { order_confirmation_sent: true },
      })

      logger.info("═══════════════════════════════════════════")
      logger.info(`[${label}] CONFIRMATION SENT to ${order.email} (template ${templateKey})`)
      logger.info(`  order: ${displayId}`)
      logger.info(`  subject: ${emailSubject}`)
      logger.info("═══════════════════════════════════════════")
    } catch (error: any) {
      logger.error(`[${label}] Failed: ${error.message}`)
      await logEmailActivity(orderModuleService, orderId, {
        template: "order_confirmation",
        subject: emailSubject,
        to: order.email,
        status: "failed",
        error_message: error.message,
      }).catch(() => {})
    }
  }
}
