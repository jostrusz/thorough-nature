import { Text, Section, Button, Hr, Link } from '@react-email/components'
import * as React from 'react'
import { Base } from './base'

export const FR_ABANDONED_CHECKOUT_3 = 'fr-abandoned-checkout-3'

export interface FrAbandonedCheckout3Props {
  firstName: string
  checkoutUrl: string
  productName: string
  productPrice: string
  productImage?: string
  preview?: string
}

export const isFrAbandonedCheckout3Data = (data: any): data is FrAbandonedCheckout3Props =>
  typeof data.firstName === 'string' && typeof data.checkoutUrl === 'string'

const font = "'Inter', 'Segoe UI', Arial, sans-serif"
const pad = '28px'

const colors = {
  headerBg: '#18181B',
  headerGradient: 'linear-gradient(135deg, #27272A 0%, #18181B 50%, #09090B 100%)',
  accent: '#C27BA0',
  accentSoft: '#FAF5F8',
  textDark: '#18181B',
  textBody: '#3F3F46',
  textMuted: '#71717A',
  boxBorder: '#EDD9E5',
  footerBg: '#2D1B3D',
  footerText: '#9B7AAD',
  footerAccent: '#C27BA0',
  divider: '#EDD9E5',
  urgentBg: '#FEF2F2',
  urgentBorder: '#FECACA',
  urgentText: '#991B1B',
}

