import { Text, Section, Button, Hr, Link } from '@react-email/components'
import * as React from 'react'
import { Base } from './base'

export const ZZ_ABANDONED_CHECKOUT_2 = 'zz-abandoned-checkout-2'

export interface ZzAbandonedCheckout2Props {
  firstName: string
  checkoutUrl: string
  productName: string
  productPrice: string
  productImage?: string
  preview?: string
}

export const isZzAbandonedCheckout2Data = (data: any): data is ZzAbandonedCheckout2Props =>
  typeof data.firstName === 'string' && typeof data.checkoutUrl === 'string'

const font = "'Inter', 'Segoe UI', Arial, sans-serif"
const pad = '28px'

const colors = {
  headerBg: '#4A1A2E',
  headerGradient: 'linear-gradient(135deg, #6B2A45 0%, #4A1A2E 50%, #3D1E2A 100%)',
  accent: '#B85C4A',
  accentSoft: '#FDF5EF',
  textDark: '#4A1A2E',
  textBody: '#6B3344',
  textMuted: '#9B6B7A',
  boxBorder: '#F0D5C4',
  starColor: '#E8A87C',
  footerBg: '#3D1E2A',
  footerText: '#C4A0A8',
  footerAccent: '#D4886F',
  divider: '#F0D5C4',
  guaranteeBg: '#F0FDF4',
  guaranteeBorder: '#BBF7D0',
  guaranteeText: '#166534',
}

const ReviewCard: React.FC<{ text: string; author: string }> = ({ text, author }) => (
  <div style={{
    backgroundColor: '#FAFAFA',
    border: `1px solid ${colors.boxBorder}`,
    borderRadius: '10px',
    padding: '16px 18px',
    marginBottom: '10px',
  }}>
    <Text style={{
      fontFamily: font,
      fontSize: '14px',
      color: colors.starColor,
      margin: '0 0 6px',
      letterSpacing: '2px',
    }}>
      ★★★★★
    </Text>
    <Text style={{
      fontFamily: font,
      fontSize: '14px',
      fontStyle: 'italic' as const,
      color: colors.textBody,
      lineHeight: '1.6',
      margin: '0 0 8px',
    }}>
      &ldquo;{text}&rdquo;
    </Text>
    <Text style={{
      fontFamily: font,
      fontSize: '12px',
      fontWeight: 600,
      color: colors.textMuted,
      margin: '0',
    }}>
      — {author}
    </Text>
  </div>
)

