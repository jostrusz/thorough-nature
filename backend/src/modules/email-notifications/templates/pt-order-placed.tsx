import { Text, Section, Hr, Link } from '@react-email/components'
import * as React from 'react'
import { cleanItemTitle } from '../../../utils/clean-item-title'
import { Base } from './base'

export const PT_ORDER_PLACED = 'pt-order-placed'

export interface PtOrderPlacedTemplateProps {
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

export const isPtOrderPlacedTemplateData = (data: any): data is PtOrderPlacedTemplateProps =>
  typeof data.order === 'object' && typeof data.shippingAddress === 'object'

const font = "'Inter', Arial, sans-serif"
const pad = '24px' // consistent side padding
const padLR = `0 ${pad}`

function formatPrice(amount: number, currencyCode: string): string {
  try {
    return new Intl.NumberFormat('pt-ES', {
      style: 'currency',
      currency: (currencyCode || 'EUR').toUpperCase(),
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    return `${(amount || 0).toFixed(0)} €`
  }
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('pt-ES', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Madrid',
    })
  } catch {
    return dateStr
  }
}

function formatCountry(code: string): string {
  const map: Record<string, string> = {
    es: 'Portugal',
    fr: 'Francia',
    lu: 'Luxembourg',
    ch: 'Suisse',
    mc: 'Monaco',
    de: 'Allemagne',
    nl: 'Pays-Bas',
    cz: 'República Checa',
  }
  return map[(code || '').toLowerCase()] || (code || '').toUpperCase()
}

export const PtOrderPlacedTemplate: React.FC<PtOrderPlacedTemplateProps> & {
  PreviewProps: any
} = ({
  order,
  shippingAddress,
  billingAddress,
  paymentMethod,
  billingEntity,
  pickupPoint,
  preview = 'Obrigado pela tua encomenda!',
}) => {
  const currency = order.currency_code || 'eur'
  const items = order.items || []
  const displayId = order.metadata?.custom_order_number || order.display_id || order.id
  const orderDate = formatDate(order.created_at)

  // Calculate totals
  const subtotal = items.reduce(
    (sum: number, item: any) => sum + (item.unit_price || 0) * (item.quantity || 1),
    0
  )
  // Use non-raw summary values (major units) — raw_* values can be in minor units
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

  // Detect pickup point from props or order metadata (supports pickup_point_*, packeta_point_* and paczkomat_* keys)
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

  // Payment status — COD means not yet paid
  const isCod = !!(paymentMethod && (
    paymentMethod.toLowerCase().includes('contre-rembours') ||
    paymentMethod.toLowerCase().includes('cod') ||
    paymentMethod.toLowerCase().includes('cash')
  )) || !!order.metadata?.cod_fee
    || order.metadata?.payment_method === 'cod'
    || order.metadata?.payment_provider === 'cod'
  const isPaid = !isCod

  // Payment method display name
  const paymentMethodDisplay = (() => {
    if (paymentMethod) return paymentMethod
    if (isCod) return 'Contra reembolso'
    const method = order.metadata?.payment_method || ''
    if (method === 'blik') return 'BLIK'
    if (method === 'card' || method === 'creditcard') return 'Carte bancaire'
    if (method === 'ideal') return 'iDEAL'
    if (method === 'bancontact') return 'Bancontact'
    if (method === 'p24' || method === 'przelewy24') return 'Przelewy24'
    if (method === 'eps') return 'EPS'
    if (method === 'paypal') return 'PayPal'
    if (method === 'klarna') return 'Klarna'
    const provider = order.metadata?.payment_provider || ''
    if (provider === 'stripe') return 'Carte bancaire'
    return 'Pagamento online'
  })()

  return (
    <Base preview={preview}>
      <Section>
        {/* HEADER — edge-to-edge, no border-radius (container handles it) */}
        <div style={{
          backgroundColor: '#2D1B3D',
          background: 'linear-gradient(135deg, #2D1B3D 0%, #1A1028 100%)',
          padding: '32px 24px',
          textAlign: 'center' as const,
        }}>
          <Text style={{
            fontFamily: font,
            fontSize: '11px',
            fontWeight: 500,
            letterSpacing: '3px',
            textTransform: 'uppercase' as const,
            color: '#C27BA0',
            marginBottom: '8px',
          }}>
            Larga o que te destrói
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '24px',
            fontWeight: 700,
            color: '#ffffff',
            margin: '0',
            lineHeight: '1.3',
          }}>
            Obrigado pela tua encomenda!
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '13px',
            color: '#9B7AAD',
            margin: '6px 0 0',
          }}>
            Commande #{displayId} &bull; {orderDate}
          </Text>
        </div>

        {/* GREETING */}
        <div style={{ padding: `28px ${pad} 0 ${pad}` }}>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            color: '#5A3D6B',
            lineHeight: '1.6',
            marginBottom: '6px',
          }}>
            Bonjour {shippingAddress?.first_name || ''},
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            color: '#5A3D6B',
            lineHeight: '1.6',
            marginBottom: '0',
          }}>
            {isPaid
              ? 'Que bom ver-te dar este passo! A tua encomenda ficou registada e vamos tratar dela já a seguir. Em baixo tens o resumo completo.'
              : 'Que bom ver-te dar este passo! A tua encomenda ficou registada e o pagamento farás tranquilamente ao receberes a encomenda. Em baixo tens o resumo completo.'
            }
          </Text>
        </div>

        {/* ORDER SUMMARY BOX */}
        <div style={{ padding: `20px ${pad}` }}>
          <div style={{
            backgroundColor: '#FAF5F8',
            borderRadius: '10px',
            border: '1px solid #EDD9E5',
            padding: '16px 20px',
          }}>
            <div style={{ marginBottom: '6px' }}>
              <Text style={{
                fontFamily: font,
                fontSize: '13px',
                color: '#5A3D6B',
                margin: '0',
              }}>
                <strong style={{ color: '#2D1B3D' }}>Encomenda:</strong> &nbsp; #{displayId}
                &nbsp;&nbsp;
                <span style={{
                  backgroundColor: isPaid ? '#e8f5e9' : '#FFF8E1',
                  color: isPaid ? '#2e7d32' : '#795548',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: 600,
                  fontFamily: font,
                }}>
                  {isPaid ? 'Pagado' : 'Contra reembolso'}
                </span>
              </Text>
            </div>
            <Text style={{
              fontFamily: font,
              fontSize: '13px',
              color: '#5A3D6B',
              margin: '0 0 4px',
            }}>
              <strong style={{ color: '#2D1B3D' }}>Fecha:</strong> &nbsp; {orderDate}
            </Text>
            <Text style={{
              fontFamily: font,
              fontSize: '13px',
              color: '#5A3D6B',
              margin: '0',
            }}>
              <strong style={{ color: '#2D1B3D' }}>Método de pagamento:</strong> &nbsp; {paymentMethodDisplay}
            </Text>
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
            color: '#9B7AAD',
            marginBottom: '12px',
          }}>
            A tua encomenda
          </Text>

          {items.map((item: any) => (
            <div key={item.id} style={{
              marginBottom: '10px',
              backgroundColor: '#FAF5F8',
              borderRadius: '8px',
              border: '1px solid #EDD9E5',
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
                          background: 'linear-gradient(135deg, #2D1B3D, #5A3D6B)',
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
                        color: '#2D1B3D',
                        margin: '0 0 2px',
                        lineHeight: '1.3',
                      }}>
                        {cleanItemTitle(item.product_title || item.title) || 'Article'}
                      </Text>
                      <Text style={{
                        fontFamily: font,
                        fontSize: '12px',
                        color: '#9B7AAD',
                        margin: '0',
                      }}>
                        {item.variant_title ? `${item.variant_title} • ` : ''}Quantité&nbsp;: {item.quantity || 1}
                      </Text>
                    </td>
                    <td width="80" align="right" valign="top">
                      <Text style={{
                        fontFamily: font,
                        fontSize: '14px',
                        fontWeight: 700,
                        color: '#2D1B3D',
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
          <div style={{ marginTop: '14px', borderTop: '2px solid #EDD9E5', paddingTop: '12px' }}>
            <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ borderCollapse: 'collapse' as const }}>
              <tbody>
                <tr>
                  <td style={{ fontFamily: font, fontSize: '13px', color: '#5A3D6B', padding: '3px 0' }}>Subtotal</td>
                  <td align="right" style={{ fontFamily: font, fontSize: '13px', color: '#5A3D6B', padding: '3px 0' }}>{formatPrice(subtotal, currency)}</td>
                </tr>
                <tr>
                  <td style={{ fontFamily: font, fontSize: '13px', color: '#5A3D6B', padding: '3px 0' }}>Portes</td>
                  <td align="right" style={{ fontFamily: font, fontSize: '13px', color: (shippingTotal + shippingFee) > 0 ? '#5A3D6B' : '#2e7d32', padding: '3px 0' }}>
                    {(shippingTotal + shippingFee) > 0 ? formatPrice(shippingTotal + shippingFee, currency) : 'Offerte'}
                  </td>
                </tr>
                {codFee > 0 && (
                  <tr>
                    <td style={{ fontFamily: font, fontSize: '13px', color: '#5A3D6B', padding: '3px 0' }}>Contra reembolso</td>
                    <td align="right" style={{ fontFamily: font, fontSize: '13px', color: '#5A3D6B', padding: '3px 0' }}>{formatPrice(codFee, currency)}</td>
                  </tr>
                )}
                {taxTotal > 0 && (
                  <tr>
                    <td style={{ fontFamily: font, fontSize: '12px', color: '#9B7AAD', padding: '3px 0' }}>IVA incluido</td>
                    <td align="right" style={{ fontFamily: font, fontSize: '12px', color: '#9B7AAD', padding: '3px 0' }}>{formatPrice(taxTotal, currency)}</td>
                  </tr>
                )}
                <tr>
                  <td style={{ fontFamily: font, fontSize: '17px', fontWeight: 700, color: '#2D1B3D', padding: '10px 0 0', borderTop: '1px solid #EDD9E5' }}>Total</td>
                  <td align="right" style={{ fontFamily: font, fontSize: '17px', fontWeight: 700, color: '#2D1B3D', padding: '10px 0 0', borderTop: '1px solid #EDD9E5' }}>{formatPrice(total, currency)}</td>
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
              📦 &nbsp; <strong>Entrega estimada:</strong> 4–6 dias úteis
            </Text>
            {isPickup && pickup ? (
              <Text style={{
                fontFamily: font,
                fontSize: '12px',
                color: '#795548',
                margin: '6px 0 0',
                lineHeight: '1.5',
              }}>
                A tua encomenda será entregue em <strong>punto de recogida</strong> siguiente:
                <br />
                <span style={{ color: '#2D1B3D', fontWeight: 600 }}>{pickup.name}</span>
                {pickup.address && (
                  <>
                    <br />
                    <span style={{ color: '#9e9e9e', fontSize: '11px' }}>{pickup.address}</span>
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
                A tua encomenda será entregue na morada indicada na encomenda.
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
                    color: '#9B7AAD',
                    marginBottom: '8px',
                  }}>
                    {isPickup ? 'Point relais' : 'Morada de entrega'}
                  </Text>
                  {isPickup && pickup ? (
                    <Text style={{
                      fontFamily: font,
                      fontSize: '13px',
                      color: '#5A3D6B',
                      lineHeight: '1.6',
                      margin: '0',
                    }}>
                      <strong style={{ color: '#2D1B3D' }}>{pickup.name}</strong>
                      {pickup.address && (
                        <>
                          <br />
                          {pickup.address}
                        </>
                      )}
                      {pickup.id && (
                        <>
                          <br />
                          <span style={{ color: '#9B7AAD', fontSize: '12px' }}>ID du punto de recogida&nbsp;: {pickup.id}</span>
                        </>
                      )}
                    </Text>
                  ) : (
                    <Text style={{
                      fontFamily: font,
                      fontSize: '13px',
                      color: '#5A3D6B',
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
                    color: '#9B7AAD',
                    marginBottom: '8px',
                  }}>
                    Morada de facturação
                  </Text>
                  <Text style={{
                    fontFamily: font,
                    fontSize: '13px',
                    color: '#5A3D6B',
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

        <Hr style={{ borderColor: '#EDD9E5', margin: `20px ${pad} 0 ${pad}` }} />

        {/* WHAT HAPPENS NEXT */}
        <div style={{ padding: `20px ${pad} 0 ${pad}` }}>
          <Text style={{
            fontFamily: font,
            fontSize: '11px',
            fontWeight: 600,
            textTransform: 'uppercase' as const,
            letterSpacing: '1.5px',
            color: '#9B7AAD',
            marginBottom: '14px',
          }}>
            E agora?
          </Text>

          <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ borderCollapse: 'collapse' as const, marginBottom: '12px' }}>
            <tbody>
              <tr>
                <td width="34" valign="top">
                  <div style={{
                    width: '26px',
                    height: '26px',
                    backgroundColor: '#C27BA0',
                    borderRadius: '50%',
                    textAlign: 'center' as const,
                    lineHeight: '26px',
                    fontFamily: font,
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#ffffff',
                  }}>1</div>
                </td>
                <td style={{ fontFamily: font, fontSize: '13px', color: '#5A3D6B', lineHeight: '1.5', paddingLeft: '8px' }}>
                  <strong style={{ color: '#2D1B3D' }}>Encomenda recebida</strong>
                  <br />
                  Estamos a preparar a tua encomenda para envio.
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
                    backgroundColor: '#D498B5',
                    borderRadius: '50%',
                    textAlign: 'center' as const,
                    lineHeight: '26px',
                    fontFamily: font,
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#ffffff',
                  }}>2</div>
                </td>
                <td style={{ fontFamily: font, fontSize: '13px', color: '#5A3D6B', lineHeight: '1.5', paddingLeft: '8px' }}>
                  <strong style={{ color: '#2D1B3D' }}>Enviado</strong>
                  <br />
                  Assim que a encomenda sair vais receber um e-mail com o número de seguimento.
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
                    backgroundColor: '#EDD9E5',
                    borderRadius: '50%',
                    textAlign: 'center' as const,
                    lineHeight: '26px',
                    fontFamily: font,
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#2D1B3D',
                  }}>3</div>
                </td>
                <td style={{ fontFamily: font, fontSize: '13px', color: '#5A3D6B', lineHeight: '1.5', paddingLeft: '8px' }}>
                  <strong style={{ color: '#2D1B3D' }}>Entregado</strong>
                  <br />
                  {isPickup
                    ? 'Em 4–6 dias úteis a tua encomenda estará à tua espera no ponto de recolha.'
                    : 'Em 4–6 dias úteis terás o livro em casa.'
                  }
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* HELP SECTION */}
        <div style={{ padding: `24px ${pad} 0 ${pad}` }}>
          <div style={{
            backgroundColor: '#FAF5F8',
            borderRadius: '10px',
            border: '1px solid #EDD9E5',
            padding: '16px 20px',
            textAlign: 'center' as const,
          }}>
            <Text style={{
              fontFamily: font,
              fontSize: '13px',
              color: '#5A3D6B',
              lineHeight: '1.6',
              margin: '0',
            }}>
              Alguma dúvida sobre a tua encomenda? Escreve-nos para
              <br />
              <Link href="mailto:livro@largaoquetedestroi.pt" style={{ color: '#C27BA0', textDecoration: 'underline', fontWeight: 600 }}>
                livro@largaoquetedestroi.pt
              </Link>
            </Text>
          </div>
        </div>

        {/* SIGNATURE */}
        <div style={{ padding: `20px ${pad} 24px ${pad}` }}>
          <Text style={{
            fontFamily: font,
            fontSize: '14px',
            color: '#5A3D6B',
            marginBottom: '4px',
          }}>
            Um abraço,
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '14px',
            fontWeight: 700,
            color: '#2D1B3D',
            marginBottom: '2px',
          }}>
            Joris de Vries
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '12px',
            color: '#9B7AAD',
          }}>
            <Link href="mailto:livro@largaoquetedestroi.pt" style={{ color: '#C27BA0', textDecoration: 'none' }}>
              livro@largaoquetedestroi.pt
            </Link>
          </Text>
        </div>

        {/* FOOTER — edge-to-edge, no border-radius (container handles it) */}
        <div style={{
          backgroundColor: '#2D1B3D',
          padding: '24px 24px',
          textAlign: 'center' as const,
        }}>
          <Text style={{
            fontFamily: font,
            fontSize: '12px',
            color: '#C27BA0',
            marginBottom: '6px',
          }}>
            Larga o que te destrói
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '11px',
            color: '#7a6189',
            lineHeight: '1.6',
            marginBottom: '6px',
          }}>
            {billingEntity?.legal_name || 'Performance Marketing Solution s.r.o.'}
            {' '}&bull;{' '}
            {billingEntity?.address
              ? `${billingEntity.address.address_1 || ''}, ${billingEntity.address.postal_code || ''} ${billingEntity.address.city || ''}${billingEntity.address.district ? ', ' + billingEntity.address.district : ''}`
              : 'Rybná 716/24, Staré Město, 110 00 Praga'}
            {billingEntity?.registration_id && (
              <>
                <br />
                N° d&rsquo;enregistrement&nbsp;: {billingEntity.registration_id}
              </>
            )}
            {!billingEntity && (
              <>
                <br />
                Reg. n.&nbsp;06259928 &bull; NIF&nbsp;CZ06259928
              </>
            )}
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '11px',
            color: '#7a6189',
            lineHeight: '1.5',
            margin: '0',
          }}>
            Recebes este e-mail porque fizeste uma encomenda em www.largaoquetedestroi.pt.
          </Text>
        </div>
      </Section>
    </Base>
  )
}

