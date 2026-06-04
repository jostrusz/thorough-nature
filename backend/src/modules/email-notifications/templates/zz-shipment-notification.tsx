import { Text, Section, Hr, Link } from '@react-email/components'
import * as React from 'react'
import { cleanItemTitle } from '../../../utils/clean-item-title'
import { Base } from './base'

export const ZZ_SHIPMENT_NOTIFICATION = 'zz-shipment-notification'

export interface ZzShipmentNotificationTemplateProps {
  order: any
  shippingAddress: any
  trackingNumber?: string
  trackingUrl?: string
  trackingCompany?: string
  billingEntity?: any
  preview?: string
}

export const isZzShipmentNotificationData = (data: any): data is ZzShipmentNotificationTemplateProps =>
  typeof data.order === 'object' && typeof data.shippingAddress === 'object'

const font = "'Inter', Arial, sans-serif"
const pad = '24px'

function formatPrice(amount: number, currencyCode: string): string {
  try {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: (currencyCode || 'PLN').toUpperCase(),
    }).format(amount)
  } catch {
    return `${(amount || 0).toFixed(2).replace('.', ',')} zł`
  }
}

function formatCountry(code: string): string {
  const map: Record<string, string> = {
    pl: 'Polska',
    de: 'Niemcy',
    at: 'Austria',
    cz: 'Czechy',
    sk: 'Słowacja',
    nl: 'Holandia',
    be: 'Belgia',
    fr: 'Francja',
    gb: 'Wielka Brytania',
    se: 'Szwecja',
    hu: 'Węgry',
    lt: 'Litwa',
    lv: 'Łotwa',
    ee: 'Estonia',
  }
  return map[(code || '').toLowerCase()] || (code || '').toUpperCase()
}

