import React from "react"
import { toast } from "@medusajs/ui"
import { BookSentToggle } from "./book-sent-toggle"
import { DeliveryBadge } from "./order-badges"
import { OrderTag } from "./order-tag"
import { useUpdateMetadata } from "../../hooks/use-update-metadata"

interface OrderDetailMetadataProps {
  order: any
}

const sectionStyle: React.CSSProperties = {
  background: "#FFFFFF",
  border: "1px solid #E1E3E5",
  borderRadius: "10px",
  padding: "20px",
  marginBottom: "16px",
}

const sectionTitleStyle: React.CSSProperties = {
  fontSize: "14px",
  fontWeight: 600,
  color: "#1A1A1A",
  marginBottom: "16px",
}

const rowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "10px 0",
  borderBottom: "1px solid #F1F1F1",
}

const labelStyle: React.CSSProperties = {
  fontSize: "13px",
  fontWeight: 500,
  color: "#6D7175",
}

export function OrderDetailMetadata({ order }: OrderDetailMetadataProps) {
  const updateMetadata = useUpdateMetadata()
  const metadata = order.metadata || {}

  const bookSent = metadata.book_sent === true || metadata.book_sent === "true"
  const tag = metadata.tags || ""
  const deliveryStatus = metadata.baselinker_status || ""
  const baselinkerOrderId = metadata.baselinker_order_id || ""
  const fakturoidInvoiceId = metadata.fakturoid_invoice_id || ""
  const fakturoidInvoiceUrl = metadata.fakturoid_invoice_url || ""

  function handleBookSentToggle() {
    updateMetadata.mutate(
      { orderId: order.id, metadata: { book_sent: !bookSent } },
      {
        onSuccess: () => {
          toast.success(`Book sent ${!bookSent ? "marked" : "unmarked"}`)
        },
        onError: () => {
          toast.error("Failed to update")
        },
      }
    )
  }

  // Get product tag from first item if not in metadata
  const displayTag =
    tag ||
    order.items?.[0]?.variant?.product?.title ||
    order.items?.[0]?.title ||
    ""

  return (
    <div style={sectionStyle}>
      <div style={sectionTitleStyle}>Custom Data</div>

      {/* Book Sent */}
      <div style={rowStyle}>
        <span style={labelStyle}>Book Sent</span>
        <BookSentToggle sent={bookSent} onClick={handleBookSentToggle} />
      </div>

      {/* Tags */}
      <div style={rowStyle}>
        <span style={labelStyle}>Product Tag</span>
        <OrderTag
          tag={displayTag}
          countryCode={order.shipping_address?.country_code}
        />
      </div>

      {/* BaseLinker Status */}
      <div style={rowStyle}>
        <span style={labelStyle}>BaseLinker Status</span>
        {deliveryStatus ? (
          <DeliveryBadge status={deliveryStatus} />
        ) : (
          <span style={{ fontSize: "13px", color: "#8C9196" }}>&mdash;</span>
        )}
      </div>

      {/* BaseLinker Order ID */}
      <div style={rowStyle}>
        <span style={labelStyle}>BaseLinker Order ID</span>
        <span style={{ fontSize: "13px", color: "#1A1A1A" }}>
          {baselinkerOrderId || "\u2014"}
        </span>
      </div>

      {/* Fakturoid */}
      <div style={{ ...rowStyle, borderBottom: "none" }}>
        <span style={labelStyle}>Fakturoid Invoice</span>
        {fakturoidInvoiceId ? (
          <a
            href={fakturoidInvoiceUrl || "#"}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: "13px",
              color: "#2C6ECB",
              textDecoration: "none",
            }}
          >
            #{fakturoidInvoiceId}
          </a>
        ) : (
          <span style={{ fontSize: "13px", color: "#8C9196" }}>&mdash;</span>
        )}
      </div>

      {/* Upsell info */}
      {metadata.upsell_accepted && (
        <>
          <div
            style={{
              marginTop: "12px",
              paddingTop: "12px",
              borderTop: "1px solid #E1E3E5",
            }}
          >
            <div
              style={{
                fontSize: "12px",
                fontWeight: 600,
                color: "#6D7175",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                marginBottom: "8px",
              }}
            >
              Upsell
            </div>
            <div style={{ ...rowStyle, borderBottom: "none" }}>
              <span style={labelStyle}>Upsell Accepted</span>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                  padding: "3px 10px",
                  borderRadius: "12px",
                  fontSize: "12px",
                  fontWeight: 600,
                  background: "#AEE9D1",
                  color: "#0D5740",
                }}
              >
                Yes
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
