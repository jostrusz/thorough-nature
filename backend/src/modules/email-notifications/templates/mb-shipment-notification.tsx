import { Text, Section, Hr, Link, Img } from '@react-email/components'
import * as React from 'react'
import { cleanItemTitle } from '../../../utils/clean-item-title'
import { Base } from './base'

export const MB_SHIPMENT_NOTIFICATION = 'mb-shipment-notification'

export interface MbShipmentNotificationTemplateProps {
  order: any
  shippingAddress: any
  trackingNumber?: string
  trackingUrl?: string
  trackingCompany?: string
  billingEntity?: any
  pickupPoint?: {
    name: string
    id?: string
    address?: string
  } | null
  preview?: string
}

export const isMbShipmentNotificationData = (data: any): data is MbShipmentNotificationTemplateProps =>
  typeof data.order === 'object' && typeof data.shippingAddress === 'object'

const font = "'Inter', 'Segoe UI', Arial, sans-serif"
const pad = '28px'

// Brand colors — warm orange palette (matching DH)
const colors = {
  headerBg: '#2D1B3D',
  headerGradient: 'linear-gradient(135deg, #2D1B3D 0%, #1A1028 100%)',
  accent: '#C27BA0',
  accentLight: '#D9A4C0',
  accentSoft: '#FAF5F8',
  accentMuted: '#9B7AAD',
  textDark: '#2D1B3D',
  textBody: '#5A3D6B',
  textMuted: '#9B7AAD',
  textLight: '#9B7AAD',
  boxBg: '#FAF5F8',
  boxBorder: '#EDD9E5',
  cardBg: '#FFFFFF',
  footerBg: '#2D1B3D',
  footerText: '#7a6189',
  footerAccent: '#C27BA0',
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
    return new Intl.NumberFormat('hu-HU', {
      style: 'currency',
      currency: (currencyCode || 'HUF').toUpperCase(),
    }).format(amount)
  } catch {
    return `${(amount || 0).toFixed(0)} Ft`
  }
}

function formatCountry(code: string): string {
  const map: Record<string, string> = {
    cz: 'Csehország', sk: 'Szlovákia', pl: 'Lengyelország', de: 'Németország',
    at: 'Ausztria', nl: 'Hollandia', be: 'Belgium', hu: 'Magyarország',
  }
  return map[(code || '').toLowerCase()] || (code || '').toUpperCase()
}

