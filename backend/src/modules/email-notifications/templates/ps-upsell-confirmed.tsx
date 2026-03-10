import { Text, Section, Hr, Link, Img } from '@react-email/components'
import * as React from 'react'
import { Base } from './base'

export const PS_UPSELL_CONFIRMED = 'ps-upsell-confirmed'

export interface PsUpsellConfirmedTemplateProps {
  order: any
  shippingAddress: any
  addedItems?: any[]
  billingEntity?: any
  preview?: string
}

export const isPsUpsellConfirmedData = (data: any): data is PsUpsellConfirmedTemplateProps =>
  typeof data.order === 'object' && typeof data.shippingAddress === 'object'

const font = "'Inter', 'Segoe UI', Arial, sans-serif"
const pad = '28px'

// Brand colors — warm orange palette (matching DH)
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
    return new Intl.NumberFormat('cs-CZ', {
      style: 'currency',
      currency: (currencyCode || 'CZK').toUpperCase(),
    }).format(amount)
  } catch {
    return `${(amount || 0).toFixed(0)} Kč`
  }
}

export const PsUpsellConfirmedTemplate: React.FC<PsUpsellConfirmedTemplateProps> & {
  PreviewProps: any
} = ({
  order,
  shippingAddress,
  addedItems,
  billingEntity,
  preview = 'Vaše objednávka byla aktualizována!',
}) => {
  const currency = order.currency_code || 'czk'
  const items = order.items || []
  const displayId = order.metadata?.custom_order_number || order.display_id || order.id

  const codFee = Number(order.metadata?.cod_fee) || 0
  const shippingFee = Number(order.metadata?.shipping_fee) || 0
  const total = (order.summary?.raw_current_order_total?.value ?? order.summary?.current_order_total ?? 0) + codFee + shippingFee

  // Billing entity info
  const entityName = billingEntity?.legal_name || 'EverChapter OÜ'
  const entityAddress = billingEntity?.address
    ? `${billingEntity.address.city || 'Tallinn'}, ${billingEntity.address.district || billingEntity.address.country_code?.toUpperCase() || 'Estonia'}`
    : 'Tallinn, Estonia'
  const entityRegId = billingEntity?.registration_id || '16938029'

  // Items that were added via upsell
  const newItems = addedItems && addedItems.length > 0 ? addedItems : []

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
            Psí superživot
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
            Objednávka aktualizována!
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '13px',
            color: 'rgba(255,255,255,0.7)',
            margin: '0',
          }}>
            Objednávka {displayId}
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
              &#10003; Položka přidána do objednávky
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
            Ahoj {shippingAddress?.first_name || 'tam'},
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            color: colors.textBody,
            lineHeight: '1.7',
            margin: '8px 0 0',
          }}>
            Skvělá volba! Do vaší objednávky jsme úspěšně přidali novou položku. Obě knihy vám odešleme společně v jednom balíku.
          </Text>
        </div>

        {/* ====== NEWLY ADDED ITEMS ====== */}
        {newItems.length > 0 && (
          <div style={{ padding: `24px ${pad} 0` }}>
            <Text style={{
              fontFamily: font,
              fontSize: '12px',
              fontWeight: 700,
              textTransform: 'uppercase' as const,
              letterSpacing: '1px',
              color: colors.greenText,
              marginBottom: '14px',
            }}>
              &#10024; Nově přidáno
            </Text>

            {newItems.map((item: any, idx: number) => (
              <div key={item.id || idx} style={{
                marginBottom: '12px',
                backgroundColor: colors.greenBg,
                borderRadius: '12px',
                border: `1px solid ${colors.greenBorder}`,
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
                              border: `1px solid ${colors.greenBorder}`,
                            }}
                          />
                        ) : (
                          <div style={{
                            width: '60px',
                            height: '76px',
                            background: `linear-gradient(145deg, ${colors.accentSoft}, #FED7AA)`,
                            borderRadius: '8px',
                            border: `1px solid ${colors.greenBorder}`,
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
                          {item.product_title || item.title || 'Položka'}
                        </Text>
                        <Text style={{
                          fontFamily: font,
                          fontSize: '12px',
                          color: colors.textMuted,
                          margin: '0',
                        }}>
                          {item.variant_title ? `${item.variant_title} \u2022 ` : ''}Množství: {item.quantity || 1}
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
        )}

        {/* ====== ALL ITEMS (complete order) ====== */}
        <div style={{ padding: `16px ${pad} 0` }}>
          <Text style={{
            fontFamily: font,
            fontSize: '12px',
            fontWeight: 700,
            textTransform: 'uppercase' as const,
            letterSpacing: '1px',
            color: colors.accent,
            marginBottom: '14px',
          }}>
            Kompletní objednávka
          </Text>

          {items.map((item: any) => (
            <div key={item.id} style={{
              marginBottom: '8px',
              backgroundColor: colors.boxBg,
              borderRadius: '10px',
              border: `1px solid ${colors.boxBorder}`,
              padding: '12px 14px',
            }}>
              <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ borderCollapse: 'collapse' as const }}>
                <tbody>
                  <tr>
                    <td valign="middle">
                      <Text style={{
                        fontFamily: font,
                        fontSize: '14px',
                        fontWeight: 600,
                        color: colors.textDark,
                        margin: '0',
                      }}>
                        {item.product_title || item.title || 'Položka'}
                      </Text>
                      <Text style={{
                        fontFamily: font,
                        fontSize: '11px',
                        color: colors.textMuted,
                        margin: '2px 0 0',
                      }}>
                        {item.variant_title ? `${item.variant_title} \u2022 ` : ''}Množství: {item.quantity || 1}
                      </Text>
                    </td>
                    <td width="80" align="right" valign="middle">
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
          ))}

          {/* New total */}
          <div style={{
            marginTop: '12px',
            borderTop: `2px solid ${colors.boxBorder}`,
            paddingTop: '12px',
          }}>
            <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ borderCollapse: 'collapse' as const }}>
              <tbody>
                {codFee > 0 && (
                  <tr>
                    <td style={{ fontFamily: font, fontSize: '13px', color: colors.textBody, padding: '3px 0' }}>Dobírka</td>
                    <td align="right" style={{ fontFamily: font, fontSize: '13px', color: colors.textBody, padding: '3px 0' }}>{formatPrice(codFee, currency)}</td>
                  </tr>
                )}
                {shippingFee > 0 && (
                  <tr>
                    <td style={{ fontFamily: font, fontSize: '13px', color: colors.textBody, padding: '3px 0' }}>Doprava</td>
                    <td align="right" style={{ fontFamily: font, fontSize: '13px', color: colors.textBody, padding: '3px 0' }}>{formatPrice(shippingFee, currency)}</td>
                  </tr>
                )}
                <tr>
                  <td style={{ fontFamily: font, fontSize: '18px', fontWeight: 800, color: colors.textDark, padding: '8px 0 0' }}>Nový celkem</td>
                  <td align="right" style={{ fontFamily: font, fontSize: '18px', fontWeight: 800, color: colors.accent, padding: '8px 0 0' }}>{formatPrice(total, currency)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* ====== DELIVERY NOTE ====== */}
        <div style={{ padding: `24px ${pad} 0` }}>
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
              &#128230; &nbsp;<strong>Obě knihy odešleme společně</strong>
            </Text>
            <Text style={{
              fontFamily: font,
              fontSize: '12px',
              color: colors.textMuted,
              margin: '6px 0 0',
              lineHeight: '1.5',
            }}>
              Očekávané doručení: 2–5 pracovních dnů
            </Text>
          </div>
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
              Máte dotaz k objednávce?
              <br />
              <Link href="mailto:info@psisuperzivot.cz" style={{ color: colors.accent, textDecoration: 'underline', fontWeight: 700 }}>
                info@psisuperzivot.cz
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
            S pozdravem,
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            fontWeight: 700,
            color: colors.textDark,
            margin: '0 0 2px',
          }}>
            Tým Psí superživot
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '13px',
            color: colors.textMuted,
            margin: '0',
          }}>
            <Link href="mailto:info@psisuperzivot.cz" style={{ color: colors.accent, textDecoration: 'none' }}>
              info@psisuperzivot.cz
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
            Psí superživot
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
            Reg. č.: {entityRegId}
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '11px',
            color: '#71717A',
            lineHeight: '1.5',
            margin: '0',
          }}>
            Tento e-mail jste obdrželi, protože jste provedli objednávku na psisuperzivot.cz.
          </Text>
        </div>
      </Section>
    </Base>
  )
}

