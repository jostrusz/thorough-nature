import { Text, Section, Button, Hr, Link } from '@react-email/components'
import * as React from 'react'
import { Base } from './base'

export const SL_ABANDONED_CHECKOUT_3 = 'sl-abandoned-checkout-3'

export interface SlAbandonedCheckout3Props {
  firstName: string
  checkoutUrl: string
  productName: string
  productPrice: string
  productImage?: string
  preview?: string
}

export const isSlAbandonedCheckout3Data = (data: any): data is SlAbandonedCheckout3Props =>
  typeof data.firstName === 'string' && typeof data.checkoutUrl === 'string'

const font = "'Inter', 'Segoe UI', Arial, sans-serif"
const pad = '28px'

const colors = {
  headerBg: '#1A1028',
  headerGradient: 'linear-gradient(135deg, #2D1B3D 0%, #1A1028 60%, #120A1C 100%)',
  accent: '#C27BA0',
  accentSoft: '#FAF5F8',
  urgentBg: '#FDF3F7',
  urgentBorder: '#E8BFD3',
  textDark: '#1A1028',
  textBody: '#3F3F46',
  textMuted: '#71717A',
  boxBorder: '#EDD9E5',
  footerBg: '#1A1028',
  footerText: '#A1A1AA',
  footerAccent: '#C27BA0',
  divider: '#EDD9E5',
}

const badges = ['30 dagers åpent kjøp', 'Trygg betaling', 'Rask levering']

export const SlAbandonedCheckout3Template: React.FC<SlAbandonedCheckout3Props> & {
  PreviewProps: SlAbandonedCheckout3Props
} = ({
  firstName,
  checkoutUrl,
  productName,
  productPrice,
  preview = 'Ett døgn til, så frigjør jeg handlekurven din.',
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
            Siste påminnelse
          </Text>
        </div>

        {/* ====== URGENT BANNER ====== */}
        <div style={{ padding: `24px ${pad} 0` }}>
          <div style={{
            backgroundColor: colors.urgentBg,
            border: `1px solid ${colors.urgentBorder}`,
            borderRadius: '10px',
            padding: '14px 20px',
            textAlign: 'center' as const,
          }}>
            <Text style={{
              fontFamily: font,
              fontSize: '14px',
              fontWeight: 700,
              color: colors.textDark,
              margin: '0',
              lineHeight: '1.5',
            }}>
              Handlekurven din frigjøres om 24 timer
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
            Hei {firstName},
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            lineHeight: '1.7',
            margin: '12px 0 0',
            color: colors.textBody,
          }}>
            Dette er den siste e-posten jeg sender deg om denne bestillingen. Det lover jeg.
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            lineHeight: '1.7',
            margin: '16px 0 0',
            color: colors.textBody,
          }}>
            Eksemplaret ditt av <strong style={{ color: colors.textDark }}>{productName}</strong> har ligget reservert i et par dager. I morgen frigjør systemet det automatisk, og da må du eventuelt starte bestillingen på nytt.
          </Text>
        </div>

        {/* ====== FUTURE PACING ====== */}
        <div style={{ padding: `20px ${pad} 0` }}>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            lineHeight: '1.7',
            margin: '0',
            color: colors.textBody,
          }}>
            Tenk på hvor du står om tre måneder. Enten har du lest boken og begynt på noe. Eller så er alt akkurat som nå, bortsett fra at det har gått tre måneder til.
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            lineHeight: '1.7',
            margin: '14px 0 0',
            color: colors.textBody,
          }}>
            Det er hele forskjellen. Og den koster {productPrice} kr.
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
            Behold bestillingen min &#8594;
          </Button>
        </div>

        {/* ====== TRUST BADGES ====== */}
        <div style={{ padding: `18px ${pad} 0`, textAlign: 'center' as const }}>
          <Text style={{
            fontFamily: font,
            fontSize: '12px',
            color: colors.textMuted,
            lineHeight: '1.6',
            margin: '0',
          }}>
            {badges.join('  •  ')}
          </Text>
        </div>

        {/* ====== CLOSING ====== */}
        <div style={{ padding: `20px ${pad} 0` }}>
          <Text style={{
            fontFamily: font,
            fontSize: '14px',
            lineHeight: '1.7',
            color: colors.textBody,
            margin: '0',
          }}>
            Og velger du å la den gå, er det helt greit. Da håper jeg bare du finner det du leter etter et annet sted.
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

SlAbandonedCheckout3Template.PreviewProps = {
  firstName: 'Liv',
  checkoutUrl: 'https://www.slipptaketboken.no/checkout',
  productName: 'Slipp taket på det som ødelegger deg',
  productPrice: '499',
  productImage: '',
  preview: 'Ett døgn til, så frigjør jeg handlekurven din.',
} as SlAbandonedCheckout3Props

export default SlAbandonedCheckout3Template
