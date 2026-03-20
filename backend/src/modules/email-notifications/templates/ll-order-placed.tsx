import { Text, Section, Hr, Link, Img } from '@react-email/components'
import * as React from 'react'
import { Base } from './base'

export const LL_ORDER_PLACED = 'll-order-placed'

export interface LlOrderPlacedTemplateProps {
  order: any
  shippingAddress: any
  billingAddress?: any
  paymentMethod?: string
  billingEntity?: any
  preview?: string
}

export const isLlOrderPlacedTemplateData = (data: any): data is LlOrderPlacedTemplateProps =>
  typeof data.order === 'object' && typeof data.shippingAddress === 'object'

const font = "'Inter', 'Segoe UI', Arial, sans-serif"
const pad = '28px'
const padLR = `0 ${pad}`

// Lass Los Brand colors — Velvet Dusk palette
const colors = {
  headerBg: '#2D1B3D',
  headerGradient: 'linear-gradient(135deg, #5A3D6B 0%, #2D1B3D 50%, #1A1028 100%)',
  accent: '#C27BA0',
  accentLight: '#D498B5',
  accentSoft: '#FAF5F8',
  accentMuted: '#D9A4C0',
  textDark: '#1A1028',
  textBody: '#3F3F46',
  textMuted: '#71717A',
  textLight: '#A1A1AA',
  boxBg: '#FAFAFA',
  boxBorder: '#EDD9E5',
  cardBg: '#FFFFFF',
  footerBg: '#1A1028',
  footerText: '#A1A1AA',
  footerAccent: '#C27BA0',
  greenBg: '#F0FDF4',
  greenBorder: '#BBF7D0',
  greenText: '#166534',
  amberBg: '#FFFBEB',
  amberBorder: '#FDE68A',
  amberText: '#92400E',
  divider: '#EDD9E5',
  white: '#FFFFFF',
}

function formatPrice(amount: number, currencyCode: string): string {
  try {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: (currencyCode || 'EUR').toUpperCase(),
    }).format(amount)
  } catch {
    return `\u20AC${(amount || 0).toFixed(2).replace('.', ',')}`
  }
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('de-DE', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return dateStr
  }
}

function formatCountry(code: string): string {
  const map: Record<string, string> = {
    de: 'Deutschland',
    at: 'Österreich',
    lu: 'Luxemburg',
    ch: 'Schweiz',
    nl: 'Niederlande',
    be: 'Belgien',
    fr: 'Frankreich',
    cz: 'Tschechien',
    sk: 'Slowakei',
    pl: 'Polen',
    gb: 'Vereinigtes Königreich',
    us: 'Vereinigte Staaten',
    es: 'Spanien',
    it: 'Italien',
    pt: 'Portugal',
  }
  return map[(code || '').toLowerCase()] || (code || '').toUpperCase()
}

