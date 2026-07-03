import { Text, Section, Hr, Link, Button } from '@react-email/components'
import * as React from 'react'
import { Base } from './base'

export const ENG_EBOOK_DELIVERY = 'eng-ebook-delivery'

export interface EngEbookDeliveryTemplateProps {
  firstName: string
  downloadUrl: string
  expiresAt: string
  billingEntity?: any
  preview?: string
}

export const isEngEbookDeliveryData = (data: any): data is EngEbookDeliveryTemplateProps =>
  typeof data.firstName === 'string' &&
  typeof data.downloadUrl === 'string' &&
  typeof data.expiresAt === 'string'

const font = "'Inter', Arial, sans-serif"
const pad = '24px'

export const EngEbookDeliveryTemplate: React.FC<EngEbookDeliveryTemplateProps> & {
  PreviewProps: EngEbookDeliveryTemplateProps
} = ({ firstName, downloadUrl, expiresAt, billingEntity, preview = 'Az e-könyveid készen állnak!' }) => {
  const expiryDate = new Date(expiresAt).toLocaleDateString('hu-HU', {
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
            Engedd el, ami tönkretesz
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
            Az e-könyveid készen állnak!
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
            Szia {firstName}!
          </Text>

          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            color: '#5A3D6B',
            lineHeight: '1.6',
            marginBottom: '24px',
          }}>
            Örülünk, hogy belevágtál! A digitális példányaid készen állnak az olvasásra. Kattints az alábbi gombra, és töltsd le őket.
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
              E-könyvek letöltése →
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
              ⏳ A letöltési link <strong>{expiryDate}</strong>-ig érvényes. Letöltés után mentsd el a fájlokat.
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
              📦 A nyomtatott könyved úton van, és <strong>2–3 munkanapon</strong> belül megérkezik. A csomag nyomon követési számát külön e-mailben küldjük el.
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
            Tippek az olvasáshoz
          </Text>

          <Text style={{
            fontFamily: font,
            fontSize: '13px',
            color: '#5A3D6B',
            lineHeight: '1.5',
            marginBottom: '8px',
          }}>
            ❤️ <strong style={{ color: '#2D1B3D' }}>Szánj rá időt</strong> — Olvasd a könyvet a saját tempódban. Minden fejezet az előzőre épül.
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '13px',
            color: '#5A3D6B',
            lineHeight: '1.5',
            marginBottom: '8px',
          }}>
            ✍️ <strong style={{ color: '#2D1B3D' }}>Jegyzetelj</strong> — A gyakorlatok akkor működnek a legjobban, ha valóban végigcsinálod őket.
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '13px',
            color: '#5A3D6B',
            lineHeight: '1.5',
            marginBottom: '18px',
          }}>
            🌱 <strong style={{ color: '#2D1B3D' }}>Légy türelmes önmagaddal</strong> — A változás időt igényel. Minden apró lépés számít.
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
              Problémád van a letöltéssel? Írj nekünk a{' '}
              <Link href="mailto:info@engeddelkonyv.hu" style={{ color: '#C27BA0', textDecoration: 'underline' }}>
                info@engeddelkonyv.hu
              </Link>
              {' '}címre.
            </Text>
          </div>

          {/* Signature */}
          <Text style={{
            fontFamily: font,
            fontSize: '14px',
            color: '#5A3D6B',
            marginBottom: '4px',
          }}>
            Kellemes olvasást!
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
            <Link href="mailto:info@engeddelkonyv.hu" style={{ color: '#C27BA0', textDecoration: 'none' }}>
              info@engeddelkonyv.hu
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
            Engedd el, ami tönkretesz
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
            Ezt az e-mailt azért kaptad, mert könyvet rendeltél a www.engeddelkonyv.hu oldalon.
          </Text>
        </div>
      </Section>
    </Base>
  )
}

EngEbookDeliveryTemplate.PreviewProps = {
  firstName: 'Anna',
  downloadUrl: 'https://www.engeddelkonyv.hu/download/abc123-test-token',
  expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
} as EngEbookDeliveryTemplateProps

export default EngEbookDeliveryTemplate
