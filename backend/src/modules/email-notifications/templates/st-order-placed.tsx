import { Text, Section, Hr, Link, Img } from '@react-email/components'
import * as React from 'react'
import { Base } from './base'

export const ST_ORDER_PLACED = 'st-order-placed'

export interface StOrderPlacedTemplateProps {
  order: any
  shippingAddress: any
  billingAddress?: any
  paymentMethod?: string
  billingEntity?: any
  preview?: string
}

export const isStOrderPlacedTemplateData = (data: any): data is StOrderPlacedTemplateProps =>
  typeof data.order === 'object' && typeof data.shippingAddress === 'object'

const font = "'Inter', 'Segoe UI', Arial, sans-serif"
const pad = '28px'
const padLR = `0 ${pad}`

// ST Brand colors — deep purple/mauve palette
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
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: (currencyCode || 'SEK').toUpperCase(),
    }).format(amount)
  } catch {
    return `${(amount || 0).toFixed(2)} kr`
  }
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('sv-SE', {
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
    se: 'Sverige', no: 'Norge', dk: 'Danmark', fi: 'Finland',
    de: 'Tyskland', nl: 'Nederländerna', be: 'Belgien', fr: 'Frankrike',
    at: 'Österrike', cz: 'Tjeckien', sk: 'Slovakien', pl: 'Polen',
    gb: 'Storbritannien', us: 'USA', es: 'Spanien', it: 'Italien',
    pt: 'Portugal', lu: 'Luxemburg', ee: 'Estland',
  }
  return map[(code || '').toLowerCase()] || (code || '').toUpperCase()
}