export const FrAbandonedCheckout3Template: React.FC<FrAbandonedCheckout3Props> & {
  PreviewProps: FrAbandonedCheckout3Props
} = ({
  firstName,
  checkoutUrl,
  productName,
  productPrice,
  productImage,
  preview = 'Il reste 24 heures — ensuite ton panier sera vidé.',
}) => {
  return (
    <Base preview={preview}>
      <Section>
        {/* ====== HEADER — dark, urgent tone ====== */}
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
            color: 'rgba(255,255,255,0.55)',
            margin: '0 0 10px 0',
          }}>
            Lâche prise sur ce qui te détruit
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '26px',
            fontWeight: 800,
            color: '#ffffff',
            margin: '0',
            lineHeight: '1.2',
            letterSpacing: '-0.02em',
          }}>
            Dernière chance, {firstName}
          </Text>
        </div>

        {/* ====== URGENT BOX ====== */}
        <div style={{ padding: `24px ${pad} 0` }}>
          <div style={{
            backgroundColor: colors.urgentBg,
            border: `1px solid ${colors.urgentBorder}`,
            borderRadius: '10px',
            padding: '16px 20px',
            textAlign: 'center' as const,
          }}>
            <Text style={{
              fontFamily: font,
              fontSize: '14px',
              fontWeight: 700,
              color: colors.urgentText,
              margin: '0',
              lineHeight: '1.5',
            }}>
              ⏰ Ton panier sera vidé dans 24 heures
            </Text>
          </div>
        </div>

        {/* ====== BODY ====== */}
        <div style={{ padding: `20px ${pad} 0` }}>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            color: colors.textBody,
            lineHeight: '1.7',
            margin: '0',
          }}>
            Bonjour {firstName},
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            lineHeight: '1.7',
            margin: '12px 0 0',
            color: colors.textBody,
          }}>
            C&rsquo;est mon dernier rappel. Demain, ton panier sera automatiquement vidé et je ne pourrai plus garder ta commande de côté.
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            lineHeight: '1.7',
            margin: '16px 0 0',
            color: colors.textBody,
          }}>
            Je comprends que franchir ce pas puisse être difficile. Mais pose-toi la question&nbsp;: <strong style={{ color: colors.textDark }}>si ce n&rsquo;est pas maintenant — alors quand&nbsp;?</strong>
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            lineHeight: '1.7',
            margin: '16px 0 0',
            color: colors.textBody,
          }}>
            Combien de nuits blanches encore, à cause de pensées impossibles à arrêter&nbsp;? Combien de fois encore diras-tu «&nbsp;plus tard&nbsp;» au changement dont tu as profondément besoin&nbsp;?
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            lineHeight: '1.7',
            margin: '16px 0 0',
            color: colors.textBody,
            fontWeight: 600,
          }}>
            La douleur à laquelle tu t&rsquo;accroches ne t&rsquo;apporte plus rien. Il est temps de lâcher prise sur ce qui te détruit.
          </Text>
        </div>

        {/* ====== PRODUCT CARD ====== */}
        <div style={{ padding: `24px ${pad} 0` }}>
          <div style={{
            backgroundColor: colors.accentSoft,
            borderRadius: '12px',
            border: `1px solid ${colors.boxBorder}`,
            padding: '20px 24px',
            textAlign: 'center' as const,
          }}>
            <Text style={{
              fontFamily: font,
              fontSize: '17px',
              fontWeight: 700,
              margin: '0 0 6px',
              color: colors.textDark,
            }}>
              {productName}
            </Text>
            <Text style={{
              fontFamily: font,
              fontSize: '20px',
              fontWeight: 800,
              margin: '0',
              color: colors.accent,
            }}>
              {productPrice} €
            </Text>
          </div>
        </div>

        {/* ====== CTA BUTTON ====== */}
        <div style={{ textAlign: 'center' as const, padding: `24px ${pad} 0` }}>
          <Button
            href={checkoutUrl}
            style={{
              backgroundColor: colors.accent,
              color: '#ffffff',
              fontFamily: font,
              fontSize: '16px',
              fontWeight: 700,
              padding: '14px 40px',
              borderRadius: '10px',
              textDecoration: 'none',
              display: 'inline-block',
            }}
          >
            Finaliser ma commande maintenant &#8594;
          </Button>
        </div>

        <div style={{ padding: `14px ${pad} 0` }}>
          <Text style={{
            fontFamily: font,
            fontSize: '13px',
            lineHeight: '1.6',
            color: colors.textMuted,
            textAlign: 'center' as const,
            margin: '0',
          }}>
            Garantie satisfait ou remboursé pendant 30 jours. Aucune question. Aucun risque.
          </Text>
        </div>

        <Hr style={{ margin: `24px ${pad}`, borderColor: colors.divider }} />

        {/* ====== SIGN-OFF ====== */}
        <div style={{ padding: `0 ${pad}` }}>
          <Text style={{
            fontFamily: font,
            fontSize: '14px',
            color: colors.textBody,
            lineHeight: '1.6',
            margin: '0',
          }}>
            Chaleureusement,
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '14px',
            fontWeight: 700,
            color: colors.textDark,
            margin: '4px 0 0',
          }}>
            Joris de Vries
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '13px',
            color: colors.textMuted,
            margin: '2px 0 0',
          }}>
            Lâche prise sur ce qui te détruit &bull;{' '}
            <Link href="mailto:support@lacheprise-livre.fr" style={{ color: colors.accent, textDecoration: 'underline' }}>
              support@lacheprise-livre.fr
            </Link>
          </Text>
        </div>

        <div style={{ height: '28px' }}></div>

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
            Lâche prise sur ce qui te détruit
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '11px',
            color: colors.footerText,
            lineHeight: '1.7',
            margin: '0 0 8px',
          }}>
            Performance Marketing Solution s.r.o. &bull; Rybná 716/24, 110 00 Praha
            <br />
            N° d&rsquo;enregistrement&nbsp;: 06259928
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '11px',
            color: '#71717A',
            lineHeight: '1.5',
            margin: '0',
          }}>
            Ceci est le dernier rappel concernant ta commande. Tu ne recevras plus aucune autre relance.
          </Text>
        </div>
      </Section>
    </Base>
  )
}

FrAbandonedCheckout3Template.PreviewProps = {
  firstName: 'Claire',
  checkoutUrl: 'https://lacheprise-livre.fr/checkout',
  productName: 'Lâche prise sur ce qui te détruit',
  productPrice: '36',
  productImage: '',
  preview: 'Il reste 24 heures — ensuite ton panier sera vidé.',
} as FrAbandonedCheckout3Props

export default FrAbandonedCheckout3Template
