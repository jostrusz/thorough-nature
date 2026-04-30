import { Text, Section, Hr, Link } from '@react-email/components'
import * as React from 'react'
import { Base } from './base'
import { getBundleBookLabel } from '../../../utils/bundle-quantity'

export const HL_ORDER_PLACED = 'hl-order-placed'

export interface HlOrderPlacedTemplateProps {
  order: any
  shippingAddress: any
  billingAddress?: any
  paymentMethod?: string
  billingEntity?: any
  preview?: string
}

export const isHlOrderPlacedTemplateData = (data: any): data is HlOrderPlacedTemplateProps =>
  typeof data.order === 'object' && typeof data.shippingAddress === 'object'

const font = "'Inter', Arial, sans-serif"
const pad = '24px'
const padLR = `0 ${pad}`

// Het Leven Dat Je Verdient brand palette — matches index page CSS variables
// (--bg #FFF8F3, --heading #4A1A2E, --cta #B85C4A, gold #C9A96E)
const colors = {
  headerBg: '#4A1A2E',
  headerGradient: 'linear-gradient(135deg, #5A2D3E 0%, #4A1A2E 50%, #3D1E2A 100%)',
  accent: '#B85C4A',           // --cta on the site
  accentLight: '#D4916A',
  accentSoft: '#FFF8F3',       // --bg cream (matches the section bg on the site)
  boxBg: '#FCF1E6',            // soft warm tint for highlight cards (vs accentSoft)
  cream: '#FFF8F3',
  textDark: '#2D1B26',
  textBody: '#5A3D40',
  textMuted: '#8A7884',
  boxBorder: '#F0DCC4',        // warm cream border (matches gold accent family)
  footerBg: '#3D1E2A',
  footerAccent: '#C9A96E',     // brand gold
  footerText: '#9B7889',
  divider: '#F0DCC4',
  okBg: '#E8F5E9',
  okBorder: '#A5D6A7',
  okText: '#2E7D32',
}

