import { Text, Section, Hr, Link, Img } from '@react-email/components'
import * as React from 'react'
import { cleanItemTitle } from '../../../utils/clean-item-title'
import { Base } from './base'

export const BK_ORDER_PLACED = 'bk-order-placed'

export interface BkOrderPlacedTemplateProps {
  order: any
  shippingAddress: any
  billingAddress?: any
  paymentMethod?: string
  billingEntity?: any
  pickupPoint?: {
    name: string
    id?: string
    address?: string
  } | null
  preview?: string
}

export const isBkOrderPlacedTemplateData = (data: any): data is BkOrderPlacedTemplateProps =>
  typeof data.order === 'object' && typeof data.shippingAddress === 'object'

const font = "'Inter', 'Segoe UI', Arial, sans-serif"
const pad = '28px'
const padLR = `0 ${pad}`

// Brand colors — Velvet Dusk palette (matching KB)
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
  white: '#FFFFFF',
}

function formatPrice(amount: number, currencyCode: string): string {
  try {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: (currencyCode || 'PLN').toUpperCase(),
    }).format(amount)
  } catch {
    return `${(amount || 0).toFixed(0)} zł`
  }
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('pl-PL', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Warsaw',
    })
  } catch {
    return dateStr
  }
}

function formatCountry(code: string): string {
  const map: Record<string, string> = {
    pl: 'Polska',
    cz: 'Czechy',
    sk: 'Słowacja',
    de: 'Niemcy',
    at: 'Austria',
    nl: 'Holandia',
    be: 'Belgia',
    hu: 'Węgry',
  }
  return map[(code || '').toLowerCase()] || (code || '').toUpperCase()
}

