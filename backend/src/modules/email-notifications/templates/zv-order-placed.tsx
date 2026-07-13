import { Text, Section, Hr, Link } from '@react-email/components'
import * as React from 'react'
import { cleanItemTitle } from '../../../utils/clean-item-title'
import { displayBookQty, isBookBundle } from '../../../utils/bundle-book-count'
import { Base } from './base'

export const ZV_ORDER_PLACED = 'zv-order-placed'

export interface ZvOrderPlacedTemplateProps {
  order: any
  shippingAddress: any
  billingAddress?: any
  paymentMethod?: string
  billingEntity?: any
  preview?: string
}

export const isZvOrderPlacedTemplateData = (data: any): data is ZvOrderPlacedTemplateProps =>
  typeof data.order === 'object' && typeof data.shippingAddress === 'object'

const font = "'Inter', Arial, sans-serif"
const pad = '24px'
const padLR = `0 ${pad}`

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

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('cs-CZ', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Prague',
    })
  } catch {
    return dateStr
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

export const ZvOrderPlacedTemplate: React.FC<ZvOrderPlacedTemplateProps> & {
  PreviewProps: any
} = ({
  order,
  shippingAddress,
  billingAddress,
  paymentMethod,
  billingEntity,
  preview = 'Děkuju ti za objednávku!',
}) => {
  const currency = order.currency_code || 'czk'
  const items = order.items || []
  const displayId = order.metadata?.custom_order_number || order.display_id || order.id
  const orderDate = formatDate(order.created_at)

  // Detect Zásilkovna pickup point vs home delivery
  const pickupName = order.metadata?.pickup_point_name || order.metadata?.packeta_point_name || ''
  const pickupAddress = order.metadata?.pickup_point_address || order.metadata?.packeta_point_address || ''
  const isPickup = order.metadata?.shipping_method === 'zasilkovna_pickup' || !!pickupName

  // Calculate totals
  const subtotal = items.reduce(
    (sum: number, item: any) => sum + (item.unit_price || 0) * (item.quantity || 1),
    0
  )
  // Use non-raw summary values (major units) — raw_* values can be in minor units (haléře)
  const shippingTotal = order.summary?.shipping_total ?? 0
  const taxTotal = order.summary?.tax_total ?? 0
  const total = order.summary?.current_order_total ?? subtotal + shippingTotal

  const invoiceAddress = billingAddress || shippingAddress

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
            fontFamily: font,
            fontSize: '24px',
            fontWeight: 700,
            color: '#ffffff',
            margin: '0',
            lineHeight: '1.3',
          }}>
            Děkuju ti za objednávku!
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '13px',
            color: '#9B6B7A',
            margin: '6px 0 0',
          }}>
            Objednávka #{displayId} &bull; {orderDate}
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
            mám velkou radost, že ses do toho pustila! Tvoje objednávka je přijatá a už na ní pracujeme. Níže najdeš kompletní přehled.
          </Text>
        </div>

        {/* ORDER SUMMARY BOX */}
        <div style={{ padding: `20px ${pad}` }}>
          <div style={{
            backgroundColor: '#FDF5EF',
            borderRadius: '10px',
            border: '1px solid #F0D5C4',
            padding: '16px 20px',
          }}>
            <div style={{ marginBottom: '6px' }}>
              <Text style={{
                fontFamily: font,
                fontSize: '13px',
                color: '#6B3344',
                margin: '0',
              }}>
                <strong style={{ color: '#4A1A2E' }}>Objednávka:</strong> &nbsp; #{displayId}
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
                  Potvrzeno
                </span>
              </Text>
            </div>
            <Text style={{
              fontFamily: font,
              fontSize: '13px',
              color: '#6B3344',
              margin: '0 0 4px',
            }}>
              <strong style={{ color: '#4A1A2E' }}>Datum:</strong> &nbsp; {orderDate}
            </Text>
            {paymentMethod && (
              <Text style={{
                fontFamily: font,
                fontSize: '13px',
                color: '#6B3344',
                margin: '0',
              }}>
                <strong style={{ color: '#4A1A2E' }}>Platební metoda:</strong> &nbsp; {paymentMethod}
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
            color: '#9B6B7A',
            marginBottom: '12px',
          }}>
            Tvoje objednávka
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

          {/* Totals */}
          <div style={{ marginTop: '14px', borderTop: '2px solid #F0D5C4', paddingTop: '12px' }}>
            <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ borderCollapse: 'collapse' as const }}>
              <tbody>
                <tr>
                  <td style={{ fontFamily: font, fontSize: '13px', color: '#6B3344', padding: '3px 0' }}>Mezisoučet</td>
                  <td align="right" style={{ fontFamily: font, fontSize: '13px', color: '#6B3344', padding: '3px 0' }}>{formatPrice(subtotal, currency)}</td>
                </tr>
                <tr>
                  <td style={{ fontFamily: font, fontSize: '13px', color: '#6B3344', padding: '3px 0' }}>Doprava</td>
                  <td align="right" style={{ fontFamily: font, fontSize: '13px', color: shippingTotal > 0 ? '#6B3344' : '#2e7d32', padding: '3px 0' }}>
                    {shippingTotal > 0 ? formatPrice(shippingTotal, currency) : 'Zdarma'}
                  </td>
                </tr>
                {taxTotal > 0 && (
                  <tr>
                    <td style={{ fontFamily: font, fontSize: '12px', color: '#9B6B7A', padding: '3px 0' }}>z toho DPH</td>
                    <td align="right" style={{ fontFamily: font, fontSize: '12px', color: '#9B6B7A', padding: '3px 0' }}>{formatPrice(taxTotal, currency)}</td>
                  </tr>
                )}
                <tr>
                  <td style={{ fontFamily: font, fontSize: '17px', fontWeight: 700, color: '#4A1A2E', padding: '10px 0 0', borderTop: '1px solid #F0D5C4' }}>Celkem</td>
                  <td align="right" style={{ fontFamily: font, fontSize: '17px', fontWeight: 700, color: '#4A1A2E', padding: '10px 0 0', borderTop: '1px solid #F0D5C4' }}>{formatPrice(total, currency)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* DELIVERY ESTIMATE */}
        <div style={{ padding: `20px ${pad} 0 ${pad}` }}>
          <div style={{
            backgroundColor: '#FFF8E1',
            borderRadius: '8px',
            border: '1px solid #FFE082',
            padding: '14px 16px',
            textAlign: 'center' as const,
          }}>
            <Text style={{
              fontFamily: font,
              fontSize: '13px',
              color: '#795548',
              margin: '0',
              lineHeight: '1.5',
            }}>
              📦 &nbsp; <strong>Předpokládané doručení:</strong> do 2 pracovních dnů — kniha je skladem v ČR
            </Text>
            {isPickup ? (
              <Text style={{
                fontFamily: font,
                fontSize: '12px',
                color: '#795548',
                margin: '6px 0 0',
                lineHeight: '1.5',
              }}>
                Zásilku ti doručíme na výdejní místo <strong>Zásilkovny</strong>:
                <br />
                <span style={{ color: '#4A1A2E', fontWeight: 600 }}>{pickupName}</span>
                {pickupAddress && (
                  <>
                    <br />
                    <span style={{ color: '#9e9e9e', fontSize: '11px' }}>{pickupAddress}</span>
                  </>
                )}
              </Text>
            ) : (
              <Text style={{
                fontFamily: font,
                fontSize: '12px',
                color: '#795548',
                margin: '6px 0 0',
                lineHeight: '1.5',
              }}>
                Zásilku ti doručí Zásilkovna na adresu uvedenou v objednávce.
              </Text>
            )}
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
                    color: '#9B6B7A',
                    marginBottom: '8px',
                  }}>
                    {isPickup ? 'Výdejní místo Zásilkovny' : 'Doručovací adresa'}
                  </Text>
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
                </td>
                <td width="50%" valign="top" style={{ paddingLeft: '10px' }}>
                  <Text style={{
                    fontFamily: font,
                    fontSize: '11px',
                    fontWeight: 600,
                    textTransform: 'uppercase' as const,
                    letterSpacing: '1.5px',
                    color: '#9B6B7A',
                    marginBottom: '8px',
                  }}>
                    Fakturační adresa
                  </Text>
                  <Text style={{
                    fontFamily: font,
                    fontSize: '13px',
                    color: '#6B3344',
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
            Co bude dál?
          </Text>

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
                  }}>1</div>
                </td>
                <td style={{ fontFamily: font, fontSize: '13px', color: '#6B3344', lineHeight: '1.5', paddingLeft: '8px' }}>
                  <strong style={{ color: '#4A1A2E' }}>Objednávka přijata</strong>
                  <br />
                  Tvou objednávku právě chystáme k odeslání.
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
                    backgroundColor: '#D4916A',
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
                  <strong style={{ color: '#4A1A2E' }}>Odesláno</strong>
                  <br />
                  Jakmile zásilku odešleme, přijde ti e-mail s číslem pro sledování.
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
                    ? 'Do 2 pracovních dnů bude zásilka čekat na tvém výdejním místě.'
                    : 'Do 2 pracovních dnů budeš mít knihu doma.'
                  }
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
              Máš dotaz k objednávce? Napiš mi na
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
            Srdečně,
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
            marginBottom: '6px',
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
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '11px',
            color: '#9B6B7A',
            lineHeight: '1.5',
            margin: '0',
          }}>
            Tento e-mail ti přišel, protože sis objednala knihu na www.nejdriv-ja.cz.
          </Text>
        </div>
      </Section>
    </Base>
  )
}

