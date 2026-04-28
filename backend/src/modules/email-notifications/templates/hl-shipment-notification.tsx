import { Text, Section, Hr, Link } from '@react-email/components'
import * as React from 'react'
import { Base } from './base'
import { getBundleBookLabel } from '../../../utils/bundle-quantity'

export const HL_SHIPMENT_NOTIFICATION = 'hl-shipment-notification'

export interface HlShipmentNotificationTemplateProps {
  order: any
  shippingAddress: any
  trackingNumber?: string
  trackingUrl?: string
  trackingCompany?: string
  billingEntity?: any
  preview?: string
}

export const isHlShipmentNotificationData = (data: any): data is HlShipmentNotificationTemplateProps =>
  typeof data.order === 'object' && typeof data.shippingAddress === 'object'

const font = "'Inter', Arial, sans-serif"
const pad = '24px'

const colors = {
  headerBg: '#4A1A2E',
  headerGradient: 'linear-gradient(135deg, #5A2D3E 0%, #4A1A2E 50%, #3D1E2A 100%)',
  accent: '#B85C4A',
  accentSoft: '#FAF5F8',
  textDark: '#2D1B26',
  textBody: '#5A3D40',
  textMuted: '#8A7884',
  boxBorder: '#EDD9E5',
  footerBg: '#3D1E2A',
  footerText: '#9B7889',
  footerAccent: '#C9A96E',
  divider: '#EDD9E5',
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

export const HlShipmentNotificationTemplate: React.FC<HlShipmentNotificationTemplateProps> & {
  PreviewProps: any
} = ({
  order,
  shippingAddress,
  trackingNumber,
  trackingUrl,
  trackingCompany,
  billingEntity,
  preview = 'Je bestelling is verzonden — track & trace zit erbij.',
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
            color: colors.footerAccent,
            marginBottom: '8px',
          }}>
            ✦ LIFE RESET™ Methode
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
            color: colors.footerText,
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
            Goed nieuws! Je bestelling is ingepakt en onderweg naar je. Hieronder vind je de details — en de track &amp; trace zodat je je pakket kunt volgen.
          </Text>
        </div>

        {/* TRACKING INFO */}
        {(trackingNumber || trackingUrl) && (
          <div style={{ padding: `20px ${pad} 0 ${pad}` }}>
            <div style={{
              backgroundColor: '#E8F5E9',
              borderRadius: '10px',
              border: '1px solid #A5D6A7',
              padding: '18px 20px',
              textAlign: 'center' as const,
            }}>
              <Text style={{
                fontFamily: font,
                fontSize: '11px',
                fontWeight: 600,
                textTransform: 'uppercase' as const,
                letterSpacing: '1.5px',
                color: '#2E7D32',
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
              🚚 &nbsp; <strong>Verwachte levering:</strong> 3–5 werkdagen
            </Text>
            <Text style={{
              fontFamily: font,
              fontSize: '12px',
              color: '#9e9e9e',
              margin: '4px 0 0',
              lineHeight: '1.5',
            }}>
              We versturen via GLS — naar Nederland en België.
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
            color: colors.textMuted,
            marginBottom: '12px',
          }}>
            Verzonden items
          </Text>

          {items.map((item: any) => {
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
        </div>

        {/* SHIPPING ADDRESS */}
        <div style={{ padding: `20px ${pad} 0 ${pad}` }}>
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
          <div style={{
            backgroundColor: colors.accentSoft,
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
            Wat kun je verwachten?
          </Text>

          {[
            { num: '✓', bg: '#2e7d32', text: '#ffffff', title: 'Verzonden', desc: 'Je bestelling is ingepakt en op weg. Track & trace hierboven.' },
            { num: '2', bg: colors.accent, text: '#ffffff', title: 'Onderweg', desc: 'GLS brengt je pakket naar het opgegeven adres.' },
            { num: '3', bg: colors.boxBorder, text: colors.textDark, title: 'Bezorgd', desc: 'Binnen 3–5 werkdagen heb je je boek in huis. Begin met de oefeningen.' },
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
              Vragen over je verzending? Stuur me even een mailtje naar
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
            Veel leesplezier!
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
            Je ontvangt deze e-mail omdat je een bestelling hebt geplaatst op pakjeleventerug.nl.
          </Text>
        </div>
      </Section>
    </Base>
  )
}

HlShipmentNotificationTemplate.PreviewProps = {
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
        thumbnail: null,
      },
    ],
  },
  shippingAddress: {
    first_name: 'Sophie',
    last_name: 'van der Berg',
    address_1: 'Keizersgracht 412',
    city: 'Amsterdam',
    postal_code: '1016 GC',
    country_code: 'nl',
  },
  trackingNumber: 'GLS1234567890',
  trackingUrl: 'https://gls-group.eu/track/GLS1234567890',
  trackingCompany: 'GLS',
} as any

export default HlShipmentNotificationTemplate