export const BkOrderPlacedTemplate: React.FC<BkOrderPlacedTemplateProps> & {
  PreviewProps: any
} = ({
  order,
  shippingAddress,
  billingAddress,
  paymentMethod,
  billingEntity,
  pickupPoint,
  preview = 'Dziękujemy za Twoje zamówienie!',
}) => {
  const currency = order.currency_code || 'pln'
  const items = order.items || []
  const displayId = order.metadata?.custom_order_number || order.display_id || order.id
  const orderDate = formatDate(order.created_at)

  const subtotal = items.reduce(
    (sum: number, item: any) => sum + (item.unit_price || 0) * (item.quantity || 1),
    0
  )
  // Use non-raw summary values (major units like 89 zł), NOT raw values (minor units)
  const shippingTotal = order.summary?.shipping_total ?? 0
  const taxTotal = order.summary?.tax_total ?? 0
  const codFee = Number(order.metadata?.cod_fee) || 0
  const shippingFee = Number(order.metadata?.shipping_fee) || 0
  const total = (order.summary?.current_order_total ?? subtotal + shippingTotal) + codFee + shippingFee

  const invoiceAddress = billingAddress || shippingAddress

  // Detect pickup point from props or order metadata (supports both packeta_point_* and paczkomat_* keys)
  const pickup = pickupPoint || (() => {
    const name = order.metadata?.pickup_point_name || order.metadata?.packeta_point_name || order.metadata?.paczkomat_name
    if (!name) return null
    return {
      name,
      id: order.metadata?.pickup_point_id || order.metadata?.packeta_point_id || order.metadata?.paczkomat_id || '',
      address: order.metadata?.pickup_point_address || order.metadata?.packeta_point_address || order.metadata?.paczkomat_address || '',
    }
  })()
  const isPickup = !!pickup || order.metadata?.shipping_method === 'zasilkovna_pickup'
  const isHomeDelivery = !isPickup

  // Payment status — COD means not yet paid
  const isCod = !!(paymentMethod && (
    paymentMethod.toLowerCase().includes('pobran') ||
    paymentMethod.toLowerCase().includes('cod') ||
    paymentMethod.toLowerCase().includes('cash')
  )) || !!order.metadata?.cod_fee
    || order.metadata?.payment_method === 'cod'
    || order.metadata?.payment_provider === 'cod'
  const isPaid = !isCod

  // Payment method display name
  const paymentMethodDisplay = (() => {
    if (paymentMethod) return paymentMethod
    if (isCod) return 'Za pobraniem (płatność przy odbiorze)'
    const method = order.metadata?.payment_method || ''
    if (method === 'blik') return 'BLIK'
    if (method === 'card' || method === 'creditcard') return 'Karta płatnicza'
    if (method === 'ideal') return 'iDEAL'
    if (method === 'bancontact') return 'Bancontact'
    if (method === 'p24' || method === 'przelewy24') return 'Przelewy24'
    if (method === 'eps') return 'EPS'
    if (method === 'paypal') return 'PayPal'
    if (method === 'klarna') return 'Klarna'
    const provider = order.metadata?.payment_provider || ''
    if (provider === 'comgate') return 'Płatność online'
    if (provider === 'stripe') return 'Karta płatnicza'
    if (provider === 'airwallex') return 'Płatność online'
    if (provider) return 'Płatność online'
    return 'Płatność online'
  })()

  // Billing entity — Czech company
  const entityName = billingEntity?.legal_name || 'Performance Marketing Solution s.r.o.'
  const entityAddress = billingEntity?.address_line || 'Rybná 716/24, Staré Město, 110 00 Praga, Czechy'
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
            Biblia kotów
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
            Dziękujemy za Twoje zamówienie!
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '13px',
            color: 'rgba(255,255,255,0.7)',
            margin: '0',
          }}>
            Zamówienie {displayId} &bull; {orderDate}
          </Text>
        </div>

        {/* ====== STATUS BADGES ====== */}
        <div style={{ padding: `24px ${pad} 0`, textAlign: 'center' as const }}>
          <div style={{
            display: 'inline-block',
            backgroundColor: colors.greenBg,
            border: `1px solid ${colors.greenBorder}`,
            borderRadius: '20px',
            padding: '6px 18px',
            marginRight: '8px',
          }}>
            <Text style={{
              fontFamily: font,
              fontSize: '13px',
              fontWeight: 600,
              color: colors.greenText,
              margin: '0',
            }}>
              &#10003; Zamówienie potwierdzone
            </Text>
          </div>
          <div style={{
            display: 'inline-block',
            backgroundColor: isPaid ? colors.greenBg : colors.amberBg,
            border: `1px solid ${isPaid ? colors.greenBorder : colors.amberBorder}`,
            borderRadius: '20px',
            padding: '6px 18px',
            marginTop: '8px',
          }}>
            <Text style={{
              fontFamily: font,
              fontSize: '13px',
              fontWeight: 600,
              color: isPaid ? colors.greenText : colors.amberText,
              margin: '0',
            }}>
              {isPaid ? '✅ Opłacone' : '💰 Płatność za pobraniem'}
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
            Cześć {shippingAddress?.first_name || ''} 👋,
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            color: colors.textBody,
            lineHeight: '1.7',
            margin: '8px 0 0',
          }}>
            {isPaid
              ? 'Bardzo dziękujemy za Twoje zamówienie! Płatność przeszła pomyślnie i już zabieramy się za pakowanie. Poniżej znajdziesz pełne podsumowanie.'
              : 'Bardzo dziękujemy za Twoje zamówienie! Przygotowujemy je do wysyłki, a zapłacisz wygodnie przy odbiorze przesyłki. Poniżej znajdziesz pełne podsumowanie.'
            }
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
                  <td style={{ fontFamily: font, fontSize: '13px', color: colors.textMuted, padding: '3px 0' }}>Zamówienie</td>
                  <td align="right" style={{ fontFamily: font, fontSize: '13px', fontWeight: 600, color: colors.textDark, padding: '3px 0' }}>{displayId}</td>
                </tr>
                <tr>
                  <td style={{ fontFamily: font, fontSize: '13px', color: colors.textMuted, padding: '3px 0' }}>Data</td>
                  <td align="right" style={{ fontFamily: font, fontSize: '13px', color: colors.textDark, padding: '3px 0' }}>{orderDate}</td>
                </tr>
                <tr>
                  <td style={{ fontFamily: font, fontSize: '13px', color: colors.textMuted, padding: '3px 0' }}>Metoda płatności</td>
                  <td align="right" style={{ fontFamily: font, fontSize: '13px', fontWeight: 600, color: colors.textDark, padding: '3px 0' }}>{paymentMethodDisplay}</td>
                </tr>
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
            Twoje zamówienie
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
                        {cleanItemTitle(item.product_title || item.title) || 'Pozycja'}
                      </Text>
                      <Text style={{
                        fontFamily: font,
                        fontSize: '12px',
                        color: colors.textMuted,
                        margin: '0',
                      }}>
                        {item.variant_title ? `${item.variant_title} • ` : ''}Ilość: {item.quantity || 1}
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
                  <td style={{ fontFamily: font, fontSize: '13px', color: colors.textBody, padding: '4px 0' }}>Suma częściowa</td>
                  <td align="right" style={{ fontFamily: font, fontSize: '13px', color: colors.textBody, padding: '4px 0' }}>{formatPrice(subtotal, currency)}</td>
                </tr>
                <tr>
                  <td style={{ fontFamily: font, fontSize: '13px', color: colors.textBody, padding: '4px 0' }}>Dostawa</td>
                  <td align="right" style={{ fontFamily: font, fontSize: '13px', color: (shippingTotal + shippingFee) > 0 ? colors.textBody : colors.greenText, fontWeight: (shippingTotal + shippingFee) > 0 ? 400 : 600, padding: '4px 0' }}>
                    {(shippingTotal + shippingFee) > 0 ? formatPrice(shippingTotal + shippingFee, currency) : 'Za darmo'}
                  </td>
                </tr>
                {codFee > 0 && (
                  <tr>
                    <td style={{ fontFamily: font, fontSize: '13px', color: colors.textBody, padding: '4px 0' }}>Pobranie</td>
                    <td align="right" style={{ fontFamily: font, fontSize: '13px', color: colors.textBody, padding: '4px 0' }}>{formatPrice(codFee, currency)}</td>
                  </tr>
                )}
                {taxTotal > 0 && (
                  <tr>
                    <td style={{ fontFamily: font, fontSize: '12px', color: colors.textLight, padding: '4px 0' }}>w tym VAT</td>
                    <td align="right" style={{ fontFamily: font, fontSize: '12px', color: colors.textLight, padding: '4px 0' }}>{formatPrice(taxTotal, currency)}</td>
                  </tr>
                )}
                <tr>
                  <td colSpan={2} style={{ paddingTop: '8px' }}>
                    <div style={{ borderTop: `1px solid ${colors.boxBorder}` }}></div>
                  </td>
                </tr>
                <tr>
                  <td style={{ fontFamily: font, fontSize: '18px', fontWeight: 800, color: colors.textDark, padding: '10px 0 0' }}>Razem</td>
                  <td align="right" style={{ fontFamily: font, fontSize: '18px', fontWeight: 800, color: colors.textDark, padding: '10px 0 0' }}>{formatPrice(total, currency)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* ====== DELIVERY INFO ====== */}
        <div style={{ padding: `24px ${pad} 0` }}>
          <div style={{
            backgroundColor: colors.amberBg,
            borderRadius: '12px',
            border: `1px solid ${colors.amberBorder}`,
            padding: '16px 18px',
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
                ? <>&#128205; &nbsp;<strong>Dostawa do punktu odbioru — 2–3 dni robocze</strong></>
                : <>&#128230; &nbsp;<strong>Dostawa na adres — 2–3 dni robocze</strong></>
              }
            </Text>
            {isPickup && pickup ? (
              <div style={{ marginTop: '10px', textAlign: 'left' as const }}>
                <Text style={{
                  fontFamily: font,
                  fontSize: '13px',
                  color: colors.textBody,
                  margin: '0',
                  lineHeight: '1.6',
                }}>
                  <strong>{pickup.name}</strong>
                  {pickup.address && <><br />{pickup.address}</>}
                  {pickup.id && <><br /><span style={{ color: colors.textMuted, fontSize: '12px' }}>ID punktu odbioru: {pickup.id}</span></>}
                </Text>
              </div>
            ) : (
              <Text style={{
                fontFamily: font,
                fontSize: '12px',
                color: colors.textMuted,
                margin: '6px 0 0',
                lineHeight: '1.5',
              }}>
                Przesyłkę wysyłamy w ciągu 24 godzin z naszego centralnego magazynu.
              </Text>
            )}
          </div>
        </div>

        {/* ====== DELIVERY ADDRESS / PICKUP POINT ====== */}
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
                    {isPickup ? 'Punkt odbioru' : 'Adres dostawy'}
                  </Text>
                  {isPickup && pickup ? (
                    <Text style={{
                      fontFamily: font,
                      fontSize: '13px',
                      color: colors.textBody,
                      lineHeight: '1.7',
                      margin: '0',
                    }}>
                      <strong>{pickup.name}</strong>
                      {pickup.id && <><br />ID: {pickup.id}</>}
                      {pickup.address && <><br />{pickup.address}</>}
                    </Text>
                  ) : (
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
                  )}
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
                    Adres rozliczeniowy
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
            Co dalej?
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
                  <strong style={{ color: colors.textDark }}>Zamówienie przyjęte</strong>
                  <br />
                  <span style={{ fontSize: '13px', color: colors.textMuted }}>Mamy Twoje zamówienie i właśnie przygotowujemy je do wysyłki.</span>
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
                  <strong style={{ color: colors.textDark }}>Wysłane</strong>
                  <br />
                  <span style={{ fontSize: '13px', color: colors.textMuted }}>Wyślemy Ci e-mail z numerem do śledzenia przesyłki.</span>
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
                  <strong style={{ color: colors.textDark }}>Dostarczone</strong>
                  <br />
                  <span style={{ fontSize: '13px', color: colors.textMuted }}>
                    {isPickup
                      ? `Przesyłkę odbierzesz w punkcie odbioru${pickup?.name ? ` ${pickup.name}` : ''} w ciągu 2–3 dni roboczych.`
                      : 'W ciągu 2–3 dni roboczych książka będzie u Ciebie w domu.'
                    }
                  </span>
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
            border: `1px solid #EDD9E5`,
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
              Masz pytanie do zamówienia? Śmiało napisz!
              <br />
              <Link href="mailto:peterka@biblia-kotow.pl" style={{ color: colors.accent, textDecoration: 'underline', fontWeight: 700 }}>
                peterka@biblia-kotow.pl
              </Link>
            </Text>
          </div>
        </div>

        {/* ====== CROSS-SELL — książki, których NIE ma w zamówieniu (pełna cena) ====== */}
        {(() => {
          const CATALOG = [
            {
              match: ['odpuść to', 'odpusc to'],
              title: 'Odpuść to, co cię niszczy',
              tagline: 'Głowa, która nigdy nie odpoczywa? Bestseller o spokoju wewnętrznym — od zamartwiania się do wewnętrznej ciszy.',
              price: '129 zł',
              url: 'https://odpusc-ksiazka.pl',
              image: 'https://bucket-production-b93e.up.railway.app:443/medusa-media/odpusc-ksiazka-thumbnail-01KK8RBZFKFSMZJJDDRR82PJ1D.png',
            },
          ]
          const orderedTitles = items
            .map((it: any) => `${it.product_title || ''} ${it.title || ''}`.toLowerCase())
            .join(' | ')
          const missing = CATALOG.filter(
            (c) => !c.match.some((m) => orderedTitles.includes(m))
          )
          if (!missing.length) return null
          return (
            <div style={{ padding: `8px ${pad} 0` }}>
              <Text style={{
                fontFamily: font,
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase' as const,
                letterSpacing: '1.5px',
                color: colors.textMuted,
                margin: '0 0 4px',
              }}>
                To może Cię zainteresować
              </Text>
              <Text style={{
                fontFamily: font,
                fontSize: '13px',
                color: colors.textBody,
                margin: '0 0 14px',
                lineHeight: '1.5',
              }}>
                Czytelnicy Biblii kotów najczęściej dokupują tę książkę:
              </Text>
              {missing.map((c) => (
                <div key={c.title} style={{
                  border: `1px solid ${colors.boxBorder}`,
                  borderRadius: '12px',
                  padding: '14px 16px',
                  marginBottom: '10px',
                  backgroundColor: '#FFFFFF',
                }}>
                  <table role="presentation" width="100%" cellPadding="0" cellSpacing="0" style={{ borderCollapse: 'collapse' as const }}>
                    <tbody>
                      <tr>
                        <td width="56" valign="top" style={{ paddingRight: '14px' }}>
                          <Link href={c.url}>
                            <Img src={c.image} alt={c.title} width="56" height="78"
                              style={{ width: '56px', height: '78px', objectFit: 'contain' as const, display: 'block' }} />
                          </Link>
                        </td>
                        <td valign="top">
                          <Text style={{ fontFamily: font, fontSize: '15px', fontWeight: 700, color: colors.textDark, margin: '0 0 3px' }}>
                            {c.title}
                          </Text>
                          <Text style={{ fontFamily: font, fontSize: '12.5px', color: colors.textBody, lineHeight: '1.5', margin: '0 0 8px' }}>
                            {c.tagline}
                          </Text>
                          <Link href={c.url} style={{
                            fontFamily: font,
                            fontSize: '13px',
                            fontWeight: 700,
                            color: '#ffffff',
                            backgroundColor: colors.accent,
                            padding: '8px 16px',
                            borderRadius: '8px',
                            textDecoration: 'none',
                            display: 'inline-block',
                          }}>
                            Kup za {c.price} &rarr;
                          </Link>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )
        })()}

        {/* ====== SIGNATURE ====== */}
        <div style={{ padding: `24px ${pad} 28px` }}>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            color: colors.textBody,
            margin: '0 0 4px',
          }}>
            Niech ta książka przyniesie Ci mnóstwo kociej radości! 🐱
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            fontWeight: 700,
            color: colors.textDark,
            margin: '0 0 2px',
          }}>
            Michał Peterka
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '13px',
            color: colors.textMuted,
            margin: '0',
          }}>
            <Link href="mailto:peterka@biblia-kotow.pl" style={{ color: colors.accent, textDecoration: 'none' }}>
              peterka@biblia-kotow.pl
            </Link>
          </Text>
        </div>

        {/* ====== FOOTER ====== */}
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
            Biblia kotów
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
            Otrzymujesz tego e-maila, ponieważ złożyłeś/aś zamówienie na biblia-kotow.pl.
          </Text>
        </div>
      </Section>
    </Base>
  )
}

