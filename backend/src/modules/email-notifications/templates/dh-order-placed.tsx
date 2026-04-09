import { Text, Section, Hr, Link, Img } from '@react-email/components'
import * as React from 'react'
import { Base } from './base'

export const DH_ORDER_PLACED = 'dh-order-placed'

export interface DhOrderPlacedTemplateProps {
  order: any
  shippingAddress: any
  billingAddress?: any
  paymentMethod?: string
  billingEntity?: any
  preview?: string
}

export const isDhOrderPlacedTemplateData = (data: any): data is DhOrderPlacedTemplateProps =>
  typeof data.order === 'object' && typeof data.shippingAddress === 'object'

const font = "'Inter', 'Segoe UI', Arial, sans-serif"
const pad = '28px'
const padLR = `0 ${pad}`

// DH Brand colors — warm orange palette
const colors = {
  headerBg: '#EA580C',
  headerGradient: 'linear-gradient(135deg, #F97316 0%, #EA580C 50%, #C2410C 100%)',
  accent: '#EA580C',
  accentLight: '#FDBA74',
  accentSoft: '#FFF7ED',
  accentMuted: '#FB923C',
  textDark: '#18181B',
  textBody: '#3F3F46',
  textMuted: '#71717A',
  textLight: '#A1A1AA',
  boxBg: '#FAFAFA',
  boxBorder: '#E4E4E7',
  cardBg: '#FFFFFF',
  footerBg: '#18181B',
  footerText: '#A1A1AA',
  footerAccent: '#FB923C',
  greenBg: '#F0FDF4',
  greenBorder: '#BBF7D0',
  greenText: '#166534',
  amberBg: '#FFFBEB',
  amberBorder: '#FDE68A',
  amberText: '#92400E',
  divider: '#E4E4E7',
  white: '#FFFFFF',
}

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

