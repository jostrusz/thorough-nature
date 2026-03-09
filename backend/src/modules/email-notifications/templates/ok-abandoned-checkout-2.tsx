import { Text, Section, Button, Hr, Link } from '@react-email/components'
import * as React from 'react'
import { Base } from './base'

export const OK_ABANDONED_CHECKOUT_2 = 'ok-abandoned-checkout-2'

export interface OkAbandonedCheckout2Props {
  firstName: string
  checkoutUrl: string
  productName: string
  productPrice: string
  productImage?: string
  preview?: string
}

export const isOkAbandonedCheckout2Data = (data: any): data is OkAbandonedCheckout2Props =>
  typeof data.firstName === 'string' && typeof data.checkoutUrl === 'string'

const font = "'Inter', 'Segoe UI', Arial, sans-serif"
const pad = '28px'

const colors = {
  headerBg: '#2D1B3D',
  headerGradient: 'linear-gradient(135deg, #5A3D6B 0%, #2D1B3D 50%, #1A1028 100%)',
  accent: '#C27BA0',
  accentSoft: '#FAF5F8',
  textDark: '#1A1028',
  textBody: '#3F3F46',
  textMuted: '#71717A',
  boxBorder: '#EDD9E5',
  starColor: '#F59E0B',
  footerBg: '#1A1028',
  footerText: '#A1A1AA',
  footerAccent: '#C27BA0',
  divider: '#EDD9E5',
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

export const OkAbandonedCheckout2Template: React.FC<OkAbandonedCheckout2Props> & {
  PreviewProps: OkAbandonedCheckout2Props
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
            Odpuść to, co cię niszczy
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
            Chciałem napisać do Ciebie osobiście. Nie po to, żeby Cię naciskać — ale dlatego, że wierzę, że musisz to usłyszeć.
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            lineHeight: '1.7',
            margin: '16px 0 0',
            color: colors.textBody,
          }}>
            Nie napisałem tej książki dlatego, że pisanie książek jest &ldquo;fajne&rdquo;. Napisałem ją, bo przez lata widziałem, jak ludzie noszą w sobie rzeczy, które niszczą ich od środka — poczucie winy, gorycz, toksyczne relacje, myśli, które nigdy się nie kończą — i nigdy nie znajdowali wyjścia.
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            lineHeight: '1.7',
            margin: '16px 0 0',
            color: colors.textBody,
          }}>
            Ta książka to efekt wszystkiego, czego się nauczyłem. Każda technika jest przetestowana. Każda metoda jest sprawdzona. A co najlepsze? Nie musisz być psychologiem ani terapeutą, żeby zobaczyć rezultaty.
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
            Co mówią inni czytelnicy
          </Text>

          <ReviewCard
            text="Nosiłam w sobie poczucie winy przez ponad dziesięć lat. Po przeczytaniu tej książki w końcu zrozumiałam, że mogę je puścić. To było jak pierwszy głęboki oddech od dawna."
            author="Zofia K., Warszawa"
          />
          <ReviewCard
            text="Próbowałem terapii i książek samopomocy, ale nic nie pomagało. Ta książka tłumaczy wszystko tak jasno, że po prostu zadziałało. Wreszcie."
            author="Marek J., Kraków"
          />
          <ReviewCard
            text="Już po tygodniu poczułam się lżejsza. Żałuję, że nie znalazłam tej książki wcześniej."
            author="Agnieszka W., Wrocław"
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
            Chcę zmienić swoje życie &#8594;
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
            Joris De Vries
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '13px',
            color: colors.textMuted,
            margin: '2px 0 0',
          }}>
            Odpuść to, co cię niszczy &bull;{' '}
            <Link href="mailto:biuro@odpusc-ksiazka.pl" style={{ color: colors.accent, textDecoration: 'underline' }}>
              biuro@odpusc-ksiazka.pl
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
            Otrzymujesz tę wiadomość, ponieważ rozpocząłeś(aś) zamówienie na odpusc-ksiazka.pl.
          </Text>
        </div>
      </Section>
    </Base>
  )
}

OkAbandonedCheckout2Template.PreviewProps = {
  firstName: 'Anna',
  checkoutUrl: 'https://odpusc-ksiazka.pl/checkout',
  productName: 'Odpuść to, co cię niszczy',
  productPrice: '129',
  productImage: '',
  preview: 'Już po tygodniu poczułam się lżejsza niż od dawna...',
} as OkAbandonedCheckout2Props

export default OkAbandonedCheckout2Template