export const ZzShipmentNotificationTemplate: React.FC<ZzShipmentNotificationTemplateProps> & {
  PreviewProps: any
} = ({
  order,
  shippingAddress,
  trackingNumber,
  trackingUrl,
  trackingCompany,
  billingEntity,
  preview = 'Twoje zamówienie zostało wysłane!',
}) => {
  const currency = order.currency_code || 'pln'
  const items = order.items || []
  const displayId = order.metadata?.custom_order_number || order.display_id || order.id

  // Detect pickup point (Paczkomat) vs home delivery
  const isPaczkomat = order.metadata?.shipping_method === 'zasilkovna_pickup'
    || !!(order.metadata?.paczkomat_name)
  const paczkomatName = order.metadata?.paczkomat_name || ''
  const paczkomatAddress = order.metadata?.paczkomat_address || ''

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
            Życie, jakiego nigdy sobie nie pozwoliłaś
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
            Twoje zamówienie jest w drodze!
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '13px',
            color: '#9B6B7A',
            margin: '6px 0 0',
          }}>
            Zamówienie #{displayId}
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
            Cześć {shippingAddress?.first_name || 'tam'},
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            color: '#6B3344',
            lineHeight: '1.6',
            marginBottom: '0',
          }}>
            Świetna wiadomość! Twoje zamówienie zostało zapakowane i jest już w drodze do Ciebie. Poniżej znajdziesz szczegóły przesyłki.
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
                Śledzenie przesyłki
              </Text>
              {trackingCompany && (
                <Text style={{
                  fontFamily: font,
                  fontSize: '13px',
                  color: '#6B3344',
                  marginBottom: '6px',
                }}>
                  Przewoźnik: <strong style={{ color: '#4A1A2E' }}>{trackingCompany}</strong>
                </Text>
              )}
              {trackingNumber && (
                <Text style={{
                  fontFamily: font,
                  fontSize: '13px',
                  color: '#6B3344',
                  marginBottom: trackingUrl ? '12px' : '0',
                }}>
                  Numer śledzenia: <strong style={{ color: '#4A1A2E' }}>{trackingNumber}</strong>
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
                  Śledź przesyłkę →
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
              🚚 &nbsp; <strong>Przewidywana dostawa:</strong> 2–4 dni roboczych
            </Text>
            <Text style={{
              fontFamily: font,
              fontSize: '12px',
              color: '#9e9e9e',
              margin: '4px 0 0',
              lineHeight: '1.5',
            }}>
              Nasze książki wysyłamy z centralnego magazynu w Czechach.
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
            Wysłane produkty
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
                        {cleanItemTitle(item.product_title || item.title) || 'Produkt'}
                      </Text>
                      <Text style={{
                        fontFamily: font,
                        fontSize: '12px',
                        color: '#9B6B7A',
                        margin: '0',
                      }}>
                        {item.variant_title ? `${item.variant_title} \u2022 ` : ''}Ilość: {item.quantity || 1}
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
            {isPaczkomat ? 'Paczkomat InPost' : 'Adres dostawy'}
          </Text>
          <div style={{
            backgroundColor: '#FDF5EF',
            borderRadius: '10px',
            border: '1px solid #F0D5C4',
            padding: '14px 18px',
          }}>
            {isPaczkomat ? (
              <Text style={{
                fontFamily: font,
                fontSize: '13px',
                color: '#6B3344',
                lineHeight: '1.6',
                margin: '0',
              }}>
                <strong style={{ color: '#4A1A2E' }}>{paczkomatName}</strong>
                {paczkomatAddress && (
                  <>
                    <br />
                    {paczkomatAddress}
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
            Czego się spodziewać?
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
                  <strong style={{ color: '#4A1A2E' }}>Wysłane</strong>
                  <br />
                  Twoje zamówienie zostało zapakowane i wysłane z naszego magazynu.
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
                  <strong style={{ color: '#4A1A2E' }}>W drodze</strong>
                  <br />
                  {isPaczkomat
                    ? 'Przewoźnik dostarcza paczkę do wybranego Paczkomatu InPost.'
                    : 'Przewoźnik dostarcza paczkę pod wskazany adres.'}
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
                  <strong style={{ color: '#4A1A2E' }}>Dostarczono</strong>
                  <br />
                  {isPaczkomat
                    ? 'Otrzymasz SMS i e-mail z kodem odbioru, gdy paczka będzie czekać w Paczkomacie. Masz 48 godzin na odbiór.'
                    : 'W ciągu 2–4 dni roboczych otrzymasz swoją książkę!'}
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
              Masz pytania dotyczące przesyłki? Napisz do nas na
              <br />
              <Link href="mailto:anna@najpierw-ja.pl" style={{ color: '#B85C4A', textDecoration: 'underline', fontWeight: 600 }}>
                anna@najpierw-ja.pl
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
            Miłego czytania!
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
            <Link href="mailto:anna@najpierw-ja.pl" style={{ color: '#B85C4A', textDecoration: 'none' }}>
              anna@najpierw-ja.pl
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
            Życie, jakiego nigdy sobie nie pozwoliłaś
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '11px',
            color: '#9B6B7A',
            lineHeight: '1.6',
            margin: '0',
          }}>
            {billingEntity?.legal_name || 'Performance Marketing Solution s.r.o.'}
            {' '}&bull;{' '}
            {billingEntity?.address
              ? `${billingEntity.address.address_1 || ''}, ${billingEntity.address.postal_code || ''} ${billingEntity.address.city || ''}${billingEntity.address.district ? ', ' + billingEntity.address.district : ''}`
              : 'Rybná 716/24, 110 00 Praha, Staré Město'}
            {billingEntity?.registration_id && (
              <>
                <br />
                IČO: {billingEntity.registration_id}
                {billingEntity.vat_id && ` · DIČ: ${billingEntity.vat_id}`}
              </>
            )}
            {!billingEntity && (
              <>
                <br />
                IČO: 06259928 · DIČ: CZ06259928
              </>
            )}
            <br />
            Otrzymujesz tę wiadomość, ponieważ złożyłaś zamówienie.
          </Text>
        </div>
      </Section>
    </Base>
  )
}

ZzShipmentNotificationTemplate.PreviewProps = {
  order: {
    id: 'test-order-id',
    display_id: '2001',
    created_at: new Date().toISOString(),
    email: 'anna@example.pl',
    currency_code: 'pln',
    items: [
      {
        id: 'item-1',
        title: 'Życie, jakiego nigdy sobie nie pozwoliłaś',
        product_title: 'Życie, jakiego nigdy sobie nie pozwoliłaś',
        variant_title: '',
        quantity: 1,
        unit_price: 129,
        thumbnail: null,
      },
    ],
  },
  shippingAddress: {
    first_name: 'Anna',
    last_name: 'Kowalska',
    address_1: 'ul. Marszałkowska 12',
    city: 'Warszawa',
    postal_code: '00-001',
    country_code: 'pl',
  },
  trackingNumber: 'PL1234567890',
  trackingUrl: 'https://tracking.example.com/PL1234567890',
  trackingCompany: 'InPost',
} as any

export default ZzShipmentNotificationTemplate
