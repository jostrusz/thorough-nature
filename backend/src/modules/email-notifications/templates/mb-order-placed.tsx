import { Text, Section, Hr, Link, Img } from '@react-email/components'
import * as React from 'react'
import { cleanItemTitle } from '../../../utils/clean-item-title'
import { Base } from './base'

export const MB_ORDER_PLACED = 'mb-order-placed'

export interface MbOrderPlacedTemplateProps {
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

export const isMbOrderPlacedTemplateData = (data: any): data is MbOrderPlacedTemplateProps =>
  typeof data.order === 'object' && typeof data.shippingAddress === 'object'

const font = "'Inter', 'Segoe UI', Arial, sans-serif"
const pad = '28px'
const padLR = `0 ${pad}`

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
  white: '#FFFFFF',
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

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('hu-HU', {
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
    cz: 'Csehország',
    sk: 'Szlovákia',
    pl: 'Lengyelország',
    de: 'Németország',
    at: 'Ausztria',
    nl: 'Hollandia',
    be: 'Belgium',
    hu: 'Magyarország',
  }
  return map[(code || '').toLowerCase()] || (code || '').toUpperCase()
}

export const MbOrderPlacedTemplate: React.FC<MbOrderPlacedTemplateProps> & {
  PreviewProps: any
} = ({
  order,
  shippingAddress,
  billingAddress,
  paymentMethod,
  billingEntity,
  pickupPoint,
  preview = 'Köszönjük a rendelésedet!',
}) => {
  const currency = order.currency_code || 'huf'
  const items = order.items || []
  const displayId = order.metadata?.custom_order_number || order.display_id || order.id
  const orderDate = formatDate(order.created_at)

  const subtotal = items.reduce(
    (sum: number, item: any) => sum + (item.unit_price || 0) * (item.quantity || 1),
    0
  )
  // Use non-raw summary values (major units like 7990 Ft), NOT raw values (minor units)
  // order_summary.totals carries only payment-level figures — it has no
  // shipping_total key — so fall back to the shipping method, where the real
  // fee lives. Without this, paid delivery renders as free.
  const shippingFromMethods = (order.shipping_methods || []).reduce(
    (sum: number, m: any) => sum + (Number(m.amount) || 0),
    0
  )
  const shippingTotal = order.summary?.shipping_total ?? shippingFromMethods
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
    paymentMethod.toLowerCase().includes('utánvét') ||
    // Backend may still hand over the Czech label — keep matching it (same as eng-order-placed)
    paymentMethod.toLowerCase().includes('dobírk') ||
    paymentMethod.toLowerCase().includes('cod') ||
    paymentMethod.toLowerCase().includes('cash')
  )) || !!order.metadata?.cod_fee
    || order.metadata?.payment_method === 'cod'
    || order.metadata?.payment_provider === 'cod'
  const isPaid = !isCod

  // Payment method display name
  const paymentMethodDisplay = (() => {
    if (paymentMethod) return paymentMethod
    if (isCod) return 'Utánvét (fizetés átvételkor)'
    const method = order.metadata?.payment_method || ''
    if (method === 'blik') return 'BLIK'
    if (method === 'card' || method === 'creditcard') return 'Bankkártya'
    if (method === 'ideal') return 'iDEAL'
    if (method === 'bancontact') return 'Bancontact'
    if (method === 'p24' || method === 'przelewy24') return 'Przelewy24'
    if (method === 'eps') return 'EPS'
    if (method === 'paypal') return 'PayPal'
    if (method === 'klarna') return 'Klarna'
    const provider = order.metadata?.payment_provider || ''
    if (provider === 'comgate') return 'Online fizetés'
    if (provider === 'stripe') return 'Bankkártya'
    if (provider === 'airwallex') return 'Online fizetés'
    if (provider) return 'Online fizetés'
    return 'Online fizetés'
  })()

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
            Köszönjük a rendelésedet!
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '13px',
            color: 'rgba(255,255,255,0.7)',
            margin: '0',
          }}>
            Rendelés {displayId} &bull; {orderDate}
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
              &#10003; Rendelés megerősítve
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
              {isPaid ? '✅ Kifizetve' : '💰 Utánvétes fizetés'}
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
            {isPaid
              ? 'Nagyon köszönjük a rendelésedet! A fizetés sikeresen megtörtént, és máris nekilátunk a csomagolásnak. Alább megtalálod a teljes összesítőt.'
              : 'Nagyon köszönjük a rendelésedet! Már készítjük elő a feladásra, a fizetést pedig kényelmesen a csomag átvételekor rendezheted. Alább megtalálod a teljes összesítőt.'
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
                  <td style={{ fontFamily: font, fontSize: '13px', color: colors.textMuted, padding: '3px 0' }}>Rendelésszám</td>
                  <td align="right" style={{ fontFamily: font, fontSize: '13px', fontWeight: 600, color: colors.textDark, padding: '3px 0' }}>{displayId}</td>
                </tr>
                <tr>
                  <td style={{ fontFamily: font, fontSize: '13px', color: colors.textMuted, padding: '3px 0' }}>Dátum</td>
                  <td align="right" style={{ fontFamily: font, fontSize: '13px', color: colors.textDark, padding: '3px 0' }}>{orderDate}</td>
                </tr>
                <tr>
                  <td style={{ fontFamily: font, fontSize: '13px', color: colors.textMuted, padding: '3px 0' }}>Fizetési mód</td>
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
            A rendelésed
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

          {/* Totals */}
          <div style={{
            marginTop: '16px',
            borderTop: `2px solid ${colors.boxBorder}`,
            paddingTop: '14px',
          }}>
            <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ borderCollapse: 'collapse' as const }}>
              <tbody>
                <tr>
                  <td style={{ fontFamily: font, fontSize: '13px', color: colors.textBody, padding: '4px 0' }}>Részösszeg</td>
                  <td align="right" style={{ fontFamily: font, fontSize: '13px', color: colors.textBody, padding: '4px 0' }}>{formatPrice(subtotal, currency)}</td>
                </tr>
                <tr>
                  <td style={{ fontFamily: font, fontSize: '13px', color: colors.textBody, padding: '4px 0' }}>Szállítás</td>
                  <td align="right" style={{ fontFamily: font, fontSize: '13px', color: (shippingTotal + shippingFee) > 0 ? colors.textBody : colors.greenText, fontWeight: (shippingTotal + shippingFee) > 0 ? 400 : 600, padding: '4px 0' }}>
                    {(shippingTotal + shippingFee) > 0 ? formatPrice(shippingTotal + shippingFee, currency) : 'Ingyenes'}
                  </td>
                </tr>
                {codFee > 0 && (
                  <tr>
                    <td style={{ fontFamily: font, fontSize: '13px', color: colors.textBody, padding: '4px 0' }}>Utánvét</td>
                    <td align="right" style={{ fontFamily: font, fontSize: '13px', color: colors.textBody, padding: '4px 0' }}>{formatPrice(codFee, currency)}</td>
                  </tr>
                )}
                {taxTotal > 0 && (
                  <tr>
                    <td style={{ fontFamily: font, fontSize: '12px', color: colors.textLight, padding: '4px 0' }}>ebből áfa</td>
                    <td align="right" style={{ fontFamily: font, fontSize: '12px', color: colors.textLight, padding: '4px 0' }}>{formatPrice(taxTotal, currency)}</td>
                  </tr>
                )}
                <tr>
                  <td colSpan={2} style={{ paddingTop: '8px' }}>
                    <div style={{ borderTop: `1px solid ${colors.boxBorder}` }}></div>
                  </td>
                </tr>
                <tr>
                  <td style={{ fontFamily: font, fontSize: '18px', fontWeight: 800, color: colors.textDark, padding: '10px 0 0' }}>Összesen</td>
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
                ? <>&#128205; &nbsp;<strong>Kézbesítés csomagpontra — 2–3 munkanap</strong></>
                : <>&#128230; &nbsp;<strong>Házhozszállítás — 2–3 munkanap</strong></>
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
                  {pickup.id && <><br /><span style={{ color: colors.textMuted, fontSize: '12px' }}>Csomagpont azonosítója: {pickup.id}</span></>}
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
                A csomagot 24 órán belül feladjuk a központi raktárunkból.
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
                    {isPickup ? 'Csomagpont' : 'Szállítási cím'}
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
                      {pickup.id && <><br />Azonosító: {pickup.id}</>}
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
                    Számlázási cím
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
            Mi lesz ezután?
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
                  <strong style={{ color: colors.textDark }}>Rendelés beérkezett</strong>
                  <br />
                  <span style={{ fontSize: '13px', color: colors.textMuted }}>A rendelésed megvan, és már készítjük elő a feladásra.</span>
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
                  <strong style={{ color: colors.textDark }}>Feladva</strong>
                  <br />
                  <span style={{ fontSize: '13px', color: colors.textMuted }}>E-mailben elküldjük a csomagkövetési számot.</span>
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
                  <strong style={{ color: colors.textDark }}>Kézbesítve</strong>
                  <br />
                  <span style={{ fontSize: '13px', color: colors.textMuted }}>
                    {isPickup
                      ? `A csomagot 2–3 munkanapon belül átveheted a csomagponton${pickup?.name ? ` (${pickup.name})` : ''}.`
                      : '2–3 munkanapon belül otthon lesz a könyved.'
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
              Kérdésed van a rendeléseddel kapcsolatban? Írj nyugodtan!
              <br />
              <Link href="mailto:konyv@macskabiblia-konyv.hu" style={{ color: colors.accent, textDecoration: 'underline', fontWeight: 700 }}>
                konyv@macskabiblia-konyv.hu
              </Link>
            </Text>
          </div>
        </div>

        {/* ====== CROSS-SELL — books NOT in the order (full price) ====== */}
        {(() => {
          const CATALOG = [
            {
              match: ['engedd el', 'tönkretesz', 'tonkretesz'],
              title: 'Engedd el, ami tönkretesz',
              tagline: 'Bestseller a fejben lakó nyugalomról — a végtelen őrlődéstől a belső békéig.',
              price: '10 999 Ft',
              url: 'https://www.engeddelkonyv.hu/',
              image: 'https://www.engeddelkonyv.hu/engedd-el-ami-tonkretesz.png',
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
                Ez is érdekelhet
              </Text>
              <Text style={{
                fontFamily: font,
                fontSize: '13px',
                color: colors.textBody,
                margin: '0 0 14px',
                lineHeight: '1.5',
              }}>
                A Macskabiblia olvasói leggyakrabban ezt a könyvet veszik meg mellé:
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
                            Megveszem {c.price}-ért &rarr;
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
            Sok macskás örömet kívánok a könyvhöz! 🐱
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

MbOrderPlacedTemplate.PreviewProps = {
  order: {
    id: 'test-order-id',
    display_id: '812',
    metadata: {
      custom_order_number: 'HU2026-812',
      cod_fee: 490,
      payment_method: 'cod',
      payment_provider: 'cod',
      shipping_method: 'zasilkovna_pickup',
      packeta_point_id: '15680',
      packeta_point_name: 'Budapest, Váci út 9',
      packeta_point_address: 'Trafik, 1134 Budapest',
    },
    created_at: new Date().toISOString(),
    email: 'kovacs.anna@gmail.com',
    currency_code: 'huf',
    items: [
      {
        id: 'item-1',
        title: 'Macskabiblia',
        product_title: 'Macskabiblia',
        variant_title: 'Paperback',
        quantity: 1,
        unit_price: 7990,
        thumbnail: null,
      },
      {
        id: 'item-2',
        title: 'Utánvét díja',
        product_title: 'Utánvét díja',
        variant_title: null,
        quantity: 1,
        unit_price: 490,
        thumbnail: null,
      },
    ],
    summary: {
      current_order_total: 8480,
      shipping_total: 0,
      tax_total: 1804,
    },
  },
  shippingAddress: {
    first_name: 'Anna',
    last_name: 'Kovács',
    address_1: 'Andrássy út 60',
    city: 'Budapest',
    postal_code: '1062',
    country_code: 'hu',
  },
  billingAddress: {
    first_name: 'Anna',
    last_name: 'Kovács',
    address_1: 'Andrássy út 60',
    city: 'Budapest',
    postal_code: '1062',
    country_code: 'hu',
  },
  paymentMethod: null,
  pickupPoint: null,
} as any

export default MbOrderPlacedTemplate
