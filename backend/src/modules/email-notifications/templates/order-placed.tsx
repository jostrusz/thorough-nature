import { Text, Section, Hr, Link } from '@react-email/components'
import * as React from 'react'
import { Base } from './base'

export const ORDER_PLACED = 'order-placed'

export interface OrderPlacedTemplateProps {
  order: any
  shippingAddress: any
  billingAddress?: any
  paymentMethod?: string
  billingEntity?: any
  preview?: string
}

export const isOrderPlacedTemplateData = (data: any): data is OrderPlacedTemplateProps =>
  typeof data.order === 'object' && typeof data.shippingAddress === 'object'

const font = "'Inter', Arial, sans-serif"

function formatPrice(amount: number, currencyCode: string): string {
  try {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: (currencyCode || 'EUR').toUpperCase(),
    }).format(amount)
  } catch {
    return `\u20AC${(amount || 0).toFixed(2).replace('.', ',')}`
  }
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('nl-NL', {
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
    nl: 'Nederland',
    be: 'België',
    de: 'Duitsland',
    fr: 'Frankrijk',
    at: 'Oostenrijk',
    cz: 'Tsjechië',
    sk: 'Slowakije',
    pl: 'Polen',
    gb: 'Verenigd Koninkrijk',
    us: 'Verenigde Staten',
    es: 'Spanje',
    it: 'Italië',
    pt: 'Portugal',
    lu: 'Luxemburg',
  }
  return map[(code || '').toLowerCase()] || (code || '').toUpperCase()
}

