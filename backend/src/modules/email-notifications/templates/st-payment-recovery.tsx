import { Text, Section, Button } from '@react-email/components'
import * as React from 'react'
import { Base } from './base'

export const ST_PAYMENT_RECOVERY = 'st-payment-recovery'

export interface StPaymentRecoveryProps {
  firstName: string
  checkoutUrl: string
  preview?: string
}

export const isStPaymentRecoveryData = (data: any): data is StPaymentRecoveryProps =>
  typeof data.firstName === 'string' && typeof data.checkoutUrl === 'string'

const font = "'Inter', Arial, sans-serif"
const headerGradient = 'linear-gradient(135deg, #5A3D6B 0%, #2D1B3D 50%, #1A1028 100%)'

/**
 * Släpp Taget — "Det strulade till sig" (payment recovery, Joris's voice).
 * Brite open-banking only: session aborted AND transaction terminally failed (2/3/7),
 * verified NOT paid, 45+ min after the abort (late-settlement grace).
 * Copy design (2026-07): blame the tech, kill the double-charge fear first,
 * alt-payment-method as the real friction solver, reply trigger, 30-day guarantee.
 * NO discount.
 */
export const StPaymentRecoveryTemplate: React.FC<StPaymentRecoveryProps> & {
  PreviewProps: StPaymentRecoveryProps
} = ({ firstName, checkoutUrl, preview = 'Inga pengar har dragits. Att slutföra tar en minut.' }) => {
  return (
    <Base preview={preview}>
      <Section>
        <div style={{ background: headerGradient, padding: '32px 24px', textAlign: 'center' as const }}>
          <Text style={{ fontFamily: font, fontSize: '11px', fontWeight: 600, letterSpacing: '3px', textTransform: 'uppercase' as const, color: '#C27BA0', margin: '0 0 8px' }}>
            Släpp Taget
          </Text>
          <Text style={{ fontSize: '32px', margin: '0 0 6px' }}>🔔</Text>
          <Text style={{ fontFamily: font, fontSize: '22px', fontWeight: 700, color: '#ffffff', margin: 0 }}>
            Det strulade till sig
          </Text>
        </div>

        <div style={{ padding: '28px 24px' }}>
          <Text style={{ fontFamily: font, fontSize: '15px', lineHeight: 1.6, color: '#3F3F46', margin: '0 0 14px' }}>
            Hej {firstName},
          </Text>
          <Text style={{ fontFamily: font, fontSize: '15px', lineHeight: 1.6, color: '#3F3F46', margin: '0 0 16px' }}>
            Du var nästan klar — sen strulade det mellan din skärm och din bank.
          </Text>
          <Text style={{ fontFamily: font, fontSize: '15px', lineHeight: 1.6, color: '#3F3F46', margin: '0 0 16px' }}>
            Det viktigaste först: <strong>inga pengar har dragits.</strong> Inte ett öre.
          </Text>
          <Text style={{ fontFamily: font, fontSize: '15px', lineHeight: 1.6, color: '#3F3F46', margin: '0 0 16px' }}>
            Det här händer oftare än du tror. Ibland är det Swish, ibland banken, ibland bara en
            dålig dag för tekniken. Det säger ingenting om dig.
          </Text>
          <Text style={{ fontFamily: font, fontSize: '15px', lineHeight: 1.6, color: '#3F3F46', margin: '0 0 20px' }}>
            Din bok väntar fortfarande. Det tar en minut att slutföra.
          </Text>

          <div style={{ textAlign: 'center' as const, marginBottom: '18px' }}>
            <Button href={checkoutUrl} style={{ backgroundColor: '#C27BA0', color: '#ffffff', fontFamily: font, fontSize: '16px', fontWeight: 600, textDecoration: 'none', padding: '14px 44px', borderRadius: '8px', display: 'inline-block' }}>
              Slutför din beställning →
            </Button>
          </div>

          <div style={{ backgroundColor: '#FAF5F8', borderRadius: '10px', border: '1px solid #EDD9E5', padding: '14px 18px', textAlign: 'center' as const, marginBottom: '20px' }}>
            <Text style={{ fontFamily: font, fontSize: '13.5px', lineHeight: 1.55, color: '#3F3F46', margin: 0 }}>
              Krånglade banken? Välj en <strong>annan betalmetod</strong> den här gången — kort eller Klarna brukar gå smidigast.
            </Text>
          </div>

          <Text style={{ fontFamily: font, fontSize: '14px', lineHeight: 1.6, color: '#3F3F46', margin: '0 0 2px' }}>Vänligen,</Text>
          <Text style={{ fontFamily: font, fontSize: '14px', fontWeight: 700, color: '#1A1028', margin: '0 0 16px' }}>Joris de Vries</Text>

          <div style={{ borderTop: '1px dashed #EDD9E5', paddingTop: '16px' }}>
            <Text style={{ fontFamily: font, fontSize: '13px', lineHeight: 1.6, color: '#71717A', margin: '0 0 10px' }}>
              <strong style={{ color: '#3F3F46' }}>P.S.</strong> Fastnar du ändå? Svara på det här mejlet, så hjälper jag dig personligen.
            </Text>
            <Text style={{ fontFamily: font, fontSize: '13px', lineHeight: 1.6, color: '#71717A', margin: 0 }}>
              <strong style={{ color: '#3F3F46' }}>P.P.S.</strong> Du tar ingen risk: 30 dagars öppet köp, pengarna tillbaka utan frågor.
            </Text>
          </div>
        </div>

        <div style={{ backgroundColor: '#1A1028', padding: '24px', textAlign: 'center' as const }}>
          <Text style={{ fontFamily: font, fontSize: '12px', color: '#C27BA0', margin: '0 0 6px' }}>Släpp Taget</Text>
          <Text style={{ fontFamily: font, fontSize: '11px', lineHeight: 1.6, color: '#A1A1AA', margin: 0 }}>
            Performance Marketing Solution s.r.o. · Reg. nr: 06259928<br />
            Du får detta e-postmeddelande för att du påbörjat en beställning på slapptagetboken.se.
          </Text>
        </div>
      </Section>
    </Base>
  )
}

StPaymentRecoveryTemplate.PreviewProps = { firstName: 'Anna', checkoutUrl: 'https://slapptagetboken.se/checkout' }
