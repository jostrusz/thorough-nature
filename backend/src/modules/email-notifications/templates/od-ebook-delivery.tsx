import { Text, Section, Hr, Link, Button } from '@react-email/components'
import * as React from 'react'
import { Base } from './base'

export const OD_EBOOK_DELIVERY = 'od-ebook-delivery'

export interface OdEbookDeliveryTemplateProps {
  firstName: string
  downloadUrl: string
  expiresAt: string
  billingEntity?: any
  preview?: string
}

export const isOdEbookDeliveryData = (data: any): data is OdEbookDeliveryTemplateProps =>
  typeof data.firstName === 'string' &&
  typeof data.downloadUrl === 'string' &&
  typeof data.expiresAt === 'string'

const font = "'Inter', Arial, sans-serif"
const pad = '24px'

export const OdEbookDeliveryTemplate: React.FC<OdEbookDeliveryTemplateProps> & {
  PreviewProps: OdEbookDeliveryTemplateProps
} = ({ firstName, downloadUrl, expiresAt, billingEntity, preview = 'Tvoje e-booky jsou připravené!' }) => {
  const expiryDate = new Date(expiresAt).toLocaleDateString('cs-CZ', {
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
            Pusť to, co tě ničí
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
            Tvoje e-booky jsou připravené!
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
            Máme radost, že jsi do toho šel/šla! Tvoje digitální výtisky jsou připravené ke čtení. Klikni na tlačítko níže a stáhni si je.
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
              Stáhnout e-booky →
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
              ⏳ Odkaz ke stažení je platný do <strong>{expiryDate}</strong>. Po stažení si soubory ulož.
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
              📦 Tvoje tištěná kniha je na cestě a dorazí během <strong>2–3 pracovních dnů</strong>. Číslo pro sledování zásilky ti pošleme v samostatném e-mailu.
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
            Tipy pro čtení
          </Text>

          <Text style={{
            fontFamily: font,
            fontSize: '13px',
            color: '#5A3D6B',
            lineHeight: '1.5',
            marginBottom: '8px',
          }}>
            ❤️ <strong style={{ color: '#2D1B3D' }}>Dej si načas</strong> — Čti knihu vlastním tempem. Každá kapitola navazuje na tu předchozí.
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '13px',
            color: '#5A3D6B',
            lineHeight: '1.5',
            marginBottom: '8px',
          }}>
            ✍️ <strong style={{ color: '#2D1B3D' }}>Dělej si poznámky</strong> — Cvičení fungují nejlépe, když si je opravdu projdeš.
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '13px',
            color: '#5A3D6B',
            lineHeight: '1.5',
            marginBottom: '18px',
          }}>
            🌱 <strong style={{ color: '#2D1B3D' }}>Buď k sobě trpělivý/á</strong> — Změna chce čas. Každý malý krok se počítá.
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
              Máš problém se stažením? Napiš nám na{' '}
              <Link href="mailto:podpora@pusttocotenici.cz" style={{ color: '#C27BA0', textDecoration: 'underline' }}>
                podpora@pusttocotenici.cz
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
            Příjemné čtení!
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
            <Link href="mailto:podpora@pusttocotenici.cz" style={{ color: '#C27BA0', textDecoration: 'none' }}>
              podpora@pusttocotenici.cz
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
            Pusť to, co tě ničí
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
            Tento e-mail ti přišel, protože sis objednal/a knihu na www.pusttocotenici.cz.
          </Text>
        </div>
      </Section>
    </Base>
  )
}

OdEbookDeliveryTemplate.PreviewProps = {
  firstName: 'Petra',
  downloadUrl: 'https://www.pusttocotenici.cz/download/abc123-test-token',
  expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
} as OdEbookDeliveryTemplateProps

export default OdEbookDeliveryTemplate
