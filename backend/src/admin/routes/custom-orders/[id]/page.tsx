import React, { useState, useCallback } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { toast } from "@medusajs/ui"

// Hooks
import { useOrderDetail } from "../../../hooks/use-order-detail"
import { useUpdateMetadata } from "../../../hooks/use-update-metadata"
import {
  useCancelOrder,
  useArchiveOrder,
  useCreateFulfillment,
  useRefundPayment,
  useDuplicateOrder,
  useSendToDextrum,
  useCreateFakturoidInvoice,
  useCustomerStats,
} from "../../../hooks/use-order-actions"

// Components
import { OrderDetailHeader } from "../../../components/orders/order-detail-header"
import { OrderFulfillmentCard } from "../../../components/orders/order-fulfillment-card"
import { OrderDetailPayment } from "../../../components/orders/order-detail-payment"
import { OrderDetailTimeline } from "../../../components/orders/order-detail-timeline"
import { OrderDetailCustomer } from "../../../components/orders/order-detail-customer"
import { OrderDetailMetadata } from "../../../components/orders/order-detail-metadata"
import { PaymentActivityLog } from "../../../components/orders/order-payment-activity"
import { OrderNotesCard } from "../../../components/orders/order-notes-card"
import { DeliveryBadge } from "../../../components/orders/order-badges"

// Modals
import { CancelOrderModal } from "../../../components/orders/cancel-order-modal"
import { RefundModal } from "../../../components/orders/refund-modal"
import { DuplicateOrderModal } from "../../../components/orders/duplicate-order-modal"

// Global hover animation styles
function OrderDetailStyles() {
  return (
    <style>{`
      @keyframes spin { to { transform: rotate(360deg); } }
      @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }

      /* Card hover — subtle lift + shadow */
      .od-card {
        transition: box-shadow 0.25s ease, transform 0.25s ease, border-color 0.25s ease !important;
      }
      .od-card:hover {
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06), 0 1px 4px rgba(0, 0, 0, 0.04);
        border-color: #D2D5D8 !important;
        transform: translateY(-1px);
      }

      /* Buttons — smooth hover */
      .od-btn {
        transition: all 0.15s ease !important;
      }
      .od-btn:hover {
        background: #F6F6F7 !important;
        border-color: #C9CCCF !important;
      }
      .od-btn:active {
        transform: scale(0.97);
      }

      /* Primary buttons */
      .od-btn-primary {
        transition: all 0.15s ease !important;
      }
      .od-btn-primary:hover {
        filter: brightness(1.1);
        box-shadow: 0 2px 8px rgba(0, 128, 96, 0.25);
      }
      .od-btn-primary:active {
        transform: scale(0.97);
      }

      /* Links — smooth underline */
      .od-link {
        transition: color 0.15s ease !important;
      }
      .od-link:hover {
        text-decoration: underline !important;
        color: #1A5BA8 !important;
      }

      /* Edit pencil button */
      .od-edit-btn {
        transition: all 0.15s ease !important;
      }
      .od-edit-btn:hover {
        color: #1A1A1A !important;
        background: #F6F6F7 !important;
      }

      /* Input focus glow */
      .od-input {
        transition: border-color 0.2s ease, box-shadow 0.2s ease !important;
      }
      .od-input:focus {
        border-color: #008060 !important;
        box-shadow: 0 0 0 3px rgba(0, 128, 96, 0.12) !important;
        outline: none !important;
      }
      .od-input:hover:not(:focus) {
        border-color: #C9CCCF !important;
      }

      /* Hoverable rows */
      .od-row-hover {
        transition: background 0.12s ease !important;
        border-radius: 4px;
        margin: 0 -4px;
        padding-left: 4px !important;
        padding-right: 4px !important;
      }
      .od-row-hover:hover {
        background: #F9FAFB !important;
      }

      /* Badges — subtle scale */
      .od-badge {
        transition: transform 0.15s ease, box-shadow 0.15s ease !important;
      }
      .od-badge:hover {
        transform: scale(1.04);
      }

      /* Dropdown items */
      .od-dropdown-item {
        transition: background 0.12s ease, padding-left 0.15s ease !important;
      }
      .od-dropdown-item:hover {
        background: #F6F6F7 !important;
        padding-left: 20px !important;
      }

      /* Thumbnail hover */
      .od-thumbnail {
        transition: transform 0.2s ease, box-shadow 0.2s ease !important;
      }
      .od-thumbnail:hover {
        transform: scale(1.05);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      }

      /* Section dividers fade in */
      .od-section-enter {
        animation: fadeIn 0.3s ease;
      }

      /* Tooltip on hover */
      .od-has-tooltip {
        position: relative;
      }
      .od-has-tooltip:hover::after {
        content: attr(data-tooltip);
        position: absolute;
        bottom: calc(100% + 6px);
        left: 50%;
        transform: translateX(-50%);
        background: #1A1A1A;
        color: #FFFFFF;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 11px;
        white-space: nowrap;
        z-index: 50;
        pointer-events: none;
      }
    `}</style>
  )
}

