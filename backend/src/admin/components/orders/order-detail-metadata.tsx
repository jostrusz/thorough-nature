import React from "react"
import { toast } from "@medusajs/ui"
import { BookSentToggle } from "./book-sent-toggle"
import { DeliveryBadge } from "./order-badges"
import { OrderTag } from "./order-tag"
import { useUpdateMetadata } from "../../hooks/use-update-metadata"
import { colors, shadows, radii, cardStyle, cardHeaderStyle, fontStack } from "./design-tokens"

interface OrderDetailMetadataProps {
  order: any
}

const sectionStyle: React.CSSProperties = {
  background: colors.bgCard,
  border: `1px solid ${colors.border}`,
  borderRadius: radii.card,
  boxShadow: shadows.card,
  padding: "20px",
  marginBottom: "16px",
  transition: "box-shadow 0.25s ease, transform 0.25s ease",
}

const sectionTitleStyle: React.CSSProperties = {
  fontSize: "14px",
  fontWeight: 600,
  color: colors.text,
  marginBottom: "16px",
}

const groupTitleStyle: React.CSSProperties = {
  fontSize: "12px",
  fontWeight: 600,
  color: colors.textSec,
  textTransform: "uppercase",
  letterSpacing: "0.5px",
  marginBottom: "8px",
  marginTop: "16px",
  paddingTop: "12px",
  borderTop: `1px solid ${colors.border}`,
}

const rowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "8px 4px",
  borderBottom: `1px solid ${colors.bgHover}`,
  borderRadius: "4px",
  margin: "0 -4px",
  transition: "background 0.12s ease",
}

const labelStyle: React.CSSProperties = {
  fontSize: "13px",
  fontWeight: 500,
  color: colors.textSec,
}

const valueStyle: React.CSSProperties = {
  fontSize: "13px",
  color: colors.text,
}

const linkStyle: React.CSSProperties = {
  fontSize: "13px",
  color: colors.accent,
  textDecoration: "none",
}

const codeStyle: React.CSSProperties = {
  fontSize: "11px",
  background: colors.bgHover,
  padding: "2px 6px",
  borderRadius: "4px",
  color: colors.text,
  fontFamily: "monospace",
}

const dashStyle: React.CSSProperties = {
  fontSize: "13px",
  color: colors.textMuted,
}

