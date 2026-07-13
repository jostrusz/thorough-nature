import { Text, Section, Hr, Link } from '@react-email/components'
import * as React from 'react'
import { cleanItemTitle } from '../../../utils/clean-item-title'
import { displayBookQty, isBookBundle } from '../../../utils/bundle-book-count'
import { Base } from './base'

export const ZV_SHIPMENT_NOTIFICATION = 'zv-shipment-notification'

export interface ZvShipmentNotificationTemplateProps {
  order: any
  shippingAddress: any
  trackingNumber?: string
  trackingUrl?: string
  trackingCompany?: string
  billingEntity?: any
  preview?: string
}

export const isZvShipmentNotificationData = (data: any): data is ZvShipmentNotificationTemplateProps =>
  typeof data.order === 'object' && typeof data.shippingAddress === 'object'

const font = "'Inter', Arial, sans-serif"
const pad = '24px'

function formatPrice(amount: number, currencyCode: string): string {
  try {
    return new Intl.NumberFormat('cs-CZ', {
      style: 'currency',
      currency: (currencyCode || 'CZK').toUpperCase(),
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  } catch {
    return `${Math.round(amount || 0)} Kč`
  }
}

function formatCountry(code: string): string {
  const map: Record<string, string> = {
    cz: 'Česká republika',
    sk: 'Slovensko',
    pl: 'Polsko',
    de: 'Německo',
    at: 'Rakousko',
    nl: 'Nizozemsko',
    be: 'Belgie',
    hu: 'Maďarsko',
  }
  return map[(code || '').toLowerCase()] || (code || '').toUpperCase()
}

export const ZvShipmentNotificationTemplate: React.FC<ZvShipmentNotificationTemplateProps> & {
  PreviewProps: any
} = ({
  order,
  shippingAddress,
  trackingNumber,
  trackingUrl,
  trackingCompany,
  billingEntity,
  preview = 'Tvoje objednávka je na cestě!',
}) => {
  const currency = order.currency_code || 'czk'
  const items = order.items || []
  const displayId = order.metadata?.custom_order_number || order.display_id || order.id

  // Detect Zásilkovna pickup point vs home delivery
  const pickupName = order.metadata?.pickup_point_name || order.metadata?.packeta_point_name || ''
  const pickupAddress = order.metadata?.pickup_point_address || order.metadata?.packeta_point_address || ''
  const isPickup = order.metadata?.shipping_method === 'zasilkovna_pickup' || !!pickupName

  return (
    <Base preview={preview}>
      <Section>
        {/* HEADER */}
        <div style={{
          backgroundColor: '#4A1A2E',
          background: 'linear-gradient(135deg, #4A1A2E 0%, #3D1E2A 100%)',
          padding: '32px 24px',
          textAlign: 'center' as const,
        }}>
          <Text style={{
            fontFamily: font,
            fontSize: '11px',
            fontWeight: 500,
            letterSpacing: '1.5px',
            textTransform: 'uppercase' as const,
            color: '#B85C4A',
            marginBottom: '8px',
          }}>
            Život, jaký si zasloužíš
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
            Tvoje objednávka je na cestě!
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '13px',
            color: '#9B6B7A',
            margin: '6px 0 0',
          }}>
            Objednávka #{displayId}
          </Text>
        </div>

        {/* GREETING */}
        <div style={{ padding: `28px ${pad} 0 ${pad}` }}>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            color: '#6B3344',
            lineHeight: '1.6',
            marginBottom: '6px',
          }}>
            Ahoj {shippingAddress?.first_name || 'tam'},
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            color: '#6B3344',
            lineHeight: '1.6',
            marginBottom: '0',
          }}>
            skvělá zpráva! Tvoje objednávka je zabalená a už míří k tobě. Níže najdeš detaily zásilky.
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
                Sledování zásilky
              </Text>
              {trackingCompany && (
                <Text style={{
                  fontFamily: font,
                  fontSize: '13px',
                  color: '#6B3344',
                  marginBottom: '6px',
                }}>
                  Dopravce: <strong style={{ color: '#4A1A2E' }}>{trackingCompany}</strong>
                </Text>
              )}
              {trackingNumber && (
                <Text style={{
                  fontFamily: font,
                  fontSize: '13px',
                  color: '#6B3344',
                  marginBottom: trackingUrl ? '12px' : '0',
                }}>
                  Číslo zásilky: <strong style={{ color: '#4A1A2E' }}>{trackingNumber}</strong>
                </Text>
              )}
              {trackingUrl && (
                <Link
                  href={trackingUrl}
                  style={{
                    backgroundColor: '#B85C4A',
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
                  Sledovat zásilku →
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
              🚚 &nbsp; <strong>Předpokládané doručení:</strong> do 2 pracovních dnů
            </Text>
            <Text style={{
              fontFamily: font,
              fontSize: '12px',
              color: '#9e9e9e',
              margin: '4px 0 0',
              lineHeight: '1.5',
            }}>
              Knihy máme skladem v ČR a doručuje je Zásilkovna.
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
            color: '#9B6B7A',
            marginBottom: '12px',
          }}>
            Odeslané položky
          </Text>

          {items.map((item: any) => (
            <div key={item.id} style={{
              marginBottom: '10px',
              backgroundColor: '#FDF5EF',
              borderRadius: '8px',
              border: '1px solid #F0D5C4',
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
                          background: 'linear-gradient(135deg, #4A1A2E, #6B3344)',
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
                        color: '#4A1A2E',
                        margin: '0 0 2px',
                        lineHeight: '1.3',
                      }}>
                        {cleanItemTitle(item.product_title || item.title) || 'Položka'}
                      </Text>
                      <Text style={{
                        fontFamily: font,
                        fontSize: '12px',
                        color: '#9B6B7A',
                        margin: '0',
                      }}>
                        {isBookBundle(item) ? '' : (item.variant_title ? `${item.variant_title} • ` : '')}Množství: {displayBookQty(item)}
                      </Text>
                    </td>
                    <td width="80" align="right" valign="top">
                      <Text style={{
                        fontFamily: font,
                        fontSize: '14px',
                        fontWeight: 700,
                        color: '#4A1A2E',
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
            color: '#9B6B7A',
            marginBottom: '8px',
          }}>
            {isPickup ? 'Výdejní místo Zásilkovny' : 'Doručovací adresa'}
          </Text>
          <div style={{
            backgroundColor: '#FDF5EF',
            borderRadius: '10px',
            border: '1px solid #F0D5C4',
            padding: '14px 18px',
          }}>
            {isPickup ? (
              <Text style={{
                fontFamily: font,
                fontSize: '13px',
                color: '#6B3344',
                lineHeight: '1.6',
                margin: '0',
              }}>
                <strong style={{ color: '#4A1A2E' }}>{pickupName}</strong>
                {pickupAddress && (
                  <>
                    <br />
                    {pickupAddress}
                  </>
                )}
                <br />
                {formatCountry(shippingAddress?.country_code)}
              </Text>
            ) : (
              <Text style={{
                fontFamily: font,
                fontSize: '13px',
                color: '#6B3344',
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
            )}
          </div>
        </div>

        <Hr style={{ borderColor: '#F0D5C4', margin: `20px ${pad} 0 ${pad}` }} />

        {/* WHAT HAPPENS NEXT */}
        <div style={{ padding: `20px ${pad} 0 ${pad}` }}>
          <Text style={{
            fontFamily: font,
            fontSize: '11px',
            fontWeight: 600,
            textTransform: 'uppercase' as const,
            letterSpacing: '1.5px',
            color: '#9B6B7A',
            marginBottom: '14px',
          }}>
            Co tě čeká?
          </Text>

          <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ borderCollapse: 'collapse' as const, marginBottom: '12px' }}>
            <tbody>
              <tr>
                <td width="34" valign="top">
                  <div style={{
                    width: '26px',
                    height: '26px',
                    backgroundColor: '#2e7d32',
                    borderRadius: '50%',
                    textAlign: 'center' as const,
                    lineHeight: '26px',
                    fontFamily: font,
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#ffffff',
                  }}>✓</div>
                </td>
                <td style={{ fontFamily: font, fontSize: '13px', color: '#6B3344', lineHeight: '1.5', paddingLeft: '8px' }}>
                  <strong style={{ color: '#4A1A2E' }}>Odesláno</strong>
                  <br />
                  Tvoje objednávka je zabalená a opustila náš sklad.
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
                    backgroundColor: '#B85C4A',
                    borderRadius: '50%',
                    textAlign: 'center' as const,
                    lineHeight: '26px',
                    fontFamily: font,
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#ffffff',
                  }}>2</div>
                </td>
                <td style={{ fontFamily: font, fontSize: '13px', color: '#6B3344', lineHeight: '1.5', paddingLeft: '8px' }}>
                  <strong style={{ color: '#4A1A2E' }}>Na cestě</strong>
                  <br />
                  {isPickup
                    ? 'Zásilkovna právě veze balíček na tvoje výdejní místo.'
                    : 'Zásilkovna právě veze balíček na tvou adresu.'}
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
                    backgroundColor: '#F0D5C4',
                    borderRadius: '50%',
                    textAlign: 'center' as const,
                    lineHeight: '26px',
                    fontFamily: font,
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#4A1A2E',
                  }}>3</div>
                </td>
                <td style={{ fontFamily: font, fontSize: '13px', color: '#6B3344', lineHeight: '1.5', paddingLeft: '8px' }}>
                  <strong style={{ color: '#4A1A2E' }}>Doručeno</strong>
                  <br />
                  {isPickup
                    ? 'Jakmile bude balíček připravený k vyzvednutí, přijde ti SMS a e-mail s kódem. Na vyzvednutí máš zpravidla 7 dní.'
                    : 'Do 2 pracovních dnů máš knihu doma!'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* HELP SECTION */}
        <div style={{ padding: `24px ${pad} 0 ${pad}` }}>
          <div style={{
            backgroundColor: '#FDF5EF',
            borderRadius: '10px',
            border: '1px solid #F0D5C4',
            padding: '16px 20px',
            textAlign: 'center' as const,
          }}>
            <Text style={{
              fontFamily: font,
              fontSize: '13px',
              color: '#6B3344',
              lineHeight: '1.6',
              margin: '0',
            }}>
              Máš dotaz k zásilce? Napiš mi na
              <br />
              <Link href="mailto:anna@nejdriv-ja.cz" style={{ color: '#B85C4A', textDecoration: 'underline', fontWeight: 600 }}>
                anna@nejdriv-ja.cz
              </Link>
            </Text>
          </div>
        </div>

        {/* SIGNATURE */}
        <div style={{ padding: `20px ${pad} 24px ${pad}` }}>
          <Text style={{
            fontFamily: font,
            fontSize: '14px',
            color: '#6B3344',
            marginBottom: '4px',
          }}>
            Příjemné čtení!
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '14px',
            fontWeight: 700,
            color: '#4A1A2E',
            marginBottom: '2px',
          }}>
            Anna de Vries
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '12px',
            color: '#9B6B7A',
          }}>
            <Link href="mailto:anna@nejdriv-ja.cz" style={{ color: '#B85C4A', textDecoration: 'none' }}>
              anna@nejdriv-ja.cz
            </Link>
          </Text>
        </div>

        {/* FOOTER */}
        <div style={{
          backgroundColor: '#4A1A2E',
          padding: '24px 24px',
          textAlign: 'center' as const,
        }}>
          <Text style={{
            fontFamily: font,
            fontSize: '12px',
            color: '#B85C4A',
            marginBottom: '6px',
          }}>
            Život, jaký si zasloužíš
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '11px',
            color: '#9B6B7A',
            lineHeight: '1.6',
            margin: '0',
          }}>
            {billingEntity?.legal_name || 'EverChapter OÜ'}
            {' '}&bull;{' '}
            {billingEntity?.address
              ? `${billingEntity.address.address_1 || ''}, ${billingEntity.address.postal_code || ''} ${billingEntity.address.city || ''}${billingEntity.address.district ? ', ' + billingEntity.address.district : ''}`
              : 'Tallinn, Estonia'}
            {billingEntity?.registration_id && (
              <>
                <br />
                Reg. č.: {billingEntity.registration_id}
                {billingEntity.vat_id && ` · DIČ: ${billingEntity.vat_id}`}
              </>
            )}
            <br />
            Tento e-mail ti přišel, protože sis objednala knihu na www.nejdriv-ja.cz.
          </Text>
        </div>
      </Section>
    </Base>
  )
}

ZvShipmentNotificationTemplate.PreviewProps = {
  order: {
    id: 'test-order-id',
    display_id: '1001',
    metadata: {
      custom_order_number: 'CZ2026-1001',
    },
    created_at: new Date().toISOString(),
    email: 'petra.svobodova@seznam.cz',
    currency_code: 'czk',
    items: [
      {
        id: 'item-1',
        title: 'Život, jaký si zasloužíš',
        product_title: 'Život, jaký si zasloužíš',
        variant_title: '',
        quantity: 1,
        unit_price: 749,
        thumbnail: null,
      },
    ],
  },
  shippingAddress: {
    first_name: 'Petra',
    last_name: 'Svobodová',
    address_1: 'Korunní 810/104',
    city: 'Praha 10',
    postal_code: '101 00',
    country_code: 'cz',
  },
  trackingNumber: 'Z1234567890',
  trackingUrl: 'https://tracking.packeta.com/cs/?id=Z1234567890',
  trackingCompany: 'Zásilkovna',
} as any

export default ZvShipmentNotificationTemplate
