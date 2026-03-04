import { SubscriberArgs, SubscriberConfig } from "@medusajs/medusa"
import { PROFITABILITY_MODULE } from "../modules/profitability"

/**
 * Refund Handler for Profitability Tracking
 *
 * When an order is refunded:
 * 1. Find the order's original creation date
 * 2. Determine which project_config it belongs to (via sales_channel_id)
 * 3. Update the daily_project_stats row for that date: increment refund_amount, recalculate net_profit
 */
export default async function refundHandler({
  event: { data },
  container,
}: SubscriberArgs<any>) {
  const logger = container.resolve("logger") as any

  try {
    const orderId = data.order_id || data.id
    if (!orderId) {
      logger.warn("[RefundHandler] No order_id in event data, skipping")
      return
    }

    const profitService = container.resolve(PROFITABILITY_MODULE) as any
    const query = container.resolve("query") as any

    // 1. Get the order details (creation date + sales channel)
    const { data: orderData } = await query.graph({
      entity: "order",
      fields: ["id", "created_at", "sales_channel_id", "refunds.amount"],
      filters: { id: orderId },
    })

    const order = orderData?.[0]
    if (!order) {
      logger.warn(`[RefundHandler] Order ${orderId} not found, skipping`)
      return
    }

    // 2. Find the matching project_config by sales_channel_id
    if (!order.sales_channel_id) {
      logger.warn(`[RefundHandler] Order ${orderId} has no sales_channel_id, skipping`)
      return
    }

    const projects = await profitService.listProjectConfigs(
      { sales_channel_id: order.sales_channel_id },
      { take: 1 }
    )

    if (projects.length === 0) {
      logger.info(`[RefundHandler] No project_config for sales_channel ${order.sales_channel_id}, skipping`)
      return
    }

    const project = projects[0] as any

    // 3. Get the order's creation date
    const orderDate = new Date(order.created_at).toISOString().split("T")[0]

    // 4. Calculate total refund amount for this order
    const totalRefund = (order.refunds || []).reduce(
      (sum: number, r: any) => sum + Number(r.amount || 0),
      0
    )

    // 5. Update the daily_project_stats row
    const existingStats = await profitService.listDailyProjectStats(
      { project_id: project.id, date: orderDate },
      { take: 1 }
    )

    if (existingStats.length > 0) {
      const stat = existingStats[0] as any
      const currentRefund = Number(stat.refund_amount || 0)
      const newRefundAmount = totalRefund // Replace with total (not incremental, since we query all refunds)

      // Recalculate net_profit
      const netProfit = Number(stat.revenue || 0)
        - Number(stat.tax_amount || 0)
        - newRefundAmount
        - Number(stat.ad_spend || 0)
        - Number(stat.book_cost_total || 0)
        - Number(stat.shipping_cost_total || 0)
        - Number(stat.pick_pack_total || 0)
        - Number(stat.payment_fee_total || 0)

      await profitService.updateDailyProjectStats({
        id: stat.id,
        refund_amount: newRefundAmount,
        net_profit: netProfit,
        last_synced_at: new Date(),
      })

      logger.info(
        `[RefundHandler] Updated refund for order ${orderId} on ${orderDate}: ` +
        `€${currentRefund.toFixed(2)} → €${newRefundAmount.toFixed(2)} (project: ${project.project_slug})`
      )
    } else {
      // No stats row exists for this date yet — create one with just the refund
      const refundAmount = totalRefund
      await profitService.createDailyProjectStats({
        project_id: project.id,
        date: orderDate,
        revenue: 0,
        tax_amount: 0,
        order_count: 0,
        item_count: 0,
        refund_amount: refundAmount,
        ad_spend: 0,
        book_cost_total: 0,
        shipping_cost_total: 0,
        pick_pack_total: 0,
        payment_fee_total: 0,
        net_profit: -refundAmount,
        last_synced_at: new Date(),
      })

      logger.info(
        `[RefundHandler] Created stats row with refund €${refundAmount.toFixed(2)} ` +
        `for order ${orderId} on ${orderDate} (project: ${project.project_slug})`
      )
    }
  } catch (error: any) {
    logger.error(`[RefundHandler] Failed to process refund: ${error.message}`)
  }
}

export const config: SubscriberConfig = {
  event: "order.refund_created",
}