ZvOrderPlacedTemplate.PreviewProps = {
  order: {
    id: 'test-order-id',
    display_id: '1001',
    metadata: {
      custom_order_number: 'CZ2026-1001',
      shipping_method: 'zasilkovna_pickup',
      packeta_point_id: '15680',
      packeta_point_name: 'Hrdějovice, Těšínská 9',
      packeta_point_address: 'Potraviny Flop Kaňka, 373 61 Hrdějovice',
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
      {
        id: 'item-2',
        title: 'Pusť to, co tě ničí',
        product_title: 'Pusť to, co tě ničí',
        variant_title: '',
        quantity: 1,
        unit_price: 549,
        thumbnail: null,
      },
    ],
    summary: {
      current_order_total: 1298,
      shipping_total: 0,
      tax_total: 139,
    },
  },
  shippingAddress: {
    first_name: 'Petra',
    last_name: 'Svobodová',
    address_1: 'Korunní 810/104',
    city: 'Praha 10',
    postal_code: '101 00',
    country_code: 'cz',
  },
  billingAddress: {
    first_name: 'Petra',
    last_name: 'Svobodová',
    address_1: 'Korunní 810/104',
    city: 'Praha 10',
    postal_code: '101 00',
    country_code: 'cz',
  },
  paymentMethod: 'Platební karta',
} as any

export default ZvOrderPlacedTemplate
