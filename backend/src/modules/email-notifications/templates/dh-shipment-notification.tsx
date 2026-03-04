import { Text, Section, Hr, Link, Img } from '@react-email/components'
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

const font = "'Inter', 'Segoe UI', Arial, sans-serif"
const pad = '28px'

// DH Brand colors — warm orange palette (matches dh-order-placed)
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
    nl: 'Nederland', be: 'België', de: 'Duitsland', fr: 'Frankrijk',
    at: 'Oostenrijk', cz: 'Tsjechië', sk: 'Slowakije', pl: 'Polen',
    gb: 'Verenigd Koninkrijk', us: 'Verenigde Staten', es: 'Spanje',
    it: 'Italië', pt: 'Portugal', lu: 'Luxemburg',
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
  preview = 'Je bestelling is verzonden!',
}) => {
  const currency = order.currency_code || 'eur'
  const items = order.items || []
  const displayId = order.metadata?.custom_order_number || order.display_id || order.id

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
            Je bestelling is verzonden!
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '13px',
            color: 'rgba(255,255,255,0.7)',
            margin: '0',
          }}>
            Bestelling #{displayId}
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
              &#128230; Onderweg naar jou
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
            Goed nieuws! Je bestelling is ingepakt en onderweg naar je. Hieronder vind je de details van je verzending.
          </Text>
        </div>

        {/* ====== TRACKING INFO ====== */}
        {(trackingNumber || trackingUrl) && (
          <div style={{ padding: `24px ${pad} 0` }}>
            <div style={{
              backgroundColor: colors.greenBg,
              borderRadius: '12px',
              border: `1px solid ${colors.greenBorder}`,
              padding: '20px 22px',
              textAlign: 'center' as const,
            }}>
              <Text style={{
                fontFamily: font,
                fontSize: '12px',
                fontWeight: 700,
                textTransform: 'uppercase' as const,
                letterSpacing: '1px',
                color: colors.greenText,
                marginBottom: '12px',
              }}>
                Track &amp; Trace
              </Text>
              {trackingCompany && (
                <Text style={{
                  fontFamily: font,
                  fontSize: '14px',
                  color: colors.textBody,
                  marginBottom: '6px',
                }}>
                  Vervoerder: <strong style={{ color: colors.textDark }}>{trackingCompany}</strong>
                </Text>
              )}
              {trackingNumber && (
                <Text style={{
                  fontFamily: font,
                  fontSize: '14px',
                  color: colors.textBody,
                  marginBottom: trackingUrl ? '14px' : '0',
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
                    fontSize: '15px',
                    fontWeight: 700,
                    textDecoration: 'none',
                    padding: '12px 36px',
                    borderRadius: '10px',
                    display: 'inline-block',
                  }}
                >
                  Volg je pakket &#8594;
                </Link>
              )}
            </div>
          </div>
        )}

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
              &#128666; &nbsp;<strong>Verwachte levering: 4–7 werkdagen</strong>
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

        {/* ====== ITEMS ====== */}
        <div style={{ padding: `24px ${pad} 0` }}>
          <Text style={{
            fontFamily: font,
            fontSize: '12px',
            fontWeight: 700,
            textTransform: 'uppercase' as const,
            letterSpacing: '1px',
            color: colors.accent,
            marginBottom: '14px',
          }}>
            Verzonden items
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
        </div>

        {/* ====== SHIPPING ADDRESS ====== */}
        <div style={{ padding: `20px ${pad} 0` }}>
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
          <div style={{
            backgroundColor: colors.boxBg,
            borderRadius: '12px',
            border: `1px solid ${colors.boxBorder}`,
            padding: '16px 20px',
          }}>
            <Text style={{
              fontFamily: font,
              fontSize: '14px',
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
          </div>
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
            Wat kun je verwachten?
          </Text>

          {/* Step 1 — done */}
          <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ borderCollapse: 'collapse' as const, marginBottom: '16px' }}>
            <tbody>
              <tr>
                <td width="38" valign="top">
                  <div style={{
                    width: '28px',
                    height: '28px',
                    backgroundColor: colors.greenText,
                    borderRadius: '50%',
                    textAlign: 'center' as const,
                    lineHeight: '28px',
                    fontFamily: font,
                    fontSize: '14px',
                    fontWeight: 700,
                    color: '#ffffff',
                  }}>&#10003;</div>
                </td>
                <td style={{ fontFamily: font, fontSize: '14px', color: colors.textBody, lineHeight: '1.6', paddingLeft: '6px' }}>
                  <strong style={{ color: colors.textDark }}>Verzonden</strong>
                  <br />
                  <span style={{ fontSize: '13px', color: colors.textMuted }}>Je bestelling is ingepakt en verzonden vanuit ons magazijn.</span>
                </td>
              </tr>
            </tbody>
          </table>

          {/* Step 2 — current */}
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
                  }}>2</div>
                </td>
                <td style={{ fontFamily: font, fontSize: '14px', color: colors.textBody, lineHeight: '1.6', paddingLeft: '6px' }}>
                  <strong style={{ color: colors.textDark }}>Onderweg</strong>
                  <br />
                  <span style={{ fontSize: '13px', color: colors.textMuted }}>De vervoerder brengt je pakket naar het opgegeven adres.</span>
                </td>
              </tr>
            </tbody>
          </table>

          {/* Step 3 — pending */}
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
            border: '1px solid #FED7AA',
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
              Vragen over je verzending?
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
            Veel plezier met je viervoeter!
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
  billingEntity: {
    legal_name: 'EverChapter OÜ',
    registration_id: '16938029',
    address: { city: 'Tallinn', district: 'Estonia' },
  },
} as any

export default DhShipmentNotificationTemplate