export const LlOrderPlacedTemplate: React.FC<LlOrderPlacedTemplateProps> & {
  PreviewProps: any
} = ({
  order,
  shippingAddress,
  billingAddress,
  paymentMethod,
  billingEntity,
  preview = 'Danke für deine Bestellung bei Lass los, was dich kaputt macht!',
}) => {
  const currency = order.currency_code || 'eur'
  const items = order.items || []
  const rawDisplayId = order.display_id || order.id
  const displayId = order.metadata?.custom_order_number || (() => {
    const cc = (shippingAddress?.country_code || billingAddress?.country_code || 'de').toUpperCase()
    const year = new Date().getFullYear()
    return `${cc}${year}-${rawDisplayId}`
  })()
  const orderDate = formatDate(order.created_at)

  const subtotal = items.reduce(
    (sum: number, item: any) => sum + (item.unit_price || 0) * (item.quantity || 1),
    0
  )
  const shippingTotal = order.summary?.raw_shipping_total?.value ?? order.summary?.shipping_total ?? 0
  const taxTotal = order.summary?.raw_tax_total?.value ?? order.summary?.tax_total ?? 0
  const total = order.summary?.raw_current_order_total?.value ?? order.summary?.current_order_total ?? subtotal + shippingTotal

  const invoiceAddress = billingAddress || shippingAddress

  const entityName = billingEntity?.legal_name || 'Performance Marketing Solution s.r.o.'
  const entityAddress = billingEntity?.address
    ? `${billingEntity.address.city || 'Praha'}, ${billingEntity.address.district || billingEntity.address.country_code?.toUpperCase() || 'Tschechien'}`
    : 'Rybná 716/24, Staré Město, 110 00 Praha'
  const entityRegId = billingEntity?.registration_id || '17255679'

  return (
    <Base preview={preview}>
      <Section>
        {/* ====== HEADER ====== */}
        <div style={{
          backgroundColor: colors.headerBg,
          background: colors.headerGradient,
          padding: '40px 28px 36px',
          textAlign: 'center' as const,
          borderRadius: '0',
        }}>
          <Text style={{
            fontFamily: font,
            fontSize: '11px',
            fontWeight: 600,
            letterSpacing: '3px',
            textTransform: 'uppercase' as const,
            color: 'rgba(255,255,255,0.75)',
            marginBottom: '10px',
            margin: '0 0 10px 0',
          }}>
            Lass los, was dich kaputt macht
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '26px',
            fontWeight: 800,
            color: '#ffffff',
            margin: '0 0 8px 0',
            lineHeight: '1.2',
            letterSpacing: '-0.02em',
          }}>
            Danke für deine Bestellung!
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '13px',
            color: 'rgba(255,255,255,0.7)',
            margin: '0',
          }}>
            Bestellung {displayId} &bull; {orderDate}
          </Text>
        </div>

        {/* ====== STATUS BADGE ====== */}
        <div style={{ padding: `24px ${pad} 0`, textAlign: 'center' as const }}>
          <div style={{
            display: 'inline-block',
            backgroundColor: colors.greenBg,
            border: `1px solid ${colors.greenBorder}`,
            borderRadius: '20px',
            padding: '6px 18px',
          }}>
            <Text style={{
              fontFamily: font,
              fontSize: '13px',
              fontWeight: 600,
              color: colors.greenText,
              margin: '0',
            }}>
              &#10003; Bestellung bestätigt
            </Text>
          </div>
        </div>

        {/* ====== GREETING ====== */}
        <div style={{ padding: `24px ${pad} 0` }}>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            color: colors.textBody,
            lineHeight: '1.7',
            margin: '0',
          }}>
            Hallo {shippingAddress?.first_name || 'dort'},
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            color: colors.textBody,
            lineHeight: '1.7',
            margin: '8px 0 0',
          }}>
            Schön, dass du dich für „Lass los, was dich kaputt macht" entschieden hast! Deine Bestellung ist bestätigt und wir kümmern uns sofort darum. Hier findest du eine Übersicht.
          </Text>
        </div>

        {/* ====== ORDER DETAILS BOX ====== */}
        <div style={{ padding: `20px ${pad}` }}>
          <div style={{
            backgroundColor: colors.boxBg,
            borderRadius: '12px',
            border: `1px solid ${colors.boxBorder}`,
            padding: '18px 22px',
          }}>
            <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ borderCollapse: 'collapse' as const }}>
              <tbody>
                <tr>
                  <td style={{ fontFamily: font, fontSize: '13px', color: colors.textMuted, padding: '3px 0' }}>Bestellung</td>
                  <td align="right" style={{ fontFamily: font, fontSize: '13px', fontWeight: 600, color: colors.textDark, padding: '3px 0' }}>{displayId}</td>
                </tr>
                <tr>
                  <td style={{ fontFamily: font, fontSize: '13px', color: colors.textMuted, padding: '3px 0' }}>Datum</td>
                  <td align="right" style={{ fontFamily: font, fontSize: '13px', color: colors.textDark, padding: '3px 0' }}>{orderDate}</td>
                </tr>
                {paymentMethod && (
                  <tr>
                    <td style={{ fontFamily: font, fontSize: '13px', color: colors.textMuted, padding: '3px 0' }}>Zahlungsart</td>
                    <td align="right" style={{ fontFamily: font, fontSize: '13px', color: colors.textDark, padding: '3px 0' }}>{paymentMethod}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ====== ITEMS ====== */}
        <div style={{ padding: padLR }}>
          <Text style={{
            fontFamily: font,
            fontSize: '12px',
            fontWeight: 700,
            textTransform: 'uppercase' as const,
            letterSpacing: '1px',
            color: colors.accent,
            marginBottom: '14px',
          }}>
            Deine Bestellung
          </Text>

          {items.map((item: any) => (
            <div key={item.id} style={{
              marginBottom: '12px',
              backgroundColor: colors.cardBg,
              borderRadius: '12px',
              border: `1px solid ${colors.boxBorder}`,
              padding: '14px 16px',
            }}>
              <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ borderCollapse: 'collapse' as const }}>
                <tbody>
                  <tr>
                    <td width="60" valign="top" style={{ paddingRight: '14px' }}>
                      {item.thumbnail ? (
                        <Img
                          src={item.thumbnail}
                          alt={item.title || item.product_title}
                          width="60"
                          height="76"
                          style={{
                            width: '60px',
                            height: '76px',
                            objectFit: 'cover' as const,
                            borderRadius: '8px',
                            border: `1px solid ${colors.boxBorder}`,
                          }}
                        />
                      ) : (
                        <div style={{
                          width: '60px',
                          height: '76px',
                          background: `linear-gradient(145deg, ${colors.accentSoft}, ${colors.accentMuted})`,
                          borderRadius: '8px',
                          border: `1px solid ${colors.boxBorder}`,
                          textAlign: 'center' as const,
                          lineHeight: '76px',
                          fontSize: '28px',
                        }}>
                          &#128214;
                        </div>
                      )}
                    </td>
                    <td valign="middle">
                      <Text style={{
                        fontFamily: font,
                        fontSize: '15px',
                        fontWeight: 700,
                        color: colors.textDark,
                        margin: '0 0 4px',
                        lineHeight: '1.3',
                      }}>
                        {item.product_title || item.title || 'Artikel'}
                      </Text>
                      <Text style={{
                        fontFamily: font,
                        fontSize: '12px',
                        color: colors.textMuted,
                        margin: '0',
                      }}>
                        {item.variant_title ? `${item.variant_title} \u2022 ` : ''}Anzahl: {item.quantity || 1}
                      </Text>
                    </td>
                    <td width="80" align="right" valign="middle">
                      <Text style={{
                        fontFamily: font,
                        fontSize: '16px',
                        fontWeight: 800,
                        color: colors.textDark,
                        margin: '0',
                      }}>
                        {formatPrice((item.unit_price || 0) * (item.quantity || 1), currency)}
                      </Text>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          ))}

          {/* Totals */}
          <div style={{
            marginTop: '16px',
            borderTop: `2px solid ${colors.boxBorder}`,
            paddingTop: '14px',
          }}>
            <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ borderCollapse: 'collapse' as const }}>
              <tbody>
                <tr>
                  <td style={{ fontFamily: font, fontSize: '13px', color: colors.textBody, padding: '4px 0' }}>Zwischensumme</td>
                  <td align="right" style={{ fontFamily: font, fontSize: '13px', color: colors.textBody, padding: '4px 0' }}>{formatPrice(subtotal, currency)}</td>
                </tr>
                <tr>
                  <td style={{ fontFamily: font, fontSize: '13px', color: colors.textBody, padding: '4px 0' }}>Versandkosten</td>
                  <td align="right" style={{ fontFamily: font, fontSize: '13px', color: shippingTotal > 0 ? colors.textBody : colors.greenText, fontWeight: shippingTotal > 0 ? 400 : 600, padding: '4px 0' }}>
                    {shippingTotal > 0 ? formatPrice(shippingTotal, currency) : 'Kostenlos'}
                  </td>
                </tr>
                {taxTotal > 0 && (
                  <tr>
                    <td style={{ fontFamily: font, fontSize: '12px', color: colors.textLight, padding: '4px 0' }}>davon MwSt.</td>
                    <td align="right" style={{ fontFamily: font, fontSize: '12px', color: colors.textLight, padding: '4px 0' }}>{formatPrice(taxTotal, currency)}</td>
                  </tr>
                )}
                <tr>
                  <td colSpan={2} style={{ paddingTop: '8px' }}>
                    <div style={{ borderTop: `1px solid ${colors.boxBorder}` }}></div>
                  </td>
                </tr>
                <tr>
                  <td style={{ fontFamily: font, fontSize: '18px', fontWeight: 800, color: colors.textDark, padding: '10px 0 0' }}>Gesamt</td>
                  <td align="right" style={{ fontFamily: font, fontSize: '18px', fontWeight: 800, color: colors.textDark, padding: '10px 0 0' }}>{formatPrice(total, currency)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* ====== E-BOOK NOTICE ====== */}
        <div style={{ padding: `24px ${pad} 0` }}>
          <div style={{
            backgroundColor: colors.greenBg,
            borderRadius: '12px',
            border: `1px solid ${colors.greenBorder}`,
            padding: '14px 18px',
            textAlign: 'center' as const,
          }}>
            <Text style={{
              fontFamily: font,
              fontSize: '14px',
              color: colors.greenText,
              margin: '0',
              lineHeight: '1.6',
            }}>
              &#128214; &nbsp;<strong>Deine E-Books sind unterwegs!</strong>
              <br />
              <span style={{ fontSize: '13px' }}>Du erhältst in wenigen Minuten eine separate E-Mail mit dem Download-Link.</span>
            </Text>
          </div>
        </div>

        {/* ====== DELIVERY ESTIMATE ====== */}
        <div style={{ padding: `12px ${pad} 0` }}>
          <div style={{
            backgroundColor: colors.amberBg,
            borderRadius: '12px',
            border: `1px solid ${colors.amberBorder}`,
            padding: '14px 18px',
            textAlign: 'center' as const,
          }}>
            <Text style={{
              fontFamily: font,
              fontSize: '14px',
              color: colors.amberText,
              margin: '0',
              lineHeight: '1.5',
            }}>
              &#128230; &nbsp;<strong>Voraussichtliche Lieferung: 3–5 Werktage</strong>
            </Text>
            <Text style={{
              fontFamily: font,
              fontSize: '12px',
              color: colors.textMuted,
              margin: '6px 0 0',
              lineHeight: '1.5',
            }}>
              Unsere Bücher werden aus unserem Zentrallager in Tschechien per GLS versendet.
            </Text>
          </div>
        </div>

        {/* ====== ADDRESSES ====== */}
        <div style={{ padding: `28px ${pad} 0` }}>
          <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ borderCollapse: 'collapse' as const }}>
            <tbody>
              <tr>
                <td width="50%" valign="top" style={{ paddingRight: '12px' }}>
                  <Text style={{
                    fontFamily: font,
                    fontSize: '12px',
                    fontWeight: 700,
                    textTransform: 'uppercase' as const,
                    letterSpacing: '1px',
                    color: colors.accent,
                    marginBottom: '10px',
                  }}>
                    Lieferadresse
                  </Text>
                  <Text style={{
                    fontFamily: font,
                    fontSize: '13px',
                    color: colors.textBody,
                    lineHeight: '1.7',
                    margin: '0',
                  }}>
                    {shippingAddress?.first_name} {shippingAddress?.last_name}
                    <br />
                    {shippingAddress?.address_1}
                    <br />
                    {shippingAddress?.postal_code} {shippingAddress?.city}
                    <br />
                    {formatCountry(shippingAddress?.country_code)}
                  </Text>
                </td>
                <td width="50%" valign="top" style={{ paddingLeft: '12px' }}>
                  <Text style={{
                    fontFamily: font,
                    fontSize: '12px',
                    fontWeight: 700,
                    textTransform: 'uppercase' as const,
                    letterSpacing: '1px',
                    color: colors.accent,
                    marginBottom: '10px',
                  }}>
                    Rechnungsadresse
                  </Text>
                  <Text style={{
                    fontFamily: font,
                    fontSize: '13px',
                    color: colors.textBody,
                    lineHeight: '1.7',
                    margin: '0',
                  }}>
                    {invoiceAddress?.first_name} {invoiceAddress?.last_name}
                    <br />
                    {invoiceAddress?.address_1}
                    <br />
                    {invoiceAddress?.postal_code} {invoiceAddress?.city}
                    <br />
                    {formatCountry(invoiceAddress?.country_code)}
                  </Text>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <Hr style={{ borderColor: colors.divider, margin: `24px ${pad} 0` }} />

        {/* ====== WHAT HAPPENS NEXT ====== */}
        <div style={{ padding: `24px ${pad} 0` }}>
          <Text style={{
            fontFamily: font,
            fontSize: '12px',
            fontWeight: 700,
            textTransform: 'uppercase' as const,
            letterSpacing: '1px',
            color: colors.accent,
            marginBottom: '18px',
          }}>
            Wie geht es weiter?
          </Text>

          {/* Step 1 */}
          <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ borderCollapse: 'collapse' as const, marginBottom: '16px' }}>
            <tbody>
              <tr>
                <td width="38" valign="top">
                  <div style={{
                    width: '28px',
                    height: '28px',
                    backgroundColor: colors.accent,
                    borderRadius: '50%',
                    textAlign: 'center' as const,
                    lineHeight: '28px',
                    fontFamily: font,
                    fontSize: '13px',
                    fontWeight: 700,
                    color: '#ffffff',
                  }}>1</div>
                </td>
                <td style={{ fontFamily: font, fontSize: '14px', color: colors.textBody, lineHeight: '1.6', paddingLeft: '6px' }}>
                  <strong style={{ color: colors.textDark }}>Bestellung wird bearbeitet</strong>
                  <br />
                  <span style={{ fontSize: '13px', color: colors.textMuted }}>Wir bereiten deine Bestellung für den Versand vor.</span>
                </td>
              </tr>
            </tbody>
          </table>

          {/* Step 2 */}
          <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ borderCollapse: 'collapse' as const, marginBottom: '16px' }}>
            <tbody>
              <tr>
                <td width="38" valign="top">
                  <div style={{
                    width: '28px',
                    height: '28px',
                    backgroundColor: colors.accentMuted,
                    borderRadius: '50%',
                    textAlign: 'center' as const,
                    lineHeight: '28px',
                    fontFamily: font,
                    fontSize: '13px',
                    fontWeight: 700,
                    color: '#ffffff',
                  }}>2</div>
                </td>
                <td style={{ fontFamily: font, fontSize: '14px', color: colors.textBody, lineHeight: '1.6', paddingLeft: '6px' }}>
                  <strong style={{ color: colors.textDark }}>Versendet</strong>
                  <br />
                  <span style={{ fontSize: '13px', color: colors.textMuted }}>Du erhältst eine E-Mail mit deiner Sendungsverfolgungsnummer.</span>
                </td>
              </tr>
            </tbody>
          </table>

          {/* Step 3 */}
          <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ borderCollapse: 'collapse' as const, marginBottom: '4px' }}>
            <tbody>
              <tr>
                <td width="38" valign="top">
                  <div style={{
                    width: '28px',
                    height: '28px',
                    backgroundColor: colors.accentLight,
                    borderRadius: '50%',
                    textAlign: 'center' as const,
                    lineHeight: '28px',
                    fontFamily: font,
                    fontSize: '13px',
                    fontWeight: 700,
                    color: colors.accent,
                  }}>3</div>
                </td>
                <td style={{ fontFamily: font, fontSize: '14px', color: colors.textBody, lineHeight: '1.6', paddingLeft: '6px' }}>
                  <strong style={{ color: colors.textDark }}>Zugestellt</strong>
                  <br />
                  <span style={{ fontSize: '13px', color: colors.textMuted }}>Innerhalb von 3–5 Werktagen hast du dein Buch in der Hand.</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ====== HELP SECTION ====== */}
        <div style={{ padding: `28px ${pad} 0` }}>
          <div style={{
            backgroundColor: colors.accentSoft,
            borderRadius: '12px',
            border: `1px solid ${colors.boxBorder}`,
            padding: '18px 22px',
            textAlign: 'center' as const,
          }}>
            <Text style={{
              fontFamily: font,
              fontSize: '14px',
              color: colors.textBody,
              lineHeight: '1.6',
              margin: '0',
            }}>
              Fragen zu deiner Bestellung?
              <br />
              <Link href="mailto:buch@lasslosbuch.de" style={{ color: colors.accent, textDecoration: 'underline', fontWeight: 700 }}>
                buch@lasslosbuch.de
              </Link>
            </Text>
          </div>
        </div>

        {/* ====== SIGNATURE ====== */}
        <div style={{ padding: `24px ${pad} 28px` }}>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            color: colors.textBody,
            margin: '0 0 4px',
          }}>
            Herzliche Grüße,
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            fontWeight: 700,
            color: colors.textDark,
            margin: '0 0 2px',
          }}>
            Joris de Vries
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '13px',
            color: colors.textMuted,
            margin: '0',
          }}>
            <Link href="mailto:buch@lasslosbuch.de" style={{ color: colors.accent, textDecoration: 'none' }}>
              buch@lasslosbuch.de
            </Link>
          </Text>
        </div>

        {/* ====== FOOTER ====== */}
        <div style={{
          backgroundColor: colors.footerBg,
          padding: '28px 28px',
          textAlign: 'center' as const,
          borderRadius: '0',
        }}>
          <Text style={{
            fontFamily: font,
            fontSize: '13px',
            fontWeight: 700,
            color: colors.footerAccent,
            margin: '0 0 8px',
            letterSpacing: '0.5px',
          }}>
            Lass los, was dich kaputt macht
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '11px',
            color: colors.footerText,
            lineHeight: '1.7',
            margin: '0 0 8px',
          }}>
            {entityName} &bull; {entityAddress}
            <br />
            Reg. Nr: {entityRegId}
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '11px',
            color: '#71717A',
            lineHeight: '1.5',
            margin: '0',
          }}>
            Du erhältst diese E-Mail, weil du eine Bestellung auf lasslosbuch.de aufgegeben hast.
          </Text>
        </div>
      </Section>
    </Base>
  )
}

