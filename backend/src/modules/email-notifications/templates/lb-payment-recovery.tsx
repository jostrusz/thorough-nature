import { Text, Section, Button } from '@react-email/components'
import * as React from 'react'
import { Base } from './base'

export const LB_PAYMENT_RECOVERY = 'lb-payment-recovery'

export interface LbPaymentRecoveryProps {
  firstName: string
  checkoutUrl: string
  preview?: string
}

export const isLbPaymentRecoveryData = (data: any): data is LbPaymentRecoveryProps =>
  typeof data.firstName === 'string' && typeof data.checkoutUrl === 'string'

const font = "'Inter', Arial, sans-serif"

/**
 * Loslatenboek — "Je bent er bijna" (payment recovery).
 * Sent ONLY for Brite open-banking sessions that aborted AND were verified NOT paid
 * (transaction not in 4/5/6), 30–60 min after the abort so a late settlement has had
 * time to land first (never tell a paying customer to "finish" — the Vincent case).
 * Reassures: no money taken, the order is still waiting, one click to finish.
 */
export const LbPaymentRecoveryTemplate: React.FC<LbPaymentRecoveryProps> & {
  PreviewProps: LbPaymentRecoveryProps
} = ({ firstName, checkoutUrl, preview = 'Je bestelling staat klaar — afronden duurt 1 minuut.' }) => {
  return (
    <Base preview={preview}>
      <Section>
        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg, #2D1B3D 0%, #1A1028 100%)', padding: '32px 24px', textAlign: 'center' as const }}>
          <Text style={{ fontFamily: font, fontSize: '11px', fontWeight: 600, letterSpacing: '3px', textTransform: 'uppercase' as const, color: '#C27BA0', margin: '0 0 8px' }}>
            Laat Los Wat Je Kapotmaakt
          </Text>
          <Text style={{ fontSize: '32px', margin: '0 0 6px' }}>🔔</Text>
          <Text style={{ fontFamily: font, fontSize: '22px', fontWeight: 700, color: '#ffffff', margin: 0 }}>
            Je bent er bijna
          </Text>
        </div>

        {/* Body */}
        <div style={{ padding: '28px 24px' }}>
          <Text style={{ fontFamily: font, fontSize: '15px', lineHeight: 1.6, color: '#5A3D6B', margin: '0 0 14px' }}>
            Hoi {firstName},
          </Text>
          <Text style={{ fontFamily: font, fontSize: '15px', lineHeight: 1.6, color: '#5A3D6B', margin: '0 0 16px' }}>
            Het lijkt erop dat je betaling net niet is afgerond. Geen zorgen — <strong>er is geen geld afgeschreven</strong>.
          </Text>
          <Text style={{ fontFamily: font, fontSize: '15px', lineHeight: 1.6, color: '#5A3D6B', margin: '0 0 20px' }}>
            Je bestelling staat nog voor je klaar. Je kunt hem in één minuut afronden:
          </Text>

          <div style={{ textAlign: 'center' as const, marginBottom: '18px' }}>
            <Button href={checkoutUrl} style={{ backgroundColor: '#C27BA0', color: '#ffffff', fontFamily: font, fontSize: '16px', fontWeight: 600, textDecoration: 'none', padding: '14px 44px', borderRadius: '8px', display: 'inline-block' }}>
              Rond je bestelling af →
            </Button>
          </div>

          <div style={{ backgroundColor: '#FAF5F8', borderRadius: '10px', border: '1px solid #EDD9E5', padding: '14px 18px', textAlign: 'center' as const, marginBottom: '20px' }}>
            <Text style={{ fontFamily: font, fontSize: '13.5px', lineHeight: 1.55, color: '#5A3D6B', margin: 0 }}>
              Liever met iDEAL of een andere bank betalen? Dat kan via dezelfde knop.
            </Text>
          </div>

          <Text style={{ fontFamily: font, fontSize: '14px', lineHeight: 1.6, color: '#5A3D6B', margin: '0 0 2px' }}>Groet,</Text>
          <Text style={{ fontFamily: font, fontSize: '14px', fontWeight: 700, color: '#2D1B3D', margin: '0 0 16px' }}>Joris de Vries</Text>

          <div style={{ borderTop: '1px dashed #D7CFBE', paddingTop: '16px' }}>
            <Text style={{ fontFamily: font, fontSize: '13px', lineHeight: 1.6, color: '#9B7AAD', margin: 0 }}>
              <strong style={{ color: '#5A3D6B' }}>P.S.</strong> Lukt het niet of twijfel je? Beantwoord deze mail — dan help ik je er even doorheen.
            </Text>
          </div>
        </div>

        {/* Footer */}
        <div style={{ backgroundColor: '#2D1B3D', padding: '24px', textAlign: 'center' as const }}>
          <Text style={{ fontFamily: font, fontSize: '12px', color: '#C27BA0', margin: '0 0 6px' }}>Laat Los Wat Je Kapotmaakt</Text>
          <Text style={{ fontFamily: font, fontSize: '11px', lineHeight: 1.6, color: '#7a6189', margin: 0 }}>
            EverChapter OÜ • Harju maakond, 10117 Tallinn · Reg. nr: 17152439<br />
            Je ontvangt deze e-mail omdat je een bestelling bent gestart.
          </Text>
        </div>
      </Section>
    </Base>
  )
}

LbPaymentRecoveryTemplate.PreviewProps = { firstName: 'Sophie', checkoutUrl: 'https://loslatenboek.nl/checkout' }
