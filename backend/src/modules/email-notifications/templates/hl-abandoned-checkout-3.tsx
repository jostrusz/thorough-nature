import { Text, Section, Button, Hr, Link } from '@react-email/components'
import * as React from 'react'
import { Base } from './base'

export const HL_ABANDONED_CHECKOUT_3 = 'hl-abandoned-checkout-3'

export interface HlAbandonedCheckout3Props {
  firstName: string
  checkoutUrl: string
  productName: string
  productPrice: string
  productImage?: string
  preview?: string
}

export const isHlAbandonedCheckout3Data = (data: any): data is HlAbandonedCheckout3Props =>
  typeof data.firstName === 'string' && typeof data.checkoutUrl === 'string'

const font = "'Inter', 'Segoe UI', Arial, sans-serif"
const pad = '28px'

const colors = {
  headerBg: '#18181B',
  headerGradient: 'linear-gradient(135deg, #2D1B26 0%, #18181B 50%, #09090B 100%)',
  accent: '#B85C4A',
  accentSoft: '#FFF8F3',
  textDark: '#2D1B26',
  textBody: '#5A3D40',
  textMuted: '#8A7884',
  boxBorder: '#F0DCC4',
  footerBg: '#3D1E2A',
  footerText: '#9B7889',
  footerAccent: '#C9A96E',
  divider: '#F0DCC4',
  urgentBg: '#FEF2F2',
  urgentBorder: '#FECACA',
  urgentText: '#991B1B',
}

export const HlAbandonedCheckout3Template: React.FC<HlAbandonedCheckout3Props> & {
  PreviewProps: HlAbandonedCheckout3Props
} = ({
  firstName,
  checkoutUrl,
  productName,
  productPrice,
  productImage,
  preview = 'Nog 24 uur — daarna moet ik je winkelwagen vrijgeven.',
}) => {
  return (
    <Base preview={preview}>
      <Section>
        {/* HEADER — dark, urgent */}
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
            color: 'rgba(255,255,255,0.55)',
            margin: '0 0 10px 0',
          }}>
            ✦ LIFE RESET™ Methode
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
            Laatste kans, {firstName}
          </Text>
        </div>

        {/* URGENT BOX */}
        <div style={{ padding: `24px ${pad} 0` }}>
          <div style={{
            backgroundColor: colors.urgentBg,
            border: `1px solid ${colors.urgentBorder}`,
            borderRadius: '10px',
            padding: '16px 20px',
            textAlign: 'center' as const,
          }}>
            <Text style={{
              fontFamily: font,
              fontSize: '14px',
              fontWeight: 700,
              color: colors.urgentText,
              margin: '0',
              lineHeight: '1.5',
            }}>
              ⏰ Je winkelwagen wordt over 24 uur vrijgegeven
            </Text>
          </div>
        </div>

        {/* BODY */}
        <div style={{ padding: `20px ${pad} 0` }}>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            color: colors.textBody,
            lineHeight: '1.7',
            margin: '0',
          }}>
            Hoi {firstName},
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            lineHeight: '1.7',
            margin: '12px 0 0',
            color: colors.textBody,
          }}>
            Dit is mijn laatste herinnering. Morgen wordt je winkelwagen automatisch vrijgegeven en kan ik je bestelling niet meer voor je bewaren.
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            lineHeight: '1.7',
            margin: '16px 0 0',
            color: colors.textBody,
          }}>
            Ik begrijp dat het spannend kan zijn om voor jezelf te kiezen. Vooral als je gewend bent altijd voor anderen te zorgen. Maar vraag jezelf eens af: <strong style={{ color: colors.textDark }}>als niet nu — wanneer dan wel?</strong>
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            lineHeight: '1.7',
            margin: '16px 0 0',
            color: colors.textBody,
          }}>
            Hoeveel ochtenden sta je nog op met datzelfde lijstje in je hoofd? Hoe vaak nog die knoop in je maag, dat schuldgevoel als je iets voor jezelf doet, die kast die uitpuilt en toch niets om aan te trekken?
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            lineHeight: '1.7',
            margin: '16px 0 0',
            color: colors.textBody,
            fontWeight: 600,
          }}>
            Het kan ook anders. 30 dagen, 8 minuten per dag. Eén la, één nee, één ademhaling tegelijk.
          </Text>
        </div>

        {/* PRODUCT CARD */}
        <div style={{ padding: `24px ${pad} 0` }}>
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
              €{productPrice}
            </Text>
          </div>
        </div>

        {/* CTA BUTTON */}
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
            Nu mijn bestelling afronden →
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
            30 dagen niet-goed-geld-terug garantie. Geen vragen. Geen risico.
          </Text>
        </div>

        <Hr style={{ margin: `24px ${pad}`, borderColor: colors.divider }} />

        {/* SIGN-OFF */}
        <div style={{ padding: `0 ${pad}` }}>
          <Text style={{
            fontFamily: font,
            fontSize: '14px',
            color: colors.textBody,
            lineHeight: '1.6',
            margin: '0',
          }}>
            Warme groet,
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
            Het Leven Dat Je Verdient &bull;{' '}
            <Link href="mailto:annadevries@pakjeleventerug.nl" style={{ color: colors.accent, textDecoration: 'underline' }}>
              annadevries@pakjeleventerug.nl
            </Link>
          </Text>
        </div>

        <div style={{ height: '28px' }}></div>

        {/* FOOTER */}
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
            Het Leven Dat Je Verdient &bull; LIFE RESET™ Methode
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '11px',
            color: colors.footerText,
            lineHeight: '1.7',
            margin: '0 0 8px',
          }}>
            Performance Marketing Solution s.r.o. &bull; Rybná 716/24, 110 00 Staré Město, Praha, CZ
            <br />
            IČ: 06259928 &bull; DIČ: CZ06259928
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '11px',
            color: '#71717A',
            lineHeight: '1.5',
            margin: '0',
          }}>
            Dit is de laatste herinnering over je bestelling. Je ontvangt hierna geen verdere herinneringen.
          </Text>
        </div>
      </Section>
    </Base>
  )
}

HlAbandonedCheckout3Template.PreviewProps = {
  firstName: 'Sophie',
  checkoutUrl: 'https://www.pakjeleventerug.nl/checkout',
  productName: 'Het Leven Dat Je Verdient',
  productPrice: '36,00',
  productImage: '',
  preview: 'Nog 24 uur — daarna moet ik je winkelwagen vrijgeven.',
} as HlAbandonedCheckout3Props

export default HlAbandonedCheckout3Template
