import { Text, Section } from '@react-email/components'
import * as React from 'react'
import { Base } from './base'

export const LL_PAYMENT_PENDING = 'll-payment-pending'

export interface LlPaymentPendingProps {
  firstName: string
  preview?: string
}

export const isLlPaymentPendingData = (data: any): data is LlPaymentPendingProps =>
  typeof data.firstName === 'string'

const font = "'Inter', Arial, sans-serif"
const headerGradient = 'linear-gradient(135deg, #5A3D6B 0%, #2D1B3D 50%, #1A1028 100%)'

/**
 * Lass los, was dich kaputt macht — "Wir haben deine Bestellung erhalten" (payment pending).
 * Brite open-banking only: transaction PENDING (1), no order yet, customer left.
 */
export const LlPaymentPendingTemplate: React.FC<LlPaymentPendingProps> & {
  PreviewProps: LlPaymentPendingProps
} = ({ firstName, preview = 'Wir haben deine Bestellung erhalten — du musst nichts tun.' }) => {
  return (
    <Base preview={preview}>
      <Section>
        <div style={{ background: headerGradient, padding: '32px 24px', textAlign: 'center' as const }}>
          <Text style={{ fontFamily: font, fontSize: '11px', fontWeight: 600, letterSpacing: '3px', textTransform: 'uppercase' as const, color: '#C27BA0', margin: '0 0 8px' }}>
            Lass los, was dich kaputt macht
          </Text>
          <Text style={{ fontSize: '32px', margin: '0 0 6px' }}>⏳</Text>
          <Text style={{ fontFamily: font, fontSize: '22px', fontWeight: 700, color: '#ffffff', margin: 0 }}>
            Wir haben deine Bestellung erhalten
          </Text>
        </div>

        <div style={{ padding: '28px 24px' }}>
          <Text style={{ fontFamily: font, fontSize: '15px', lineHeight: 1.6, color: '#3F3F46', margin: '0 0 14px' }}>
            Hallo {firstName},
          </Text>
          <Text style={{ fontFamily: font, fontSize: '15px', lineHeight: 1.6, color: '#3F3F46', margin: '0 0 16px' }}>
            Deine Bestellung ist notiert.
          </Text>
          <Text style={{ fontFamily: font, fontSize: '15px', lineHeight: 1.6, color: '#3F3F46', margin: '0 0 16px' }}>
            Deine Bank verarbeitet die Zahlung noch — bei manchen Banken dauert das ein paar Minuten. Das ist völlig normal und du musst auf nichts warten.
          </Text>
          <Text style={{ fontFamily: font, fontSize: '15px', lineHeight: 1.6, color: '#3F3F46', margin: '0 0 20px' }}>
            Sobald die Zahlung bestätigt ist, erhältst du sofort dein E-Book und die Bestätigung von uns.
          </Text>

          <div style={{ backgroundColor: '#FAF5F8', borderRadius: '10px', border: '1px solid #EDD9E5', padding: '14px 18px', marginBottom: '20px' }}>
            <Text style={{ fontFamily: font, fontSize: '13.5px', lineHeight: 1.55, color: '#3F3F46', margin: 0 }}>
              <strong style={{ color: '#1A1028' }}>Es ist nichts schiefgegangen</strong> — die Bank nimmt sich nur etwas Zeit. Wir behalten es für dich im Blick.
            </Text>
          </div>

          <Text style={{ fontFamily: font, fontSize: '14px', lineHeight: 1.6, color: '#3F3F46', margin: '0 0 2px' }}>Herzliche Grüße,</Text>
          <Text style={{ fontFamily: font, fontSize: '14px', fontWeight: 700, color: '#1A1028', margin: '0 0 16px' }}>Lass los, was dich kaputt macht</Text>

          <div style={{ borderTop: '1px dashed #EDD9E5', paddingTop: '16px' }}>
            <Text style={{ fontFamily: font, fontSize: '13px', lineHeight: 1.6, color: '#71717A', margin: 0 }}>
              <strong style={{ color: '#3F3F46' }}>P.S.</strong> Du musst diese E-Mail nicht beantworten — sobald die Zahlung abgeschlossen ist, hörst du sofort von uns.
            </Text>
          </div>
        </div>

        <div style={{ backgroundColor: '#1A1028', padding: '24px', textAlign: 'center' as const }}>
          <Text style={{ fontFamily: font, fontSize: '12px', color: '#C27BA0', margin: '0 0 6px' }}>Lass los, was dich kaputt macht</Text>
          <Text style={{ fontFamily: font, fontSize: '11px', lineHeight: 1.6, color: '#A1A1AA', margin: 0 }}>
            Performance Marketing Solution s.r.o. · Reg. nr: 17255679<br />
            Du erhältst diese E-Mail, weil du eine Bestellung auf jetztloslassen.de aufgegeben hast.
          </Text>
        </div>
      </Section>
    </Base>
  )
}

LlPaymentPendingTemplate.PreviewProps = { firstName: 'Anna' }