LlOrderPlacedTemplate.PreviewProps = {
  order: {
    id: 'test-order-id',
    display_id: '77',
    metadata: { custom_order_number: 'LU2026-77' },
    created_at: new Date().toISOString(),
    email: 'maria@beispiel.de',
    currency_code: 'eur',
    items: [
      {
        id: 'item-1',
        title: 'Lass los, was dich kaputt macht',
        product_title: 'Lass los, was dich kaputt macht',
        variant_title: 'Hardcover + E-Book',
        quantity: 1,
        unit_price: 35,
        thumbnail: null,
      },
    ],
    summary: {
      raw_current_order_total: { value: 35 },
      raw_shipping_total: { value: 0 },
      raw_tax_total: { value: 5.59 },
    },
  },
  shippingAddress: {
    first_name: 'Maria',
    last_name: 'Schneider',
    address_1: 'Hauptstraße 42',
    city: 'Berlin',
    postal_code: '10115',
    country_code: 'de',
  },
  billingAddress: {
    first_name: 'Maria',
    last_name: 'Schneider',
    address_1: 'Hauptstraße 42',
    city: 'Berlin',
    postal_code: '10115',
    country_code: 'de',
  },
  paymentMethod: 'PayPal',
  billingEntity: {
    legal_name: 'Performance Marketing Solution s.r.o.',
    registration_id: '17255679',
    address: {
      city: 'Praha',
      district: 'Tschechien',
    },
  },
} as any

export default LlOrderPlacedTemplate
