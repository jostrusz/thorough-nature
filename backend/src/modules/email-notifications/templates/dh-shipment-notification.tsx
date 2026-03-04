import { Text, Section, Hr, Link } from '@react-email/components'
import * as React from 'react'
import { Base } from './base'

export const DH_SHIPMENT_NOTIFICATION = 'dh-shipment-notification'

export interface DhShipmentNotificationTemplateProps {
  order: any
  shippingAddress: any
  trackingNumber?: string
  trackingUrl?: string
  trackingCompany?: string
  billingEntity?: any
  preview?: string
}

export const isDhShipmentNotificationData = (data: any): data is DhShipmentNotificationTemplateProps =>
  typeof data.order === 'object' && typeof data.shippingAddress === 'object'

const font = "'Inter', Arial, sans-serif"
const pad = '24px'
const padLR = `0 ${pad}`

// DH Brand colors
const colors = {
  headerBg: '#4C1D95',
  headerGradient: 'linear-gradient(135deg, #4C1D95 0%, #2E1065 100%)',
  accent: '#7C3AED',
  accentLight: '#A78BFA',
  accentMuted: '#8B5CF6',
  textDark: '#1F2937',
  textBody: '#374151',
  textMuted: '#6B7280',
  boxBg: '#FAF5FF',
  boxBorder: '#E9D5FF',
  footerBg: '#1E1B4B',
  amberLight: '#FEF3C7',
  amberBorder: '#FDE68A',
  greenBg: '#E8F5E9',
  greenBorder: '#A5D6A7',
  greenText: '#2E7D32',
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

export const DhShipmentNotificationTemplate: React.FC<DhShipmentNotificationTemplateProps> & {
  PreviewProps: any
} = ({
  order,
  shippingAddress,
  trackingNumber,
  trackingUrl,
  trackingCompany,
  billingEntity,
  preview = 'Je bestelling is verzonden! 🐾',
}) => {
  const currency = order.currency_code || 'eur'
  const items = order.items || []
  const displayId = order.metadata?.custom_order_number || order.display_id || order.id

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
            color: colors.accentLight,
            marginBottom: '8px',
          }}>
            De Hondenbijbel
          </Text>
          <Text style={{
            fontSize: '32px',
            marginBottom: '6px',
          }}>
            📦
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '24px',
            fontWeight: 700,
            color: '#ffffff',
            margin: '0',
            lineHeight: '1.3',
          }}>
            Je bestelling is verzonden!
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '13px',
            color: colors.accentMuted,
            margin: '6px 0 0',
          }}>
            Bestelling #{displayId}
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
            Goed nieuws! Je bestelling is ingepakt en onderweg naar je. Hieronder vind je de details van je verzending.
          </Text>
        </div>

        {/* TRACKING INFO */}
        {(trackingNumber || trackingUrl) && (
          <div style={{ padding: `20px ${pad} 0 ${pad}` }}>
            <div style={{
              backgroundColor: colors.greenBg,
              borderRadius: '10px',
              border: `1px solid ${colors.greenBorder}`,
              padding: '18px 20px',
              textAlign: 'center' as const,
            }}>
              <Text style={{
                fontFamily: font,
                fontSize: '11px',
                fontWeight: 600,
                textTransform: 'uppercase' as const,
                letterSpacing: '1.5px',
                color: colors.greenText,
                marginBottom: '10px',
              }}>
                Track &amp; Trace
              </Text>
              {trackingCompany && (
                <Text style={{
                  fontFamily: font,
                  fontSize: '13px',
                  color: colors.textBody,
                  marginBottom: '6px',
                }}>
                  Vervoerder: <strong style={{ color: colors.textDark }}>{trackingCompany}</strong>
                </Text>
              )}
              {trackingNumber && (
                <Text style={{
                  fontFamily: font,
                  fontSize: '13px',
                  color: colors.textBody,
                  marginBottom: trackingUrl ? '12px' : '0',
                }}>
                  Trackingnummer: <strong style={{ color: colors.textDark }}>{trackingNumber}</strong>
                </Text>
              )}
              {trackingUrl && (
                <Link
                  href={trackingUrl}
                  style={{
                    backgroundColor: colors.accent,
                    color: '#ffffff',
                    fontFamily: font,
                    fontSize: '14px',
                    fontWeight: 600,
                    textDecoration: 'none',
                    padding: '12px 32px',
                    borderRadius: '8px',
                    display: 'inline-block',
                  }}
                >
                  Volg je pakket →
                </Link>
              )}
            </div>
          </div>
        )}

        {/* DELIVERY ESTIMATE */}
        <div style={{ padding: `12px ${pad} 0 ${pad}` }}>
          <div style={{
            backgroundColor: colors.amberLight,
            borderRadius: '8px',
            border: `1px solid ${colors.amberBorder}`,
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
              🚚 &nbsp; <strong>Verwachte levering:</strong> 4–7 werkdagen
            </Text>
            <Text style={{
              fontFamily: font,
              fontSize: '12px',
              color: '#9e9e9e',
              margin: '4px 0 0',
              lineHeight: '1.5',
            }}>
              Onze boeken worden verzonden vanuit ons centrale magazijn in Tsjechië.
            </Text>
          </div>
        </div>

        {/* ITEMS */}
        <div style={{ padding: `20px ${pad} 0 ${pad}` }}>
          <Text style={{
            fontFamily: font,
            fontSize: '11px',
            fontWeight: 600,
            textTransform: 'uppercase' as const,
            letterSpacing: '1.5px',
            color: colors.accentMuted,
            marginBottom: '12px',
          }}>
            Verzonden items
          </Text>

          {items.map((item: any) => (
            <div key={item.id} style={{
              marginBottom: '10px',
              backgroundColor: colors.boxBg,
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
                          background: `linear-gradient(135deg, ${colors.headerBg}, ${colors.accent})`,
                          borderRadius: '6px',
                          textAlign: 'center' as const,
                          lineHeight: '68px',
                          fontSize: '24px',
                        }}>
                          🐕
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
                        {item.variant_title ? `${item.variant_title} \u2022 ` : ''}Aantal: {item.quantity || 1}
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
          ))}
        </div>

        {/* SHIPPING ADDRESS */}
        <div style={{ padding: `20px ${pad} 0 ${pad}` }}>
          <Text style={{
            fontFamily: font,
            fontSize: '11px',
            fontWeight: 600,
            textTransform: 'uppercase' as const,
            letterSpacing: '1.5px',
            color: colors.accentMuted,
            marginBottom: '8px',
          }}>
            Bezorgadres
          </Text>
          <div style={{
            backgroundColor: colors.boxBg,
            borderRadius: '10px',
            border: `1px solid ${colors.boxBorder}`,
            padding: '14px 18px',
          }}>
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
          </div>
        </div>

        <Hr style={{ borderColor: colors.boxBorder, margin: `20px ${pad} 0 ${pad}` }} />

        {/* WHAT HAPPENS NEXT */}
        <div style={{ padding: `20px ${pad} 0 ${pad}` }}>
          <Text style={{
            fontFamily: font,
            fontSize: '11px',
            fontWeight: 600,
            textTransform: 'uppercase' as const,
            letterSpacing: '1.5px',
            color: colors.accentMuted,
            marginBottom: '14px',
          }}>
            Wat kun je verwachten?
          </Text>

          <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ borderCollapse: 'collapse' as const, marginBottom: '12px' }}>
            <tbody>
              <tr>
                <td width="34" valign="top">
                  <div style={{
                    width: '26px',
                    height: '26px',
                    backgroundColor: colors.greenText,
                    borderRadius: '50%',
                    textAlign: 'center' as const,
                    lineHeight: '26px',
                    fontFamily: font,
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#ffffff',
                  }}>✓</div>
                </td>
                <td style={{ fontFamily: font, fontSize: '13px', color: colors.textBody, lineHeight: '1.5', paddingLeft: '8px' }}>
                  <strong style={{ color: colors.textDark }}>Verzonden</strong>
                  <br />
                  Je bestelling is ingepakt en verzonden vanuit ons magazijn.
                </td>
              </tr>
            </tbody>
          </table>

          <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ borderCollapse: 'collapse' as const, marginBottom: '12px' }}>
            <tbody>
              <tr>
                <td width="34" valign="top">
                  <div style={{
                    width: '26px',
                    height: '26px',
                    backgroundColor: colors.accent,
                    borderRadius: '50%',
                    textAlign: 'center' as const,
                    lineHeight: '26px',
                    fontFamily: font,
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#ffffff',
                  }}>2</div>
                </td>
                <td style={{ fontFamily: font, fontSize: '13px', color: colors.textBody, lineHeight: '1.5', paddingLeft: '8px' }}>
                  <strong style={{ color: colors.textDark }}>Onderweg</strong>
                  <br />
                  De vervoerder brengt je pakket naar het opgegeven adres.
                </td>
              </tr>
            </tbody>
          </table>

          <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ borderCollapse: 'collapse' as const, marginBottom: '6px' }}>
            <tbody>
              <tr>
                <td width="34" valign="top">
                  <div style={{
                    width: '26px',
                    height: '26px',
                    backgroundColor: colors.boxBorder,
                    borderRadius: '50%',
                    textAlign: 'center' as const,
                    lineHeight: '26px',
                    fontFamily: font,
                    fontSize: '12px',
                    fontWeight: 700,
                    color: colors.textDark,
                  }}>3</div>
                </td>
                <td style={{ fontFamily: font, fontSize: '13px', color: colors.textBody, lineHeight: '1.5', paddingLeft: '8px' }}>
                  <strong style={{ color: colors.textDark }}>Bezorgd</strong>
                  <br />
                  Binnen 4–7 werkdagen heb je De Hondenbijbel in huis! 🐾
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* HELP SECTION */}
        <div style={{ padding: `24px ${pad} 0 ${pad}` }}>
          <div style={{
            backgroundColor: colors.boxBg,
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
              Vragen over je verzending? Stuur een mailtje naar
              <br />
              <Link href="mailto:support@dehondenbijbel.nl" style={{ color: colors.accent, textDecoration: 'underline', fontWeight: 600 }}>
                support@dehondenbijbel.nl
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
            Veel plezier met je viervoeter!
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '14px',
            fontWeight: 700,
            color: colors.textDark,
            marginBottom: '2px',
          }}>
            Lars Vermeulen
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '12px',
            color: colors.textMuted,
          }}>
            <Link href="mailto:support@dehondenbijbel.nl" style={{ color: colors.accent, textDecoration: 'none' }}>
              support@dehondenbijbel.nl
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
            color: colors.accentLight,
            marginBottom: '6px',
          }}>
            De Hondenbijbel
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '11px',
            color: '#6366F1',
            lineHeight: '1.6',
            margin: '0',
          }}>
            {billingEntity?.legal_name || 'EverChapter OÜ'}
            {' '}&bull;{' '}
            {billingEntity?.address
              ? `${billingEntity.address.address_1 || ''}, ${billingEntity.address.postal_code || ''} ${billingEntity.address.city || ''}`
              : 'Tallinn, Estonia'}
            {billingEntity?.registration_id && (
              <>
                <br />
                Reg. nr: {billingEntity.registration_id}
              </>
            )}
            <br />
            Je ontvangt deze e-mail omdat je een bestelling hebt geplaatst bij dehondenbijbel.nl.
          </Text>
        </div>
      </Section>
    </Base>
  )
}

DhShipmentNotificationTemplate.PreviewProps = {
  order: {
    id: 'test-order-id',
    display_id: '2047',
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
  },
  shippingAddress: {
    first_name: 'Jan',
    last_name: 'de Groot',
    address_1: 'Prinsengracht 263',
    city: 'Amsterdam',
    postal_code: '1016 GV',
    country_code: 'nl',
  },
  trackingNumber: 'CZ9876543210',
  trackingUrl: 'https://tracking.example.com/CZ9876543210',
  trackingCompany: 'DHL',
} as any

export default DhShipmentNotificationTemplate