export const OrderPlacedTemplate: React.FC<OrderPlacedTemplateProps> & {
  PreviewProps: any
} = ({
  order,
  shippingAddress,
  billingAddress,
  paymentMethod,
  billingEntity,
  preview = 'Bedankt voor je bestelling!',
}) => {
  const currency = order.currency_code || 'eur'
  const items = order.items || []
  const displayId = order.metadata?.custom_order_number || order.display_id || order.id
  const orderDate = formatDate(order.created_at)

  // Calculate totals
  const subtotal = items.reduce(
    (sum: number, item: any) => sum + (item.unit_price || 0) * (item.quantity || 1),
    0
  )
  const shippingTotal = order.summary?.raw_shipping_total?.value ?? order.summary?.shipping_total ?? 0
  const taxTotal = order.summary?.raw_tax_total?.value ?? order.summary?.tax_total ?? 0
  const total = order.summary?.raw_current_order_total?.value ?? order.summary?.current_order_total ?? subtotal + shippingTotal

  const invoiceAddress = billingAddress || shippingAddress

  return (
    <Base preview={preview}>
      <Section>
        {/* HEADER */}
        <div style={{
          backgroundColor: '#2D1B3D',
          background: 'linear-gradient(135deg, #2D1B3D 0%, #1A1028 100%)',
          padding: '36px 40px',
          textAlign: 'center' as const,
          borderRadius: '12px 12px 0 0',
        }}>
          <Text style={{
            fontFamily: font,
            fontSize: '12px',
            fontWeight: 500,
            letterSpacing: '3px',
            textTransform: 'uppercase' as const,
            color: '#C27BA0',
            marginBottom: '10px',
          }}>
            Laat Los Wat Je Kapotmaakt
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '24px',
            fontWeight: 700,
            color: '#ffffff',
            margin: '0',
            lineHeight: '1.3',
          }}>
            Bedankt voor je bestelling!
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '13px',
            color: '#9B7AAD',
            margin: '8px 0 0',
          }}>
            Bestelling #{displayId} &bull; {orderDate}
          </Text>
        </div>

        {/* GREETING */}
        <div style={{ padding: '36px 40px 0 40px' }}>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            color: '#5A3D6B',
            lineHeight: '1.6',
            marginBottom: '8px',
          }}>
            Hoi {shippingAddress?.first_name || 'daar'},
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            color: '#5A3D6B',
            lineHeight: '1.6',
            marginBottom: '0',
          }}>
            Wat fijn dat je de stap hebt gezet! Je bestelling is ontvangen en we gaan er meteen mee aan de slag. Hieronder vind je alles op een rijtje.
          </Text>
        </div>

        {/* ORDER SUMMARY BOX */}
        <div style={{ padding: '24px 40px' }}>
          <div style={{
            backgroundColor: '#FAF5F8',
            borderRadius: '10px',
            border: '1px solid #EDD9E5',
            padding: '20px 24px',
          }}>
            <div style={{ marginBottom: '8px' }}>
              <Text style={{
                fontFamily: font,
                fontSize: '13px',
                color: '#5A3D6B',
                margin: '0',
              }}>
                <strong style={{ color: '#2D1B3D' }}>Bestelling:</strong> &nbsp; #{displayId}
                &nbsp;&nbsp;
                <span style={{
                  backgroundColor: '#e8f5e9',
                  color: '#2e7d32',
                  padding: '3px 10px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: 600,
                  fontFamily: font,
                }}>
                  Bevestigd
                </span>
              </Text>
            </div>
            <Text style={{
              fontFamily: font,
              fontSize: '13px',
              color: '#5A3D6B',
              margin: '0 0 6px',
            }}>
              <strong style={{ color: '#2D1B3D' }}>Datum:</strong> &nbsp; {orderDate}
            </Text>
            {paymentMethod && (
              <Text style={{
                fontFamily: font,
                fontSize: '13px',
                color: '#5A3D6B',
                margin: '0',
              }}>
                <strong style={{ color: '#2D1B3D' }}>Betaalmethode:</strong> &nbsp; {paymentMethod}
              </Text>
            )}
          </div>
        </div>

        {/* ITEMS */}
        <div style={{ padding: '0 40px' }}>
          <Text style={{
            fontFamily: font,
            fontSize: '11px',
            fontWeight: 600,
            textTransform: 'uppercase' as const,
            letterSpacing: '1.5px',
            color: '#9B7AAD',
            marginBottom: '14px',
          }}>
            Je bestelling
          </Text>

          {items.map((item: any) => (
            <div key={item.id} style={{
              marginBottom: '12px',
              backgroundColor: '#FAF5F8',
              borderRadius: '8px',
              border: '1px solid #EDD9E5',
              padding: '14px 16px',
            }}>
              <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ borderCollapse: 'collapse' as const }}>
                <tbody>
                  <tr>
                    <td width="56" valign="top" style={{ paddingRight: '14px' }}>
                      {item.thumbnail ? (
                        <img
                          src={item.thumbnail}
                          alt={item.title || item.product_title}
                          width="56"
                          height="74"
                          style={{
                            width: '56px',
                            height: '74px',
                            objectFit: 'cover' as const,
                            borderRadius: '6px',
                          }}
                        />
                      ) : (
                        <div style={{
                          width: '56px',
                          height: '74px',
                          background: 'linear-gradient(135deg, #2D1B3D, #5A3D6B)',
                          borderRadius: '6px',
                          textAlign: 'center' as const,
                          lineHeight: '74px',
                          fontSize: '28px',
                        }}>
                          📕
                        </div>
                      )}
                    </td>
                    <td valign="top">
                      <Text style={{
                        fontFamily: font,
                        fontSize: '15px',
                        fontWeight: 600,
                        color: '#2D1B3D',
                        margin: '0 0 2px',
                        lineHeight: '1.3',
                      }}>
                        {item.product_title || item.title || 'Item'}
                      </Text>
                      <Text style={{
                        fontFamily: font,
                        fontSize: '12px',
                        color: '#9B7AAD',
                        margin: '0',
                      }}>
                        {item.variant_title ? `${item.variant_title} \u2022 ` : ''}Aantal: {item.quantity || 1}
                      </Text>
                    </td>
                    <td width="80" align="right" valign="top">
                      <Text style={{
                        fontFamily: font,
                        fontSize: '15px',
                        fontWeight: 700,
                        color: '#2D1B3D',
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
          <div style={{ marginTop: '16px', borderTop: '2px solid #EDD9E5', paddingTop: '14px' }}>
            <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ borderCollapse: 'collapse' as const }}>
              <tbody>
                <tr>
                  <td style={{ fontFamily: font, fontSize: '14px', color: '#5A3D6B', padding: '4px 0' }}>Subtotaal</td>
                  <td align="right" style={{ fontFamily: font, fontSize: '14px', color: '#5A3D6B', padding: '4px 0' }}>{formatPrice(subtotal, currency)}</td>
                </tr>
                <tr>
                  <td style={{ fontFamily: font, fontSize: '14px', color: '#5A3D6B', padding: '4px 0' }}>Verzendkosten</td>
                  <td align="right" style={{ fontFamily: font, fontSize: '14px', color: shippingTotal > 0 ? '#5A3D6B' : '#2e7d32', padding: '4px 0' }}>
                    {shippingTotal > 0 ? formatPrice(shippingTotal, currency) : 'Gratis'}
                  </td>
                </tr>
                {taxTotal > 0 && (
                  <tr>
                    <td style={{ fontFamily: font, fontSize: '12px', color: '#9B7AAD', padding: '4px 0' }}>Waarvan BTW</td>
                    <td align="right" style={{ fontFamily: font, fontSize: '12px', color: '#9B7AAD', padding: '4px 0' }}>{formatPrice(taxTotal, currency)}</td>
                  </tr>
                )}
                <tr>
                  <td style={{ fontFamily: font, fontSize: '18px', fontWeight: 700, color: '#2D1B3D', padding: '12px 0 0', borderTop: '1px solid #EDD9E5' }}>Totaal</td>
                  <td align="right" style={{ fontFamily: font, fontSize: '18px', fontWeight: 700, color: '#2D1B3D', padding: '12px 0 0', borderTop: '1px solid #EDD9E5' }}>{formatPrice(total, currency)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* E-BOOK NOTICE */}
        <div style={{ padding: '24px 40px 0 40px' }}>
          <div style={{
            backgroundColor: '#E8F5E9',
            borderRadius: '8px',
            border: '1px solid #A5D6A7',
            padding: '14px 20px',
            textAlign: 'center' as const,
          }}>
            <Text style={{
              fontFamily: font,
              fontSize: '13px',
              color: '#2E7D32',
              margin: '0',
              lineHeight: '1.5',
            }}>
              📖 &nbsp; <strong>Je e-book is onderweg!</strong> Je ontvangt binnen enkele minuten een aparte e-mail met de download-link.
            </Text>
          </div>
        </div>

        {/* DELIVERY ESTIMATE */}
        <div style={{ padding: '16px 40px 0 40px' }}>
          <div style={{
            backgroundColor: '#FFF8E1',
            borderRadius: '8px',
            border: '1px solid #FFE082',
            padding: '14px 20px',
            textAlign: 'center' as const,
          }}>
            <Text style={{
              fontFamily: font,
              fontSize: '13px',
              color: '#795548',
              margin: '0',
              lineHeight: '1.5',
            }}>
              📦 &nbsp; <strong>Verwachte levering:</strong> 4–7 werkdagen
            </Text>
            <Text style={{
              fontFamily: font,
              fontSize: '12px',
              color: '#9e9e9e',
              margin: '6px 0 0',
              lineHeight: '1.5',
            }}>
              Onze boeken worden verzonden vanuit ons centrale magazijn in Tsjechië, van waaruit we heel Europa bedienen.
            </Text>
          </div>
        </div>

        {/* ADDRESSES */}
        <div style={{ padding: '28px 40px 0 40px' }}>
          <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ borderCollapse: 'collapse' as const }}>
            <tbody>
              <tr>
                <td width="50%" valign="top" style={{ paddingRight: '12px' }}>
                  <Text style={{
                    fontFamily: font,
                    fontSize: '11px',
                    fontWeight: 600,
                    textTransform: 'uppercase' as const,
                    letterSpacing: '1.5px',
                    color: '#9B7AAD',
                    marginBottom: '10px',
                  }}>
                    Bezorgadres
                  </Text>
                  <Text style={{
                    fontFamily: font,
                    fontSize: '14px',
                    color: '#5A3D6B',
                    lineHeight: '1.6',
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
                    fontSize: '11px',
                    fontWeight: 600,
                    textTransform: 'uppercase' as const,
                    letterSpacing: '1.5px',
                    color: '#9B7AAD',
                    marginBottom: '10px',
                  }}>
                    Factuuradres
                  </Text>
                  <Text style={{
                    fontFamily: font,
                    fontSize: '14px',
                    color: '#5A3D6B',
                    lineHeight: '1.6',
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

        <Hr style={{ borderColor: '#EDD9E5', margin: '24px 40px 0 40px' }} />

        {/* WHAT HAPPENS NEXT */}
        <div style={{ padding: '24px 40px 0 40px' }}>
          <Text style={{
            fontFamily: font,
            fontSize: '11px',
            fontWeight: 600,
            textTransform: 'uppercase' as const,
            letterSpacing: '1.5px',
            color: '#9B7AAD',
            marginBottom: '16px',
          }}>
            Wat gebeurt er nu?
          </Text>

          <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ borderCollapse: 'collapse' as const, marginBottom: '14px' }}>
            <tbody>
              <tr>
                <td width="36" valign="top">
                  <div style={{
                    width: '28px',
                    height: '28px',
                    backgroundColor: '#C27BA0',
                    borderRadius: '50%',
                    textAlign: 'center' as const,
                    lineHeight: '28px',
                    fontFamily: font,
                    fontSize: '13px',
                    fontWeight: 700,
                    color: '#ffffff',
                  }}>1</div>
                </td>
                <td style={{ fontFamily: font, fontSize: '14px', color: '#5A3D6B', lineHeight: '1.5', paddingLeft: '8px' }}>
                  <strong style={{ color: '#2D1B3D' }}>Bestelling verwerkt</strong>
                  <br />
                  We maken je bestelling klaar voor verzending.
                </td>
              </tr>
            </tbody>
          </table>

          <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ borderCollapse: 'collapse' as const, marginBottom: '14px' }}>
            <tbody>
              <tr>
                <td width="36" valign="top">
                  <div style={{
                    width: '28px',
                    height: '28px',
                    backgroundColor: '#D498B5',
                    borderRadius: '50%',
                    textAlign: 'center' as const,
                    lineHeight: '28px',
                    fontFamily: font,
                    fontSize: '13px',
                    fontWeight: 700,
                    color: '#ffffff',
                  }}>2</div>
                </td>
                <td style={{ fontFamily: font, fontSize: '14px', color: '#5A3D6B', lineHeight: '1.5', paddingLeft: '8px' }}>
                  <strong style={{ color: '#2D1B3D' }}>Verzonden</strong>
                  <br />
                  Zodra je pakket is verzonden, ontvang je direct een e-mail met je track &amp; trace code.
                </td>
              </tr>
            </tbody>
          </table>

          <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ borderCollapse: 'collapse' as const, marginBottom: '8px' }}>
            <tbody>
              <tr>
                <td width="36" valign="top">
                  <div style={{
                    width: '28px',
                    height: '28px',
                    backgroundColor: '#EDD9E5',
                    borderRadius: '50%',
                    textAlign: 'center' as const,
                    lineHeight: '28px',
                    fontFamily: font,
                    fontSize: '13px',
                    fontWeight: 700,
                    color: '#2D1B3D',
                  }}>3</div>
                </td>
                <td style={{ fontFamily: font, fontSize: '14px', color: '#5A3D6B', lineHeight: '1.5', paddingLeft: '8px' }}>
                  <strong style={{ color: '#2D1B3D' }}>Bezorgd</strong>
                  <br />
                  Binnen 4–7 werkdagen heb je jouw boek in huis.
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* HELP SECTION */}
        <div style={{ padding: '28px 40px 0 40px' }}>
          <div style={{
            backgroundColor: '#FAF5F8',
            borderRadius: '10px',
            border: '1px solid #EDD9E5',
            padding: '20px 24px',
            textAlign: 'center' as const,
          }}>
            <Text style={{
              fontFamily: font,
              fontSize: '14px',
              color: '#5A3D6B',
              lineHeight: '1.6',
              margin: '0',
            }}>
              Vragen over je bestelling? Stuur een mailtje naar
              <br />
              <Link href="mailto:devries@loslatenboek.nl" style={{ color: '#C27BA0', textDecoration: 'underline', fontWeight: 600 }}>
                devries@loslatenboek.nl
              </Link>
            </Text>
          </div>
        </div>

        {/* SIGNATURE */}
        <div style={{ padding: '24px 40px 28px 40px' }}>
          <Text style={{
            fontFamily: font,
            fontSize: '14px',
            color: '#5A3D6B',
            marginBottom: '4px',
          }}>
            Warme groet,
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '14px',
            fontWeight: 700,
            color: '#2D1B3D',
            marginBottom: '2px',
          }}>
            Joris de Vries
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '12px',
            color: '#9B7AAD',
          }}>
            <Link href="mailto:devries@loslatenboek.nl" style={{ color: '#C27BA0', textDecoration: 'none' }}>
              devries@loslatenboek.nl
            </Link>
          </Text>
        </div>

        {/* FOOTER */}
        <div style={{
          backgroundColor: '#2D1B3D',
          padding: '28px 40px',
          textAlign: 'center' as const,
          borderRadius: '0 0 12px 12px',
        }}>
          <Text style={{
            fontFamily: font,
            fontSize: '12px',
            color: '#C27BA0',
            marginBottom: '8px',
          }}>
            Laat Los Wat Je Kapotmaakt
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '11px',
            color: '#7a6189',
            lineHeight: '1.6',
            marginBottom: '8px',
          }}>
            {billingEntity?.legal_name || 'EverChapter OÜ'}
            {' '}&bull;{' '}
            {billingEntity?.address
              ? `${billingEntity.address.address_1 || ''}, ${billingEntity.address.postal_code || ''} ${billingEntity.address.city || ''}${billingEntity.address.district ? ', ' + billingEntity.address.district : ''}`
              : 'Tallinn, Estonia'}
            {billingEntity?.registration_id && (
              <>
                <br />
                Reg. nr: {billingEntity.registration_id}
              </>
            )}
            {!billingEntity && (
              <>
                <br />
                Reg. nr: 16938029
              </>
            )}
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '11px',
            color: '#7a6189',
            lineHeight: '1.5',
            margin: '0',
          }}>
            Je ontvangt deze e-mail omdat je een bestelling hebt geplaatst.
          </Text>
        </div>
      </Section>
    </Base>
  )
}

