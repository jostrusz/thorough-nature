import { Text, Section, Button, Hr, Link } from '@react-email/components'
import * as React from 'react'
import { ZzBase } from './zz-base'

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

const fontBody = "'DM Sans', Helvetica, Arial, sans-serif"
const fontSerif = "'Recoleta', Georgia, 'Times New Roman', serif"
const pad = '28px'

const colors = {
  bg: '#FFF8F3',
  heading: '#4A1A2E',
  cta: '#B85C4A',
  ctaHover: '#A04A38',
  section: '#F0D5C4',
  body: '#6B3344',
  highlight: '#E8A88C',
  dark: '#3D1E2A',
  white: '#FFFFFF',
  light: '#FDF5EF',
  muted: '#9B6B7A',
  accent: '#D4916A',
  starColor: '#F0A500',
  guaranteeBg: '#F0FDF4',
  guaranteeBorder: '#BBF7D0',
  guaranteeText: '#166534',
}

const ReviewCard: React.FC<{ text: string; author: string }> = ({ text, author }) => (
  <div style={{
    backgroundColor: colors.light,
    border: `1px solid ${colors.section}`,
    borderLeft: `4px solid ${colors.highlight}`,
    borderRadius: '10px',
    padding: '18px 20px',
    marginBottom: '12px',
  }}>
    <Text style={{
      fontFamily: fontBody,
      fontSize: '14px',
      color: colors.starColor,
      margin: '0 0 8px',
      letterSpacing: '2px',
    }}>
      ★★★★★
    </Text>
    <Text style={{
      fontFamily: fontSerif,
      fontSize: '15px',
      fontStyle: 'italic' as const,
      color: colors.heading,
      lineHeight: '1.55',
      margin: '0 0 10px',
    }}>
      &ldquo;{text}&rdquo;
    </Text>
    <Text style={{
      fontFamily: fontBody,
      fontSize: '12px',
      fontWeight: 600,
      color: colors.muted,
      margin: '0',
      letterSpacing: '0.03em',
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
    <ZzBase preview={preview}>
      {/* ====== HEADER ====== */}
      <div style={{
        backgroundColor: colors.heading,
        background: `linear-gradient(135deg, ${colors.heading} 0%, ${colors.dark} 100%)`,
        padding: '44px 28px 38px',
        textAlign: 'center' as const,
      }}>
        <Text style={{
          fontFamily: fontBody,
          fontSize: '11px',
          fontWeight: 700,
          letterSpacing: '0.22em',
          textTransform: 'uppercase' as const,
          color: colors.highlight,
          margin: '0 0 12px 0',
        }}>
          Życie, jakiego nigdy sobie nie pozwoliłaś
        </Text>
        <Text style={{
          fontFamily: fontSerif,
          fontSize: '26px',
          fontWeight: 700,
          color: colors.white,
          margin: '0',
          lineHeight: '1.2',
          letterSpacing: '-0.02em',
        }}>
          Historia stojąca za tą książką
        </Text>
        <div style={{ width: '60px', height: '3px', background: colors.highlight, borderRadius: '2px', margin: '18px auto 0' }} />
      </div>

      {/* ====== PERSONAL MESSAGE ====== */}
      <Section style={{ padding: `30px ${pad} 0` }}>
        <Text style={{
          fontFamily: fontBody,
          fontSize: '15px',
          color: colors.body,
          lineHeight: '1.7',
          margin: '0',
        }}>
          Cześć {firstName},
        </Text>
        <Text style={{
          fontFamily: fontBody,
          fontSize: '15px',
          lineHeight: '1.7',
          margin: '14px 0 0',
          color: colors.body,
        }}>
          Chciałam napisać do Ciebie osobiście. Nie po to, żeby Cię naciskać — ale dlatego, że wierzę, że musisz to usłyszeć.
        </Text>
        <Text style={{
          fontFamily: fontBody,
          fontSize: '15px',
          lineHeight: '1.7',
          margin: '18px 0 0',
          color: colors.body,
        }}>
          5 lat temu siedziałam na podłodze w kuchni i płakałam. Z zewnątrz wszystko wyglądało idealnie — dom czysty, dzieci nakarmione, kalendarz pełen. A w środku? Wykończona. Tym, że musiałam mieć wszystko pod kontrolą.
        </Text>
        <Text style={{
          fontFamily: fontBody,
          fontSize: '15px',
          lineHeight: '1.7',
          margin: '18px 0 0',
          color: colors.body,
        }}>
          Tamtego wieczoru zamówiłam 10 światowych bestsellerów o odpuszczaniu, granicach, porządkowaniu i spokoju. Przeczytałam je wszystkie w 4 miesiące. I odkryłam, że wszystkie mówiły o tym samym — tylko każda z innej strony. Połączyłam je w jeden system: <strong style={{ color: colors.heading }}>LIFE RESET™ — 5 filarów, 30 dni</strong>.
        </Text>
        <Text style={{
          fontFamily: fontBody,
          fontSize: '15px',
          lineHeight: '1.7',
          margin: '18px 0 0',
          color: colors.body,
        }}>
          Nie musisz być psycholożką. Nie potrzebujesz terapeutki. 8 minut dziennie. Jedna szuflada. Jedno „nie". I po 30 dniach jesteś inną osobą — w dobrym sensie.
        </Text>
      </Section>

      <Hr style={{ margin: `26px ${pad}`, borderColor: colors.section }} />

      {/* ====== REVIEWS ====== */}
      <Section style={{ padding: `0 ${pad}` }}>
        <Text style={{
          fontFamily: fontBody,
          fontSize: '12px',
          fontWeight: 700,
          textTransform: 'uppercase' as const,
          letterSpacing: '0.2em',
          color: colors.cta,
          margin: '0 0 16px',
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
      </Section>

      {/* ====== GUARANTEE ====== */}
      <Section style={{ padding: `22px ${pad} 0` }}>
        <div style={{
          backgroundColor: colors.guaranteeBg,
          border: `1px solid ${colors.guaranteeBorder}`,
          borderRadius: '10px',
          padding: '16px 20px',
          textAlign: 'center' as const,
        }}>
          <Text style={{
            fontFamily: fontBody,
            fontSize: '14px',
            fontWeight: 600,
            color: colors.guaranteeText,
            margin: '0',
            lineHeight: '1.55',
          }}>
            ✓ 100% gwarancja zwrotu pieniędzy w ciągu 30 dni.
            <br />
            Bez pytań, bez komplikacji. Ryzyko jest po mojej stronie, nie Twojej.
          </Text>
        </div>
      </Section>

      {/* ====== PRODUCT CARD ====== */}
      <Section style={{ padding: `22px ${pad} 0` }}>
        <div style={{
          backgroundColor: colors.light,
          borderRadius: '14px',
          border: `1px solid ${colors.section}`,
          padding: '22px 26px',
          textAlign: 'center' as const,
        }}>
          <Text style={{
            fontFamily: fontSerif,
            fontSize: '19px',
            fontWeight: 700,
            margin: '0 0 8px',
            color: colors.heading,
            lineHeight: '1.25',
          }}>
            {productName}
          </Text>
          <Text style={{
            fontFamily: fontSerif,
            fontSize: '24px',
            fontWeight: 700,
            margin: '0',
            color: colors.cta,
          }}>
            {productPrice} zł
          </Text>
        </div>
      </Section>

      {/* ====== CTA BUTTON ====== */}
      <Section style={{ textAlign: 'center' as const, padding: `26px ${pad} 0` }}>
        <Button
          href={checkoutUrl}
          style={{
            backgroundColor: colors.cta,
            color: colors.white,
            fontFamily: fontBody,
            fontSize: '16px',
            fontWeight: 700,
            padding: '16px 44px',
            borderRadius: '10px',
            textDecoration: 'none',
            display: 'inline-block',
          }}
        >
          Chcę odzyskać swoje życie →
        </Button>
      </Section>

      <Section style={{ padding: `14px ${pad} 0` }}>
        <Text style={{
          fontFamily: fontBody,
          fontSize: '13px',
          lineHeight: '1.6',
          color: colors.muted,
          textAlign: 'center' as const,
          margin: '0',
        }}>
          Twoja książka może być w drodze już jutro.
        </Text>
      </Section>

      <Hr style={{ margin: `26px ${pad}`, borderColor: colors.section }} />

      {/* ====== SIGN-OFF ====== */}
      <Section style={{ padding: `0 ${pad}` }}>
        <Text style={{
          fontFamily: fontBody,
          fontSize: '14px',
          color: colors.body,
          lineHeight: '1.6',
          margin: '0',
        }}>
          Serdecznie pozdrawiam,
        </Text>
        <Text style={{
          fontFamily: fontSerif,
          fontSize: '18px',
          fontWeight: 700,
          color: colors.heading,
          margin: '6px 0 0',
        }}>
          Anna de Vries
        </Text>
        <Text style={{
          fontFamily: fontBody,
          fontSize: '13px',
          color: colors.muted,
          margin: '4px 0 0',
        }}>
          Życie, jakiego nigdy sobie nie pozwoliłaś •{' '}
          <Link href="mailto:anna@najpierw-ja.pl" style={{ color: colors.cta, textDecoration: 'underline' }}>
            anna@najpierw-ja.pl
          </Link>
        </Text>
      </Section>

      <div style={{ height: '32px' }}></div>

      {/* ====== FOOTER ====== */}
      <div style={{
        backgroundColor: colors.dark,
        padding: '30px 28px',
        textAlign: 'center' as const,
      }}>
        <Text style={{
          fontFamily: fontSerif,
          fontSize: '15px',
          fontWeight: 700,
          color: colors.highlight,
          margin: '0 0 10px',
        }}>
          Życie, jakiego nigdy sobie nie pozwoliłaś
        </Text>
        <Text style={{
          fontFamily: fontBody,
          fontSize: '11px',
          color: 'rgba(255,255,255,0.7)',
          lineHeight: '1.7',
          margin: '0 0 8px',
        }}>
          Performance Marketing Solution s.r.o. • Rybná 716/24, 110 00 Praha, Staré Město
          <br />
          IČO: 06259928 · DIČ: CZ06259928
        </Text>
        <Text style={{
          fontFamily: fontBody,
          fontSize: '11px',
          color: 'rgba(255,255,255,0.45)',
          lineHeight: '1.5',
          margin: '0',
        }}>
          Otrzymujesz tę wiadomość, ponieważ rozpoczęłaś zamówienie na najpierw-ja.pl.
        </Text>
      </div>
    </ZzBase>
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
