import { Text, Section, Button, Img, Hr, Link } from '@react-email/components'
import * as React from 'react'
import { Base } from './base'

export const LL_ABANDONED_CHECKOUT_1 = 'll-abandoned-checkout-1'

export interface LlAbandonedCheckout1Props {
  firstName: string
  checkoutUrl: string
  productName: string
  productPrice: string
  productImage?: string
  preview?: string
}

export const isLlAbandonedCheckout1Data = (data: any): data is LlAbandonedCheckout1Props =>
  typeof data.firstName === 'string' && typeof data.checkoutUrl === 'string'

const font = "'Inter', 'Segoe UI', Arial, sans-serif"
const pad = '28px'

const colors = {
  headerBg: '#7C3AED',
  headerGradient: 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 50%, #6D28D9 100%)',
  accent: '#7C3AED',
  accentLight: '#C4B5FD',
  accentSoft: '#F5F3FF',
  textDark: '#18181B',
  textBody: '#3F3F46',
  textMuted: '#71717A',
  boxBorder: '#E4E4E7',
  footerBg: '#18181B',
  footerText: '#A1A1AA',
  footerAccent: '#A78BFA',
  divider: '#E4E4E7',
}

export const LlAbandonedCheckout1Template: React.FC<LlAbandonedCheckout1Props> & {
  PreviewProps: LlAbandonedCheckout1Props
} = ({
  firstName,
  checkoutUrl,
  productName,
  productPrice,
  productImage,
  preview = 'Dein Buch liegt verpackt und wartet auf dich!',
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
            color: 'rgba(255,255,255,0.75)',
            margin: '0 0 10px 0',
          }}>
            Lass los, was dich kaputt macht
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
            Dein Paket steht bereit!
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
            Hallo {firstName},
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            lineHeight: '1.7',
            margin: '12px 0 0',
            color: colors.textBody,
          }}>
            gute Nachrichten &mdash; deine Bestellung von <strong style={{ color: colors.textDark }}>{productName}</strong> ist bereits verpackt und versandbereit. Es fehlt nur noch deine Best&auml;tigung.
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            lineHeight: '1.7',
            margin: '16px 0 0',
            color: colors.textBody,
          }}>
            Wusstest du, dass die meisten Menschen nicht an ihren Problemen scheitern &mdash; sondern daran, dass sie an alten Mustern festhalten? Ein einziger Perspektivwechsel kann den Unterschied ausmachen zwischen einem Leben voller Gr&uuml;beln und Selbstzweifel &mdash; und einem Leben in innerer Ruhe und Klarheit.
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            lineHeight: '1.7',
            margin: '16px 0 0',
            color: colors.textBody,
          }}>
            Genau das entdeckst du in &bdquo;Lass los, was dich kaputt macht&ldquo;. Keine komplizierten Theorien. Keine teuren Therapeuten. Einfach klare, bew&auml;hrte Techniken, die du sofort anwenden kannst.
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
            border: '1px solid #DDD6FE',
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
              &euro;{productPrice}
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
            Ja, Buch jetzt bestellen &#8594;
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
            Deine Daten sind bereits hinterlegt &mdash; die Bestellung dauert nur noch 1 Minute.
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
            Bis bald,
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
            Lass los, was dich kaputt macht &bull;{' '}
            <Link href="mailto:buch@lasslosbuch.de" style={{ color: colors.accent, textDecoration: 'underline' }}>
              buch@lasslosbuch.de
            </Link>
          </Text>
        </div>

        {/* ====== SPACER ====== */}
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
            Lass los, was dich kaputt macht
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '11px',
            color: colors.footerText,
            lineHeight: '1.7',
            margin: '0 0 8px',
          }}>
            EverChapter O&Uuml; &bull; Tallinn, Estonia
            <br />
            Reg. Nr: 16938029
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '11px',
            color: '#71717A',
            lineHeight: '1.5',
            margin: '0',
          }}>
            Du erh&auml;ltst diese E-Mail, weil du einen Checkout auf lasslosbuch.de gestartet hast.
          </Text>
        </div>
      </Section>
    </Base>
  )
}

LlAbandonedCheckout1Template.PreviewProps = {
  firstName: 'Maria',
  checkoutUrl: 'https://www.lasslosbuch.de/checkout',
  productName: 'Lass los, was dich kaputt macht',
  productPrice: '35,00',
  productImage: '',
  preview: 'Dein Buch liegt verpackt und wartet auf dich!',
} as LlAbandonedCheckout1Props

export default LlAbandonedCheckout1Template