export const ZzAbandonedCheckout2Template: React.FC<ZzAbandonedCheckout2Props> & {
  PreviewProps: ZzAbandonedCheckout2Props
} = ({
  firstName,
  checkoutUrl,
  productName,
  productPrice,
  productImage,
  preview = 'Już po tygodniu poczułam się lżejsza niż od dawna...',
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
            Życie, jakiego nigdy sobie nie pozwoliłaś
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '24px',
            fontWeight: 800,
            color: '#ffffff',
            margin: '0',
            lineHeight: '1.2',
            letterSpacing: '-0.02em',
          }}>
            Historia stojąca za tą książką
          </Text>
        </div>

        {/* ====== PERSONAL MESSAGE ====== */}
        <div style={{ padding: `28px ${pad} 0` }}>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            color: colors.textBody,
            lineHeight: '1.7',
            margin: '0',
          }}>
            Cześć {firstName},
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            lineHeight: '1.7',
            margin: '12px 0 0',
            color: colors.textBody,
          }}>
            Chciałam napisać do Ciebie osobiście. Nie po to, żeby Cię naciskać — ale dlatego, że wierzę, że musisz to usłyszeć.
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            lineHeight: '1.7',
            margin: '16px 0 0',
            color: colors.textBody,
          }}>
            5 lat temu siedziałam na podłodze w kuchni i płakałam. Z zewnątrz wszystko wyglądało idealnie — dom czysty, dzieci nakarmione, kalendarz pełen. A w środku? Wykończona. Tym, że musiałam mieć wszystko pod kontrolą.
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            lineHeight: '1.7',
            margin: '16px 0 0',
            color: colors.textBody,
          }}>
            Tamtego wieczoru zamówiłam 10 światowych bestsellerów o odpuszczaniu, granicach, porządkowaniu i spokoju. Przeczytałam je wszystkie w 4 miesiące. I odkryłam, że wszystkie mówiły o tym samym — tylko każda z innej strony. Połączyłam je w jeden system: <strong style={{ color: colors.textDark }}>LIFE RESET™ — 5 filarów, 30 dni</strong>.
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            lineHeight: '1.7',
            margin: '16px 0 0',
            color: colors.textBody,
          }}>
            Nie musisz być psycholożką. Nie potrzebujesz terapeutki. 8 minut dziennie. Jedna szuflada. Jedno „nie". I po 30 dniach jesteś inną osobą — w dobrym sensie.
          </Text>
        </div>

        <Hr style={{ margin: `24px ${pad}`, borderColor: colors.divider }} />

        {/* ====== REVIEWS ====== */}
        <div style={{ padding: `0 ${pad}` }}>
          <Text style={{
            fontFamily: font,
            fontSize: '13px',
            fontWeight: 700,
            textTransform: 'uppercase' as const,
            letterSpacing: '1.5px',
            color: colors.textMuted,
            margin: '0 0 14px',
          }}>
            Co mówią inne czytelniczki
          </Text>

          <ReviewCard
            text="Z 347 ubrań zostały mi 73. I po raz pierwszy od lat wiem, w co się ubrać. Mała rzecz — a zmieniła moje poranki kompletnie."
            author="Karolina, 38, Poznań"
          />
          <ReviewCard
            text="Przesunęłam łóżko. Po raz pierwszy od miesięcy przesypiam całą noc. Nie wiem, dlaczego to działa — ale działa."
            author="Magda, 41, Wrocław"
          />
          <ReviewCard
            text="Nauczyłam się mówić NIE bez wyrzutów sumienia. Te dwa słowa uratowały moje małżeństwo."
            author="Ola, 39, Kraków"
          />
        </div>

        {/* ====== GUARANTEE ====== */}
        <div style={{ padding: `20px ${pad} 0` }}>
          <div style={{
            backgroundColor: colors.guaranteeBg,
            border: `1px solid ${colors.guaranteeBorder}`,
            borderRadius: '10px',
            padding: '16px 20px',
            textAlign: 'center' as const,
          }}>
            <Text style={{
              fontFamily: font,
              fontSize: '14px',
              fontWeight: 600,
              color: colors.guaranteeText,
              margin: '0',
              lineHeight: '1.5',
            }}>
              ✓ 100% gwarancja zwrotu pieniędzy w ciągu 30 dni.
              <br />
              Bez pytań, bez komplikacji. Ryzyko jest po mojej stronie, nie Twojej.
            </Text>
          </div>
        </div>

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
              {productPrice} zł
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
            Chcę odzyskać swoje życie &#8594;
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
            Twoja książka może być w drodze już jutro.
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
            Serdecznie pozdrawiam,
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '14px',
            fontWeight: 700,
            color: colors.textDark,
            margin: '4px 0 0',
          }}>
            Anna de Vries
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '13px',
            color: colors.textMuted,
            margin: '2px 0 0',
          }}>
            Życie, jakiego nigdy sobie nie pozwoliłaś &bull;{' '}
            <Link href="mailto:anna@najpierw-ja.pl" style={{ color: colors.accent, textDecoration: 'underline' }}>
              anna@najpierw-ja.pl
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
            Życie, jakiego nigdy sobie nie pozwoliłaś
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '11px',
            color: colors.footerText,
            lineHeight: '1.7',
            margin: '0 0 8px',
          }}>
            Performance Marketing Solution s.r.o. &bull; Rybná 716/24, 110 00 Praha, Staré Město
            <br />
            IČO: 06259928 &middot; DIČ: CZ06259928
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '11px',
            color: colors.footerText,
            lineHeight: '1.5',
            margin: '0',
          }}>
            Otrzymujesz tę wiadomość, ponieważ rozpoczęłaś zamówienie na najpierw-ja.pl.
          </Text>
        </div>
      </Section>
    </Base>
  )
}

ZzAbandonedCheckout2Template.PreviewProps = {
  firstName: 'Anna',
  checkoutUrl: 'https://www.najpierw-ja.pl/checkout',
  productName: 'Życie, jakiego nigdy sobie nie pozwoliłaś',
  productPrice: '129',
  productImage: '',
  preview: 'Już po tygodniu poczułam się lżejsza niż od dawna...',
} as ZzAbandonedCheckout2Props

export default ZzAbandonedCheckout2Template
