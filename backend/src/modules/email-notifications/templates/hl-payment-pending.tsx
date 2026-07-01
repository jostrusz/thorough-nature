import { Text, Section } from '@react-email/components'
import * as React from 'react'
import { Base } from './base'

export const HL_PAYMENT_PENDING = 'hl-payment-pending'

export interface HlPaymentPendingProps {
  firstName: string
  preview?: string
}

export const isHlPaymentPendingData = (data: any): data is HlPaymentPendingProps =>
  typeof data.firstName === 'string'

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
 * Het Leven — "We hebben je bestelling ontvangen" (payment pending).
 * Sent ONLY for Brite open-banking payments that are still settling (transaction
 * PENDING, no order yet) when the customer has left. Reassures: nothing went wrong,
 * the bank just needs a moment, the order confirmation follows automatically.
 */
export const HlPaymentPendingTemplate: React.FC<HlPaymentPendingProps> & {
  PreviewProps: HlPaymentPendingProps
} = ({ firstName, preview = 'We hebben je bestelling ontvangen — je hoeft niets te doen.' }) => {
  return (
    <Base preview={preview}>
      <Section>
        {/* Header */}
        <div style={{ background: colors.headerGradient, padding: '32px 24px', textAlign: 'center' as const }}>
          <Text style={{ fontFamily: font, fontSize: '11px', fontWeight: 600, letterSpacing: '3px', textTransform: 'uppercase' as const, color: colors.footerAccent, margin: '0 0 8px' }}>
            Het Leven Dat Je Verdient
          </Text>
          <Text style={{ fontSize: '32px', margin: '0 0 6px' }}>⏳</Text>
          <Text style={{ fontFamily: font, fontSize: '22px', fontWeight: 700, color: '#ffffff', margin: 0 }}>
            We hebben je bestelling ontvangen
          </Text>
        </div>

        {/* Body */}
        <div style={{ padding: '28px 24px' }}>
          <Text style={{ fontFamily: font, fontSize: '15px', lineHeight: 1.6, color: colors.textBody, margin: '0 0 14px' }}>
            Hoi {firstName},
          </Text>
          <Text style={{ fontFamily: font, fontSize: '15px', lineHeight: 1.6, color: colors.textBody, margin: '0 0 16px' }}>
            Je bestelling staat genoteerd.
          </Text>
          <Text style={{ fontFamily: font, fontSize: '15px', lineHeight: 1.6, color: colors.textBody, margin: '0 0 16px' }}>
            Je bank is de betaling nog aan het verwerken — bij sommige banken duurt dat een paar minuten. Dat is helemaal normaal en je hoeft nergens op te wachten.
          </Text>
          <Text style={{ fontFamily: font, fontSize: '15px', lineHeight: 1.6, color: colors.textBody, margin: '0 0 20px' }}>
            Zodra de betaling bevestigd is, krijg je direct de bevestiging van mij.
          </Text>

          <div style={{ backgroundColor: colors.accentSoft, borderRadius: '10px', border: `1px solid ${colors.boxBorder}`, padding: '14px 18px', marginBottom: '20px' }}>
            <Text style={{ fontFamily: font, fontSize: '13.5px', lineHeight: 1.55, color: colors.textBody, margin: 0 }}>
              <strong style={{ color: colors.textDark }}>Er is nog niets misgegaan</strong> — dit is gewoon de bank die even de tijd neemt. Ik hou het voor je in de gaten.
            </Text>
          </div>

          <Text style={{ fontFamily: font, fontSize: '14px', lineHeight: 1.6, color: colors.textBody, margin: '0 0 2px' }}>Tot zo,</Text>
          <Text style={{ fontFamily: font, fontSize: '14px', fontWeight: 700, color: colors.textDark, margin: '0 0 16px' }}>Anna de Vries</Text>

          <div style={{ borderTop: `1px dashed ${colors.boxBorder}`, paddingTop: '16px' }}>
            <Text style={{ fontFamily: font, fontSize: '13px', lineHeight: 1.6, color: colors.footerText, margin: 0 }}>
              <strong style={{ color: colors.textBody }}>P.S.</strong> Je hoeft deze mail niet te beantwoorden — zodra de betaling rond is, hoor je het meteen van me.
            </Text>
          </div>
        </div>

        {/* Footer */}
        <div style={{ backgroundColor: colors.footerBg, padding: '24px', textAlign: 'center' as const }}>
          <Text style={{ fontFamily: font, fontSize: '12px', color: colors.footerAccent, margin: '0 0 6px' }}>Het Leven Dat Je Verdient</Text>
          <Text style={{ fontFamily: font, fontSize: '11px', lineHeight: 1.6, color: colors.footerText, margin: 0 }}>
            Performance Marketing Solution s.r.o. • Rybná 716/24, 110 00 Staré Město, Praha, CZ · IČ: 06259928<br />
            Je ontvangt deze e-mail omdat je een bestelling hebt geplaatst op pakjeleventerug.nl.
          </Text>
        </div>
      </Section>
    </Base>
  )
}

HlPaymentPendingTemplate.PreviewProps = { firstName: 'Sophie' }
