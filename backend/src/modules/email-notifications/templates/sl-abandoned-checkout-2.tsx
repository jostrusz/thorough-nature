import { Text, Section, Button, Hr, Link } from '@react-email/components'
import * as React from 'react'
import { Base } from './base'

export const SL_ABANDONED_CHECKOUT_2 = 'sl-abandoned-checkout-2'

export interface SlAbandonedCheckout2Props {
  firstName: string
  checkoutUrl: string
  productName: string
  productPrice: string
  productImage?: string
  preview?: string
}

export const isSlAbandonedCheckout2Data = (data: any): data is SlAbandonedCheckout2Props =>
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
  footerBg: '#1A1028',
  footerText: '#A1A1AA',
  footerAccent: '#C27BA0',
  divider: '#EDD9E5',
  quoteBg: '#FBF8FA',
}

const reviews = [
  {
    text: 'Etter en uke kjente jeg meg lettere enn jeg hadde gjort på veldig lenge.',
    author: 'Marte, Bergen',
  },
  {
    text: 'Jeg leste den på tre kvelder. Kapittel 7 traff noe jeg har gått rundt med i årevis.',
    author: 'Anders, Trondheim',
  },
  {
    text: 'Endelig en bok som ikke ber meg om å tenke positivt.',
    author: 'Kristin, Oslo',
  },
]

export const SlAbandonedCheckout2Template: React.FC<SlAbandonedCheckout2Props> & {
  PreviewProps: SlAbandonedCheckout2Props
} = ({
  firstName,
  checkoutUrl,
  productName,
  productPrice,
  preview = 'Etter en uke kjente jeg meg lettere enn på lenge...',
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
            Slipp taket
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
            Historien bak boken
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
            Hei {firstName},
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            lineHeight: '1.7',
            margin: '12px 0 0',
            color: colors.textBody,
          }}>
            Jeg vil gjerne fortelle deg hvorfor denne boken i det hele tatt ble skrevet.
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            lineHeight: '1.7',
            margin: '16px 0 0',
            color: colors.textBody,
          }}>
            Jeg var 34 da det gikk opp for meg at jeg hadde brukt ti år på å holde fast ved ting som for lengst var over. Et forhold jeg visste hadde tatt slutt. En jobb som tappet meg. Og en stemme i hodet som stadig minnet meg på at jeg burde klare mer.
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            lineHeight: '1.7',
            margin: '16px 0 0',
            color: colors.textBody,
          }}>
            Alle rundt meg sa at jeg måtte slippe taket. Ingen kunne fortelle meg hvordan.
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            lineHeight: '1.7',
            margin: '16px 0 0',
            color: colors.textBody,
          }}>
            Så jeg brukte fire år på å finne ut av det selv. Nevrovitenskap, filosofi, atferdsforskning og en god del prøving og feiling på egen hånd. Det ble til <strong style={{ color: colors.textDark }}>{productName}</strong>.
          </Text>
        </div>

        {/* ====== REVIEWS ====== */}
        <div style={{ padding: `24px ${pad} 0` }}>
          <Text style={{
            fontFamily: font,
            fontSize: '12px',
            fontWeight: 700,
            letterSpacing: '1.5px',
            textTransform: 'uppercase' as const,
            color: colors.textMuted,
            margin: '0 0 14px',
          }}>
            Fra lesere
          </Text>
          {reviews.map((review, i) => (
            <div
              key={i}
              style={{
                backgroundColor: colors.quoteBg,
                borderLeft: `3px solid ${colors.accent}`,
                borderRadius: '8px',
                padding: '14px 18px',
                margin: i === 0 ? '0' : '10px 0 0',
              }}
            >
              <Text style={{
                fontFamily: font,
                fontSize: '14px',
                lineHeight: '1.6',
                color: colors.textBody,
                fontStyle: 'italic' as const,
                margin: '0',
              }}>
                &ldquo;{review.text}&rdquo;
              </Text>
              <Text style={{
                fontFamily: font,
                fontSize: '12px',
                color: colors.textMuted,
                margin: '6px 0 0',
              }}>
                {review.author}
              </Text>
            </div>
          ))}
        </div>

        {/* ====== GUARANTEE ====== */}
        <div style={{ padding: `20px ${pad} 0` }}>
          <div style={{
            backgroundColor: colors.accentSoft,
            border: `1px solid ${colors.boxBorder}`,
            borderRadius: '10px',
            padding: '16px 20px',
          }}>
            <Text style={{
              fontFamily: font,
              fontSize: '14px',
              lineHeight: '1.6',
              color: colors.textBody,
              margin: '0',
            }}>
              <strong style={{ color: colors.textDark }}>30 dagers åpent kjøp.</strong> Passer ikke boken for deg, sender du oss en e-post og får pengene tilbake. Du trenger ikke begrunne noe.
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
              {productPrice} kr
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
            Fullfør bestillingen &#8594;
          </Button>
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
            Vi snakkes,
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
            Slipp taket &bull;{' '}
            <Link href="mailto:bok@slipptaketboken.no" style={{ color: colors.accent, textDecoration: 'underline' }}>
              bok@slipptaketboken.no
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
            Slipp taket på det som ødelegger deg
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '11px',
            color: colors.footerText,
            lineHeight: '1.7',
            margin: '0 0 8px',
          }}>
            Performance Marketing Solution s.r.o.
            <br />
            Rybná 716/24, Praha, 110 00, Tsjekkia
            <br />
            Org.nr: 06259928 &bull; MVA-nr: CZ06259928
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '11px',
            color: '#71717A',
            lineHeight: '1.5',
            margin: '0',
          }}>
            Du får denne e-posten fordi du startet en bestilling på slipptaketboken.no.
          </Text>
        </div>
      </Section>
    </Base>
  )
}

SlAbandonedCheckout2Template.PreviewProps = {
  firstName: 'Liv',
  checkoutUrl: 'https://www.slipptaketboken.no/checkout',
  productName: 'Slipp taket på det som ødelegger deg',
  productPrice: '499',
  productImage: '',
  preview: 'Etter en uke kjente jeg meg lettere enn på lenge...',
} as SlAbandonedCheckout2Props

export default SlAbandonedCheckout2Template
