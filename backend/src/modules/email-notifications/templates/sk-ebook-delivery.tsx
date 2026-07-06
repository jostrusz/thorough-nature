import { Text, Section, Hr, Link, Button } from '@react-email/components'
import * as React from 'react'
import { Base } from './base'

export const SK_EBOOK_DELIVERY = 'sk-ebook-delivery'

export interface SkEbookDeliveryTemplateProps {
  firstName: string
  downloadUrl: string
  expiresAt: string
  billingEntity?: any
  preview?: string
}

export const isSkEbookDeliveryData = (data: any): data is SkEbookDeliveryTemplateProps =>
  typeof data.firstName === 'string' &&
  typeof data.downloadUrl === 'string' &&
  typeof data.expiresAt === 'string'

const font = "'Inter', Arial, sans-serif"
const pad = '24px'

export const SkEbookDeliveryTemplate: React.FC<SkEbookDeliveryTemplateProps> & {
  PreviewProps: SkEbookDeliveryTemplateProps
} = ({ firstName, downloadUrl, expiresAt, billingEntity, preview = 'Tvoje e-knihy sú pripravené!' }) => {
  const expiryDate = new Date(expiresAt).toLocaleDateString('sk-SK', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <Base preview={preview}>
      <Section>
        {/* Header */}
        <div style={{
          backgroundColor: '#2D1B3D',
          background: 'linear-gradient(135deg, #2D1B3D 0%, #1A1028 100%)',
          padding: '32px 24px',
          textAlign: 'center' as const,
        }}>
          <Text style={{
            fontFamily: font,
            fontSize: '11px',
            fontWeight: 500,
            letterSpacing: '3px',
            textTransform: 'uppercase' as const,
            color: '#C27BA0',
            marginBottom: '8px',
          }}>
            Pusti to, čo ťa ničí
          </Text>
          <Text style={{
            fontSize: '32px',
            marginBottom: '6px',
          }}>
            📖
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '22px',
            fontWeight: 700,
            color: '#ffffff',
            margin: '0',
            lineHeight: '1.3',
          }}>
            Tvoje e-knihy sú pripravené!
          </Text>
        </div>

        {/* Body */}
        <div style={{ padding: `28px ${pad}` }}>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            color: '#5A3D6B',
            lineHeight: '1.6',
            marginBottom: '6px',
          }}>
            Ahoj {firstName},
          </Text>

          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            color: '#5A3D6B',
            lineHeight: '1.6',
            marginBottom: '24px',
          }}>
            Máme radosť, že si do toho išiel/išla! Tvoje digitálne výtlačky sú pripravené na čítanie. Klikni na tlačidlo nižšie a stiahni si ich.
          </Text>

          {/* CTA Button */}
          <div style={{ textAlign: 'center' as const, marginBottom: '24px' }}>
            <Button
              href={downloadUrl}
              style={{
                backgroundColor: '#C27BA0',
                color: '#ffffff',
                fontFamily: font,
                fontSize: '16px',
                fontWeight: 600,
                textDecoration: 'none',
                padding: '14px 48px',
                borderRadius: '8px',
                display: 'inline-block',
              }}
            >
              Stiahnuť e-knihy →
            </Button>
          </div>

          {/* Link expiry notice */}
          <div style={{
            backgroundColor: '#FFF8E1',
            borderRadius: '8px',
            padding: '12px 16px',
            textAlign: 'center' as const,
            border: '1px solid #FFE082',
            marginBottom: '20px',
          }}>
            <Text style={{
              fontFamily: font,
              fontSize: '13px',
              color: '#795548',
              margin: '0',
            }}>
              ⏳ Odkaz na stiahnutie je platný do <strong>{expiryDate}</strong>. Po stiahnutí si súbory ulož.
            </Text>
          </div>

          <Hr style={{ borderColor: '#EDD9E5', margin: '4px 0' }} />

          {/* Physical book note */}
          <div style={{
            backgroundColor: '#FAF5F8',
            borderRadius: '10px',
            border: '1px solid #EDD9E5',
            padding: '16px 20px',
            textAlign: 'center' as const,
            marginTop: '20px',
            marginBottom: '20px',
          }}>
            <Text style={{
              fontFamily: font,
              fontSize: '13px',
              color: '#5A3D6B',
              lineHeight: '1.6',
              margin: '0',
            }}>
              📦 Tvoja tlačená kniha je na ceste a dorazí do <strong>2–3 pracovných dní</strong>. Číslo na sledovanie zásielky ti pošleme v samostatnom e-maile.
            </Text>
          </div>

          {/* Reading tips */}
          <Text style={{
            fontFamily: font,
            fontSize: '11px',
            fontWeight: 600,
            textTransform: 'uppercase' as const,
            letterSpacing: '1.5px',
            color: '#9B7AAD',
            marginBottom: '14px',
          }}>
            Tipy na čítanie
          </Text>

          <Text style={{
            fontFamily: font,
            fontSize: '13px',
            color: '#5A3D6B',
            lineHeight: '1.5',
            marginBottom: '8px',
          }}>
            ❤️ <strong style={{ color: '#2D1B3D' }}>Nechaj si čas</strong> — Čítaj knihu vlastným tempom. Každá kapitola nadväzuje na tú predchádzajúcu.
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '13px',
            color: '#5A3D6B',
            lineHeight: '1.5',
            marginBottom: '8px',
          }}>
            ✍️ <strong style={{ color: '#2D1B3D' }}>Rob si poznámky</strong> — Cvičenia fungujú najlepšie, keď si ich naozaj prejdeš.
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '13px',
            color: '#5A3D6B',
            lineHeight: '1.5',
            marginBottom: '18px',
          }}>
            🌱 <strong style={{ color: '#2D1B3D' }}>Buď k sebe trpezlivý/á</strong> — Zmena chce čas. Každý malý krok sa počíta.
          </Text>

          {/* Help */}
          <div style={{
            backgroundColor: '#FAF5F8',
            borderRadius: '10px',
            border: '1px solid #EDD9E5',
            padding: '16px 20px',
            textAlign: 'center' as const,
            marginBottom: '20px',
          }}>
            <Text style={{
              fontFamily: font,
              fontSize: '13px',
              color: '#5A3D6B',
              lineHeight: '1.6',
              margin: '0',
            }}>
              Máš problém so stiahnutím? Napíš nám na{' '}
              <Link href="mailto:podpora@pustitocotanici.sk" style={{ color: '#C27BA0', textDecoration: 'underline' }}>
                podpora@pustitocotanici.sk
              </Link>
            </Text>
          </div>

          {/* Signature */}
          <Text style={{
            fontFamily: font,
            fontSize: '14px',
            color: '#5A3D6B',
            marginBottom: '4px',
          }}>
            Príjemné čítanie!
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '14px',
            fontWeight: 700,
            color: '#2D1B3D',
            marginBottom: '2px',
          }}>
            Joris de Vries
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '12px',
            color: '#9B7AAD',
          }}>
            <Link href="mailto:podpora@pustitocotanici.sk" style={{ color: '#C27BA0', textDecoration: 'none' }}>
              podpora@pustitocotanici.sk
            </Link>
          </Text>
        </div>

        {/* Footer */}
        <div style={{
          backgroundColor: '#2D1B3D',
          padding: '24px 24px',
          textAlign: 'center' as const,
        }}>
          <Text style={{
            fontFamily: font,
            fontSize: '12px',
            color: '#C27BA0',
            marginBottom: '6px',
          }}>
            Pusti to, čo ťa ničí
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '11px',
            color: '#7a6189',
            lineHeight: '1.6',
            margin: '0',
          }}>
            {billingEntity?.legal_name || 'Performance Marketing Solution s.r.o.'}
            {' '}&bull;{' '}
            {billingEntity?.address
              ? `${billingEntity.address.address_1 || ''}, ${billingEntity.address.postal_code || ''} ${billingEntity.address.city || ''}`
              : 'Rybná 716/24, Staré Město, 110 00 Praha'}
            {billingEntity?.registration_id && (
              <>
                <br />
                IČO: {billingEntity.registration_id}
              </>
            )}
            {!billingEntity && (
              <>
                <br />
                IČO: 06259928 &bull; DIČ: CZ06259928
              </>
            )}
            <br />
            Tento e-mail ti prišiel, pretože si si objednal/a knihu na www.pustitocotanici.sk.
          </Text>
        </div>
      </Section>
    </Base>
  )
}

SkEbookDeliveryTemplate.PreviewProps = {
  firstName: 'Petra',
  downloadUrl: 'https://www.pustitocotanici.sk/download/abc123-test-token',
  expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
} as SkEbookDeliveryTemplateProps

export default SkEbookDeliveryTemplate
