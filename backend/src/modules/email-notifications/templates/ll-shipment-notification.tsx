import { Text, Section, Hr, Link, Img } from '@react-email/components'
import * as React from 'react'
import { Base } from './base'

export const LL_SHIPMENT_NOTIFICATION = 'll-shipment-notification'

export interface LlShipmentNotificationTemplateProps {
  order: any
  shippingAddress: any
  trackingNumber?: string
  trackingUrl?: string
  trackingCompany?: string
  billingEntity?: any
  preview?: string
}

export const isLlShipmentNotificationData = (data: any): data is LlShipmentNotificationTemplateProps =>
  typeof data.order === 'object' && typeof data.shippingAddress === 'object'

const font = "'Inter', 'Segoe UI', Arial, sans-serif"
const pad = '28px'

// Lass Los Brand colors — Velvet Dusk palette (matches ll-order-placed)
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

function formatCountry(code: string): string {
  const map: Record<string, string> = {
    de: 'Deutschland', at: 'Österreich', lu: 'Luxemburg', ch: 'Schweiz',
    nl: 'Niederlande', be: 'Belgien', fr: 'Frankreich',
    cz: 'Tschechien', sk: 'Slowakei', pl: 'Polen',
    gb: 'Vereinigtes Königreich', us: 'Vereinigte Staaten', es: 'Spanien',
    it: 'Italien', pt: 'Portugal',
  }
  return map[(code || '').toLowerCase()] || (code || '').toUpperCase()
}

export const LlShipmentNotificationTemplate: React.FC<LlShipmentNotificationTemplateProps> & {
  PreviewProps: any
} = ({
  order,
  shippingAddress,
  trackingNumber,
  trackingUrl,
  trackingCompany,
  billingEntity,
  preview = 'Deine Bestellung wurde versendet!',
}) => {
  const currency = order.currency_code || 'eur'
  const items = order.items || []
  const rawDisplayId = order.display_id || order.id
  const displayId = order.metadata?.custom_order_number || (() => {
    const cc = (shippingAddress?.country_code || 'de').toUpperCase()
    const year = new Date().getFullYear()
    return `${cc}${year}-${rawDisplayId}`
  })()

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
            Deine Bestellung ist auf dem Weg!
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '13px',
            color: 'rgba(255,255,255,0.7)',
            margin: '0',
          }}>
            Bestellung {displayId}
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
              &#128230; Auf dem Weg zu dir
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
            Gute Nachrichten! Deine Bestellung wurde verpackt und ist auf dem Weg zu dir. Nachfolgend findest du die Details zu deiner Sendung.
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
                Sendungsverfolgung
              </Text>
              {trackingCompany && (
                <Text style={{
                  fontFamily: font,
                  fontSize: '14px',
                  color: colors.textBody,
                  marginBottom: '6px',
                }}>
                  Versanddienstleister: <strong style={{ color: colors.textDark }}>{trackingCompany}</strong>
                </Text>
              )}
              {trackingNumber && (
                <Text style={{
                  fontFamily: font,
                  fontSize: '14px',
                  color: colors.textBody,
                  marginBottom: trackingUrl ? '14px' : '0',
                }}>
                  Sendungsnummer: <strong style={{ color: colors.textDark }}>{trackingNumber}</strong>
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
                  Sendung verfolgen &#8594;
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
              &#128666; &nbsp;<strong>Voraussichtliche Lieferung: 3–5 Werktage</strong>
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
            Versendete Artikel
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
            Lieferadresse
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
            Was passiert als Nächstes?
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
                  <strong style={{ color: colors.textDark }}>Versendet</strong>
                  <br />
                  <span style={{ fontSize: '13px', color: colors.textMuted }}>Deine Bestellung wurde verpackt und aus unserem Lager versendet.</span>
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
                  <strong style={{ color: colors.textDark }}>Unterwegs</strong>
                  <br />
                  <span style={{ fontSize: '13px', color: colors.textMuted }}>Der Versanddienstleister bringt dein Paket an die angegebene Adresse.</span>
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
              Fragen zu deiner Sendung?
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
            Viel Freude beim Lesen!
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

LlShipmentNotificationTemplate.PreviewProps = {
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
  },
  shippingAddress: {
    first_name: 'Maria',
    last_name: 'Schneider',
    address_1: 'Hauptstraße 42',
    city: 'Berlin',
    postal_code: '10115',
    country_code: 'de',
  },
  trackingNumber: 'CZ9876543210',
  trackingUrl: 'https://tracking.example.com/CZ9876543210',
  trackingCompany: 'GLS',
  billingEntity: {
    legal_name: 'Performance Marketing Solution s.r.o.',
    registration_id: '17255679',
    address: { city: 'Praha', district: 'Tschechien' },
  },
} as any

export default LlShipmentNotificationTemplate
