import React, { useState, useCallback, useEffect, useRef } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { toast } from "@medusajs/ui"

// Design tokens
import {
  colors,
  shadows,
  radii,
  fontStack,
  cardStyle,
  cardHeaderStyle,
} from "../../../components/orders/design-tokens"

// Hooks
import { useOrderDetail } from "../../../hooks/use-order-detail"
import { useUpdateMetadata } from "../../../hooks/use-update-metadata"
import {
  useCancelOrder,
  useArchiveOrder,
  useCreateFulfillment,
  useRefundPayment,
  useCapturePayment,
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
        border-color: ${colors.borderActive} !important;
        transform: translateY(-1px);
      }

      /* Buttons — smooth hover */
      .od-btn {
        transition: all 0.15s ease !important;
      }
      .od-btn:hover {
        background: ${colors.bgHover} !important;
        border-color: ${colors.borderActive} !important;
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
        box-shadow: 0 2px 8px rgba(108, 92, 231, 0.3);
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
        color: ${colors.accent} !important;
      }

      /* Edit pencil button */
      .od-edit-btn {
        transition: all 0.15s ease !important;
      }
      .od-edit-btn:hover {
        color: ${colors.text} !important;
        background: ${colors.bgHover} !important;
      }

      /* Input focus glow */
      .od-input {
        transition: border-color 0.2s ease, box-shadow 0.2s ease !important;
      }
      .od-input:focus {
        border-color: ${colors.accent} !important;
        box-shadow: 0 0 0 3px rgba(108, 92, 231, 0.12) !important;
        outline: none !important;
      }
      .od-input:hover:not(:focus) {
        border-color: ${colors.borderActive} !important;
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
        background: ${colors.bgHover} !important;
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
        background: ${colors.bgHover} !important;
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
        background: ${colors.text};
        color: #FFFFFF;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 11px;
        white-space: nowrap;
        z-index: 50;
        pointer-events: none;
      }

      /* Enhanced card hover — glassmorphism inspired */
      .od-card {
        backdrop-filter: blur(0px);
      }
      .od-card:hover {
        box-shadow: 0 8px 32px rgba(108, 92, 231, 0.08), 0 2px 8px rgba(0, 0, 0, 0.04) !important;
      }

      /* Smooth row highlight with left accent */
      .od-row-hover::before {
        content: '';
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        width: 2px;
        background: transparent;
        border-radius: 2px;
        transition: background 0.2s ease;
      }
      .od-row-hover {
        position: relative;
      }
      .od-row-hover:hover::before {
        background: #6C5CE7;
      }

      /* Button ripple effect */
      .od-btn::after {
        content: '';
        position: absolute;
        top: 50%;
        left: 50%;
        width: 0;
        height: 0;
        border-radius: 50%;
        background: rgba(108, 92, 231, 0.1);
        transition: width 0.3s ease, height 0.3s ease, top 0.3s ease, left 0.3s ease;
      }
      .od-btn {
        position: relative;
        overflow: hidden;
      }
      .od-btn:active::after {
        width: 200%;
        height: 200%;
        top: -50%;
        left: -50%;
      }

      /* Health bar segment hover */
      .od-health-segment {
        transition: transform 0.2s ease, filter 0.2s ease !important;
      }
      .od-health-segment:hover {
        transform: scaleY(1.3);
        filter: brightness(1.1);
      }

      /* Smooth entrance */
      @keyframes odSlideIn {
        from { opacity: 0; transform: translateY(12px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .od-section-animate {
        animation: odSlideIn 0.35s ease;
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
        border: `3px solid ${colors.border}`,
        borderTopColor: colors.accent,
        borderRadius: "50%",
        animation: "spin 0.8s linear infinite",
      }}
    />
  )
}

// ═══ Health Bar ═══
// Shows order progress: Created → Paid → Fulfilled → Shipped → Delivered

function getOrderHealthStep(order: any): number {
  // 0=Created, 1=Paid, 2=Fulfilled, 3=Shipped, 4=Delivered
  const dextrumStatus = order.metadata?.dextrum_status?.toLowerCase?.() || ""
  const fulfillmentStatus = (order.fulfillment_status || "").toLowerCase()
  const paymentStatus = (order.payment_status || "").toLowerCase()

  if (dextrumStatus === "delivered" || dextrumStatus === "completed") return 4
  if (
    dextrumStatus === "shipped" ||
    dextrumStatus === "in_transit" ||
    order.metadata?.dextrum_tracking_number
  )
    return 3
  if (
    fulfillmentStatus === "fulfilled" ||
    fulfillmentStatus === "shipped" ||
    fulfillmentStatus === "partially_fulfilled"
  )
    return 2
  if (
    paymentStatus === "captured" ||
    paymentStatus === "paid" ||
    paymentStatus === "partially_refunded"
  )
    return 1
  return 0
}

const HEALTH_STEPS = ["Created", "Paid", "Fulfilled", "Shipped", "Delivered"]