OrderPlacedTemplate.PreviewProps = {
  order: {
    id: 'test-order-id',
    display_id: '1047',
    created_at: new Date().toISOString(),
    email: 'emma@voorbeeld.nl',
    currency_code: 'eur',
    items: [
      {
        id: 'item-1',
        title: 'Laat Los Wat Je Kapotmaakt',
        product_title: 'Laat Los Wat Je Kapotmaakt',
        variant_title: 'Paperback + E-book',
        quantity: 1,
        unit_price: 24.95,
        thumbnail: null,
      },
      {
        id: 'item-2',
        title: 'Werkboek: Oefeningen voor Loslaten',
        product_title: 'Werkboek: Oefeningen voor Loslaten',
        variant_title: 'Paperback',
        quantity: 1,
        unit_price: 14.95,
        thumbnail: null,
      },
    ],
    summary: {
      raw_current_order_total: { value: 44.85 },
      raw_shipping_total: { value: 4.95 },
      raw_tax_total: { value: 7.78 },
    },
  },
  shippingAddress: {
    first_name: 'Emma',
    last_name: 'van der Berg',
    address_1: 'Keizersgracht 412',
    city: 'Amsterdam',
    postal_code: '1016 GC',
    country_code: 'nl',
  },
  billingAddress: {
    first_name: 'Emma',
    last_name: 'van der Berg',
    address_1: 'Keizersgracht 412',
    city: 'Amsterdam',
    postal_code: '1016 GC',
    country_code: 'nl',
  },
  paymentMethod: 'iDEAL (ING Bank)',
} as any

export default OrderPlacedTemplate
