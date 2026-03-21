import { Text, Section, Button, Hr, Link } from '@react-email/components'
import * as React from 'react'
import { Base } from './base'

export const LL_ABANDONED_CHECKOUT_3 = 'll-abandoned-checkout-3'

export interface LlAbandonedCheckout3Props {
  firstName: string
  checkoutUrl: string
  productName: string
  productPrice: string
  productImage?: string
  preview?: string
}

export const isLlAbandonedCheckout3Data = (data: any): data is LlAbandonedCheckout3Props =>
  typeof data.firstName === 'string' && typeof data.checkoutUrl === 'string'

const font = "'Inter', 'Segoe UI', Arial, sans-serif"
const pad = '28px'

const colors = {
  headerBg: '#18181B',
  headerGradient: 'linear-gradient(135deg, #27272A 0%, #18181B 50%, #09090B 100%)',
  accent: '#7C3AED',
  accentSoft: '#F5F3FF',
  textDark: '#18181B',
  textBody: '#3F3F46',
  textMuted: '#71717A',
  boxBorder: '#E4E4E7',
  footerBg: '#18181B',
  footerText: '#A1A1AA',
  footerAccent: '#A78BFA',
  divider: '#E4E4E7',
  urgentBg: '#FEF2F2',
  urgentBorder: '#FECACA',
  urgentText: '#991B1B',
}

export const LlAbandonedCheckout3Template: React.FC<LlAbandonedCheckout3Props> & {
  PreviewProps: LlAbandonedCheckout3Props
} = ({
  firstName,
  checkoutUrl,
  productName,
  productPrice,
  productImage,
  preview = 'Noch 24 Stunden \u2014 danach wird dein Warenkorb freigegeben.',
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
            Letzte Chance, {firstName}
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
              &#9200; Dein Warenkorb wird in 24 Stunden automatisch freigegeben
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
            Hallo {firstName},
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            lineHeight: '1.7',
            margin: '12px 0 0',
            color: colors.textBody,
          }}>
            das ist die letzte E-Mail, die ich dir &uuml;ber deine Bestellung schicke. Ich bewahre deinen Warenkorb noch 24 Stunden auf &mdash; danach wird er automatisch freigegeben.
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            lineHeight: '1.7',
            margin: '16px 0 0',
            color: colors.textBody,
          }}>
            Ich m&ouml;chte dich nicht unter Druck setzen. Aber ich m&ouml;chte ehrlich zu dir sein.
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            lineHeight: '1.7',
            margin: '16px 0 0',
            color: colors.textBody,
          }}>
            Jedes Muster, das dich heute belastet &mdash; das Gr&uuml;beln, die Selbstzweifel, das Festhalten an Dingen, die dir nicht guttun &mdash; wird nicht von alleine besser. Es wird schlimmer. Nicht weil du schwach bist, sondern weil sich diese Muster jeden Tag tiefer eingraben. Je l&auml;nger du wartest, desto schwerer wird es.
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
              &#128173; Stell dir das einmal vor:
            </Text>
            <Text style={{
              fontFamily: font,
              fontSize: '14px',
              color: '#78350F',
              lineHeight: '1.7',
              margin: '0',
            }}>
              Es ist n&auml;chste Woche. Du wachst auf &mdash; und zum ersten Mal seit Langem f&uuml;hlst du dich nicht sofort erdr&uuml;ckt von Gedanken. Du sp&uuml;rst eine Leichtigkeit, die du fast vergessen hattest. Du reagierst ruhiger. Du setzt Grenzen. Du lebst endlich f&uuml;r dich &mdash; nicht f&uuml;r die Erwartungen anderer.
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
            Das ist keine Fantasie. Das ist, was <strong style={{ color: colors.textDark }}>Tausende Leser</strong> bereits erreicht haben. Und f&uuml;r die meisten begann es mit genau dem gleichen Zweifel, den du jetzt sp&uuml;rst.
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            lineHeight: '1.7',
            margin: '12px 0 0',
            color: colors.textDark,
            fontWeight: 600,
          }}>
            Wei&szlig;t du, was den Unterschied gemacht hat? Sie haben sich entschieden, heute anzufangen.
          </Text>
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
            Ja, ich fange heute an &#8594;
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
            &#10003; 100% Geld-zur&uuml;ck-Garantie<br />
            &#10003; Kostenloser Versand (DE, AT &amp; LU)<br />
            &#10003; Tausende zufriedene Leser
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
            Nach dieser Nachricht schicke ich dir keine Erinnerungen mehr. Die Entscheidung liegt bei dir &mdash; und welche Entscheidung du auch triffst, ich respektiere sie vollkommen.
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            lineHeight: '1.7',
            margin: '16px 0 0',
            color: colors.textBody,
          }}>
            Aber wenn du jemals gedacht hast <em>&bdquo;Ich w&uuml;nschte, ich k&ouml;nnte endlich loslassen&ldquo;</em> &mdash; dann ist jetzt dein Moment.
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
            Joris de Vries
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '13px',
            color: colors.textMuted,
            margin: '2px 0 0',
          }}>
            Lass los, was dich kaputt macht
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '13px',
            color: colors.textMuted,
            margin: '14px 0 0',
            fontStyle: 'italic' as const,
          }}>
            P.S. Noch Zweifel? Schreib mir pers&ouml;nlich an{' '}
            <Link href="mailto:buch@lasslosbuch.de" style={{ color: colors.accent, textDecoration: 'underline', fontWeight: 600, fontStyle: 'normal' as const }}>
              buch@lasslosbuch.de
            </Link>
            . Ich lese und beantworte jede Nachricht selbst.
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
            Du erh&auml;ltst diese E-Mail, weil du einen Checkout auf lasslosbuch.de gestartet hast. Dies ist die letzte Erinnerung &mdash; du erh&auml;ltst keine weiteren E-Mails zu dieser Bestellung.
          </Text>
        </div>
      </Section>
    </Base>
  )
}

LlAbandonedCheckout3Template.PreviewProps = {
  firstName: 'Maria',
  checkoutUrl: 'https://www.lasslosbuch.de/checkout',
  productName: 'Lass los, was dich kaputt macht',
  productPrice: '35,00',
  productImage: '',
  preview: 'Noch 24 Stunden \u2014 danach wird dein Warenkorb freigegeben.',
} as LlAbandonedCheckout3Props

export default LlAbandonedCheckout3Template
