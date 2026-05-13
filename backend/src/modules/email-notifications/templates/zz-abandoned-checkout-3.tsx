import { Text, Section, Button, Hr, Link } from '@react-email/components'
import * as React from 'react'
import { ZzBase } from './zz-base'

export const ZZ_ABANDONED_CHECKOUT_3 = 'zz-abandoned-checkout-3'

export interface ZzAbandonedCheckout3Props {
  firstName: string
  checkoutUrl: string
  productName: string
  productPrice: string
  productImage?: string
  preview?: string
}

export const isZzAbandonedCheckout3Data = (data: any): data is ZzAbandonedCheckout3Props =>
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
  urgentBg: '#FEF2F2',
  urgentBorder: '#FECACA',
  urgentText: '#991B1B',
  futureBg: '#FFFBEB',
  futureBorder: '#FDE68A',
  futureText: '#78350F',
  futureHeading: '#92400E',
}

export const ZzAbandonedCheckout3Template: React.FC<ZzAbandonedCheckout3Props> & {
  PreviewProps: ZzAbandonedCheckout3Props
} = ({
  firstName,
  checkoutUrl,
  productName,
  productPrice,
  productImage,
  preview = 'Jeszcze 24 godziny — potem muszę zwolnić Twój koszyk.',
}) => {
  return (
    <ZzBase preview={preview}>
      {/* ====== HEADER — darker/urgent ====== */}
      <div style={{
        backgroundColor: colors.dark,
        background: `linear-gradient(135deg, ${colors.heading} 0%, ${colors.dark} 50%, #2A0F1A 100%)`,
        padding: '44px 28px 38px',
        textAlign: 'center' as const,
      }}>
        <Text style={{
          fontFamily: fontBody,
          fontSize: '11px',
          fontWeight: 700,
          letterSpacing: '0.22em',
          textTransform: 'uppercase' as const,
          color: 'rgba(232,168,140,0.7)',
          margin: '0 0 12px 0',
        }}>
          Życie, jakiego nigdy sobie nie pozwoliłaś
        </Text>
        <Text style={{
          fontFamily: fontSerif,
          fontSize: '28px',
          fontWeight: 700,
          color: colors.white,
          margin: '0',
          lineHeight: '1.15',
          letterSpacing: '-0.02em',
        }}>
          Ostatnia szansa, {firstName}
        </Text>
        <div style={{ width: '60px', height: '3px', background: colors.highlight, borderRadius: '2px', margin: '18px auto 0' }} />
      </div>

      {/* ====== URGENT BANNER ====== */}
      <Section style={{ padding: `22px ${pad} 0` }}>
        <div style={{
          backgroundColor: colors.urgentBg,
          border: `1px solid ${colors.urgentBorder}`,
          borderRadius: '10px',
          padding: '14px 18px',
          textAlign: 'center' as const,
        }}>
          <Text style={{
            fontFamily: fontBody,
            fontSize: '13px',
            fontWeight: 600,
            color: colors.urgentText,
            margin: '0',
          }}>
            ⏰ Twój koszyk zostanie zwolniony automatycznie w ciągu 24 godzin
          </Text>
        </div>
      </Section>

      {/* ====== BODY ====== */}
      <Section style={{ padding: `22px ${pad} 0` }}>
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
          To ostatni raz, kiedy piszę w sprawie Twojego zamówienia. Zachowam Twój koszyk jeszcze przez 24 godziny — potem zostanie automatycznie zwolniony.
        </Text>
        <Text style={{
          fontFamily: fontBody,
          fontSize: '15px',
          lineHeight: '1.7',
          margin: '18px 0 0',
          color: colors.body,
        }}>
          Nie chcę Cię naciskać. Ale chcę być z Tobą szczera.
        </Text>
        <Text style={{
          fontFamily: fontBody,
          fontSize: '15px',
          lineHeight: '1.7',
          margin: '18px 0 0',
          color: colors.body,
        }}>
          Ten ciężar, który teraz w sobie nosisz — pełna szafa, hałas w głowie, „nie" które nie chce wyjść, wieczne zmęczenie — nie zniknie sam z siebie. Nie poprawi się jutro. Wręcz przeciwnie: za rok Twoja szafa będzie pełniejsza, głowa głośniejsza, energia niższa.
        </Text>
      </Section>

      {/* ====== FUTURE PACING ====== */}
      <Section style={{ padding: `22px ${pad} 0` }}>
        <div style={{
          backgroundColor: colors.futureBg,
          border: `1px solid ${colors.futureBorder}`,
          borderRadius: '12px',
          padding: '22px 22px',
        }}>
          <Text style={{
            fontFamily: fontSerif,
            fontSize: '15px',
            fontWeight: 700,
            color: colors.futureHeading,
            margin: '0 0 10px',
            letterSpacing: '0.01em',
          }}>
            💭 Wyobraź sobie to:
          </Text>
          <Text style={{
            fontFamily: fontBody,
            fontSize: '14px',
            color: colors.futureText,
            lineHeight: '1.75',
            margin: '0',
          }}>
            Jest za 30 dni. Otwierasz szafę i od razu wiesz, co założysz. Mama dzwoni z prośbą — mówisz „dzisiaj nie, mamo" — odkładasz słuchawkę, bierzesz oddech, idziesz dalej. Bez wyrzutów sumienia. Wieczorem siedzisz na kanapie i nie robisz nic. I po raz pierwszy od lat jest cicho — w domu i w środku.
          </Text>
        </div>
      </Section>

      <Section style={{ padding: `18px ${pad} 0` }}>
        <Text style={{
          fontFamily: fontBody,
          fontSize: '15px',
          lineHeight: '1.7',
          margin: '0',
          color: colors.body,
        }}>
          To nie fantazja. To jest to, co <strong style={{ color: colors.heading }}>setki Polek</strong> już przeżyło z metodą LIFE RESET™. A dla większości z nich zaczęło się od dokładnie takich samych wątpliwości, jakie masz teraz.
        </Text>
        <Text style={{
          fontFamily: fontSerif,
          fontSize: '16px',
          lineHeight: '1.55',
          margin: '14px 0 0',
          color: colors.heading,
          fontWeight: 700,
          fontStyle: 'italic' as const,
        }}>
          Wiesz, co było różnicą? Wybrały zacząć dzisiaj. Jedna szuflada. Osiem minut.
        </Text>
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
          Tak, zaczynam dzisiaj →
        </Button>
      </Section>

      {/* ====== TRUST BADGES ====== */}
      <Section style={{ padding: `20px ${pad} 0`, textAlign: 'center' as const }}>
        <Text style={{
          fontFamily: fontBody,
          fontSize: '13px',
          color: colors.muted,
          lineHeight: '2',
          margin: '0',
        }}>
          ✓ 30 dni gwarancji zwrotu pieniędzy<br />
          ✓ Darmowa wysyłka w całej Polsce<br />
          ✓ 2 bonusowe e-booki gratis (wartość 238 zł)
        </Text>
      </Section>

      <Hr style={{ margin: `26px ${pad}`, borderColor: colors.section }} />

      {/* ====== CLOSING ====== */}
      <Section style={{ padding: `0 ${pad}` }}>
        <Text style={{
          fontFamily: fontBody,
          fontSize: '15px',
          lineHeight: '1.7',
          margin: '0',
          color: colors.body,
        }}>
          Po tej wiadomości nie wyślę Ci już żadnych przypomnień. Wybór należy do Ciebie — i niezależnie od tego, co zdecydujesz, w pełni to szanuję.
        </Text>
        <Text style={{
          fontFamily: fontBody,
          fontSize: '15px',
          lineHeight: '1.7',
          margin: '16px 0 0',
          color: colors.body,
        }}>
          Ale jeśli kiedykolwiek pomyślałaś <em style={{ color: colors.heading, fontStyle: 'italic' as const }}>„chciałabym wreszcie odpuścić to, co mnie przytłacza"</em> — to jest Twoja szansa.
        </Text>
      </Section>

      <Hr style={{ margin: `26px ${pad}`, borderColor: colors.section }} />

      {/* ====== SIGN-OFF ====== */}
      <Section style={{ padding: `0 ${pad}` }}>
        <Text style={{
          fontFamily: fontSerif,
          fontSize: '18px',
          fontWeight: 700,
          color: colors.heading,
          margin: '0',
        }}>
          Anna de Vries
        </Text>
        <Text style={{
          fontFamily: fontBody,
          fontSize: '13px',
          color: colors.muted,
          margin: '4px 0 0',
        }}>
          Życie, jakiego nigdy sobie nie pozwoliłaś
        </Text>
        <Text style={{
          fontFamily: fontBody,
          fontSize: '13px',
          color: colors.muted,
          margin: '16px 0 0',
          fontStyle: 'italic' as const,
          lineHeight: '1.65',
        }}>
          P.S. Masz pytania? Napisz do mnie osobiście na{' '}
          <Link href="mailto:anna@najpierw-ja.pl" style={{ color: colors.cta, textDecoration: 'underline', fontWeight: 600, fontStyle: 'normal' as const }}>
            anna@najpierw-ja.pl
          </Link>
          . Czytam i odpowiadam na każdą wiadomość osobiście.
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
          Otrzymujesz tę wiadomość, ponieważ rozpoczęłaś zamówienie na najpierw-ja.pl. To jest ostatnie przypomnienie — nie otrzymasz więcej wiadomości dotyczących tego zamówienia.
        </Text>
      </div>
    </ZzBase>
  )
}

ZzAbandonedCheckout3Template.PreviewProps = {
  firstName: 'Anna',
  checkoutUrl: 'https://www.najpierw-ja.pl/checkout',
  productName: 'Życie, jakiego nigdy sobie nie pozwoliłaś',
  productPrice: '129',
  productImage: '',
  preview: 'Jeszcze 24 godziny — potem muszę zwolnić Twój koszyk.',
} as ZzAbandonedCheckout3Props

export default ZzAbandonedCheckout3Template