// Simple loading spinner
function LoadingSpinner() {
  return (
    <div
      style={{
        width: "24px",
        height: "24px",
        border: "3px solid #E1E3E5",
        borderTopColor: "#008060",
        borderRadius: "50%",
        animation: "spin 0.8s linear infinite",
      }}
    />
  )
}

const pageStyle: React.CSSProperties = {
  width: "1000px",
  maxWidth: "calc(100vw - 280px)",
  margin: "0 auto",
  padding: "24px 32px",
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif",
}

const OrderDetailPage = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  // Data hooks
  const { data, isLoading, error } = useOrderDetail(id)
  const updateMetadata = useUpdateMetadata()

  // Action hooks
  const cancelOrder = useCancelOrder()
  const archiveOrder = useArchiveOrder()
  const createFulfillment = useCreateFulfillment()
  const refundPayment = useRefundPayment()
  const duplicateOrder = useDuplicateOrder()
  const sendToDextrum = useSendToDextrum()
  const createFakturoidInvoice = useCreateFakturoidInvoice()

  // Customer stats
  const order = data?.order as any
  const { data: customerStats } = useCustomerStats(order?.email)

  // Modal states
  const [cancelModalOpen, setCancelModalOpen] = useState(false)
  const [refundModalOpen, setRefundModalOpen] = useState(false)
  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false)

  // ═══════════════════════════════════════════
  // HANDLERS
  // ═══════════════════════════════════════════

  const handleCancel = useCallback(() => {
    if (!id) return
    cancelOrder.mutate(id, {
      onSuccess: () => {
        toast.success("Order canceled")
        setCancelModalOpen(false)
      },
      onError: (err: any) => {
        toast.error(err?.message || "Failed to cancel order")
      },
    })
  }, [id, cancelOrder])

  const handleArchive = useCallback(() => {
    if (!id) return
    archiveOrder.mutate(id, {
      onSuccess: () => {
        toast.success("Order archived")
      },
      onError: (err: any) => {
        toast.error(err?.message || "Failed to archive order")
      },
    })
  }, [id, archiveOrder])

  const handleFulfill = useCallback(() => {
    if (!id || !order?.items) return
    const items = order.items.map((item: any) => ({
      id: item.id,
      quantity: item.quantity || 1,
    }))
    createFulfillment.mutate(
      { orderId: id, items },
      {
        onSuccess: () => {
          toast.success("Order fulfilled")
        },
        onError: (err: any) => {
          toast.error(err?.message || "Failed to fulfill order")
        },
      }
    )
  }, [id, order, createFulfillment])

  const handleRefund = useCallback(
    (amount: number, note: string) => {
      if (!order) return
      const payments =
        order.payment_collections?.flatMap((pc: any) => pc.payments || []) || []
      const paymentId = payments[0]?.id
      if (!paymentId) {
        toast.error("No payment found to refund")
        return
      }
      refundPayment.mutate(
        { paymentId, amount, note },
        {
          onSuccess: () => {
            toast.success("Refund processed")
            setRefundModalOpen(false)
          },
          onError: (err: any) => {
            toast.error(err?.message || "Failed to process refund")
          },
        }
      )
    },
    [order, refundPayment]
  )

  const handleDuplicate = useCallback(() => {
    if (!id) return
    duplicateOrder.mutate(id, {
      onSuccess: (data: any) => {
        toast.success("Order duplicated")
        setDuplicateModalOpen(false)
        if (data?.order?.id) {
          navigate(`/custom-orders/${data.order.id}`)
        }
      },
      onError: (err: any) => {
        toast.error(err?.message || "Failed to duplicate order")
      },
    })
  }, [id, duplicateOrder, navigate])

  const handleEdit = useCallback(() => {
    if (id) {
      window.open(`/app/orders/${id}`, "_blank")
    }
  }, [id])

  const handleSendToDextrum = useCallback(() => {
    if (!id) return
    sendToDextrum.mutate(id, {
      onSuccess: () => {
        toast.success("Order sent to Dextrum WMS")
      },
      onError: (err: any) => {
        toast.error(err?.message || "Failed to send to Dextrum")
      },
    })
  }, [id, sendToDextrum])

  const handleFakturoidCreate = useCallback(() => {
    if (!id) return
    createFakturoidInvoice.mutate(id, {
      onSuccess: () => {
        toast.success("Fakturoid invoice created")
      },
      onError: (err: any) => {
        toast.error(err?.message || "Failed to create invoice")
      },
    })
  }, [id, createFakturoidInvoice])

  const handleFakturoidOpen = useCallback(() => {
    const url = order?.metadata?.fakturoid_invoice_url
    if (url) {
      window.open(url, "_blank")
    }
  }, [order])

  const handleUpdateNote = useCallback(
    (note: string) => {
      if (!id) return
      updateMetadata.mutate(
        { orderId: id, metadata: { admin_note: note } },
        {
          onSuccess: () => toast.success("Note saved"),
          onError: () => toast.error("Failed to save note"),
        }
      )
    },
    [id, updateMetadata]
  )

  const handleAddComment = useCallback(
    (comment: string) => {
      if (!id || !order) return
      const existingComments = order.metadata?.timeline_comments || []
      const newComment = {
        text: comment,
        author: "Staff",
        created_at: new Date().toISOString(),
      }
      updateMetadata.mutate(
        {
          orderId: id,
          metadata: {
            timeline_comments: [...existingComments, newComment],
          },
        },
        {
          onSuccess: () => toast.success("Comment added"),
          onError: () => toast.error("Failed to add comment"),
        }
      )
    },
    [id, order, updateMetadata]
  )

  // ═══════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════

  if (isLoading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "80px 20px",
        }}
      >
        <LoadingSpinner />
      </div>
    )
  }

  if (error || !order) {
    return (
      <div style={pageStyle}>
        <div
          style={{
            textAlign: "center",
            padding: "60px 20px",
            color: "#8C9196",
          }}
        >
          <p style={{ fontSize: "14px" }}>
            {error ? `Error: ${(error as Error).message}` : "Order not found"}
          </p>
        </div>
      </div>
    )
  }

  // Calculate max refundable
  const payments =
    order.payment_collections?.flatMap((pc: any) => pc.payments || []) || []
  const totalPaid = payments.reduce(
    (sum: number, p: any) => sum + (Number(p.amount) || 0),
    0
  )
  const maxRefundable = totalPaid || Number(order.total) || 0

  return (
    <div style={pageStyle}>
      <OrderDetailStyles />

      {/* Header with Shopify-style actions */}
      <OrderDetailHeader
        order={order}
        onRefund={() => setRefundModalOpen(true)}
        onEdit={handleEdit}
        onCancel={() => setCancelModalOpen(true)}
        onDuplicate={() => setDuplicateModalOpen(true)}
        onArchive={handleArchive}
        onSendToDextrum={handleSendToDextrum}
        onFakturoidCreate={handleFakturoidCreate}
        onFakturoidOpen={handleFakturoidOpen}
      />

      {/* Two-column layout */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 340px",
          gap: "20px",
          alignItems: "start",
        }}
      >
        {/* Left column - Main content */}
        <div>
          <OrderFulfillmentCard
            order={order}
            onMarkAsFulfilled={handleFulfill}
            isLoading={createFulfillment.isPending}
          />
          <OrderDetailPayment order={order} />
          <PaymentActivityLog order={order} />
          <OrderDetailTimeline
            order={order}
            onAddComment={handleAddComment}
            isAddingComment={updateMetadata.isPending}
          />
        </div>

        {/* Right column - Sidebar */}
        <div>
          <OrderNotesCard
            order={order}
            onUpdateNote={handleUpdateNote}
            isLoading={updateMetadata.isPending}
          />
          <OrderDetailCustomer
            order={order}
            orderCount={(customerStats as any)?.order_count}
            totalSpent={(customerStats as any)?.total_spent}
          />
          <OrderDetailMetadata order={order} />

          {/* Dextrum WMS Info */}
          {order.metadata?.dextrum_status && (
            <div
              className="od-card"
              style={{
                background: "#FFFFFF",
                border: "1px solid #E1E3E5",
                borderRadius: "10px",
                marginBottom: "16px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  fontSize: "14px",
                  fontWeight: 600,
                  color: "#1A1A1A",
                  padding: "16px 20px",
                  borderBottom: "1px solid #E1E3E5",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="#3730A3" strokeWidth="1.5">
                  <rect x="2" y="4" width="16" height="12" rx="2" />
                  <path d="M2 8h16M7 4v4M13 4v4" />
                </svg>
                Dextrum — WMS
              </div>
              <div style={{ padding: "16px 20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                  <span style={{ fontSize: "12px", color: "#6D7175" }}>Status</span>
                  <DeliveryBadge status={order.metadata.dextrum_status} />
                </div>
                {order.metadata.dextrum_order_code && (
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                    <span style={{ fontSize: "12px", color: "#6D7175" }}>WMS Order</span>
                    <span style={{ fontSize: "13px", fontWeight: 500 }}>{order.metadata.dextrum_order_code}</span>
                  </div>
                )}
                {order.metadata.dextrum_tracking_number && (
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                    <span style={{ fontSize: "12px", color: "#6D7175" }}>Tracking</span>
                    {order.metadata.dextrum_tracking_url ? (
                      <a
                        href={order.metadata.dextrum_tracking_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: "13px", color: "#2C6ECB", textDecoration: "none", fontWeight: 500 }}
                        className="od-link"
                      >
                        {order.metadata.dextrum_tracking_number} &rarr;
                      </a>
                    ) : (
                      <span style={{ fontSize: "13px", fontWeight: 500 }}>{order.metadata.dextrum_tracking_number}</span>
                    )}
                  </div>
                )}
                {order.metadata.dextrum_carrier && (
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                    <span style={{ fontSize: "12px", color: "#6D7175" }}>Carrier</span>
                    <span style={{ fontSize: "13px", fontWeight: 500 }}>{order.metadata.dextrum_carrier}</span>
                  </div>
                )}
                {order.metadata.dextrum_sent_at && (
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "12px", color: "#6D7175" }}>Sent to WMS</span>
                    <span style={{ fontSize: "12px", color: "#6D7175" }}>
                      {new Date(order.metadata.dextrum_sent_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      {" at "}
                      {new Date(order.metadata.dextrum_sent_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <CancelOrderModal
        open={cancelModalOpen}
        onClose={() => setCancelModalOpen(false)}
        onConfirm={handleCancel}
        isLoading={cancelOrder.isPending}
        orderDisplayId={order.display_id}
      />
      <RefundModal
        open={refundModalOpen}
        onClose={() => setRefundModalOpen(false)}
        onConfirm={handleRefund}
        isLoading={refundPayment.isPending}
        order={order}
        maxRefundable={maxRefundable}
        currency={order.currency_code || "eur"}
      />
      <DuplicateOrderModal
        open={duplicateModalOpen}
        onClose={() => setDuplicateModalOpen(false)}
        onConfirm={handleDuplicate}
        isLoading={duplicateOrder.isPending}
        orderDisplayId={order.display_id}
      />
    </div>
  )
}

export default OrderDetailPage
