import { Text, Section, Hr, Link, Button } from '@react-email/components'
import * as React from 'react'
import { Base } from './base'

export const EBOOK_DELIVERY = 'ebook-delivery'

export interface EbookDeliveryTemplateProps {
  firstName: string
  downloadUrl: string
  expiresAt: string
  preview?: string
}

export const isEbookDeliveryData = (data: any): data is EbookDeliveryTemplateProps =>
  typeof data.firstName === 'string' &&
  typeof data.downloadUrl === 'string' &&
  typeof data.expiresAt === 'string'

export const EbookDeliveryTemplate: React.FC<EbookDeliveryTemplateProps> & {
  PreviewProps: EbookDeliveryTemplateProps
} = ({ firstName, downloadUrl, expiresAt, preview = 'Je e-books staan klaar!' }) => {
  const expiryDate = new Date(expiresAt).toLocaleDateString('nl-NL', {
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
          padding: '36px 40px',
          textAlign: 'center' as const,
          borderRadius: '12px 12px 0 0',
          marginBottom: '0',
        }}>
          <Text style={{
            fontFamily: "'Inter', Arial, sans-serif",
            fontSize: '12px',
            fontWeight: 500,
            letterSpacing: '3px',
            textTransform: 'uppercase' as const,
            color: '#C27BA0',
            marginBottom: '10px',
          }}>
            Laat Los Wat Je Kapotmaakt
          </Text>
          <Text style={{
            fontSize: '36px',
            marginBottom: '8px',
          }}>
            📖
          </Text>
          <Text style={{
            fontFamily: "'Inter', Arial, sans-serif",
            fontSize: '22px',
            fontWeight: 700,
            color: '#ffffff',
            margin: '0',
            lineHeight: '1.3',
          }}>
            Je e-books staan klaar!
          </Text>
        </div>

        {/* Body */}
        <div style={{ padding: '36px 20px' }}>
          <Text style={{
            fontFamily: "'Inter', Arial, sans-serif",
            fontSize: '15px',
            color: '#5A3D6B',
            lineHeight: '1.6',
            marginBottom: '8px',
          }}>
            Hoi {firstName},
          </Text>

          <Text style={{
            fontFamily: "'Inter', Arial, sans-serif",
            fontSize: '15px',
            color: '#5A3D6B',
            lineHeight: '1.6',
            marginBottom: '28px',
          }}>
            Super dat je erbij bent! Je digitale exemplaren zijn klaar om te lezen. Klik op de knop hieronder om je e-books te downloaden.
          </Text>

          {/* CTA Button */}
          <div style={{ textAlign: 'center' as const, marginBottom: '28px' }}>
            <Button
              href={downloadUrl}
              style={{
                backgroundColor: '#C27BA0',
                color: '#ffffff',
                fontFamily: "'Inter', Arial, sans-serif",
                fontSize: '16px',
                fontWeight: 600,
                textDecoration: 'none',
                padding: '14px 48px',
                borderRadius: '8px',
                display: 'inline-block',
              }}
            >
              Download je e-books →
            </Button>
          </div>

          {/* Link expiry notice */}
          <div style={{
            backgroundColor: '#FFF8E1',
            borderRadius: '8px',
            padding: '14px 20px',
            textAlign: 'center' as const,
            border: '1px solid #FFE082',
            marginBottom: '28px',
          }}>
            <Text style={{
              fontFamily: "'Inter', Arial, sans-serif",
              fontSize: '13px',
              color: '#795548',
              margin: '0',
            }}>
              ⏳ Deze download-link is geldig tot <strong>{expiryDate}</strong>. Sla de bestanden op na het downloaden.
            </Text>
          </div>

          <Hr style={{ borderColor: '#EDD9E5', margin: '4px 0' }} />

          {/* Physical book note */}
          <div style={{
            backgroundColor: '#FAF5F8',
            borderRadius: '10px',
            border: '1px solid #EDD9E5',
            padding: '20px 24px',
            textAlign: 'center' as const,
            marginTop: '24px',
            marginBottom: '24px',
          }}>
            <Text style={{
              fontFamily: "'Inter', Arial, sans-serif",
              fontSize: '14px',
              color: '#5A3D6B',
              lineHeight: '1.6',
              margin: '0',
            }}>
              📦 Je fysieke boek is onderweg en wordt binnen <strong>4–7 werkdagen</strong> bezorgd. Je ontvangt apart een track &amp; trace code.
            </Text>
          </div>

          {/* Reading tips */}
          <Text style={{
            fontFamily: "'Inter', Arial, sans-serif",
            fontSize: '11px',
            fontWeight: 600,
            textTransform: 'uppercase' as const,
            letterSpacing: '1.5px',
            color: '#9B7AAD',
            marginBottom: '16px',
          }}>
            Leestips
          </Text>

          <Text style={{
            fontFamily: "'Inter', Arial, sans-serif",
            fontSize: '14px',
            color: '#5A3D6B',
            lineHeight: '1.5',
            marginBottom: '10px',
          }}>
            ❤️ <strong style={{ color: '#2D1B3D' }}>Neem je tijd</strong> — Lees het boek op je eigen tempo. Elk hoofdstuk bouwt voort op het vorige.
          </Text>
          <Text style={{
            fontFamily: "'Inter', Arial, sans-serif",
            fontSize: '14px',
            color: '#5A3D6B',
            lineHeight: '1.5',
            marginBottom: '10px',
          }}>
            ✍️ <strong style={{ color: '#2D1B3D' }}>Maak aantekeningen</strong> — De oefeningen werken het beste als je ze echt uitvoert.
          </Text>
          <Text style={{
            fontFamily: "'Inter', Arial, sans-serif",
            fontSize: '14px',
            color: '#5A3D6B',
            lineHeight: '1.5',
            marginBottom: '20px',
          }}>
            🌱 <strong style={{ color: '#2D1B3D' }}>Wees geduldig met jezelf</strong> — Verandering kost tijd. Elke kleine stap telt.
          </Text>

          {/* Help */}
          <div style={{
            backgroundColor: '#FAF5F8',
            borderRadius: '10px',
            border: '1px solid #EDD9E5',
            padding: '20px 24px',
            textAlign: 'center' as const,
            marginBottom: '24px',
          }}>
            <Text style={{
              fontFamily: "'Inter', Arial, sans-serif",
              fontSize: '14px',
              color: '#5A3D6B',
              lineHeight: '1.6',
              margin: '0',
            }}>
              Problemen met de download? Stuur een mailtje naar{' '}
              <Link href="mailto:devries@loslatenboek.nl" style={{ color: '#C27BA0', textDecoration: 'underline' }}>
                devries@loslatenboek.nl
              </Link>
            </Text>
          </div>

          {/* Signature */}
          <Text style={{
            fontFamily: "'Inter', Arial, sans-serif",
            fontSize: '14px',
            color: '#5A3D6B',
            marginBottom: '4px',
          }}>
            Veel leesplezier!
          </Text>
          <Text style={{
            fontFamily: "'Inter', Arial, sans-serif",
            fontSize: '14px',
            fontWeight: 700,
            color: '#2D1B3D',
            marginBottom: '2px',
          }}>
            Joris de Vries
          </Text>
          <Text style={{
            fontFamily: "'Inter', Arial, sans-serif",
            fontSize: '12px',
            color: '#9B7AAD',
          }}>
            <Link href="mailto:devries@loslatenboek.nl" style={{ color: '#C27BA0', textDecoration: 'none' }}>
              devries@loslatenboek.nl
            </Link>
          </Text>
        </div>

        {/* Footer */}
        <div style={{
          backgroundColor: '#2D1B3D',
          padding: '28px 40px',
          textAlign: 'center' as const,
          borderRadius: '0 0 12px 12px',
        }}>
          <Text style={{
            fontFamily: "'Inter', Arial, sans-serif",
            fontSize: '12px',
            color: '#C27BA0',
            marginBottom: '8px',
          }}>
            Laat Los Wat Je Kapotmaakt
          </Text>
          <Text style={{
            fontFamily: "'Inter', Arial, sans-serif",
            fontSize: '11px',
            color: '#7a6189',
            lineHeight: '1.6',
            margin: '0',
          }}>
            EverChapter OÜ • Tallinn, Estonia
            <br />
            Je ontvangt deze e-mail omdat je een bestelling hebt geplaatst.
          </Text>
        </div>
      </Section>
    </Base>
  )
}

EbookDeliveryTemplate.PreviewProps = {
  firstName: 'Emma',
  downloadUrl: 'https://tijdomloslaten.nl/download/abc123-test-token',
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
} as EbookDeliveryTemplateProps

export default EbookDeliveryTemplate