PsUpsellConfirmedTemplate.PreviewProps = {
  order: {
    id: 'test-order-id',
    display_id: '48',
    metadata: { custom_order_number: 'CZ2026-48' },
    created_at: new Date().toISOString(),
    email: 'jan@priklad.cz',
    currency_code: 'czk',
    items: [
      {
        id: 'item-1',
        title: 'Psí superživot',
        product_title: 'Psí superživot',
        variant_title: null,
        quantity: 1,
        unit_price: 550,
        thumbnail: null,
      },
      {
        id: 'item-2',
        title: 'Kočičí bible',
        product_title: 'Kočičí bible',
        variant_title: null,
        quantity: 1,
        unit_price: 399,
        thumbnail: null,
      },
    ],
    summary: {
      raw_current_order_total: { value: 949 },
    },
  },
  shippingAddress: {
    first_name: 'Jan',
    last_name: 'Novák',
    address_1: 'Václavské náměstí 1',
    city: 'Praha',
    postal_code: '110 00',
    country_code: 'cz',
  },
  addedItems: [
    {
      id: 'item-2',
      title: 'Kočičí bible',
      product_title: 'Kočičí bible',
      variant_title: null,
      quantity: 1,
      unit_price: 399,
      thumbnail: null,
    },
  ],
  billingEntity: {
    legal_name: 'EverChapter OÜ',
    registration_id: '16938029',
    address: { city: 'Tallinn', district: 'Estonia' },
  },
} as any

export default PsUpsellConfirmedTemplate
