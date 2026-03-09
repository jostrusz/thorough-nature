import { Text, Section, Button, Hr, Link } from '@react-email/components'
import * as React from 'react'
import { Base } from './base'

export const OK_ABANDONED_CHECKOUT_3 = 'ok-abandoned-checkout-3'

export interface OkAbandonedCheckout3Props {
  firstName: string
  checkoutUrl: string
  productName: string
  productPrice: string
  productImage?: string
  preview?: string
}

export const isOkAbandonedCheckout3Data = (data: any): data is OkAbandonedCheckout3Props =>
  typeof data.firstName === 'string' && typeof data.checkoutUrl === 'string'

const font = "'Inter', 'Segoe UI', Arial, sans-serif"
const pad = '28px'

const colors = {
  headerBg: '#18181B',
  headerGradient: 'linear-gradient(135deg, #27272A 0%, #18181B 50%, #09090B 100%)',
  accent: '#C27BA0',
  accentSoft: '#FAF5F8',
  textDark: '#1A1028',
  textBody: '#3F3F46',
  textMuted: '#71717A',
  boxBorder: '#EDD9E5',
  footerBg: '#1A1028',
  footerText: '#A1A1AA',
  footerAccent: '#C27BA0',
  divider: '#EDD9E5',
  urgentBg: '#FEF2F2',
  urgentBorder: '#FECACA',
  urgentText: '#991B1B',
}

export const OkAbandonedCheckout3Template: React.FC<OkAbandonedCheckout3Props> & {
  PreviewProps: OkAbandonedCheckout3Props
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
            Odpuść to, co cię niszczy
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
            Nie chcę Cię naciskać. Ale chcę być z Tobą szczery(a).
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            lineHeight: '1.7',
            margin: '16px 0 0',
            color: colors.textBody,
          }}>
            Każdy destrukcyjny wzorzec, który teraz w sobie nosisz — poczucie winy, gorycz, relacje, które Cię wyczerpują — nie zniknie sam z siebie. Nie poprawi się z czasem. Wręcz przeciwnie. Im dłużej czekasz, tym głębiej się zakorzenia.
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
              Jest przyszły tydzień. Budzisz się rano bez tego ciężaru na piersi. Myśli, które kiedyś nie dawały Ci spokoju, ucichły. Czujesz się lżej, swobodniej, bardziej obecny(a). Twoi bliscy zauważają różnicę. &ldquo;Co się z Tobą stało?&rdquo; pytają.
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
            To nie fantazja. To jest to, co <strong style={{ color: colors.textDark }}>tysiące czytelników</strong> już przeżyło. A dla większości z nich zaczęło się od dokładnie takich samych wątpliwości, jakie masz teraz.
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            lineHeight: '1.7',
            margin: '12px 0 0',
            color: colors.textDark,
            fontWeight: 600,
          }}>
            Wiesz, co było różnicą? Oni wybrali, żeby zacząć dzisiaj.
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
            ✓ 100% gwarancja zwrotu pieniędzy<br />
            ✓ Darmowa wysyłka w Polsce<br />
            ✓ Tysiące zadowolonych czytelników
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
            Ale jeśli kiedykolwiek pomyślałeś(aś) <em>&ldquo;Chciałbym/Chciałabym odpuścić to, co mnie przytłacza&rdquo;</em> — to jest Twoja szansa.
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
            Joris De Vries
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '13px',
            color: colors.textMuted,
            margin: '2px 0 0',
          }}>
            Odpuść to, co cię niszczy
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '13px',
            color: colors.textMuted,
            margin: '14px 0 0',
            fontStyle: 'italic' as const,
          }}>
            P.S. Masz pytania? Napisz do mnie osobiście na{' '}
            <Link href="mailto:biuro@odpusc-ksiazka.pl" style={{ color: colors.accent, textDecoration: 'underline', fontWeight: 600, fontStyle: 'normal' as const }}>
              biuro@odpusc-ksiazka.pl
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
            Odpuść to, co cię niszczy
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '11px',
            color: colors.footerText,
            lineHeight: '1.7',
            margin: '0 0 8px',
          }}>
            EverChapter OÜ &bull; Tallinn, Estonia
            <br />
            Reg. nr: 16938029
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '11px',
            color: '#71717A',
            lineHeight: '1.5',
            margin: '0',
          }}>
            Otrzymujesz tę wiadomość, ponieważ rozpocząłeś(aś) zamówienie na odpusc-ksiazka.pl. To jest ostatnie przypomnienie — nie otrzymasz więcej wiadomości dotyczących tego zamówienia.
          </Text>
        </div>
      </Section>
    </Base>
  )
}

OkAbandonedCheckout3Template.PreviewProps = {
  firstName: 'Anna',
  checkoutUrl: 'https://odpusc-ksiazka.pl/checkout',
  productName: 'Odpuść to, co cię niszczy',
  productPrice: '129',
  productImage: '',
  preview: 'Jeszcze 24 godziny — potem muszę zwolnić Twój koszyk.',
} as OkAbandonedCheckout3Props

export default OkAbandonedCheckout3Template
