import { Text, Section, Button, Hr, Link } from '@react-email/components'
import * as React from 'react'
import { Base } from './base'

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

const font = "'Inter', 'Segoe UI', Arial, sans-serif"
const pad = '28px'

const colors = {
  headerBg: '#2A0F1A',
  headerGradient: 'linear-gradient(135deg, #4A1A2E 0%, #2A0F1A 50%, #1A0610 100%)',
  accent: '#B85C4A',
  accentSoft: '#FDF5EF',
  textDark: '#4A1A2E',
  textBody: '#6B3344',
  textMuted: '#9B6B7A',
  boxBorder: '#F0D5C4',
  footerBg: '#3D1E2A',
  footerText: '#C4A0A8',
  footerAccent: '#D4886F',
  divider: '#F0D5C4',
  urgentBg: '#FEF2F2',
  urgentBorder: '#FECACA',
  urgentText: '#991B1B',
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
    <Base preview={preview}>
      <Section>
        {/* ====== HEADER — dark/urgent ====== */}
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
            color: 'rgba(255,255,255,0.5)',
            margin: '0 0 10px 0',
          }}>
            Życie, jakiego nigdy sobie nie pozwoliłaś
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
            Ostatnia szansa, {firstName}
          </Text>
        </div>

        {/* ====== URGENT BANNER ====== */}
        <div style={{ padding: `20px ${pad} 0` }}>
          <div style={{
            backgroundColor: colors.urgentBg,
            border: `1px solid ${colors.urgentBorder}`,
            borderRadius: '10px',
            padding: '14px 18px',
            textAlign: 'center' as const,
          }}>
            <Text style={{
              fontFamily: font,
              fontSize: '13px',
              fontWeight: 600,
              color: colors.urgentText,
              margin: '0',
            }}>
              ⏰ Twój koszyk zostanie zwolniony automatycznie w ciągu 24 godzin
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
            Cześć {firstName},
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            lineHeight: '1.7',
            margin: '12px 0 0',
            color: colors.textBody,
          }}>
            To ostatni raz, kiedy piszę w sprawie Twojego zamówienia. Zachowam Twój koszyk jeszcze przez 24 godziny — potem zostanie automatycznie zwolniony.
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            lineHeight: '1.7',
            margin: '16px 0 0',
            color: colors.textBody,
          }}>
            Nie chcę Cię naciskać. Ale chcę być z Tobą szczera.
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            lineHeight: '1.7',
            margin: '16px 0 0',
            color: colors.textBody,
          }}>
            Ten ciężar, który teraz w sobie nosisz — pełna szafa, hałas w głowie, „nie" które nie chce wyjść, wieczne zmęczenie — nie zniknie sam z siebie. Nie poprawi się jutro. Wręcz przeciwnie: za rok Twoja szafa będzie pełniejsza, głowa głośniejsza, energia niższa.
          </Text>
        </div>

        {/* ====== FUTURE PACING ====== */}
        <div style={{ padding: `20px ${pad} 0` }}>
          <div style={{
            backgroundColor: '#FFFBEB',
            border: '1px solid #FDE68A',
            borderRadius: '10px',
            padding: '20px 22px',
          }}>
            <Text style={{
              fontFamily: font,
              fontSize: '14px',
              fontWeight: 700,
              color: '#92400E',
              margin: '0 0 8px',
            }}>
              💭 Wyobraź sobie to:
            </Text>
            <Text style={{
              fontFamily: font,
              fontSize: '14px',
              color: '#78350F',
              lineHeight: '1.7',
              margin: '0',
            }}>
              Jest za 30 dni. Otwierasz szafę i od razu wiesz, co założysz. Mama dzwoni z prośbą — mówisz „dzisiaj nie, mamo" — odkładasz słuchawkę, bierzesz oddech, idziesz dalej. Bez wyrzutów sumienia. Wieczorem siedzisz na kanapie i nie robisz nic. I po raz pierwszy od lat jest cicho — w domu i w środku.
            </Text>
          </div>
        </div>

        <div style={{ padding: `16px ${pad} 0` }}>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            lineHeight: '1.7',
            margin: '0',
            color: colors.textBody,
          }}>
            To nie fantazja. To jest to, co <strong style={{ color: colors.textDark }}>setki Polek</strong> już przeżyło z metodą LIFE RESET™. A dla większości z nich zaczęło się od dokładnie takich samych wątpliwości, jakie masz teraz.
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            lineHeight: '1.7',
            margin: '12px 0 0',
            color: colors.textDark,
            fontWeight: 600,
          }}>
            Wiesz, co było różnicą? Wybrały zacząć dzisiaj. Jedna szuflada. Osiem minut.
          </Text>
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
            Tak, zaczynam dzisiaj &#8594;
          </Button>
        </div>

        {/* ====== TRUST BADGES ====== */}
        <div style={{ padding: `18px ${pad} 0`, textAlign: 'center' as const }}>
          <Text style={{
            fontFamily: font,
            fontSize: '13px',
            color: colors.textMuted,
            lineHeight: '1.8',
            margin: '0',
          }}>
            ✓ 30 dni gwarancji zwrotu pieniędzy<br />
            ✓ Darmowa wysyłka w całej Polsce<br />
            ✓ 2 bonusowe e-booki gratis (wartość 238 zł)
          </Text>
        </div>

        <Hr style={{ margin: `24px ${pad}`, borderColor: colors.divider }} />

        {/* ====== CLOSING ====== */}
        <div style={{ padding: `0 ${pad}` }}>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            lineHeight: '1.7',
            margin: '0',
            color: colors.textBody,
          }}>
            Po tej wiadomości nie wyślę Ci już żadnych przypomnień. Wybór należy do Ciebie — i niezależnie od tego, co zdecydujesz, w pełni to szanuję.
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            lineHeight: '1.7',
            margin: '16px 0 0',
            color: colors.textBody,
          }}>
            Ale jeśli kiedykolwiek pomyślałaś <em>„chciałabym wreszcie odpuścić to, co mnie przytłacza"</em> — to jest Twoja szansa.
          </Text>
        </div>

        <Hr style={{ margin: `24px ${pad}`, borderColor: colors.divider }} />

        {/* ====== SIGN-OFF ====== */}
        <div style={{ padding: `0 ${pad}` }}>
          <Text style={{
            fontFamily: font,
            fontSize: '14px',
            fontWeight: 700,
            color: colors.textDark,
            margin: '0',
          }}>
            Anna de Vries
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '13px',
            color: colors.textMuted,
            margin: '2px 0 0',
          }}>
            Życie, jakiego nigdy sobie nie pozwoliłaś
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '13px',
            color: colors.textMuted,
            margin: '14px 0 0',
            fontStyle: 'italic' as const,
          }}>
            P.S. Masz pytania? Napisz do mnie osobiście na{' '}
            <Link href="mailto:anna@najpierw-ja.pl" style={{ color: colors.accent, textDecoration: 'underline', fontWeight: 600, fontStyle: 'normal' as const }}>
              anna@najpierw-ja.pl
            </Link>
            . Czytam i odpowiadam na każdą wiadomość osobiście.
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
            Otrzymujesz tę wiadomość, ponieważ rozpoczęłaś zamówienie na najpierw-ja.pl. To jest ostatnie przypomnienie — nie otrzymasz więcej wiadomości dotyczących tego zamówienia.
          </Text>
        </div>
      </Section>
    </Base>
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
