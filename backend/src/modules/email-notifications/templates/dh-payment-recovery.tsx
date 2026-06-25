import { Text, Section, Button } from '@react-email/components'
import * as React from 'react'
import { Base } from './base'

export const DH_PAYMENT_RECOVERY = 'dh-payment-recovery'

export interface DhPaymentRecoveryProps {
  firstName: string
  checkoutUrl: string
  preview?: string
}

export const isDhPaymentRecoveryData = (data: any): data is DhPaymentRecoveryProps =>
  typeof data.firstName === 'string' && typeof data.checkoutUrl === 'string'

const font = "'Inter', Arial, sans-serif"

/**
 * De Hondenbijbel — "Je bent er bijna" (payment recovery).
 * Sent ONLY for Brite open-banking sessions that aborted AND were verified NOT paid
 * (transaction not in 4/5/6), 30–60 min after the abort so a late settlement has had
 * time to land first (never tell a paying customer to "finish" — the Vincent case).
 * Reassures: no money taken, the order is still waiting, one click to finish.
 */
export const DhPaymentRecoveryTemplate: React.FC<DhPaymentRecoveryProps> & {
  PreviewProps: DhPaymentRecoveryProps
} = ({ firstName, checkoutUrl, preview = 'Je bestelling staat klaar — afronden duurt 1 minuut.' }) => {
  return (
    <Base preview={preview}>
      <Section>
        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg, #F97316 0%, #EA580C 50%, #C2410C 100%)', padding: '32px 24px', textAlign: 'center' as const }}>
          <Text style={{ fontFamily: font, fontSize: '11px', fontWeight: 600, letterSpacing: '3px', textTransform: 'uppercase' as const, color: 'rgba(255,255,255,0.75)', margin: '0 0 8px' }}>
            De Hondenbijbel
          </Text>
          <Text style={{ fontSize: '32px', margin: '0 0 6px' }}>🔔</Text>
          <Text style={{ fontFamily: font, fontSize: '22px', fontWeight: 700, color: '#ffffff', margin: 0 }}>
            Je bent er bijna
          </Text>
        </div>

        {/* Body */}
        <div style={{ padding: '28px 24px' }}>
          <Text style={{ fontFamily: font, fontSize: '15px', lineHeight: 1.6, color: '#3F3F46', margin: '0 0 14px' }}>
            Hoi {firstName},
          </Text>
          <Text style={{ fontFamily: font, fontSize: '15px', lineHeight: 1.6, color: '#3F3F46', margin: '0 0 16px' }}>
            Het lijkt erop dat je betaling net niet is afgerond. Geen zorgen — <strong>er is geen geld afgeschreven</strong>.
          </Text>
          <Text style={{ fontFamily: font, fontSize: '15px', lineHeight: 1.6, color: '#3F3F46', margin: '0 0 20px' }}>
            Je bestelling staat nog voor je klaar. Je kunt hem in één minuut afronden:
          </Text>

          <div style={{ textAlign: 'center' as const, marginBottom: '18px' }}>
            <Button href={checkoutUrl} style={{ backgroundColor: '#E87E04', color: '#ffffff', fontFamily: font, fontSize: '16px', fontWeight: 600, textDecoration: 'none', padding: '14px 44px', borderRadius: '8px', display: 'inline-block' }}>
              Rond je bestelling af →
            </Button>
          </div>

          <div style={{ backgroundColor: '#FFF7ED', borderRadius: '10px', border: '1px solid #FED7AA', padding: '14px 18px', textAlign: 'center' as const, marginBottom: '20px' }}>
            <Text style={{ fontFamily: font, fontSize: '13.5px', lineHeight: 1.55, color: '#3F3F46', margin: 0 }}>
              Liever met iDEAL of een andere bank betalen? Dat kan via dezelfde knop.
            </Text>
          </div>

          <Text style={{ fontFamily: font, fontSize: '14px', lineHeight: 1.6, color: '#3F3F46', margin: '0 0 2px' }}>Groet,</Text>
          <Text style={{ fontFamily: font, fontSize: '14px', fontWeight: 700, color: '#18181B', margin: '0 0 16px' }}>Lars Vermeulen</Text>

          <div style={{ borderTop: '1px dashed #E4E4E7', paddingTop: '16px' }}>
            <Text style={{ fontFamily: font, fontSize: '13px', lineHeight: 1.6, color: '#A1A1AA', margin: 0 }}>
              <strong style={{ color: '#3F3F46' }}>P.S.</strong> Lukt het niet of twijfel je? Beantwoord deze mail — dan help ik je er even doorheen.
            </Text>
          </div>
        </div>

        {/* Footer */}
        <div style={{ backgroundColor: '#18181B', padding: '24px', textAlign: 'center' as const }}>
          <Text style={{ fontFamily: font, fontSize: '12px', color: '#FB923C', margin: '0 0 6px' }}>De Hondenbijbel</Text>
          <Text style={{ fontFamily: font, fontSize: '11px', lineHeight: 1.6, color: '#A1A1AA', margin: 0 }}>
            EverChapter OÜ • Tallinn, Estonia · Reg. nr: 16938029<br />
            Je ontvangt deze e-mail omdat je een bestelling bent gestart.
          </Text>
        </div>
      </Section>
    </Base>
  )
}

DhPaymentRecoveryTemplate.PreviewProps = { firstName: 'Sophie', checkoutUrl: 'https://dehondenbijbel.nl/checkout' }
