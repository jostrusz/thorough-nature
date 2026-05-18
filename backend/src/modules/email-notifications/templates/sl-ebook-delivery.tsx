import { Text, Section, Hr, Link, Button } from '@react-email/components'
import * as React from 'react'
import { Base } from './base'

export const SL_EBOOK_DELIVERY = 'sl-ebook-delivery'

export interface SlEbookDeliveryTemplateProps {
  firstName: string
  downloadUrl: string
  expiresAt: string
  billingEntity?: any
  preview?: string
}

export const isSlEbookDeliveryData = (data: any): data is SlEbookDeliveryTemplateProps =>
  typeof data.firstName === 'string' &&
  typeof data.downloadUrl === 'string' &&
  typeof data.expiresAt === 'string'

const font = "'Inter', Arial, sans-serif"
const pad = '24px'

export const SlEbookDeliveryTemplate: React.FC<SlEbookDeliveryTemplateProps> & {
  PreviewProps: SlEbookDeliveryTemplateProps
} = ({ firstName, downloadUrl, expiresAt, billingEntity, preview = 'E-bøkene dine er klare!' }) => {
  const expiryDate = new Date(expiresAt).toLocaleDateString('nb-NO', {
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
            Slipp Taket
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
            E-bøkene dine er klare!
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
            Hei {firstName},
          </Text>

          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            color: '#5A3D6B',
            lineHeight: '1.6',
            marginBottom: '24px',
          }}>
            Så fint at du er med! De digitale eksemplarene dine er klare til å leses — inkludert de 2 gratis e-bøkene dine. Klikk på knappen nedenfor for å laste ned e-bøkene.
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
              Last ned e-bøkene dine →
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
              ⏳ Denne nedlastingslenken er gyldig til <strong>{expiryDate}</strong>. Lagre filene etter at du har lastet dem ned.
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
              📦 Den fysiske boken din er på vei og leveres innen <strong>4–7 dager</strong>. Du mottar et eget sporingsnummer per e-post.
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
            Lesetips
          </Text>

          <Text style={{
            fontFamily: font,
            fontSize: '13px',
            color: '#5A3D6B',
            lineHeight: '1.5',
            marginBottom: '8px',
          }}>
            ❤️ <strong style={{ color: '#2D1B3D' }}>Ta deg god tid</strong> — Les boken i ditt eget tempo. Hvert kapittel bygger videre på det forrige.
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '13px',
            color: '#5A3D6B',
            lineHeight: '1.5',
            marginBottom: '8px',
          }}>
            ✍️ <strong style={{ color: '#2D1B3D' }}>Gjør notater</strong> — Øvelsene fungerer best når du faktisk utfører dem.
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '13px',
            color: '#5A3D6B',
            lineHeight: '1.5',
            marginBottom: '18px',
          }}>
            🌱 <strong style={{ color: '#2D1B3D' }}>Vær tålmodig med deg selv</strong> — Forandring tar tid. Hvert lille skritt teller.
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
              Problemer med nedlastingen? Send oss en e-post på{' '}
              <Link href="mailto:bok@slipptaketboken.no" style={{ color: '#C27BA0', textDecoration: 'underline' }}>
                bok@slipptaketboken.no
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
            God lesing!
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
            <Link href="mailto:bok@slipptaketboken.no" style={{ color: '#C27BA0', textDecoration: 'none' }}>
              bok@slipptaketboken.no
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
            Slipp Taket
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
              ? `${billingEntity.address.address_1 || billingEntity.address.street || ''}, ${billingEntity.address.postal_code || ''} ${billingEntity.address.city || ''}`
              : 'Rybná 716/24, 110 00 Praha, Tsjekkia'}
            {billingEntity?.registration_id && (
              <>
                <br />
                Org.nr: {billingEntity.registration_id}
              </>
            )}
            <br />
            Du mottar denne e-posten fordi du har lagt inn en bestilling på slipptaket.com.
          </Text>
        </div>
      </Section>
    </Base>
  )
}

SlEbookDeliveryTemplate.PreviewProps = {
  firstName: 'Emma',
  downloadUrl: 'https://slipptaket.com/download/abc123-test-token',
  expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
} as SlEbookDeliveryTemplateProps

export default SlEbookDeliveryTemplate