function formatPrice(amount: number, currencyCode: string): string {
  try {
    return new Intl.NumberFormat('nl-NL', {
      style: 'currency',
      currency: (currencyCode || 'EUR').toUpperCase(),
    }).format(amount)
  } catch {
    return `€${(amount || 0).toFixed(2).replace('.', ',')}`
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

export const HlOrderPlacedTemplate: React.FC<HlOrderPlacedTemplateProps> & {
  PreviewProps: any
} = ({
  order,
  shippingAddress,
  billingAddress,
  paymentMethod,
  billingEntity,
  preview = 'Bedankt voor je bestelling — je LIFE RESET begint nu.',
}) => {
  const currency = order.currency_code || 'eur'
  const items = order.items || []
  const displayId = order.metadata?.custom_order_number || order.display_id || order.id
  const orderDate = formatDate(order.created_at)

  const subtotal = items.reduce(
    (sum: number, item: any) => sum + (item.unit_price || 0) * (item.quantity || 1),
    0
  )
  const shippingTotal = order.summary?.shipping_total ?? 0
  const taxTotal = order.summary?.tax_total ?? 0
  const total = order.summary?.current_order_total ?? subtotal + shippingTotal

  const invoiceAddress = billingAddress || shippingAddress

  return (
    <Base preview={preview}>
      <Section>
        {/* HEADER */}
        <div style={{
          backgroundColor: colors.headerBg,
          background: colors.headerGradient,
          padding: '32px 24px',
          textAlign: 'center' as const,
        }}>
          <Text style={{
            fontFamily: font,
            fontSize: '11px',
            fontWeight: 500,
            letterSpacing: '3px',
            textTransform: 'uppercase' as const,
            color: colors.footerAccent,
            marginBottom: '8px',
          }}>
            ✦ LIFE RESET™ Methode
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
            color: colors.footerText,
            margin: '6px 0 0',
          }}>
            Bestelling #{displayId} &bull; {orderDate}
          </Text>
        </div>

        {/* GREETING */}
        <div style={{ padding: `28px ${pad} 0 ${pad}` }}>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            color: colors.textBody,
            lineHeight: '1.6',
            marginBottom: '6px',
          }}>
            Hoi {shippingAddress?.first_name || 'daar'},
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            color: colors.textBody,
            lineHeight: '1.6',
            marginBottom: '0',
          }}>
            Wat fijn dat je voor jezelf hebt gekozen. Je bestelling is binnen — we maken je pakket zo snel mogelijk klaar. Hieronder vind je alles op een rijtje.
          </Text>
        </div>

        {/* ORDER SUMMARY BOX */}
        <div style={{ padding: `20px ${pad}` }}>
          <div style={{
            backgroundColor: colors.accentSoft,
            borderRadius: '10px',
            border: `1px solid ${colors.boxBorder}`,
            padding: '16px 20px',
          }}>
            <div style={{ marginBottom: '6px' }}>
              <Text style={{
                fontFamily: font,
                fontSize: '13px',
                color: colors.textBody,
                margin: '0',
              }}>
                <strong style={{ color: colors.textDark }}>Bestelling:</strong> &nbsp; #{displayId}
                &nbsp;&nbsp;
                <span style={{
                  backgroundColor: '#e8f5e9',
                  color: '#2e7d32',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontSize: '11px',
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
              color: colors.textBody,
              margin: '0 0 4px',
            }}>
              <strong style={{ color: colors.textDark }}>Datum:</strong> &nbsp; {orderDate}
            </Text>
            {paymentMethod && (
              <Text style={{
                fontFamily: font,
                fontSize: '13px',
                color: colors.textBody,
                margin: '0',
              }}>
                <strong style={{ color: colors.textDark }}>Betaalmethode:</strong> &nbsp; {paymentMethod}
              </Text>
            )}
          </div>
        </div>

        {/* ITEMS */}
        <div style={{ padding: padLR }}>
          <Text style={{
            fontFamily: font,
            fontSize: '11px',
            fontWeight: 600,
            textTransform: 'uppercase' as const,
            letterSpacing: '1.5px',
            color: colors.textMuted,
            marginBottom: '12px',
          }}>
            Je bestelling
          </Text>

          {items.map((item: any) => {
            // Het-leven bundle SKUs (HLDV-1/2/3/4) encode N books into one
            // line item with quantity=1. Show the real book count instead of
            // the meaningless "Aantal: 1", which confuses customers.
            const sku = item.variant_sku || item.variant?.sku || item.sku || null
            const bundleLabel = getBundleBookLabel(sku, item.quantity || 1, 'nl')
            return (
              <div key={item.id} style={{
                marginBottom: '10px',
                backgroundColor: colors.accentSoft,
                borderRadius: '8px',
                border: `1px solid ${colors.boxBorder}`,
                padding: '12px 14px',
              }}>
                <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ borderCollapse: 'collapse' as const }}>
                  <tbody>
                    <tr>
                      <td width="52" valign="top" style={{ paddingRight: '12px' }}>
                        {item.thumbnail ? (
                          <img
                            src={item.thumbnail}
                            alt={item.title || item.product_title}
                            width="52"
                            height="68"
                            style={{
                              width: '52px',
                              height: '68px',
                              objectFit: 'cover' as const,
                              borderRadius: '6px',
                            }}
                          />
                        ) : (
                          <div style={{
                            width: '52px',
                            height: '68px',
                            background: colors.headerGradient,
                            borderRadius: '6px',
                            textAlign: 'center' as const,
                            lineHeight: '68px',
                            fontSize: '24px',
                          }}>
                            📕
                          </div>
                        )}
                      </td>
                      <td valign="top">
                        <Text style={{
                          fontFamily: font,
                          fontSize: '14px',
                          fontWeight: 600,
                          color: colors.textDark,
                          margin: '0 0 2px',
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
                          {bundleLabel
                            ? `Aantal: ${bundleLabel}`
                            : `${item.variant_title ? `${item.variant_title} • ` : ''}Aantal: ${item.quantity || 1}`}
                        </Text>
                      </td>
                      <td width="70" align="right" valign="top">
                        <Text style={{
                          fontFamily: font,
                          fontSize: '14px',
                          fontWeight: 700,
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
            )
          })}

          {/* Totals */}
          <div style={{ marginTop: '14px', borderTop: `2px solid ${colors.boxBorder}`, paddingTop: '12px' }}>
            <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ borderCollapse: 'collapse' as const }}>
              <tbody>
                <tr>
                  <td style={{ fontFamily: font, fontSize: '13px', color: colors.textBody, padding: '3px 0' }}>Subtotaal</td>
                  <td align="right" style={{ fontFamily: font, fontSize: '13px', color: colors.textBody, padding: '3px 0' }}>{formatPrice(subtotal, currency)}</td>
                </tr>
                <tr>
                  <td style={{ fontFamily: font, fontSize: '13px', color: colors.textBody, padding: '3px 0' }}>Verzendkosten</td>
                  <td align="right" style={{ fontFamily: font, fontSize: '13px', color: shippingTotal > 0 ? colors.textBody : '#2e7d32', padding: '3px 0' }}>
                    {shippingTotal > 0 ? formatPrice(shippingTotal, currency) : 'Gratis'}
                  </td>
                </tr>
                {taxTotal > 0 && (
                  <tr>
                    <td style={{ fontFamily: font, fontSize: '12px', color: colors.textMuted, padding: '3px 0' }}>Waarvan BTW</td>
                    <td align="right" style={{ fontFamily: font, fontSize: '12px', color: colors.textMuted, padding: '3px 0' }}>{formatPrice(taxTotal, currency)}</td>
                  </tr>
                )}
                <tr>
                  <td style={{ fontFamily: font, fontSize: '17px', fontWeight: 700, color: colors.textDark, padding: '10px 0 0', borderTop: `1px solid ${colors.boxBorder}` }}>Totaal</td>
                  <td align="right" style={{ fontFamily: font, fontSize: '17px', fontWeight: 700, color: colors.textDark, padding: '10px 0 0', borderTop: `1px solid ${colors.boxBorder}` }}>{formatPrice(total, currency)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* E-BOOK NOTICE — 2 gratis e-books */}
        <div style={{ padding: `20px ${pad} 0 ${pad}` }}>
          <div style={{
            backgroundColor: colors.okBg,
            borderRadius: '8px',
            border: `1px solid ${colors.okBorder}`,
            padding: '14px 16px',
            textAlign: 'center' as const,
          }}>
            <Text style={{
              fontFamily: font,
              fontSize: '13px',
              color: colors.okText,
              margin: '0 0 4px',
              lineHeight: '1.5',
              fontWeight: 700,
            }}>
              🎁 &nbsp; Je 2 gratis e-books zijn onderweg!
            </Text>
            <Text style={{
              fontFamily: font,
              fontSize: '12px',
              color: colors.okText,
              margin: '0',
              lineHeight: '1.5',
            }}>
              <em>Verschuif Eén Ding, Verander Alles</em> en <em>Niet Alles Verdient Een Plek</em> &mdash; je ontvangt ze binnen enkele minuten in een aparte e-mail.
            </Text>
          </div>
        </div>

        {/* DELIVERY ESTIMATE */}
        <div style={{ padding: `12px ${pad} 0 ${pad}` }}>
          <div style={{
            backgroundColor: '#FFF8E1',
            borderRadius: '8px',
            border: '1px solid #FFE082',
            padding: '12px 16px',
            textAlign: 'center' as const,
          }}>
            <Text style={{
              fontFamily: font,
              fontSize: '13px',
              color: '#795548',
              margin: '0',
              lineHeight: '1.5',
            }}>
              📦 &nbsp; <strong>Verwachte levering:</strong> 3&ndash;5 werkdagen
            </Text>
            <Text style={{
              fontFamily: font,
              fontSize: '12px',
              color: '#9e9e9e',
              margin: '4px 0 0',
              lineHeight: '1.5',
            }}>
              We versturen via GLS naar Nederland en België. Zodra je pakket onderweg is, krijg je een track &amp; trace link per e-mail.
            </Text>
          </div>
        </div>

        {/* ADDRESSES */}
        <div style={{ padding: `24px ${pad} 0 ${pad}` }}>
          <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ borderCollapse: 'collapse' as const }}>
            <tbody>
              <tr>
                <td width="50%" valign="top" style={{ paddingRight: '10px' }}>
                  <Text style={{
                    fontFamily: font,
                    fontSize: '11px',
                    fontWeight: 600,
                    textTransform: 'uppercase' as const,
                    letterSpacing: '1.5px',
                    color: colors.textMuted,
                    marginBottom: '8px',
                  }}>
                    Bezorgadres
                  </Text>
                  <Text style={{
                    fontFamily: font,
                    fontSize: '13px',
                    color: colors.textBody,
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
                <td width="50%" valign="top" style={{ paddingLeft: '10px' }}>
                  <Text style={{
                    fontFamily: font,
                    fontSize: '11px',
                    fontWeight: 600,
                    textTransform: 'uppercase' as const,
                    letterSpacing: '1.5px',
                    color: colors.textMuted,
                    marginBottom: '8px',
                  }}>
                    Factuuradres
                  </Text>
                  <Text style={{
                    fontFamily: font,
                    fontSize: '13px',
                    color: colors.textBody,
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

        <Hr style={{ borderColor: colors.divider, margin: `20px ${pad} 0 ${pad}` }} />

        {/* WHAT HAPPENS NEXT */}
        <div style={{ padding: `20px ${pad} 0 ${pad}` }}>
          <Text style={{
            fontFamily: font,
            fontSize: '11px',
            fontWeight: 600,
            textTransform: 'uppercase' as const,
            letterSpacing: '1.5px',
            color: colors.textMuted,
            marginBottom: '14px',
          }}>
            Wat gebeurt er nu?
          </Text>

          {[
            { num: '1', bg: colors.accent, text: '#ffffff', title: 'Bestelling verwerkt', desc: 'We maken je bestelling klaar voor verzending.' },
            { num: '2', bg: colors.accentLight, text: '#ffffff', title: 'Verzonden', desc: 'Zodra je pakket de deur uit is, krijg je een e-mail met track & trace.' },
            { num: '3', bg: colors.boxBorder, text: colors.textDark, title: 'Bezorgd', desc: 'Binnen 3–5 werkdagen heb je je boek in huis. Klaar om te beginnen.' },
          ].map((step) => (
            <table key={step.num} role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ borderCollapse: 'collapse' as const, marginBottom: '12px' }}>
              <tbody>
                <tr>
                  <td width="34" valign="top">
                    <div style={{
                      width: '26px',
                      height: '26px',
                      backgroundColor: step.bg,
                      borderRadius: '50%',
                      textAlign: 'center' as const,
                      lineHeight: '26px',
                      fontFamily: font,
                      fontSize: '12px',
                      fontWeight: 700,
                      color: step.text,
                    }}>{step.num}</div>
                  </td>
                  <td style={{ fontFamily: font, fontSize: '13px', color: colors.textBody, lineHeight: '1.5', paddingLeft: '8px' }}>
                    <strong style={{ color: colors.textDark }}>{step.title}</strong>
                    <br />
                    {step.desc}
                  </td>
                </tr>
              </tbody>
            </table>
          ))}
        </div>

        {/* HELP SECTION */}
        <div style={{ padding: `12px ${pad} 0 ${pad}` }}>
          <div style={{
            backgroundColor: colors.accentSoft,
            borderRadius: '10px',
            border: `1px solid ${colors.boxBorder}`,
            padding: '16px 20px',
            textAlign: 'center' as const,
          }}>
            <Text style={{
              fontFamily: font,
              fontSize: '13px',
              color: colors.textBody,
              lineHeight: '1.6',
              margin: '0',
            }}>
              Vragen over je bestelling? Stuur me gerust een mailtje naar
              <br />
              <Link href="mailto:annadevries@pakjeleventerug.nl" style={{ color: colors.accent, textDecoration: 'underline', fontWeight: 600 }}>
                annadevries@pakjeleventerug.nl
              </Link>
            </Text>
          </div>
        </div>

        {/* SIGNATURE */}
        <div style={{ padding: `20px ${pad} 24px ${pad}` }}>
          <Text style={{
            fontFamily: font,
            fontSize: '14px',
            color: colors.textBody,
            marginBottom: '4px',
          }}>
            Warme groet,
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '14px',
            fontWeight: 700,
            color: colors.textDark,
            marginBottom: '2px',
          }}>
            Anna de Vries
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '12px',
            color: colors.textMuted,
          }}>
            <Link href="mailto:annadevries@pakjeleventerug.nl" style={{ color: colors.accent, textDecoration: 'none' }}>
              annadevries@pakjeleventerug.nl
            </Link>
          </Text>
        </div>

        {/* FOOTER */}
        <div style={{
          backgroundColor: colors.footerBg,
          padding: '24px 24px',
          textAlign: 'center' as const,
        }}>
          <Text style={{
            fontFamily: font,
            fontSize: '12px',
            color: colors.footerAccent,
            marginBottom: '6px',
          }}>
            Het Leven Dat Je Verdient &bull; LIFE RESET™ Methode
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '11px',
            color: colors.footerText,
            lineHeight: '1.6',
            marginBottom: '6px',
          }}>
            {billingEntity?.legal_name || 'Performance Marketing Solution s.r.o.'}
            {' '}&bull;{' '}
            {billingEntity?.address
              ? `${billingEntity.address.address_1 || ''}, ${billingEntity.address.postal_code || ''} ${billingEntity.address.city || ''}${billingEntity.address.district ? ', ' + billingEntity.address.district : ''}`
              : 'Rybná 716/24, 110 00 Staré Město, Praha, CZ'}
            <br />
            IČ: {billingEntity?.registration_id || '06259928'}
            {(billingEntity?.vat_id || !billingEntity) && (
              <>
                {' '}&bull;{' '}
                DIČ: {billingEntity?.vat_id || 'CZ06259928'}
              </>
            )}
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '11px',
            color: colors.footerText,
            lineHeight: '1.5',
            margin: '0',
          }}>
            Je ontvangt deze e-mail omdat je een bestelling hebt geplaatst op pakjeleventerug.nl.
          </Text>
        </div>
      </Section>
    </Base>
  )
}