export function OrderDetailMetadata({ order }: OrderDetailMetadataProps) {
  const updateMetadata = useUpdateMetadata()
  const metadata = order.metadata || {}

  const bookSent = metadata.book_sent === true || metadata.book_sent === "true"
  const tag = metadata.tags || ""
  const deliveryStatus = metadata.dextrum_status || ""
  const dextrumOrderCode = metadata.dextrum_order_code || ""

  // Fakturoid
  const fakturoidInvoiceId = metadata.fakturoid_invoice_id || ""
  const fakturoidInvoiceUrl = metadata.fakturoid_invoice_url || ""

  // QuickBooks
  const quickbooksInvoiceId = metadata.quickbooks_invoice_id || ""
  const quickbooksInvoiceUrl = metadata.quickbooks_invoice_url || ""

  // Payment info
  const payments = (order.payment_collections || []).flatMap(
    (pc: any) => pc.payments || []
  )
  const payment = payments[0]

  // Payment ID — each gateway stores it differently
  const gatewayPaymentId =
    // Direct from payment data
    payment?.data?.molliePaymentId ||
    payment?.data?.mollieOrderId ||
    payment?.data?.stripePaymentIntentId ||
    payment?.data?.payment_intent ||
    payment?.data?.intentId ||
    payment?.data?.id ||
    payment?.data?.payment_id ||
    payment?.data?.transaction_id ||
    // From order metadata (set by order-placed-payment-metadata subscriber)
    metadata.stripePaymentIntentId ||
    metadata.molliePaymentId ||
    metadata.mollieOrderId ||
    metadata.paypalOrderId ||
    metadata.klarnaOrderId ||
    metadata.comgateTransId ||
    metadata.p24SessionId ||
    metadata.airwallexPaymentIntentId ||
    ""

  // Payment Gateway name (e.g. "Mollie", "PayPal")
  const providerRaw = payment?.provider_id || ""
  const paymentGateway = providerRaw
    ? providerRaw.replace(/^pp_/, "").replace(/_.*$/, "").replace(/^\w/, (c: string) => c.toUpperCase())
    : ""

  // Payment Method (e.g. "ideal", "bancontact", "creditcard")
  const paymentMethodRaw =
    payment?.data?.method ||
    metadata.payment_method ||
    ""
  const PAYMENT_METHOD_LABELS: Record<string, string> = {
    ideal: "iDEAL",
    creditcard: "Credit Card",
    bancontact: "Bancontact",
    klarnapaylater: "Klarna",
    klarna: "Klarna",
    paypal: "PayPal",
    applepay: "Apple Pay",
    eps: "EPS",
    giropay: "Giropay",
    przelewy24: "Przelewy24",
    sofort: "SOFORT",
    belfius: "Belfius",
    kbc: "KBC",
    mybank: "MyBank",
  }
  const paymentMethodLabel = PAYMENT_METHOD_LABELS[paymentMethodRaw] || paymentMethodRaw || ""

  function handleBookSentToggle() {
    updateMetadata.mutate(
      {
        orderId: order.id,
        metadata: {
          book_sent: !bookSent,
          book_sent_at: !bookSent ? new Date().toISOString() : undefined,
        },
      },
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

  // Get product tag from metadata or map from project_id
  const PROJECT_TAG_NAMES: Record<string, string> = {
    dehondenbijbel: "De Hondenbijbel",
    odpusc: "Odpuść",
    "odpusc-ksiazka": "Odpuść",
    slapp: "Släpp taget",
    "slapp-taget": "Släpp taget",
    "psi-superzivot": "Psí superživot",
    "lass-los": "Lass los",
    loslatenboek: "Laat Los Wat Je Kapotmaakt",
  }
  const projectId = order.metadata?.project_id
  const displayTag =
    tag ||
    (projectId && PROJECT_TAG_NAMES[projectId]) ||
    ""

  return (
    <div className="od-card" style={sectionStyle}>
      <div style={sectionTitleStyle}>Order Data</div>

      {/* ═══════════ FULFILLMENT ═══════════ */}

      {/* Book Sent */}
      <div className="od-row-hover" style={rowStyle}>
        <span style={labelStyle}>Book Sent</span>
        <BookSentToggle sent={bookSent} onClick={handleBookSentToggle} />
      </div>

      {/* Tags */}
      <div className="od-row-hover" style={rowStyle}>
        <span style={labelStyle}>Product Tag</span>
        <OrderTag
          tag={displayTag}
          countryCode={order.shipping_address?.country_code}
        />
      </div>

      {/* ═══════════ PAYMENT ═══════════ */}
      <div style={groupTitleStyle}>Payment</div>

      {/* Payment Gateway */}
      <div className="od-row-hover" style={rowStyle}>
        <span style={labelStyle}>Payment Gate</span>
        {paymentGateway ? (
          <span style={valueStyle}>{paymentGateway}</span>
        ) : (
          <span style={dashStyle}>&mdash;</span>
        )}
      </div>

      {/* Payment Method */}
      <div className="od-row-hover" style={rowStyle}>
        <span style={labelStyle}>Payment Method</span>
        {paymentMethodLabel ? (
          <span style={valueStyle}>{paymentMethodLabel}</span>
        ) : (
          <span style={dashStyle}>&mdash;</span>
        )}
      </div>

      {/* Payment Gateway ID */}
      <div className="od-row-hover" style={rowStyle}>
        <span style={labelStyle}>Payment ID</span>
        {gatewayPaymentId ? (
          <code style={codeStyle}>{gatewayPaymentId}</code>
        ) : (
          <span style={dashStyle}>&mdash;</span>
        )}
      </div>

      {/* ═══════════ DEXTRUM WMS ═══════════ */}
      <div style={groupTitleStyle}>Dextrum WMS</div>

      {/* Dextrum Status */}
      <div className="od-row-hover" style={rowStyle}>
        <span style={labelStyle}>Status</span>
        {deliveryStatus ? (
          <DeliveryBadge status={deliveryStatus} />
        ) : (
          <span style={dashStyle}>&mdash;</span>
        )}
      </div>

      {/* Dextrum WMS Order Code */}
      <div className="od-row-hover" style={rowStyle}>
        <span style={labelStyle}>WMS Order</span>
        <span style={valueStyle}>
          {dextrumOrderCode || <span style={dashStyle}>&mdash;</span>}
        </span>
      </div>

      {/* ═══════════ FAKTUROID ═══════════ */}
      <div style={groupTitleStyle}>Fakturoid</div>

      {/* Fakturoid Invoice ID */}
      <div className="od-row-hover" style={rowStyle}>
        <span style={labelStyle}>Invoice ID</span>
        {fakturoidInvoiceId ? (
          <code style={codeStyle}>{fakturoidInvoiceId}</code>
        ) : (
          <span style={dashStyle}>&mdash;</span>
        )}
      </div>

      {/* Fakturoid Invoice Link */}
      <div className="od-row-hover" style={rowStyle}>
        <span style={labelStyle}>Invoice Link</span>
        {fakturoidInvoiceUrl ? (
          <a
            href={fakturoidInvoiceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="od-link"
            style={linkStyle}
          >
            Open in Fakturoid &rarr;
          </a>
        ) : (
          <span style={dashStyle}>&mdash;</span>
        )}
      </div>

      {/* Fakturoid Credit Note */}
      {metadata.fakturoid_credit_note_id && (
        <>
          <div className="od-row-hover" style={rowStyle}>
            <span style={labelStyle}>Credit Note</span>
            <code style={codeStyle}>{metadata.fakturoid_credit_note_id}</code>
          </div>
          {metadata.fakturoid_credit_note_url && (
            <div className="od-row-hover" style={rowStyle}>
              <span style={labelStyle}>Credit Note Link</span>
              <a
                href={metadata.fakturoid_credit_note_url}
                target="_blank"
                rel="noopener noreferrer"
                className="od-link"
                style={linkStyle}
              >
                Open credit note &rarr;
              </a>
            </div>
          )}
        </>
      )}

      {/* ═══════════ QUICKBOOKS ═══════════ */}
      <div style={groupTitleStyle}>QuickBooks</div>

      {/* QuickBooks Invoice ID */}
      <div className="od-row-hover" style={rowStyle}>
        <span style={labelStyle}>Invoice ID</span>
        {quickbooksInvoiceId ? (
          <code style={codeStyle}>{quickbooksInvoiceId}</code>
        ) : (
          <span style={dashStyle}>&mdash;</span>
        )}
      </div>

      {/* QuickBooks Invoice Link */}
      <div className="od-row-hover" style={rowStyle}>
        <span style={labelStyle}>Invoice Link</span>
        {quickbooksInvoiceUrl ? (
          <a
            href={quickbooksInvoiceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="od-link"
            style={linkStyle}
          >
            Open in QuickBooks &rarr;
          </a>
        ) : (
          <span style={dashStyle}>&mdash;</span>
        )}
      </div>

      {/* QuickBooks Credit Memo */}
      {metadata.quickbooks_credit_memo_id && (
        <>
          <div className="od-row-hover" style={rowStyle}>
            <span style={labelStyle}>Credit Memo</span>
            <code style={codeStyle}>{metadata.quickbooks_credit_memo_id}</code>
          </div>
          {metadata.quickbooks_credit_memo_url && (
            <div className="od-row-hover" style={rowStyle}>
              <span style={labelStyle}>Credit Memo Link</span>
              <a
                href={metadata.quickbooks_credit_memo_url}
                target="_blank"
                rel="noopener noreferrer"
                className="od-link"
                style={linkStyle}
              >
                Open credit memo &rarr;
              </a>
            </div>
          )}
        </>
      )}

      {/* ═══════════ UPSELL ═══════════ */}
      {metadata.upsell_accepted && (
        <>
          <div style={groupTitleStyle}>Upsell</div>
          <div style={rowStyle}>
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
                background: colors.greenBg,
                color: colors.green,
              }}
            >
              Yes
            </span>
          </div>
          {metadata.upsell_payment_id && (
            <div style={rowStyle}>
              <span style={labelStyle}>Upsell Payment ID</span>
              <span style={valueStyle}>{String(metadata.upsell_payment_id)}</span>
            </div>
          )}
          {metadata.upsell_accepted_at && (
            <div style={{ ...rowStyle, borderBottom: "none" }}>
              <span style={labelStyle}>Accepted At</span>
              <span style={valueStyle}>
                {new Date(String(metadata.upsell_accepted_at)).toLocaleString("en-GB", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          )}
          {!metadata.upsell_payment_id && !metadata.upsell_accepted_at && (
            <div style={{ height: 0 }} />
          )}
        </>
      )}
    </div>
  )
}
