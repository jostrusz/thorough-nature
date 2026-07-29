import { Text, Section, Button } from '@react-email/components'
import * as React from 'react'
import { Base } from './base'

export const HL_PAYMENT_RECOVERY = 'hl-payment-recovery'

export interface HlPaymentRecoveryProps {
  firstName: string
  checkoutUrl: string
  preview?: string
}

export const isHlPaymentRecoveryData = (data: any): data is HlPaymentRecoveryProps =>
  typeof data.firstName === 'string' && typeof data.checkoutUrl === 'string'

const font = "'Inter', Arial, sans-serif"

// Het Leven Dat Je Verdient brand palette — matches hl-order-placed.tsx
const colors = {
  headerGradient: 'linear-gradient(135deg, #5A2D3E 0%, #4A1A2E 50%, #3D1E2A 100%)',
  accent: '#B85C4A',
  accentSoft: '#FFF8F3',
  textDark: '#2D1B26',
  textBody: '#5A3D40',
  boxBorder: '#F0DCC4',
  footerBg: '#3D1E2A',
  footerAccent: '#C9A96E',
  footerText: '#9B7889',
}

/**
 * Het Leven — "Dat ging even mis" (payment recovery, Anna's voice).
 * Sent ONLY for Brite open-banking sessions that aborted AND were verified NOT paid
 * (transaction not in 4/5/6), 45+ min after the abort so a late settlement has had
 * time to land first (never tell a paying customer to "finish" — the Vincent case).
 * Copy design (2026-07): blame the tech, kill the double-charge fear first, author
 * self-implication for humanity, alt-payment-method as the real friction solver,
 * reply trigger, 30-day guarantee as risk reversal. NO discount.
 */
export const HlPaymentRecoveryTemplate: React.FC<HlPaymentRecoveryProps> & {
  PreviewProps: HlPaymentRecoveryProps
} = ({ firstName, checkoutUrl, preview = 'Er is niets afgeschreven. Afronden kost je één minuut.' }) => {
  return (
    <Base preview={preview}>
      <Section>
        {/* Header */}
        <div style={{ background: colors.headerGradient, padding: '32px 24px', textAlign: 'center' as const }}>
          <Text style={{ fontFamily: font, fontSize: '11px', fontWeight: 600, letterSpacing: '3px', textTransform: 'uppercase' as const, color: colors.footerAccent, margin: '0 0 8px' }}>
            Het Leven Dat Je Verdient
          </Text>
          <Text style={{ fontSize: '32px', margin: '0 0 6px' }}>🔔</Text>
          <Text style={{ fontFamily: font, fontSize: '22px', fontWeight: 700, color: '#ffffff', margin: 0 }}>
            Dat ging even mis
          </Text>
        </div>

        {/* Body */}
        <div style={{ padding: '28px 24px' }}>
          <Text style={{ fontFamily: font, fontSize: '15px', lineHeight: 1.6, color: colors.textBody, margin: '0 0 14px' }}>
            Hoi {firstName},
          </Text>
          <Text style={{ fontFamily: font, fontSize: '15px', lineHeight: 1.6, color: colors.textBody, margin: '0 0 16px' }}>
            Je klikte op betalen — en ergens tussen jouw scherm en je bank ging het mis.
          </Text>
          <Text style={{ fontFamily: font, fontSize: '15px', lineHeight: 1.6, color: colors.textBody, margin: '0 0 16px' }}>
            Eerst het belangrijkste: <strong>er is geen cent afgeschreven.</strong> Echt niet.
          </Text>
          <Text style={{ fontFamily: font, fontSize: '15px', lineHeight: 1.6, color: colors.textBody, margin: '0 0 16px' }}>
            Dit gebeurt vaker dan je denkt. Banken hebben zo hun momenten. Ik heb zelf ooit drie keer
            opnieuw moeten beginnen voor een boek dat ik écht wilde — bij de derde poging typte ik
            mijn eigen naam verkeerd.
          </Text>
          <Text style={{ fontFamily: font, fontSize: '15px', lineHeight: 1.6, color: colors.textBody, margin: '0 0 20px' }}>
            Je boek ligt nog voor je klaar. Afronden duurt één minuut.
          </Text>

          <div style={{ textAlign: 'center' as const, marginBottom: '18px' }}>
            <Button href={checkoutUrl} style={{ backgroundColor: colors.accent, color: '#ffffff', fontFamily: font, fontSize: '16px', fontWeight: 600, textDecoration: 'none', padding: '14px 44px', borderRadius: '8px', display: 'inline-block' }}>
              Rond je bestelling af →
            </Button>
          </div>

          <div style={{ backgroundColor: colors.accentSoft, borderRadius: '10px', border: `1px solid ${colors.boxBorder}`, padding: '14px 18px', textAlign: 'center' as const, marginBottom: '20px' }}>
            <Text style={{ fontFamily: font, fontSize: '13.5px', lineHeight: 1.55, color: colors.textBody, margin: 0 }}>
              Deed je bank moeilijk? Kies deze keer gewoon een <strong>andere betaalmethode</strong> — kaart, Klarna, wat voor jou werkt.
            </Text>
          </div>

          <Text style={{ fontFamily: font, fontSize: '14px', lineHeight: 1.6, color: colors.textBody, margin: '0 0 2px' }}>Liefs,</Text>
          <Text style={{ fontFamily: font, fontSize: '14px', fontWeight: 700, color: colors.textDark, margin: '0 0 16px' }}>Anna de Vries</Text>

          <div style={{ borderTop: `1px dashed ${colors.boxBorder}`, paddingTop: '16px' }}>
            <Text style={{ fontFamily: font, fontSize: '13px', lineHeight: 1.6, color: colors.footerText, margin: '0 0 10px' }}>
              <strong style={{ color: colors.textBody }}>P.S.</strong> Lukt het nog steeds niet? Beantwoord deze mail, dan kijk ik persoonlijk met je mee.
            </Text>
            <Text style={{ fontFamily: font, fontSize: '13px', lineHeight: 1.6, color: colors.footerText, margin: 0 }}>
              <strong style={{ color: colors.textBody }}>P.P.S.</strong> Je zit nergens aan vast: 30 dagen bedenktijd, geld terug zonder vragen.
            </Text>
          </div>
        </div>

        {/* Footer */}
        <div style={{ backgroundColor: colors.footerBg, padding: '24px', textAlign: 'center' as const }}>
          <Text style={{ fontFamily: font, fontSize: '12px', color: colors.footerAccent, margin: '0 0 6px' }}>Het Leven Dat Je Verdient</Text>
          <Text style={{ fontFamily: font, fontSize: '11px', lineHeight: 1.6, color: colors.footerText, margin: 0 }}>
            Performance Marketing Solution s.r.o. • Rybná 716/24, 110 00 Staré Město, Praha, CZ · IČ: 06259928<br />
            Je ontvangt deze e-mail omdat je een bestelling bent gestart op pakjeleventerug.nl.
          </Text>
        </div>
      </Section>
    </Base>
  )
}

HlPaymentRecoveryTemplate.PreviewProps = { firstName: 'Sophie', checkoutUrl: 'https://pakjeleventerug.nl/checkout' }
