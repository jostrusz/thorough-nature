import { Text, Section, Button, Img, Hr, Link } from '@react-email/components'
import * as React from 'react'
import { Base } from './base'

export const KB_ABANDONED_CHECKOUT_1 = 'kb-abandoned-checkout-1'

export interface KbAbandonedCheckout1Props {
  firstName: string
  checkoutUrl: string
  productName: string
  productPrice: string
  productImage?: string
  preview?: string
}

export const isKbAbandonedCheckout1Data = (data: any): data is KbAbandonedCheckout1Props =>
  typeof data.firstName === 'string' && typeof data.checkoutUrl === 'string'

const font = "'Inter', 'Segoe UI', Arial, sans-serif"
const pad = '28px'

const colors = {
  headerBg: '#2D1B3D',
  headerGradient: 'linear-gradient(135deg, #3D2B4D 0%, #2D1B3D 50%, #1A1028 100%)',
  accent: '#C27BA0',
  accentLight: '#E8B4D0',
  accentSoft: '#FAF5F8',
  textDark: '#18181B',
  textBody: '#3F3F46',
  textMuted: '#71717A',
  boxBorder: '#EDD9E5',
  footerBg: '#2D1B3D',
  footerText: '#9B7AAD',
  footerAccent: '#C27BA0',
  divider: '#EDD9E5',
}

export const KbAbandonedCheckout1Template: React.FC<KbAbandonedCheckout1Props> & {
  PreviewProps: KbAbandonedCheckout1Props
} = ({
  firstName,
  checkoutUrl,
  productName,
  productPrice,
  productImage,
  preview = 'Vaše kniha je zabalená. Čeká jen na vás.',
}) => {
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
            color: 'rgba(255,255,255,0.65)',
            margin: '0 0 10px 0',
          }}>
            Kočičí bible
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
            Vaše kniha je zabalená
          </Text>
        </div>

        {/* ====== GREETING + BODY ====== */}
        <div style={{ padding: `28px ${pad} 0` }}>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            color: colors.textBody,
            lineHeight: '1.7',
            margin: '0',
          }}>
            Dobrý den {firstName},
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            lineHeight: '1.7',
            margin: '12px 0 0',
            color: colors.textBody,
          }}>
Vaše objednávka knihy <strong style={{ color: colors.textDark }}>{productName}</strong> zůstala rozdělaná. Máme ji odloženou stranou, chybí jen potvrzení.
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            lineHeight: '1.7',
            margin: '16px 0 0',
            color: colors.textBody,
          }}>
Za dvanáct let jsem nepotkal kočku, která by <em>zlobila naschvál</em>. Čůrání vedle bedýnky, noční řev, rozdrásaný gauč. To všechno vám něco říká, jen to zatím není čitelné.
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            lineHeight: '1.7',
            margin: '16px 0 0',
            color: colors.textBody,
          }}>
V knize je sepsané, co jsem si za ta léta ověřil. Co zabralo, co ne a za jak dlouho. Vyberete si jednu věc, dáte tomu týden a uvidíte sami. Plus 3 bonusové e-booky zdarma.
          </Text>
        </div>

        {/* ====== PRODUCT IMAGE ====== */}
        {productImage && (
          <div style={{ textAlign: 'center' as const, padding: `20px ${pad} 0` }}>
            <Img
              src={productImage}
              alt={productName}
              width="200"
              style={{ borderRadius: '12px', maxWidth: '100%', border: `1px solid ${colors.boxBorder}` }}
            />
          </div>
        )}

        {/* ====== PRODUCT CARD ====== */}
        <div style={{ padding: `20px ${pad} 0` }}>
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
              {productPrice} Kč
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
            Ano, pošlete mi mou knihu &#8594;
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
            Údaje už máte vyplněné, dokončení zabere minutu.
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
            Srdečně,
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '14px',
            fontWeight: 700,
            color: colors.textDark,
            margin: '4px 0 0',
          }}>
            Michal Peterka
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '13px',
            color: colors.textMuted,
            margin: '2px 0 0',
          }}>
            Kočičí bible &bull;{' '}
            <Link href="mailto:peterka@kocicibible.cz" style={{ color: colors.accent, textDecoration: 'underline' }}>
              peterka@kocicibible.cz
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
            Kočičí bible
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
            IČO: 06259928
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '11px',
            color: '#71717A',
            lineHeight: '1.5',
            margin: '0',
          }}>
            Tenhle e-mail vám přišel, protože jste na kocicibible.cz nechali rozdělanou objednávku.
          </Text>
        </div>
      </Section>
    </Base>
  )
}

KbAbandonedCheckout1Template.PreviewProps = {
  firstName: 'Petra',
  checkoutUrl: 'https://www.kocicibible.cz/checkout',
  productName: 'Kočičí bible',
  productPrice: '550',
  productImage: '',
  preview: 'Vaše kniha je zabalená. Čeká jen na vás.',
} as KbAbandonedCheckout1Props

export default KbAbandonedCheckout1Template