export const StOrderPlacedTemplate: React.FC<StOrderPlacedTemplateProps> & {
  PreviewProps: any
} = ({
  order,
  shippingAddress,
  billingAddress,
  paymentMethod,
  billingEntity,
  preview = 'Tack för din beställning!',
}) => {
  const currency = order.currency_code || 'sek'
  const items = order.items || []
  const displayId = order.metadata?.custom_order_number || order.display_id || order.id
  const orderDate = formatDate(order.created_at)

  const subtotal = items.reduce(
    (sum: number, item: any) => sum + (item.unit_price || 0) * (item.quantity || 1),
    0
  )
  // Use non-raw summary values (major units) — raw_* values can be in minor units (cents/haléře)
  const shippingTotal = order.summary?.shipping_total ?? 0
  const taxTotal = order.summary?.tax_total ?? 0
  const total = order.summary?.current_order_total ?? subtotal + shippingTotal

  const invoiceAddress = billingAddress || shippingAddress

  const entityName = billingEntity?.legal_name || 'Performance Marketing Solution s.r.o.'
  const entityAddress = billingEntity?.address
    ? `${billingEntity.address.street || 'Rybná 716/24'}, ${billingEntity.address.city || 'Prag'}, ${billingEntity.address.postal_code || '110 00'}, ${billingEntity.address.district || 'Tjeckien'}`
    : 'Rybná 716/24, Prag, 110 00, Tjeckien'
  const entityRegId = billingEntity?.registration_id || '06259928'
  const entityVatId = billingEntity?.vat_id || 'CZ06259928'

  return (
    <Base preview={preview}>
      <Section>
        {/* ====== HEADER ====== */}
        <div style={{
          backgroundColor: colors.headerBg,
          background: colors.headerGradient,
          padding: '40px 28px 36px',
          textAlign: 'center' as const,
        }}>
          <Text style={{
            fontFamily: font,
            fontSize: '11px',
            fontWeight: 600,
            letterSpacing: '3px',
            textTransform: 'uppercase' as const,
            color: 'rgba(255,255,255,0.75)',
            margin: '0 0 10px 0',
          }}>
            Släpp Taget
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
            Tack för din beställning!
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '13px',
            color: 'rgba(255,255,255,0.7)',
            margin: '0',
          }}>
            Beställning {displayId} &bull; {orderDate}
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
              &#10003; Beställning bekräftad
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
            Hej {shippingAddress?.first_name || 'där'},
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            color: colors.textBody,
            lineHeight: '1.7',
            margin: '8px 0 0',
          }}>
            Vad roligt att du har beställt Släpp Taget! Din beställning är bekräftad och vi börjar packa den direkt. Här nedan hittar du en översikt.
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
                  <td style={{ fontFamily: font, fontSize: '13px', color: colors.textMuted, padding: '3px 0' }}>Beställning</td>
                  <td align="right" style={{ fontFamily: font, fontSize: '13px', fontWeight: 600, color: colors.textDark, padding: '3px 0' }}>{displayId}</td>
                </tr>
                <tr>
                  <td style={{ fontFamily: font, fontSize: '13px', color: colors.textMuted, padding: '3px 0' }}>Datum</td>
                  <td align="right" style={{ fontFamily: font, fontSize: '13px', color: colors.textDark, padding: '3px 0' }}>{orderDate}</td>
                </tr>
                {paymentMethod && (
                  <tr>
                    <td style={{ fontFamily: font, fontSize: '13px', color: colors.textMuted, padding: '3px 0' }}>Betalningsmetod</td>
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
            Din beställning
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
                          background: `linear-gradient(145deg, ${colors.accentSoft}, ${colors.accentLight})`,
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
                        {item.variant_title ? `${item.variant_title} \u2022 ` : ''}Antal: {item.quantity || 1}
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
                  <td style={{ fontFamily: font, fontSize: '13px', color: colors.textBody, padding: '4px 0' }}>Delsumma</td>
                  <td align="right" style={{ fontFamily: font, fontSize: '13px', color: colors.textBody, padding: '4px 0' }}>{formatPrice(subtotal, currency)}</td>
                </tr>
                <tr>
                  <td style={{ fontFamily: font, fontSize: '13px', color: colors.textBody, padding: '4px 0' }}>Frakt</td>
                  <td align="right" style={{ fontFamily: font, fontSize: '13px', color: shippingTotal > 0 ? colors.textBody : colors.greenText, fontWeight: shippingTotal > 0 ? 400 : 600, padding: '4px 0' }}>
                    {shippingTotal > 0 ? formatPrice(shippingTotal, currency) : 'Gratis'}
                  </td>
                </tr>
                {taxTotal > 0 && (
                  <tr>
                    <td style={{ fontFamily: font, fontSize: '12px', color: colors.textLight, padding: '4px 0' }}>Varav moms</td>
                    <td align="right" style={{ fontFamily: font, fontSize: '12px', color: colors.textLight, padding: '4px 0' }}>{formatPrice(taxTotal, currency)}</td>
                  </tr>
                )}
                <tr>
                  <td colSpan={2} style={{ paddingTop: '8px' }}>
                    <div style={{ borderTop: `1px solid ${colors.boxBorder}` }}></div>
                  </td>
                </tr>
                <tr>
                  <td style={{ fontFamily: font, fontSize: '18px', fontWeight: 800, color: colors.textDark, padding: '10px 0 0' }}>Totalt</td>
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
              &#128214; &nbsp;<strong>Din e-bok är på väg!</strong>
              <br />
              <span style={{ fontSize: '13px' }}>Du får ett separat e-postmeddelande med nedladdningslänken inom några minuter.</span>
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
              &#128230; &nbsp;<strong>Beräknad leverans: 2–4 arbetsdagar</strong>
            </Text>
            <Text style={{
              fontFamily: font,
              fontSize: '12px',
              color: colors.textMuted,
              margin: '6px 0 0',
              lineHeight: '1.5',
            }}>
              Våra böcker skickas från vårt centrallager i Polen via PostNord till hela Europa.
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
                    Leveransadress
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
                    Faktureringsadress
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
            Vad händer nu?
          </Text>

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
                  <strong style={{ color: colors.textDark }}>Beställning behandlad</strong>
                  <br />
                  <span style={{ fontSize: '13px', color: colors.textMuted }}>Vi förbereder din beställning för leverans.</span>
                </td>
              </tr>
            </tbody>
          </table>

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
                  <strong style={{ color: colors.textDark }}>Skickad</strong>
                  <br />
                  <span style={{ fontSize: '13px', color: colors.textMuted }}>Du får ett e-postmeddelande med ditt spårningsnummer.</span>
                </td>
              </tr>
            </tbody>
          </table>

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
                  <strong style={{ color: colors.textDark }}>Levererad</strong>
                  <br />
                  <span style={{ fontSize: '13px', color: colors.textMuted }}>Inom 2–4 arbetsdagar har du din bok hemma.</span>
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
              Frågor om din beställning?
              <br />
              <Link href="mailto:hej@slapptagetboken.se" style={{ color: colors.accent, textDecoration: 'underline', fontWeight: 700 }}>
                hej@slapptagetboken.se
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
            Varma hälsningar,
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
            <Link href="mailto:hej@slapptagetboken.se" style={{ color: colors.accent, textDecoration: 'none' }}>
              hej@slapptagetboken.se
            </Link>
          </Text>
        </div>

        {/* ====== FOOTER ====== */}
        <div style={{
          backgroundColor: colors.footerBg,
          padding: '28px 28px',
          textAlign: 'center' as const,
        }}>
          <Text style={{
            fontFamily: font,
            fontSize: '13px',
            fontWeight: 700,
            color: colors.footerAccent,
            margin: '0 0 8px',
            letterSpacing: '0.5px',
          }}>
            Släpp Taget
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '11px',
            color: colors.footerText,
            lineHeight: '1.7',
            margin: '0 0 8px',
          }}>
            {entityName}
            <br />
            {entityAddress}
            <br />
            Org.nr: {entityRegId} &bull; Momsnr: {entityVatId}
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '11px',
            color: '#71717A',
            lineHeight: '1.5',
            margin: '0',
          }}>
            Du får detta e-postmeddelande för att du har lagt en beställning på slapptagetboken.se.
          </Text>
        </div>
      </Section>
    </Base>
  )
}

StOrderPlacedTemplate.PreviewProps = {
  order: {
    id: 'test-order-id',
    display_id: '1001',
    metadata: { custom_order_number: 'SE2026-1001' },
    created_at: new Date().toISOString(),
    email: 'anna@exempel.se',
    currency_code: 'sek',
    items: [
      {
        id: 'item-1',
        title: 'Släpp Taget',
        product_title: 'Släpp Taget',
        variant_title: 'Pocket + E-bok',
        quantity: 1,
        unit_price: 399,
        thumbnail: null,
      },
    ],
    summary: {
      raw_current_order_total: { value: 399 },
      raw_shipping_total: { value: 0 },
      raw_tax_total: { value: 79.80 },
    },
  },
  shippingAddress: {
    first_name: 'Anna',
    last_name: 'Johansson',
    address_1: 'Sveavägen 42',
    city: 'Stockholm',
    postal_code: '111 34',
    country_code: 'se',
  },
  billingAddress: {
    first_name: 'Anna',
    last_name: 'Johansson',
    address_1: 'Sveavägen 42',
    city: 'Stockholm',
    postal_code: '111 34',
    country_code: 'se',
  },
  paymentMethod: 'Klarna',
  billingEntity: {
    legal_name: 'Performance Marketing Solution s.r.o.',
    registration_id: '06259928',
    vat_id: 'CZ06259928',
    address: { street: 'Rybná 716/24', city: 'Prag', postal_code: '110 00', district: 'Tjeckien' },
  },
} as any

export default StOrderPlacedTemplate