BkOrderPlacedTemplate.PreviewProps = {
  order: {
    id: 'test-order-id',
    display_id: '812',
    metadata: {
      custom_order_number: 'PL2026-812',
      payment_method: 'blik',
      payment_provider: 'airwallex',
      paczkomat_id: 'WAW04A',
      paczkomat_name: 'Paczkomat WAW04A',
      paczkomat_address: 'ul. Marszałkowska 10, 00-590 Warszawa',
    },
    created_at: new Date().toISOString(),
    email: 'katarzyna.kowalska@example.com',
    currency_code: 'pln',
    items: [
      {
        id: 'item-1',
        title: 'Biblia kotów',
        product_title: 'Biblia kotów',
        variant_title: 'Paperback',
        quantity: 1,
        unit_price: 89,
        thumbnail: null,
      },
    ],
    summary: {
      current_order_total: 89,
      shipping_total: 0,
      tax_total: 17,
    },
  },
  shippingAddress: {
    first_name: 'Katarzyna',
    last_name: 'Kowalska',
    address_1: 'ul. Marszałkowska 10',
    city: 'Warszawa',
    postal_code: '00-590',
    country_code: 'pl',
  },
  billingAddress: {
    first_name: 'Katarzyna',
    last_name: 'Kowalska',
    address_1: 'ul. Marszałkowska 10',
    city: 'Warszawa',
    postal_code: '00-590',
    country_code: 'pl',
  },
  paymentMethod: null,
  pickupPoint: null,
} as any

export default BkOrderPlacedTemplate