export const MbShipmentNotificationTemplate: React.FC<MbShipmentNotificationTemplateProps> & {
  PreviewProps: any
} = ({
  order,
  shippingAddress,
  trackingNumber,
  trackingUrl,
  trackingCompany,
  billingEntity,
  pickupPoint,
  preview = 'Elment a csomagod. Innentől a futáron múlik.',
}) => {
  const currency = order.currency_code || 'huf'
  const items = order.items || []
  const displayId = order.metadata?.custom_order_number || order.display_id || order.id

  // Detect pickup point from props or order metadata
  const pickup = pickupPoint || (order.metadata?.pickup_point_name ? {
    name: order.metadata.pickup_point_name,
    id: order.metadata.pickup_point_id,
    address: order.metadata.pickup_point_address,
  } : null)
  const isPickup = !!pickup

  // Billing entity — Czech company
  const entityName = billingEntity?.legal_name || 'Performance Marketing Solution s.r.o.'
  const entityAddress = billingEntity?.address_line || 'Rybná 716/24, Staré Město, 110 00 Praha'
  const entityIco = billingEntity?.ico || '06259928'
  const entityDic = billingEntity?.dic || 'CZ06259928'

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
            Macskabiblia
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
            A csomagod elindult
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '13px',
            color: 'rgba(255,255,255,0.7)',
            margin: '0',
          }}>
            Rendelés {displayId}
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
              &#128230; Úton hozzád
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
            Szia {shippingAddress?.first_name || 'kedves Vásárló'} 👋,
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            color: colors.textBody,
            lineHeight: '1.7',
            margin: '8px 0 0',
          }}>
            {isPickup
              ? 'Becsomagoltuk, ráment a címke, és a csomag elindult a Packeta csomagpont felé. Amint átvehető lesz, külön értesítést kapsz — azt már nem én küldöm, hanem a futárszolgálat.'
              : 'Becsomagoltuk, ráment a címke, és a csomag elindult hozzád. A követési adatokat lentebb találod. Innentől a futáron múlik, nem rajtam.'
            }
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
                Küldemény követése
              </Text>
              {trackingCompany && (
                <Text style={{
                  fontFamily: font,
                  fontSize: '14px',
                  color: colors.textBody,
                  marginBottom: '6px',
                }}>
                  Futárszolgálat: <strong style={{ color: colors.textDark }}>{trackingCompany}</strong>
                </Text>
              )}
              {trackingNumber && (
                <Text style={{
                  fontFamily: font,
                  fontSize: '14px',
                  color: colors.textBody,
                  marginBottom: trackingUrl ? '14px' : '0',
                }}>
                  Csomagkövetési szám: <strong style={{ color: colors.textDark }}>{trackingNumber}</strong>
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
                  Küldemény követése &#8594;
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
              {isPickup
                ? <><strong>&#128205; Kézbesítés Packeta csomagpontra</strong></>
                : <><strong>&#128666; Várható kézbesítés: 2–5 munkanap</strong></>
              }
            </Text>
            <Text style={{
              fontFamily: font,
              fontSize: '12px',
              color: colors.textMuted,
              margin: '6px 0 0',
              lineHeight: '1.5',
            }}>
              {isPickup ? 'A küldeményt a kiválasztott csomagponton veheted át.' : 'A könyveket a csehországi központi raktárunkból küldjük.'}
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
            Elküldött tételek
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
                          background: `linear-gradient(145deg, ${colors.accentSoft}, #EDD9E5)`,
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
                        {cleanItemTitle(item.product_title || item.title) || 'Tétel'}
                      </Text>
                      <Text style={{
                        fontFamily: font,
                        fontSize: '12px',
                        color: colors.textMuted,
                        margin: '0',
                      }}>
                        {item.variant_title ? `${item.variant_title} • ` : ''}Mennyiség: {item.quantity || 1}
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
            {isPickup ? 'Csomagpont' : 'Szállítási cím'}
          </Text>
          <div style={{
            backgroundColor: colors.boxBg,
            borderRadius: '12px',
            border: `1px solid ${colors.boxBorder}`,
            padding: '16px 20px',
          }}>
            {isPickup && pickup ? (
              <Text style={{
                fontFamily: font,
                fontSize: '14px',
                color: colors.textBody,
                lineHeight: '1.7',
                margin: '0',
              }}>
                <strong>{pickup.name}</strong>
                {pickup.id && <><br />Azonosító: {pickup.id}</>}
                {pickup.address && <><br />{pickup.address}</>}
              </Text>
            ) : (
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
            )}
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
            Mire számíthatsz?
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
                  <strong style={{ color: colors.textDark }}>Elküldve</strong>
                  <br />
                  <span style={{ fontSize: '13px', color: colors.textMuted }}>A rendelésedet becsomagoltuk és feladtuk a raktárunkból.</span>
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
                  <strong style={{ color: colors.textDark }}>Úton van</strong>
                  <br />
                  <span style={{ fontSize: '13px', color: colors.textMuted }}>{isPickup ? 'A küldemény a Packeta csomagpontod felé tart.' : 'A futárszolgálat a megadott címre viszi a küldeményt.'}</span>
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
                  <strong style={{ color: colors.textDark }}>Kézbesítve</strong>
                  <br />
                  <span style={{ fontSize: '13px', color: colors.textMuted }}>{isPickup ? 'A küldeményt a csomagponton veheted át.' : '2–5 munkanapon belül otthon lesz a könyved.'}</span>
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
            border: '1px solid #EDD9E5',
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
              Napok óta nem mozdul a csomagkövetés? Írj, ezt a postafiókot én olvasom.
              <br />
              <Link href="mailto:konyv@macskabiblia-konyv.hu" style={{ color: colors.accent, textDecoration: 'underline', fontWeight: 700 }}>
                konyv@macskabiblia-konyv.hu
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
            Jó olvasást! 🐱 A macskád valószínűleg előbb ül rá a könyvre, mint ahogy kinyitod.
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            fontWeight: 700,
            color: colors.textDark,
            margin: '0 0 2px',
          }}>
            Nagy Zoltán
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '13px',
            color: colors.textMuted,
            margin: '0',
          }}>
            <Link href="mailto:konyv@macskabiblia-konyv.hu" style={{ color: colors.accent, textDecoration: 'none' }}>
              konyv@macskabiblia-konyv.hu
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
            Macskabiblia
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
            IČO: {entityIco} &bull; DIČ: {entityDic}
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '11px',
            color: '#71717A',
            lineHeight: '1.5',
            margin: '0',
          }}>
            Ezt az e-mailt azért kaptad, mert rendelést adtál le a macskabiblia-konyv.hu oldalon.
          </Text>
        </div>
      </Section>
    </Base>
  )
}

MbShipmentNotificationTemplate.PreviewProps = {
  order: {
    id: 'test-order-id',
    display_id: '812',
    metadata: { custom_order_number: 'HU2026-812' },
    created_at: new Date().toISOString(),
    email: 'kovacs.eszter@gmail.com',
    currency_code: 'huf',
    items: [
      {
        id: 'item-1',
        title: 'Macskabiblia',
        product_title: 'Macskabiblia',
        variant_title: null,
        quantity: 2,
        unit_price: 7990,
        thumbnail: null,
      },
    ],
  },
  shippingAddress: {
    first_name: 'Eszter',
    last_name: 'Kovács',
    address_1: 'Andrássy út 60',
    city: 'Budapest',
    postal_code: '1062',
    country_code: 'hu',
  },
  trackingNumber: 'Z10009876543',
  trackingUrl: 'https://tracking.packeta.com/hu/Z10009876543',
  trackingCompany: 'Packeta',
  pickupPoint: null,
} as any

export default MbShipmentNotificationTemplate
