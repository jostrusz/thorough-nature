import { Text, Section, Button, Hr, Link } from '@react-email/components'
import * as React from 'react'
import { Base } from './base'

export const LL_ABANDONED_CHECKOUT_2 = 'll-abandoned-checkout-2'

export interface LlAbandonedCheckout2Props {
  firstName: string
  checkoutUrl: string
  productName: string
  productPrice: string
  productImage?: string
  preview?: string
}

export const isLlAbandonedCheckout2Data = (data: any): data is LlAbandonedCheckout2Props =>
  typeof data.firstName === 'string' && typeof data.checkoutUrl === 'string'

const font = "'Inter', 'Segoe UI', Arial, sans-serif"
const pad = '28px'

const colors = {
  headerBg: '#7C3AED',
  headerGradient: 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 50%, #6D28D9 100%)',
  accent: '#7C3AED',
  accentSoft: '#F5F3FF',
  textDark: '#18181B',
  textBody: '#3F3F46',
  textMuted: '#71717A',
  boxBorder: '#E4E4E7',
  starColor: '#F59E0B',
  footerBg: '#18181B',
  footerText: '#A1A1AA',
  footerAccent: '#A78BFA',
  divider: '#E4E4E7',
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
      &#9733;&#9733;&#9733;&#9733;&#9733;
    </Text>
    <Text style={{
      fontFamily: font,
      fontSize: '14px',
      fontStyle: 'italic' as const,
      color: colors.textBody,
      lineHeight: '1.6',
      margin: '0 0 8px',
    }}>
      &bdquo;{text}&ldquo;
    </Text>
    <Text style={{
      fontFamily: font,
      fontSize: '12px',
      fontWeight: 600,
      color: colors.textMuted,
      margin: '0',
    }}>
      &mdash; {author}
    </Text>
  </div>
)

export const LlAbandonedCheckout2Template: React.FC<LlAbandonedCheckout2Props> & {
  PreviewProps: LlAbandonedCheckout2Props
} = ({
  firstName,
  checkoutUrl,
  productName,
  productPrice,
  productImage,
  preview = 'Schon nach einer Woche f\u00fchlte ich mich leichter...',
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
            fontSize: '24px',
            fontWeight: 800,
            color: '#ffffff',
            margin: '0',
            lineHeight: '1.2',
            letterSpacing: '-0.02em',
          }}>
            Die Geschichte hinter diesem Buch
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
            Hallo {firstName},
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            lineHeight: '1.7',
            margin: '12px 0 0',
            color: colors.textBody,
          }}>
            ich wollte dir pers&ouml;nlich schreiben. Nicht um dich zu dr&auml;ngen &mdash; sondern weil ich glaube, dass du das wissen solltest.
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            lineHeight: '1.7',
            margin: '16px 0 0',
            color: colors.textBody,
          }}>
            Ich habe dieses Buch nicht geschrieben, weil es &bdquo;nett&ldquo; klang, ein Buch zu ver&ouml;ffentlichen. Ich habe es geschrieben, weil ich jahrelang gesehen habe, wie Menschen an den gleichen Mustern leiden &mdash; Gr&uuml;beln, Selbstzweifel, die Unfähigkeit loszulassen &mdash; und immer wieder dieselben Ratschl&auml;ge bekommen, die einfach nicht funktionieren.
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            lineHeight: '1.7',
            margin: '16px 0 0',
            color: colors.textBody,
          }}>
            Dieses Buch ist das Ergebnis von allem, was ich gelernt habe. Jede Technik ist erprobt. Jede Methode ist bew&auml;hrt. Und das Beste? Du musst kein Psychologe sein, um Ergebnisse zu sehen.
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
            Was andere Leser sagen
          </Text>

          <ReviewCard
            text="Innerhalb einer Woche f\u00fchlte ich mich bereits leichter. Dieses Buch ist ein Muss."
            author="Sabine L., M\u00fcnchen"
          />
          <ReviewCard
            text="Ich habe jahrelang gegr\u00fcbelt und mich selbst fertig gemacht. Dieses Buch hat mir endlich die Werkzeuge gegeben, um damit aufzuh\u00f6ren."
            author="Thomas S., Hamburg"
          />
          <ReviewCard
            text="Klar, direkt und ohne Bl\u00f6dsinn. Genau das, was ich gebraucht habe. Schon nach 3 Tagen sp\u00fcrbarer Unterschied."
            author="Anna K., Wien"
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
              &#10003; 100% Geld-zur&uuml;ck-Garantie innerhalb von 30 Tagen.
              <br />
              Keine Fragen, kein Aufwand. Das Risiko trage ich, nicht du.
            </Text>
          </div>
        </div>

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
            Ja, ich will endlich loslassen &#8594;
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
            Dein Paket kann morgen schon unterwegs sein.
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
            Herzliche Gr&uuml;&szlig;e,
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

LlAbandonedCheckout2Template.PreviewProps = {
  firstName: 'Maria',
  checkoutUrl: 'https://www.lasslosbuch.de/checkout',
  productName: 'Lass los, was dich kaputt macht',
  productPrice: '35,00',
  productImage: '',
  preview: 'Schon nach einer Woche f\u00fchlte ich mich leichter...',
} as LlAbandonedCheckout2Props

export default LlAbandonedCheckout2Template
