import { Text, Section, Hr, Link } from '@react-email/components'
import * as React from 'react'
import { cleanItemTitle } from '../../../utils/clean-item-title'
import { Base } from './base'

export const FR_SHIPMENT_NOTIFICATION = 'fr-shipment-notification'

export interface FrShipmentNotificationTemplateProps {
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

export const isFrShipmentNotificationData = (data: any): data is FrShipmentNotificationTemplateProps =>
  typeof data.order === 'object' && typeof data.shippingAddress === 'object'

const font = "'Inter', Arial, sans-serif"
const pad = '24px'

function formatPrice(amount: number, currencyCode: string): string {
  try {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: (currencyCode || 'EUR').toUpperCase(),
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    return `${(amount || 0).toFixed(0)} €`
  }
}

function formatCountry(code: string): string {
  const map: Record<string, string> = {
    fr: 'France',
    be: 'Belgique',
    lu: 'Luxembourg',
    ch: 'Suisse',
    mc: 'Monaco',
    de: 'Allemagne',
    nl: 'Pays-Bas',
    cz: 'République tchèque',
  }
  return map[(code || '').toLowerCase()] || (code || '').toUpperCase()
}

export const FrShipmentNotificationTemplate: React.FC<FrShipmentNotificationTemplateProps> & {
  PreviewProps: any
} = ({
  order,
  shippingAddress,
  trackingNumber,
  trackingUrl,
  trackingCompany,
  billingEntity,
  pickupPoint,
  preview = 'Ta commande est en route !',
}) => {
  const currency = order.currency_code || 'eur'
  const items = order.items || []
  const displayId = order.metadata?.custom_order_number || order.display_id || order.id

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

  return (
    <Base preview={preview}>
      <Section>
        {/* HEADER */}
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
            Lâche prise sur ce qui te détruit
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
            Ta commande est en route&nbsp;!
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '13px',
            color: '#9B7AAD',
            margin: '6px 0 0',
          }}>
            Commande #{displayId}
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
            {isPickup
              ? 'Bonne nouvelle ! Ta commande est emballée et se dirige vers ton point relais. Tu trouveras les détails du colis ci-dessous.'
              : 'Bonne nouvelle ! Ta commande est emballée et déjà en chemin vers toi. Tu trouveras les détails du colis ci-dessous.'
            }
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
                Suivi du colis
              </Text>
              {trackingCompany && (
                <Text style={{
                  fontFamily: font,
                  fontSize: '13px',
                  color: '#5A3D6B',
                  marginBottom: '6px',
                }}>
                  Transporteur&nbsp;: <strong style={{ color: '#2D1B3D' }}>{trackingCompany}</strong>
                </Text>
              )}
              {trackingNumber && (
                <Text style={{
                  fontFamily: font,
                  fontSize: '13px',
                  color: '#5A3D6B',
                  marginBottom: trackingUrl ? '12px' : '0',
                }}>
                  Numéro de suivi&nbsp;: <strong style={{ color: '#2D1B3D' }}>{trackingNumber}</strong>
                </Text>
              )}
              {trackingUrl && (
                <Link
                  href={trackingUrl}
                  style={{
                    backgroundColor: '#C27BA0',
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
                  Suivre mon colis →
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
              🚚 &nbsp; <strong>Livraison estimée&nbsp;:</strong> 2–3 jours ouvrés
            </Text>
            <Text style={{
              fontFamily: font,
              fontSize: '12px',
              color: '#9e9e9e',
              margin: '4px 0 0',
              lineHeight: '1.5',
            }}>
              {isPickup
                ? 'Dès que le colis sera prêt à être retiré, le point relais te préviendra.'
                : 'Nous expédions les livres depuis notre entrepôt central en République tchèque.'
              }
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
            color: '#9B7AAD',
            marginBottom: '12px',
          }}>
            Articles expédiés
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
                    <td width="70" align="right" valign="top">
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
        </div>

        {/* SHIPPING ADDRESS / PICKUP POINT */}
        <div style={{ padding: `20px ${pad} 0 ${pad}` }}>
          <Text style={{
            fontFamily: font,
            fontSize: '11px',
            fontWeight: 600,
            textTransform: 'uppercase' as const,
            letterSpacing: '1.5px',
            color: '#9B7AAD',
            marginBottom: '8px',
          }}>
            {isPickup ? 'Point relais' : 'Adresse de livraison'}
          </Text>
          <div style={{
            backgroundColor: '#FAF5F8',
            borderRadius: '10px',
            border: '1px solid #EDD9E5',
            padding: '14px 18px',
          }}>
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
                    <span style={{ color: '#9B7AAD', fontSize: '12px' }}>ID du point relais&nbsp;: {pickup.id}</span>
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
          </div>
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
            À quoi t&rsquo;attendre&nbsp;?
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
                <td style={{ fontFamily: font, fontSize: '13px', color: '#5A3D6B', lineHeight: '1.5', paddingLeft: '8px' }}>
                  <strong style={{ color: '#2D1B3D' }}>Expédiée</strong>
                  <br />
                  Ta commande a été emballée et expédiée depuis notre entrepôt.
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
                    backgroundColor: '#C27BA0',
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
                  <strong style={{ color: '#2D1B3D' }}>En route</strong>
                  <br />
                  {isPickup
                    ? 'Le colis se dirige vers ton point relais.'
                    : 'Le transporteur achemine le colis vers l’adresse indiquée.'
                  }
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
                  <strong style={{ color: '#2D1B3D' }}>Livrée</strong>
                  <br />
                  {isPickup
                    ? 'Sous 2–3 jours ouvrés, tu pourras retirer ton colis au point relais !'
                    : 'Sous 2–3 jours ouvrés, ton livre sera chez toi !'
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
              Une question sur ton colis&nbsp;? Écris-nous à
              <br />
              <Link href="mailto:joris@lacheprise-livre.fr" style={{ color: '#C27BA0', textDecoration: 'underline', fontWeight: 600 }}>
                joris@lacheprise-livre.fr
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
            Bonne lecture&nbsp;!
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
            <Link href="mailto:joris@lacheprise-livre.fr" style={{ color: '#C27BA0', textDecoration: 'none' }}>
              joris@lacheprise-livre.fr
            </Link>
          </Text>
        </div>

        {/* FOOTER */}
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
            Lâche prise sur ce qui te détruit
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '11px',
            color: '#7a6189',
            lineHeight: '1.6',
            margin: '0',
          }}>
            {billingEntity?.legal_name || 'Performance Marketing Solution s.r.o.'}
            {' '}&bull;{' '}
            {billingEntity?.address
              ? `${billingEntity.address.address_1 || ''}, ${billingEntity.address.postal_code || ''} ${billingEntity.address.city || ''}`
              : 'Rybná 716/24, Staré Město, 110 00 Praha'}
            {billingEntity?.registration_id && (
              <>
                <br />
                N° d&rsquo;enregistrement&nbsp;: {billingEntity.registration_id}
              </>
            )}
            {!billingEntity && (
              <>
                <br />
                N° d&rsquo;enregistrement&nbsp;: 06259928 &bull; TVA&nbsp;: CZ06259928
              </>
            )}
            <br />
            Tu reçois cet e-mail suite à ta commande sur www.lacheprise-livre.fr.
          </Text>
        </div>
      </Section>
    </Base>
  )
}

FrShipmentNotificationTemplate.PreviewProps = {
  order: {
    id: 'test-order-id',
    display_id: '812',
    metadata: { custom_order_number: 'FR2026-812' },
    created_at: new Date().toISOString(),
    email: 'claire.moreau@gmail.com',
    currency_code: 'eur',
    items: [
      {
        id: 'item-1',
        title: 'Lâche prise sur ce qui te détruit',
        product_title: 'Lâche prise sur ce qui te détruit',
        variant_title: 'Broché',
        quantity: 2,
        unit_price: 36,
        thumbnail: '',
      },
    ],
  },
  shippingAddress: {
    first_name: 'Claire',
    last_name: 'Moreau',
    address_1: '12 rue de la République',
    city: 'Lyon',
    postal_code: '69002',
    country_code: 'fr',
  },
  trackingNumber: 'FR10009876543',
  trackingUrl: 'https://www.laposte.fr/outils/suivre-vos-envois?code=FR10009876543',
  trackingCompany: 'Colissimo',
  pickupPoint: null,
} as any

export default FrShipmentNotificationTemplate