function OrderHealthBar({ order }: { order: any }) {
  const currentStep = getOrderHealthStep(order)

  return (
    <div
      style={{
        background: colors.bgCard,
        border: `1px solid ${colors.border}`,
        borderRadius: radii.card,
        boxShadow: shadows.card,
        marginBottom: "20px",
        padding: "16px 20px",
        overflow: "hidden",
      }}
    >
      {/* Bar segments */}
      <div style={{ display: "flex", gap: "4px", marginBottom: "10px" }}>
        {HEALTH_STEPS.map((_, idx) => {
          let segColor: string
          if (idx < currentStep) {
            segColor = colors.green
          } else if (idx === currentStep) {
            segColor = colors.accent
          } else {
            segColor = colors.border
          }
          return (
            <div
              key={idx}
              style={{
                flex: 1,
                height: "6px",
                borderRadius: "3px",
                background: segColor,
                transition: "background 0.3s ease",
              }}
            />
          )
        })}
      </div>
      {/* Labels */}
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        {HEALTH_STEPS.map((label, idx) => {
          let labelColor: string
          let labelWeight: number
          if (idx < currentStep) {
            labelColor = colors.green
            labelWeight = 500
          } else if (idx === currentStep) {
            labelColor = colors.accent
            labelWeight = 600
          } else {
            labelColor = colors.textMuted
            labelWeight = 400
          }
          return (
            <span
              key={idx}
              style={{
                fontSize: "11px",
                fontWeight: labelWeight,
                color: labelColor,
                textAlign: "center",
                flex: 1,
              }}
            >
              {label}
            </span>
          )
        })}
      </div>
    </div>
  )
}

const BG_COLOR = "#f4f5fa"

const pageStyle: React.CSSProperties = {
  width: "1000px",
  maxWidth: "100%",
  margin: "0 auto",
  padding: "24px 32px",
  fontFamily: fontStack,
}

/**
 * Hook that walks up the DOM from a ref and sets background on all
 * ancestor elements up to <body>. Cleans up on unmount.
 */
function useFullPageBackground(ref: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const el = ref.current
    if (!el) return

    const originals: { el: HTMLElement; bg: string }[] = []
    let node: HTMLElement | null = el.parentElement

    while (node && node !== document.documentElement) {
      originals.push({ el: node, bg: node.style.background })
      node.style.background = BG_COLOR
      node = node.parentElement
    }

    return () => {
      originals.forEach(({ el: n, bg }) => {
        n.style.background = bg
      })
    }
  }, [ref])
}

const OrderDetailPage = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const pageRef = useRef<HTMLDivElement>(null)
  useFullPageBackground(pageRef)

  // Data hooks
  const { data, isLoading, error } = useOrderDetail(id)
  const updateMetadata = useUpdateMetadata()

  // Action hooks
  const cancelOrder = useCancelOrder()
  const archiveOrder = useArchiveOrder()
  const createFulfillment = useCreateFulfillment()
  const refundPayment = useRefundPayment()
  const capturePayment = useCapturePayment()
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

  const handleCapture = useCallback(() => {
    if (!id) return
    capturePayment.mutate(id, {
      onSuccess: () => {
        toast.success("Payment captured successfully")
      },
      onError: (err: any) => {
        toast.error(err?.message || "Failed to capture payment")
      },
    })
  }, [id, capturePayment])

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
      <div ref={pageRef}>
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
      </div>
    )
  }

  if (error || !order) {
    return (
      <div ref={pageRef} style={pageStyle}>
        <div
          style={{
            textAlign: "center",
            padding: "60px 20px",
            color: colors.textMuted,
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
    <div ref={pageRef} style={pageStyle} className="od-section-animate">
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

      {/* Health Bar — order progress */}
      <OrderHealthBar order={order} />

      {/* Two-column layout */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 340px",
          gap: "24px",
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
          <OrderDetailPayment
            order={order}
            onCapture={handleCapture}
            isCapturing={capturePayment.isPending}
          />
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
              style={cardStyle}
            >
              <div
                style={{
                  ...cardHeaderStyle,
                  gap: "8px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke={colors.accent} strokeWidth="1.5">
                    <rect x="2" y="4" width="16" height="12" rx="2" />
                    <path d="M2 8h16M7 4v4M13 4v4" />
                  </svg>
                  Dextrum — WMS
                </div>
              </div>
              <div style={{ padding: "16px 20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                  <span style={{ fontSize: "12px", color: colors.textSec }}>Status</span>
                  <DeliveryBadge status={order.metadata.dextrum_status} />
                </div>
                {order.metadata.dextrum_order_code && (
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                    <span style={{ fontSize: "12px", color: colors.textSec }}>WMS Order</span>
                    <span style={{ fontSize: "13px", fontWeight: 500, color: colors.text }}>{order.metadata.dextrum_order_code}</span>
                  </div>
                )}
                {order.metadata.dextrum_tracking_number && (
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                    <span style={{ fontSize: "12px", color: colors.textSec }}>Tracking</span>
                    {order.metadata.dextrum_tracking_url ? (
                      <a
                        href={order.metadata.dextrum_tracking_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: "13px", color: colors.accent, textDecoration: "none", fontWeight: 500 }}
                        className="od-link"
                      >
                        {order.metadata.dextrum_tracking_number} &rarr;
                      </a>
                    ) : (
                      <span style={{ fontSize: "13px", fontWeight: 500, color: colors.text }}>{order.metadata.dextrum_tracking_number}</span>
                    )}
                  </div>
                )}
                {order.metadata.dextrum_carrier && (
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                    <span style={{ fontSize: "12px", color: colors.textSec }}>Carrier</span>
                    <span style={{ fontSize: "13px", fontWeight: 500, color: colors.text }}>{order.metadata.dextrum_carrier}</span>
                  </div>
                )}
                {order.metadata.dextrum_sent_at && (
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "12px", color: colors.textSec }}>Sent to WMS</span>
                    <span style={{ fontSize: "12px", color: colors.textSec }}>
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