PtOrderPlacedTemplate.PreviewProps = {
  order: {
    id: 'test-order-id',
    display_id: '812',
    metadata: {
      custom_order_number: 'FR2026-812',
      payment_method: 'card',
      payment_provider: 'airwallex',
    },
    created_at: new Date().toISOString(),
    email: 'claire.moreau@gmail.com',
    currency_code: 'eur',
    items: [
      {
        id: 'item-1',
        title: 'Larga o que te destrói',
        product_title: 'Larga o que te destrói',
        variant_title: 'Tapa blanda',
        quantity: 1,
        unit_price: 36,
        thumbnail: '',
      },
    ],
    summary: {
      current_order_total: 36,
      shipping_total: 0,
      tax_total: 6,
    },
  },
  shippingAddress: {
    first_name: 'Claire',
    last_name: 'Moreau',
    address_1: 'Calle Mayor 12',
    city: 'Lyon',
    postal_code: '69002',
    country_code: 'fr',
  },
  billingAddress: {
    first_name: 'Claire',
    last_name: 'Moreau',
    address_1: 'Calle Mayor 12',
    city: 'Lyon',
    postal_code: '69002',
    country_code: 'fr',
  },
  paymentMethod: null,
  pickupPoint: null,
} as any

export default PtOrderPlacedTemplate
