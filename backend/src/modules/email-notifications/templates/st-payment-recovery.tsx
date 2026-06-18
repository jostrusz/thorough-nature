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
 * Släpp Taget — "Du är nästan klar" (payment recovery).
 * Brite open-banking only: session aborted AND transaction terminally failed (2/3/7),
 * verified NOT paid, 30–60 min after the abort (late-settlement grace).
 */
export const StPaymentRecoveryTemplate: React.FC<StPaymentRecoveryProps> & {
  PreviewProps: StPaymentRecoveryProps
} = ({ firstName, checkoutUrl, preview = 'Din beställning väntar — slutför den på en minut.' }) => {
  return (
    <Base preview={preview}>
      <Section>
        <div style={{ background: headerGradient, padding: '32px 24px', textAlign: 'center' as const }}>
          <Text style={{ fontFamily: font, fontSize: '11px', fontWeight: 600, letterSpacing: '3px', textTransform: 'uppercase' as const, color: '#C27BA0', margin: '0 0 8px' }}>
            Släpp Taget
          </Text>
          <Text style={{ fontSize: '32px', margin: '0 0 6px' }}>🔔</Text>
          <Text style={{ fontFamily: font, fontSize: '22px', fontWeight: 700, color: '#ffffff', margin: 0 }}>
            Du är nästan klar
          </Text>
        </div>

        <div style={{ padding: '28px 24px' }}>
          <Text style={{ fontFamily: font, fontSize: '15px', lineHeight: 1.6, color: '#3F3F46', margin: '0 0 14px' }}>
            Hej {firstName},
          </Text>
          <Text style={{ fontFamily: font, fontSize: '15px', lineHeight: 1.6, color: '#3F3F46', margin: '0 0 16px' }}>
            Det ser ut som att din betalning inte riktigt slutfördes. Inga problem — <strong>inga pengar har dragits</strong>.
          </Text>
          <Text style={{ fontFamily: font, fontSize: '15px', lineHeight: 1.6, color: '#3F3F46', margin: '0 0 20px' }}>
            Din beställning väntar fortfarande på dig. Du slutför den på en minut:
          </Text>

          <div style={{ textAlign: 'center' as const, marginBottom: '18px' }}>
            <Button href={checkoutUrl} style={{ backgroundColor: '#C27BA0', color: '#ffffff', fontFamily: font, fontSize: '16px', fontWeight: 600, textDecoration: 'none', padding: '14px 44px', borderRadius: '8px', display: 'inline-block' }}>
              Slutför din beställning →
            </Button>
          </div>

          <div style={{ backgroundColor: '#FAF5F8', borderRadius: '10px', border: '1px solid #EDD9E5', padding: '14px 18px', textAlign: 'center' as const, marginBottom: '20px' }}>
            <Text style={{ fontFamily: font, fontSize: '13.5px', lineHeight: 1.55, color: '#3F3F46', margin: 0 }}>
              Vill du hellre betala med Swish eller en annan bank? Det går via samma knapp.
            </Text>
          </div>

          <Text style={{ fontFamily: font, fontSize: '14px', lineHeight: 1.6, color: '#3F3F46', margin: '0 0 2px' }}>Vänliga hälsningar,</Text>
          <Text style={{ fontFamily: font, fontSize: '14px', fontWeight: 700, color: '#1A1028', margin: '0 0 16px' }}>Släpp Taget</Text>

          <div style={{ borderTop: '1px dashed #EDD9E5', paddingTop: '16px' }}>
            <Text style={{ fontFamily: font, fontSize: '13px', lineHeight: 1.6, color: '#71717A', margin: 0 }}>
              <strong style={{ color: '#3F3F46' }}>P.S.</strong> Fungerar det inte eller är du osäker? Svara på det här mejlet — så hjälper vi dig vidare.
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
