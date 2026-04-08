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
  useSendToPostNord,
  useCreateFakturoidInvoice,
  useDeleteFakturoidInvoice,
  useCreateFakturoidCreditNote,
  useCreateQBInvoice,
  useDeleteQBInvoice,
  useCreateQBCreditMemo,
  useResendEbooks,
  useCustomerStats,
} from "../../../hooks/use-order-actions"

// Components
import { OrderDetailHeader } from "../../../components/orders/order-detail-header"
import { OrderFulfillmentCard } from "../../../components/orders/order-fulfillment-card"
import { OrderDetailPayment } from "../../../components/orders/order-detail-payment"
import { OrderTimeline } from "../../../components/orders/order-timeline"
import { OrderDetailCustomer } from "../../../components/orders/order-detail-customer"
import { OrderDetailMetadata } from "../../../components/orders/order-detail-metadata"
import { OrderNotesCard } from "../../../components/orders/order-notes-card"
import { DeliveryBadge } from "../../../components/orders/order-badges"

// Modals
import { CancelOrderModal } from "../../../components/orders/cancel-order-modal"
import { RefundModal } from "../../../components/orders/refund-modal"
import { DuplicateOrderModal } from "../../../components/orders/duplicate-order-modal"
import { FulfillmentModal } from "../../../components/orders/fulfillment-modal"

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
        transition: background 0.15s ease !important;
      }
      .od-dropdown-item:hover {
        background: ${colors.bgHover} !important;
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

      /* ═══ RESPONSIVE / MOBILE ═══ */

      /* Tablet & below: collapse grid to single column */
      @media (max-width: 860px) {
        .od-page-container {
          padding: 16px 16px !important;
          width: 100% !important;
        }
        .od-main-grid {
          grid-template-columns: 1fr !important;
          gap: 16px !important;
        }
        .od-health-bar {
          padding: 12px 14px !important;
          margin-bottom: 16px !important;
        }
        .od-health-labels span {
          font-size: 10px !important;
        }
      }

      /* Mobile: header layout adjustments */
      @media (max-width: 640px) {
        .od-page-container {
          padding: 12px 12px !important;
        }
        .od-header-title-row {
          flex-direction: column !important;
          align-items: flex-start !important;
          gap: 12px !important;
        }
        .od-header-actions {
          width: 100%;
          display: flex !important;
          gap: 6px !important;
        }
        .od-header-actions button {
          flex: 1;
          justify-content: center !important;
          font-size: 12px !important;
          padding: 8px 10px !important;
        }
        .od-order-title {
          font-size: 19px !important;
        }
        .od-date-subtitle {
          font-size: 12px !important;
        }

        /* Cards: tighter padding */
        .od-card {
          border-radius: 12px !important;
          margin-bottom: 12px !important;
        }
        .od-card > div:first-child {
          padding: 12px 14px !important;
        }

        /* Health bar: smaller text */
        .od-health-labels span {
          font-size: 9px !important;
          letter-spacing: -0.2px;
        }

        /* Modals: full width on mobile */
        .od-modal-overlay > div {
          width: 95vw !important;
          max-width: 95vw !important;
          margin: 16px !important;
          max-height: 90vh !important;
          overflow-y: auto !important;
        }
      }

      /* Small mobile: extra compact */
      @media (max-width: 400px) {
        .od-page-container {
          padding: 8px 8px !important;
        }
        .od-header-actions {
          flex-wrap: wrap !important;
        }
        .od-order-title {
          font-size: 17px !important;
        }
      }

      /* ═══ Component-level responsive fixes ═══ */

      /* Metadata rows: wrap long values */
      @media (max-width: 860px) {
        .od-card [style*="justifyContent"] {
          flex-wrap: wrap;
        }
      }

      /* Action button rows on mobile */
      @media (max-width: 640px) {
        /* Fulfillment card action buttons stack vertically */
        .od-action-row {
          flex-direction: column !important;
          align-items: stretch !important;
        }
        .od-action-row > button,
        .od-action-row > div > button {
          width: 100% !important;
          justify-content: center !important;
        }

        /* Payment card: tighter layout */
        .od-card table {
          font-size: 12px !important;
        }

        /* Timeline entries: tighter */
        .od-card .od-link {
          font-size: 12px !important;
        }

        /* Dropdown: position fixed on mobile for better UX */
        .od-actions-dropdown {
          position: fixed !important;
          top: auto !important;
          bottom: 0 !important;
          left: 0 !important;
          right: 0 !important;
          width: 100vw !important;
          max-height: 70vh !important;
          overflow-y: auto !important;
          border-radius: 16px 16px 0 0 !important;
          box-shadow: 0 -4px 24px rgba(0,0,0,0.12) !important;
          z-index: 1000 !important;
          animation: odSlideUp 0.25s ease !important;
        }

        @keyframes odSlideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
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

// Compute payment status from order data (same logic as orders-table.tsx)
function getPaymentStatusForHealth(order: any): string {
  if (order.metadata?.payment_captured) return "paid"
  const isCOD = (order.payment_collections || []).some((pc: any) =>
    (pc.payments || []).some((p: any) => (p.provider_id || "").includes("cod"))
  ) || order.metadata?.payment_provider === "cod" || order.metadata?.payment_method === "cod"
  if (isCOD) return "pending"
  if (order.payment_collections?.length) {
    const pcs = order.payment_collections as any[]
    const activePC = pcs.find((pc: any) => pc.status === "captured" || pc.status === "completed")
      || pcs.find((pc: any) => pc.status !== "canceled")
      || pcs[pcs.length - 1]
    if (activePC.status === "captured" || activePC.status === "completed") return "paid"
    if (activePC.status === "refunded") return "refunded"
    if (activePC.status === "partially_refunded") return "partially_refunded"
    if (activePC.status === "authorized") return "authorized"
    return activePC.status || "pending"
  }
  if (order.metadata?.copied_payment_status) return order.metadata.copied_payment_status
  return "pending"
}

// Get delivery/fulfillment status (same logic as orders-table.tsx)
function getDeliveryStatus(order: any): string {
  return order.metadata?.dextrum_status || (() => {
    const fulfillments = order.fulfillments || []
    if (fulfillments.length === 0) return "unfulfilled"
    const itemCount = order.items?.length || 0
    const fulfilledItemIds = new Set<string>()
    fulfillments.forEach((f: any) => {
      (f.items || []).forEach((fi: any) => fulfilledItemIds.add(fi.line_item_id))
    })
    if (itemCount > 0 && fulfilledItemIds.size < itemCount) return "partially_fulfilled"
    return "fulfilled"
  })()
}

// Per-step status: which steps are "done" (green) vs "active" (blue) vs "pending" (gray)
function getHealthStepStatuses(order: any): Array<"done" | "active" | "pending"> {
  const paymentStatus = getPaymentStatusForHealth(order)
  const deliveryStatus = getDeliveryStatus(order).toUpperCase()
  const isPaid = paymentStatus === "paid" || paymentStatus === "captured"
  const isPending = paymentStatus === "pending" || paymentStatus === "authorized"

  // Fulfilled = PACKED, DISPATCHED, IN_TRANSIT, DELIVERED or Medusa fulfilled
  const fulfilledStatuses = ["PACKED", "DISPATCHED", "IN_TRANSIT", "DELIVERED", "COMPLETED"]
  const isFulfilled = fulfilledStatuses.includes(deliveryStatus)
    || deliveryStatus === "FULFILLED"

  // Shipped = DISPATCHED, IN_TRANSIT, DELIVERED
  const shippedStatuses = ["DISPATCHED", "IN_TRANSIT", "DELIVERED", "COMPLETED"]
  const isShipped = shippedStatuses.includes(deliveryStatus)

  // Delivered
  const isDelivered = deliveryStatus === "DELIVERED" || deliveryStatus === "COMPLETED"

  const steps: Array<"done" | "active" | "pending"> = ["pending", "pending", "pending", "pending", "pending"]

  // Step 0: Created — always at least active (blue), green if paid
  steps[0] = isPaid ? "done" : "active"

  // Step 1: Paid — green if paid, blue if pending/authorized, gray otherwise
  if (isPaid) {
    steps[1] = "done"
  } else if (isPending) {
    steps[1] = "active"
  }

  // Step 2: Fulfilled — green if at least PACKED
  if (isFulfilled) steps[2] = "done"

  // Step 3: Shipped — green if DISPATCHED+
  if (isShipped) steps[3] = "done"

  // Step 4: Delivered — green if DELIVERED
  if (isDelivered) steps[4] = "done"

  return steps
}

const HEALTH_STEPS = ["Created", "Paid", "Fulfilled", "Shipped", "Delivered"]

function OrderHealthBar({ order }: { order: any }) {
  const stepStatuses = getHealthStepStatuses(order)

  const getColor = (status: "done" | "active" | "pending") => {
    if (status === "done") return colors.green
    if (status === "active") return colors.blue
    return colors.border
  }

  const getLabelColor = (status: "done" | "active" | "pending") => {
    if (status === "done") return colors.green
    if (status === "active") return colors.blue
    return colors.textMuted
  }

  return (
    <div
      className="od-health-bar"
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
        {HEALTH_STEPS.map((_, idx) => (
          <div
            key={idx}
            style={{
              flex: 1,
              height: "6px",
              borderRadius: "3px",
              background: getColor(stepStatuses[idx]),
              transition: "background 0.3s ease",
            }}
          />
        ))}
      </div>
      {/* Labels */}
      <div className="od-health-labels" style={{ display: "flex", justifyContent: "space-between" }}>
        {HEALTH_STEPS.map((label, idx) => (
          <span
            key={idx}
            style={{
              fontSize: "11px",
              fontWeight: stepStatuses[idx] !== "pending" ? 600 : 400,
              color: getLabelColor(stepStatuses[idx]),
              textAlign: "center",
              flex: 1,
            }}
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}

const BG_COLOR = "#fafafa"

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
  const sendToPostNord = useSendToPostNord()
  const createFakturoidInvoice = useCreateFakturoidInvoice()
  const deleteFakturoidInvoice = useDeleteFakturoidInvoice()
  const createFakturoidCreditNote = useCreateFakturoidCreditNote()
  const createQBInvoice = useCreateQBInvoice()
  const deleteQBInvoice = useDeleteQBInvoice()
  const createQBCreditMemo = useCreateQBCreditMemo()
  const resendEbooks = useResendEbooks()

  // Customer stats
  const order = data?.order as any
  const { data: customerStats } = useCustomerStats(order?.email)

  // Modal states
  const [cancelModalOpen, setCancelModalOpen] = useState(false)
  const [refundModalOpen, setRefundModalOpen] = useState(false)
  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false)
  const [fulfillmentModalOpen, setFulfillmentModalOpen] = useState(false)

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

  const handleFulfillClick = useCallback(() => {
    setFulfillmentModalOpen(true)
  }, [])

  const handleFulfillConfirm = useCallback(
    (trackingData: { trackingNumber: string; trackingUrl: string; carrier: string }) => {
      if (!id || !order?.items) return
      const items = order.items.map((item: any) => ({
        id: item.id,
        quantity: item.quantity || 1,
      }))
      createFulfillment.mutate(
        {
          orderId: id,
          items,
          trackingNumber: trackingData.trackingNumber || undefined,
          trackingUrl: trackingData.trackingUrl || undefined,
          carrier: trackingData.carrier || undefined,
        },
        {
          onSuccess: () => {
            toast.success("Order fulfilled")
            setFulfillmentModalOpen(false)
          },
          onError: (err: any) => {
            toast.error(err?.message || "Failed to fulfill order")
          },
        }
      )
    },
    [id, order, createFulfillment]
  )

  const handleRefund = useCallback(
    (amount: number, note: string) => {
      if (!order || !id) return
      refundPayment.mutate(
        { orderId: id, amount, note },
        {
          onSuccess: () => {
            toast.success("Refund processed via payment gateway")
            setRefundModalOpen(false)

            // Auto-create Fakturoid credit note if invoice exists
            if (order.metadata?.fakturoid_invoice_id && !order.metadata?.fakturoid_credit_note_id) {
              createFakturoidCreditNote.mutate(id, {
                onSuccess: () => toast.success("Fakturoid credit note created"),
                onError: (e: any) => toast.error(`Fakturoid credit note failed: ${e?.message || "unknown error"}`),
              })
            }

            // Auto-create QuickBooks credit memo if invoice exists
            if (order.metadata?.quickbooks_invoice_id && !order.metadata?.quickbooks_credit_memo_id) {
              createQBCreditMemo.mutate(id, {
                onSuccess: () => toast.success("QuickBooks credit memo created"),
                onError: (e: any) => toast.error(`QuickBooks credit memo failed: ${e?.message || "unknown error"}`),
              })
            }
          },
          onError: (err: any) => {
            toast.error(err?.message || "Failed to process refund")
          },
        }
      )
    },
    [id, order, refundPayment, createFakturoidCreditNote, createQBCreditMemo]
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

  const handleSendToPostNord = useCallback(() => {
    if (!id) return
    if (order?.metadata?.postnord_sent) {
      const confirmed = window.confirm("This order was already sent to PostNord. Send again?")
      if (!confirmed) return
    }
    sendToPostNord.mutate(id, {
      onSuccess: () => {
        toast.success("Order sent to PostNord WMS ✓")
      },
      onError: (err: any) => {
        toast.error(err?.message || "Failed to send to PostNord")
      },
    })
  }, [id, sendToPostNord, order])

  const handleResendEbooks = useCallback(() => {
    if (!id) return
    resendEbooks.mutate(id, {
      onSuccess: () => {
        toast.success("E-book email sent successfully")
      },
      onError: (err: any) => {
        toast.error(err?.message || "Failed to send e-books")
      },
    })
  }, [id, resendEbooks])

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

  const handleFakturoidDelete = useCallback(() => {
    if (!id) return
    if (!window.confirm("Are you sure you want to delete this invoice from Fakturoid?")) return
    deleteFakturoidInvoice.mutate(id, {
      onSuccess: () => {
        toast.success("Fakturoid invoice deleted")
      },
      onError: (err: any) => {
        toast.error(err?.message || "Failed to delete invoice")
      },
    })
  }, [id, deleteFakturoidInvoice])

  const handleFakturoidCreditNote = useCallback(() => {
    if (!id) return
    if (!window.confirm("Create a credit note (opravny danovy doklad) for this invoice?")) return
    createFakturoidCreditNote.mutate(id, {
      onSuccess: () => {
        toast.success("Credit note created in Fakturoid")
      },
      onError: (err: any) => {
        toast.error(err?.message || "Failed to create credit note")
      },
    })
  }, [id, createFakturoidCreditNote])

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

  // ── QuickBooks handlers ──

  const handleQBCreate = useCallback(() => {
    if (!id) return
    createQBInvoice.mutate(id, {
      onSuccess: () => {
        toast.success("QuickBooks invoice created")
      },
      onError: (err: any) => {
        toast.error(err?.message || "Failed to create QuickBooks invoice")
      },
    })
  }, [id, createQBInvoice])

  const handleQBDelete = useCallback(() => {
    if (!id) return
    if (!window.confirm("Are you sure you want to void/delete this invoice from QuickBooks?")) return
    deleteQBInvoice.mutate(id, {
      onSuccess: () => {
        toast.success("QuickBooks invoice deleted")
      },
      onError: (err: any) => {
        toast.error(err?.message || "Failed to delete QuickBooks invoice")
      },
    })
  }, [id, deleteQBInvoice])

  const handleQBCreditMemo = useCallback(() => {
    if (!id) return
    if (!window.confirm("Create a credit memo for this QuickBooks invoice?")) return
    createQBCreditMemo.mutate(id, {
      onSuccess: () => {
        toast.success("Credit memo created in QuickBooks")
      },
      onError: (err: any) => {
        toast.error(err?.message || "Failed to create credit memo")
      },
    })
  }, [id, createQBCreditMemo])

  const handleQBOpen = useCallback(() => {
    const url = order?.metadata?.quickbooks_invoice_url
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
    <div ref={pageRef} style={pageStyle} className="od-section-animate od-page-container">
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
        onSendToPostNord={handleSendToPostNord}
        onFakturoidCreate={handleFakturoidCreate}
        onFakturoidOpen={handleFakturoidOpen}
        onFakturoidDelete={handleFakturoidDelete}
        onFakturoidCreditNote={handleFakturoidCreditNote}
        onQBCreate={handleQBCreate}
        onQBOpen={handleQBOpen}
        onQBDelete={handleQBDelete}
        onQBCreditMemo={handleQBCreditMemo}
      />

      {/* Health Bar — order progress */}
      <OrderHealthBar order={order} />

      {/* Two-column layout */}
      <div
        className="od-main-grid"
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
            onMarkAsFulfilled={handleFulfillClick}
            onSendToDextrum={handleSendToDextrum}
            onFakturoidCreate={handleFakturoidCreate}
            onQBCreate={handleQBCreate}
            onResendEbooks={handleResendEbooks}
            isLoading={createFulfillment.isPending}
            isDextrumLoading={sendToDextrum.isPending}
            isFakturoidLoading={createFakturoidInvoice.isPending}
            isQBLoading={createQBInvoice.isPending}
            isEbookLoading={resendEbooks.isPending}
          />
          <OrderDetailPayment
            order={order}
            onCapture={handleCapture}
            isCapturing={capturePayment.isPending}
          />
          <OrderTimeline order={order} />
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
                      {new Date(order.metadata.dextrum_sent_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Europe/Prague" })}
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
      <FulfillmentModal
        open={fulfillmentModalOpen}
        onClose={() => setFulfillmentModalOpen(false)}
        onConfirm={handleFulfillConfirm}
        isLoading={createFulfillment.isPending}
        orderDisplayId={order.display_id}
        shippingCountry={order.shipping_address?.country_code}
        shippingZip={order.shipping_address?.postal_code}
      />
    </div>
  )
}

export default OrderDetailPage
