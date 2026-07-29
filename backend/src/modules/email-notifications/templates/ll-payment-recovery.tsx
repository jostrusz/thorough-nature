import { Text, Section, Button } from '@react-email/components'
import * as React from 'react'
import { Base } from './base'

export const LL_PAYMENT_RECOVERY = 'll-payment-recovery'

export interface LlPaymentRecoveryProps {
  firstName: string
  checkoutUrl: string
  preview?: string
}

export const isLlPaymentRecoveryData = (data: any): data is LlPaymentRecoveryProps =>
  typeof data.firstName === 'string' && typeof data.checkoutUrl === 'string'

const font = "'Inter', Arial, sans-serif"
const headerGradient = 'linear-gradient(135deg, #5A3D6B 0%, #2D1B3D 50%, #1A1028 100%)'

/**
 * Lass los, was dich kaputt macht — "Da hat etwas gehakt" (payment recovery, Joris's voice).
 * Brite open-banking only: session aborted AND transaction terminally failed (2/3/7),
 * verified NOT paid, 45+ min after the abort (late-settlement grace).
 * Copy design (2026-07): blame the tech, kill the double-charge fear first,
 * alt-payment-method as the real friction solver, reply trigger, 30-day guarantee.
 * NO discount.
 */
export const LlPaymentRecoveryTemplate: React.FC<LlPaymentRecoveryProps> & {
  PreviewProps: LlPaymentRecoveryProps
} = ({ firstName, checkoutUrl, preview = 'Es wurde nichts abgebucht. Der Abschluss dauert eine Minute.' }) => {
  return (
    <Base preview={preview}>
      <Section>
        <div style={{ background: headerGradient, padding: '32px 24px', textAlign: 'center' as const }}>
          <Text style={{ fontFamily: font, fontSize: '11px', fontWeight: 600, letterSpacing: '3px', textTransform: 'uppercase' as const, color: '#C27BA0', margin: '0 0 8px' }}>
            Lass los, was dich kaputt macht
          </Text>
          <Text style={{ fontSize: '32px', margin: '0 0 6px' }}>🔔</Text>
          <Text style={{ fontFamily: font, fontSize: '22px', fontWeight: 700, color: '#ffffff', margin: 0 }}>
            Da hat etwas gehakt
          </Text>
        </div>

        <div style={{ padding: '28px 24px' }}>
          <Text style={{ fontFamily: font, fontSize: '15px', lineHeight: 1.6, color: '#3F3F46', margin: '0 0 14px' }}>
            Hallo {firstName},
          </Text>
          <Text style={{ fontFamily: font, fontSize: '15px', lineHeight: 1.6, color: '#3F3F46', margin: '0 0 16px' }}>
            du warst fast fertig — dann hat es zwischen deinem Bildschirm und deiner Bank gehakt.
          </Text>
          <Text style={{ fontFamily: font, fontSize: '15px', lineHeight: 1.6, color: '#3F3F46', margin: '0 0 16px' }}>
            Das Wichtigste zuerst: <strong>es wurde kein Cent abgebucht.</strong>
          </Text>
          <Text style={{ fontFamily: font, fontSize: '15px', lineHeight: 1.6, color: '#3F3F46', margin: '0 0 16px' }}>
            So etwas passiert öfter, als du denkst. Banken haben ihre Launen — und das sagt nichts
            über dich aus.
          </Text>
          <Text style={{ fontFamily: font, fontSize: '15px', lineHeight: 1.6, color: '#3F3F46', margin: '0 0 20px' }}>
            Dein Buch liegt noch für dich bereit. Der Abschluss dauert eine Minute.
          </Text>

          <div style={{ textAlign: 'center' as const, marginBottom: '18px' }}>
            <Button href={checkoutUrl} style={{ backgroundColor: '#C27BA0', color: '#ffffff', fontFamily: font, fontSize: '16px', fontWeight: 600, textDecoration: 'none', padding: '14px 44px', borderRadius: '8px', display: 'inline-block' }}>
              Bestellung abschließen →
            </Button>
          </div>

          <div style={{ backgroundColor: '#FAF5F8', borderRadius: '10px', border: '1px solid #EDD9E5', padding: '14px 18px', textAlign: 'center' as const, marginBottom: '20px' }}>
            <Text style={{ fontFamily: font, fontSize: '13.5px', lineHeight: 1.55, color: '#3F3F46', margin: 0 }}>
              Hat deine Bank Ärger gemacht? Nimm diesmal einfach eine <strong>andere Zahlungsmethode</strong> — Karte oder Klarna funktionieren fast immer.
            </Text>
          </div>

          <Text style={{ fontFamily: font, fontSize: '14px', lineHeight: 1.6, color: '#3F3F46', margin: '0 0 2px' }}>Herzlich,</Text>
          <Text style={{ fontFamily: font, fontSize: '14px', fontWeight: 700, color: '#1A1028', margin: '0 0 16px' }}>Joris de Vries</Text>

          <div style={{ borderTop: '1px dashed #EDD9E5', paddingTop: '16px' }}>
            <Text style={{ fontFamily: font, fontSize: '13px', lineHeight: 1.6, color: '#71717A', margin: '0 0 10px' }}>
              <strong style={{ color: '#3F3F46' }}>P.S.</strong> Klappt es trotzdem nicht? Antworte auf diese Mail, ich schaue persönlich drauf.
            </Text>
            <Text style={{ fontFamily: font, fontSize: '13px', lineHeight: 1.6, color: '#71717A', margin: 0 }}>
              <strong style={{ color: '#3F3F46' }}>P.P.S.</strong> Du gehst kein Risiko ein: 30 Tage Geld-zurück-Garantie, ohne Fragen.
            </Text>
          </div>
        </div>

        <div style={{ backgroundColor: '#1A1028', padding: '24px', textAlign: 'center' as const }}>
          <Text style={{ fontFamily: font, fontSize: '12px', color: '#C27BA0', margin: '0 0 6px' }}>Lass los, was dich kaputt macht</Text>
          <Text style={{ fontFamily: font, fontSize: '11px', lineHeight: 1.6, color: '#A1A1AA', margin: 0 }}>
            Performance Marketing Solution s.r.o. · Reg. nr: 17255679<br />
            Du erhältst diese E-Mail, weil du eine Bestellung auf jetztloslassen.de begonnen hast.
          </Text>
        </div>
      </Section>
    </Base>
  )
}

LlPaymentRecoveryTemplate.PreviewProps = { firstName: 'Anna', checkoutUrl: 'https://jetztloslassen.de/checkout' }