export const DhOrderPlacedTemplate: React.FC<DhOrderPlacedTemplateProps> & {
  PreviewProps: any
} = ({
  order,
  shippingAddress,
  billingAddress,
  paymentMethod,
  billingEntity,
  preview = 'Bedankt voor je bestelling bij De Hondenbijbel!',
}) => {
  const currency = order.currency_code || 'eur'
  const items = order.items || []
  // Build display ID: prefer custom_order_number, fallback to generating it inline
  const rawDisplayId = order.display_id || order.id
  const displayId = order.metadata?.custom_order_number || (() => {
    const cc = (shippingAddress?.country_code || billingAddress?.country_code || 'nl').toUpperCase()
    const year = new Date().getFullYear()
    return `${cc}${year}-${rawDisplayId}`
  })()
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

  // Billing entity info — pulled from admin
  const entityName = billingEntity?.legal_name || 'EverChapter OÜ'
  const entityAddress = billingEntity?.address
    ? `${billingEntity.address.city || 'Tallinn'}, ${billingEntity.address.district || billingEntity.address.country_code?.toUpperCase() || 'Estonia'}`
    : 'Tallinn, Estonia'
  const entityRegId = billingEntity?.registration_id || '16938029'

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
            De Hondenbijbel
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
            Bedankt voor je bestelling!
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '13px',
            color: 'rgba(255,255,255,0.7)',
            margin: '0',
          }}>
            Bestelling {displayId} &bull; {orderDate}
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
              &#10003; Bestelling bevestigd
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
            Hoi {shippingAddress?.first_name || 'daar'},
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            color: colors.textBody,
            lineHeight: '1.7',
            margin: '8px 0 0',
          }}>
            Super dat je De Hondenbijbel hebt besteld! Je bestelling is bevestigd en we gaan er direct mee aan de slag. Hieronder vind je een overzicht.
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
                  <td style={{ fontFamily: font, fontSize: '13px', color: colors.textMuted, padding: '3px 0' }}>Bestelling</td>
                  <td align="right" style={{ fontFamily: font, fontSize: '13px', fontWeight: 600, color: colors.textDark, padding: '3px 0' }}>{displayId}</td>
                </tr>
                <tr>
                  <td style={{ fontFamily: font, fontSize: '13px', color: colors.textMuted, padding: '3px 0' }}>Datum</td>
                  <td align="right" style={{ fontFamily: font, fontSize: '13px', color: colors.textDark, padding: '3px 0' }}>{orderDate}</td>
                </tr>
                {paymentMethod && (
                  <tr>
                    <td style={{ fontFamily: font, fontSize: '13px', color: colors.textMuted, padding: '3px 0' }}>Betaalmethode</td>
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
            Je bestelling
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
                          background: `linear-gradient(145deg, ${colors.accentSoft}, #FED7AA)`,
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
                        {item.product_title || item.title || 'Item'}
                      </Text>
                      <Text style={{
                        fontFamily: font,
                        fontSize: '12px',
                        color: colors.textMuted,
                        margin: '0',
                      }}>
                        {item.variant_title ? `${item.variant_title} \u2022 ` : ''}Aantal: {item.quantity || 1}
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
                  <td style={{ fontFamily: font, fontSize: '13px', color: colors.textBody, padding: '4px 0' }}>Subtotaal</td>
                  <td align="right" style={{ fontFamily: font, fontSize: '13px', color: colors.textBody, padding: '4px 0' }}>{formatPrice(subtotal, currency)}</td>
                </tr>
                <tr>
                  <td style={{ fontFamily: font, fontSize: '13px', color: colors.textBody, padding: '4px 0' }}>Verzendkosten</td>
                  <td align="right" style={{ fontFamily: font, fontSize: '13px', color: shippingTotal > 0 ? colors.textBody : colors.greenText, fontWeight: shippingTotal > 0 ? 400 : 600, padding: '4px 0' }}>
                    {shippingTotal > 0 ? formatPrice(shippingTotal, currency) : 'Gratis'}
                  </td>
                </tr>
                {taxTotal > 0 && (
                  <tr>
                    <td style={{ fontFamily: font, fontSize: '12px', color: colors.textLight, padding: '4px 0' }}>Waarvan BTW</td>
                    <td align="right" style={{ fontFamily: font, fontSize: '12px', color: colors.textLight, padding: '4px 0' }}>{formatPrice(taxTotal, currency)}</td>
                  </tr>
                )}
                <tr>
                  <td colSpan={2} style={{ paddingTop: '8px' }}>
                    <div style={{ borderTop: `1px solid ${colors.boxBorder}` }}></div>
                  </td>
                </tr>
                <tr>
                  <td style={{ fontFamily: font, fontSize: '18px', fontWeight: 800, color: colors.textDark, padding: '10px 0 0' }}>Totaal</td>
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
              &#128214; &nbsp;<strong>Je e-book is onderweg!</strong>
              <br />
              <span style={{ fontSize: '13px' }}>Je ontvangt binnen enkele minuten een aparte e-mail met de download-link.</span>
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
              &#128230; &nbsp;<strong>Verwachte levering: 4–7 werkdagen</strong>
            </Text>
            <Text style={{
              fontFamily: font,
              fontSize: '12px',
              color: colors.textMuted,
              margin: '6px 0 0',
              lineHeight: '1.5',
            }}>
              Onze boeken worden verzonden vanuit ons centrale magazijn in Tsjechië.
            </Text>
          </div>
        </div>

        {/* ====== ADDRESSES — equal margins ====== */}
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
                    Bezorgadres
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
                    Factuuradres
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

        {/* ====== WHAT HAPPENS NEXT — timeline style ====== */}
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
            Wat gebeurt er nu?
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
                  <strong style={{ color: colors.textDark }}>Bestelling verwerkt</strong>
                  <br />
                  <span style={{ fontSize: '13px', color: colors.textMuted }}>We maken je bestelling klaar voor verzending.</span>
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
                  <strong style={{ color: colors.textDark }}>Verzonden</strong>
                  <br />
                  <span style={{ fontSize: '13px', color: colors.textMuted }}>Je ontvangt een e-mail met je track &amp; trace code.</span>
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
                  <strong style={{ color: colors.textDark }}>Bezorgd</strong>
                  <br />
                  <span style={{ fontSize: '13px', color: colors.textMuted }}>Binnen 4–7 werkdagen heb je De Hondenbijbel in huis.</span>
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
            border: `1px solid #FED7AA`,
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
              Vragen over je bestelling?
              <br />
              <Link href="mailto:support@dehondenbijbel.nl" style={{ color: colors.accent, textDecoration: 'underline', fontWeight: 700 }}>
                support@dehondenbijbel.nl
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
            Warme groet,
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            fontWeight: 700,
            color: colors.textDark,
            margin: '0 0 2px',
          }}>
            Lars Vermeulen
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '13px',
            color: colors.textMuted,
            margin: '0',
          }}>
            <Link href="mailto:support@dehondenbijbel.nl" style={{ color: colors.accent, textDecoration: 'none' }}>
              support@dehondenbijbel.nl
            </Link>
          </Text>
        </div>

        {/* ====== FOOTER — entity from admin ====== */}
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
            De Hondenbijbel
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
            Reg. nr: {entityRegId}
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '11px',
            color: '#71717A',
            lineHeight: '1.5',
            margin: '0',
          }}>
            Je ontvangt deze e-mail omdat je een bestelling hebt geplaatst bij dehondenbijbel.nl.
          </Text>
        </div>
      </Section>
    </Base>
  )
}

DhOrderPlacedTemplate.PreviewProps = {
  order: {
    id: 'test-order-id',
    display_id: '2047',
    metadata: { custom_order_number: 'NL2026-2047' },
    created_at: new Date().toISOString(),
    email: 'jan@voorbeeld.nl',
    currency_code: 'eur',
    items: [
      {
        id: 'item-1',
        title: 'De Hondenbijbel',
        product_title: 'De Hondenbijbel',
        variant_title: 'Hardcover + E-book',
        quantity: 1,
        unit_price: 34.95,
        thumbnail: null,
      },
    ],
    summary: {
      raw_current_order_total: { value: 34.95 },
      raw_shipping_total: { value: 0 },
      raw_tax_total: { value: 6.06 },
    },
  },
  shippingAddress: {
    first_name: 'Jan',
    last_name: 'de Groot',
    address_1: 'Prinsengracht 263',
    city: 'Amsterdam',
    postal_code: '1016 GV',
    country_code: 'nl',
  },
  billingAddress: {
    first_name: 'Jan',
    last_name: 'de Groot',
    address_1: 'Prinsengracht 263',
    city: 'Amsterdam',
    postal_code: '1016 GV',
    country_code: 'nl',
  },
  paymentMethod: 'iDEAL (ING Bank)',
  billingEntity: {
    legal_name: 'EverChapter OÜ',
    registration_id: '16938029',
    address: {
      city: 'Tallinn',
      district: 'Estonia',
    },
  },
} as any

export default DhOrderPlacedTemplate
