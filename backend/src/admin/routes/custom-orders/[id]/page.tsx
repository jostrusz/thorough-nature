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
  useSendToBaseLinker,
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
import { OrderNotesCard } from "../../../components/orders/order-notes-card"

// Modals
import { CancelOrderModal } from "../../../components/orders/cancel-order-modal"
import { RefundModal } from "../../../components/orders/refund-modal"
import { DuplicateOrderModal } from "../../../components/orders/duplicate-order-modal"

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
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
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
  const sendToBaseLinker = useSendToBaseLinker()
  const createFakturoidInvoice = useCreateFakturoidInvoice()

  // Customer stats
  const order = data?.order
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

  const handleSendToBaseLinker = useCallback(() => {
    if (!id) return
    sendToBaseLinker.mutate(id, {
      onSuccess: () => {
        toast.success("Order sent to BaseLinker")
      },
      onError: (err: any) => {
        toast.error(err?.message || "Failed to send to BaseLinker")
      },
    })
  }, [id, sendToBaseLinker])

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
      {/* Header with Shopify-style actions */}
      <OrderDetailHeader
        order={order}
        onRefund={() => setRefundModalOpen(true)}
        onEdit={handleEdit}
        onCancel={() => setCancelModalOpen(true)}
        onDuplicate={() => setDuplicateModalOpen(true)}
        onArchive={handleArchive}
        onSendToBaseLinker={handleSendToBaseLinker}
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
