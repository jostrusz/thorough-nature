import { Text, Section } from '@react-email/components'
import * as React from 'react'
import { Base } from './base'

export const LB_PAYMENT_PENDING = 'lb-payment-pending'

export interface LbPaymentPendingProps {
  firstName: string
  preview?: string
}

export const isLbPaymentPendingData = (data: any): data is LbPaymentPendingProps =>
  typeof data.firstName === 'string'

const font = "'Inter', Arial, sans-serif"

/**
 * Loslatenboek — "We hebben je bestelling ontvangen" (payment pending).
 * Sent ONLY for Brite open-banking payments that are still settling (transaction
 * PENDING, no order yet) when the customer has left. Reassures: nothing went wrong,
 * the bank just needs a moment, the e-book + confirmation follow automatically.
 */
export const LbPaymentPendingTemplate: React.FC<LbPaymentPendingProps> & {
  PreviewProps: LbPaymentPendingProps
} = ({ firstName, preview = 'We hebben je bestelling ontvangen — je hoeft niets te doen.' }) => {
  return (
    <Base preview={preview}>
      <Section>
        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg, #2D1B3D 0%, #1A1028 100%)', padding: '32px 24px', textAlign: 'center' as const }}>
          <Text style={{ fontFamily: font, fontSize: '11px', fontWeight: 600, letterSpacing: '3px', textTransform: 'uppercase' as const, color: '#C27BA0', margin: '0 0 8px' }}>
            Laat Los Wat Je Kapotmaakt
          </Text>
          <Text style={{ fontSize: '32px', margin: '0 0 6px' }}>⏳</Text>
          <Text style={{ fontFamily: font, fontSize: '22px', fontWeight: 700, color: '#ffffff', margin: 0 }}>
            We hebben je bestelling ontvangen
          </Text>
        </div>

        {/* Body */}
        <div style={{ padding: '28px 24px' }}>
          <Text style={{ fontFamily: font, fontSize: '15px', lineHeight: 1.6, color: '#5A3D6B', margin: '0 0 14px' }}>
            Hoi {firstName},
          </Text>
          <Text style={{ fontFamily: font, fontSize: '15px', lineHeight: 1.6, color: '#5A3D6B', margin: '0 0 16px' }}>
            Je bestelling staat genoteerd.
          </Text>
          <Text style={{ fontFamily: font, fontSize: '15px', lineHeight: 1.6, color: '#5A3D6B', margin: '0 0 16px' }}>
            Je bank is de betaling nog aan het verwerken — bij sommige banken duurt dat een paar minuten. Dat is helemaal normaal en je hoeft nergens op te wachten.
          </Text>
          <Text style={{ fontFamily: font, fontSize: '15px', lineHeight: 1.6, color: '#5A3D6B', margin: '0 0 20px' }}>
            Zodra de betaling bevestigd is, krijg je direct je e-book en de bevestiging van mij.
          </Text>

          <div style={{ backgroundColor: '#FAF5F8', borderRadius: '10px', border: '1px solid #EDD9E5', padding: '14px 18px', marginBottom: '20px' }}>
            <Text style={{ fontFamily: font, fontSize: '13.5px', lineHeight: 1.55, color: '#5A3D6B', margin: 0 }}>
              <strong style={{ color: '#2D1B3D' }}>Er is nog niets misgegaan</strong> — dit is gewoon de bank die even de tijd neemt. Ik hou het voor je in de gaten.
            </Text>
          </div>

          <Text style={{ fontFamily: font, fontSize: '14px', lineHeight: 1.6, color: '#5A3D6B', margin: '0 0 2px' }}>Tot zo,</Text>
          <Text style={{ fontFamily: font, fontSize: '14px', fontWeight: 700, color: '#2D1B3D', margin: '0 0 16px' }}>Joris de Vries</Text>

          <div style={{ borderTop: '1px dashed #D7CFBE', paddingTop: '16px' }}>
            <Text style={{ fontFamily: font, fontSize: '13px', lineHeight: 1.6, color: '#9B7AAD', margin: 0 }}>
              <strong style={{ color: '#5A3D6B' }}>P.S.</strong> Je hoeft deze mail niet te beantwoorden — zodra de betaling rond is, hoor je het meteen van me.
            </Text>
          </div>
        </div>

        {/* Footer */}
        <div style={{ backgroundColor: '#2D1B3D', padding: '24px', textAlign: 'center' as const }}>
          <Text style={{ fontFamily: font, fontSize: '12px', color: '#C27BA0', margin: '0 0 6px' }}>Laat Los Wat Je Kapotmaakt</Text>
          <Text style={{ fontFamily: font, fontSize: '11px', lineHeight: 1.6, color: '#7a6189', margin: 0 }}>
            EverChapter OÜ • Harju maakond, 10117 Tallinn · Reg. nr: 17152439<br />
            Je ontvangt deze e-mail omdat je een bestelling hebt geplaatst.
          </Text>
        </div>
      </Section>
    </Base>
  )
}

LbPaymentPendingTemplate.PreviewProps = { firstName: 'Sophie' }