HlOrderPlacedTemplate.PreviewProps = {
  order: {
    id: 'test-order-id',
    display_id: '2401',
    created_at: new Date().toISOString(),
    email: 'sophie@voorbeeld.nl',
    currency_code: 'eur',
    items: [
      {
        id: 'item-1',
        title: 'Het Leven Dat Je Verdient — 2 Boeken',
        product_title: 'Het Leven Dat Je Verdient',
        variant_title: '2 Boeken',
        variant_sku: 'HLDV-2',
        quantity: 1,
        unit_price: 59,
        thumbnail: 'https://www.pakjeleventerug.nl/het-leven-dat-je-verdient-380w.webp',
      },
    ],
    summary: {
      current_order_total: 59,
      shipping_total: 0,
      tax_total: 4.87,
    },
  },
  shippingAddress: {
    first_name: 'Sophie',
    last_name: 'van der Berg',
    address_1: 'Keizersgracht 412',
    city: 'Amsterdam',
    postal_code: '1016 GC',
    country_code: 'nl',
  },
  billingAddress: {
    first_name: 'Sophie',
    last_name: 'van der Berg',
    address_1: 'Keizersgracht 412',
    city: 'Amsterdam',
    postal_code: '1016 GC',
    country_code: 'nl',
  },
  paymentMethod: 'iDEAL',
} as any

export default HlOrderPlacedTemplate
