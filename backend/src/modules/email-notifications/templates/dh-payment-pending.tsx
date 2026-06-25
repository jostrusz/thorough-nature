import { Text, Section } from '@react-email/components'
import * as React from 'react'
import { Base } from './base'

export const DH_PAYMENT_PENDING = 'dh-payment-pending'

export interface DhPaymentPendingProps {
  firstName: string
  preview?: string
}

export const isDhPaymentPendingData = (data: any): data is DhPaymentPendingProps =>
  typeof data.firstName === 'string'

const font = "'Inter', Arial, sans-serif"

/**
 * De Hondenbijbel — "We hebben je bestelling ontvangen" (payment pending).
 * Sent ONLY for Brite open-banking payments that are still settling (transaction
 * PENDING, no order yet) when the customer has left. Reassures: nothing went wrong,
 * the bank just needs a moment, the e-book + confirmation follow automatically.
 */
export const DhPaymentPendingTemplate: React.FC<DhPaymentPendingProps> & {
  PreviewProps: DhPaymentPendingProps
} = ({ firstName, preview = 'We hebben je bestelling ontvangen — je hoeft niets te doen.' }) => {
  return (
    <Base preview={preview}>
      <Section>
        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg, #F97316 0%, #EA580C 50%, #C2410C 100%)', padding: '32px 24px', textAlign: 'center' as const }}>
          <Text style={{ fontFamily: font, fontSize: '11px', fontWeight: 600, letterSpacing: '3px', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.75)', margin: '0 0 8px' }}>
            De Hondenbijbel
          </Text>
          <Text style={{ fontSize: '32px', margin: '0 0 6px' }}>⏳</Text>
          <Text style={{ fontFamily: font, fontSize: '22px', fontWeight: 700, color: '#ffffff', margin: 0 }}>
            We hebben je bestelling ontvangen
          </Text>
        </div>

        {/* Body */}
        <div style={{ padding: '28px 24px' }}>
          <Text style={{ fontFamily: font, fontSize: '15px', lineHeight: 1.6, color: '#3F3F46', margin: '0 0 14px' }}>
            Hoi {firstName},
          </Text>
          <Text style={{ fontFamily: font, fontSize: '15px', lineHeight: 1.6, color: '#3F3F46', margin: '0 0 16px' }}>
            Je bestelling staat genoteerd.
          </Text>
          <Text style={{ fontFamily: font, fontSize: '15px', lineHeight: 1.6, color: '#3F3F46', margin: '0 0 16px' }}>
            Je bank is de betaling nog aan het verwerken — bij sommige banken duurt dat een paar minuten. Dat is helemaal normaal en je hoeft nergens op te wachten.
          </Text>
          <Text style={{ fontFamily: font, fontSize: '15px', lineHeight: 1.6, color: '#3F3F46', margin: '0 0 20px' }}>
            Zodra de betaling bevestigd is, krijg je direct je e-book en de bevestiging van mij.
          </Text>

          <div style={{ backgroundColor: '#FFF7ED', borderRadius: '10px', border: '1px solid #FED7AA', padding: '14px 18px', marginBottom: '20px' }}>
            <Text style={{ fontFamily: font, fontSize: '13.5px', lineHeight: 1.55, color: '#3F3F46', margin: 0 }}>
              <strong style={{ color: '#18181B' }}>Er is nog niets misgegaan</strong> — dit is gewoon de bank die even de tijd neemt. Ik hou het voor je in de gaten.
            </Text>
          </div>

          <Text style={{ fontFamily: font, fontSize: '14px', lineHeight: 1.6, color: '#3F3F46', margin: '0 0 2px' }}>Tot zo,</Text>
          <Text style={{ fontFamily: font, fontSize: '14px', fontWeight: 700, color: '#18181B', margin: '0 0 16px' }}>Lars Vermeulen</Text>

          <div style={{ borderTop: '1px dashed #E4E4E7', paddingTop: '16px' }}>
            <Text style={{ fontFamily: font, fontSize: '13px', lineHeight: 1.6, color: '#A1A1AA', margin: 0 }}>
              <strong style={{ color: '#3F3F46' }}>P.S.</strong> Je hoeft deze mail niet te beantwoorden — zodra de betaling rond is, hoor je het meteen van me.
            </Text>
          </div>
        </div>

        {/* Footer */}
        <div style={{ backgroundColor: '#18181B', padding: '24px', textAlign: 'center' as const }}>
          <Text style={{ fontFamily: font, fontSize: '12px', color: '#FB923C', margin: '0 0 6px' }}>De Hondenbijbel</Text>
          <Text style={{ fontFamily: font, fontSize: '11px', lineHeight: 1.6, color: '#A1A1AA', margin: 0 }}>
            EverChapter OÜ • Tallinn, Estonia · Reg. nr: 16938029<br />
            Je ontvangt deze e-mail omdat je een bestelling hebt geplaatst.
          </Text>
        </div>
      </Section>
    </Base>
  )
}

DhPaymentPendingTemplate.PreviewProps = { firstName: 'Sophie' }
