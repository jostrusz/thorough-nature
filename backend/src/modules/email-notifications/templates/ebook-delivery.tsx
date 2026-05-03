import { Text, Section, Hr, Link, Button, Img } from '@react-email/components'
import * as React from 'react'
import { Base } from './base'

export const EBOOK_DELIVERY = 'ebook-delivery'

export interface EbookDeliveryTemplateProps {
  firstName: string
  downloadUrl: string
  expiresAt: string
  billingEntity?: any
  preview?: string
}

export const isEbookDeliveryData = (data: any): data is EbookDeliveryTemplateProps =>
  typeof data.firstName === 'string' &&
  typeof data.downloadUrl === 'string' &&
  typeof data.expiresAt === 'string'

const font = "'Inter', Arial, sans-serif"
const pad = '24px'

export const EbookDeliveryTemplate: React.FC<EbookDeliveryTemplateProps> & {
  PreviewProps: EbookDeliveryTemplateProps
} = ({ firstName, downloadUrl, expiresAt, billingEntity, preview = 'Je e-books staan klaar!' }) => {
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
            Laat Los Wat Je Kapotmaakt
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
            Je e-books staan klaar!
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
            Hoi {firstName},
          </Text>

          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            color: '#5A3D6B',
            lineHeight: '1.6',
            marginBottom: '24px',
          }}>
            Super dat je erbij bent! Je digitale exemplaren zijn klaar om te lezen. Klik op de knop hieronder om je e-books te downloaden.
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
              Download je e-books →
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
              ⏳ Deze download-link is geldig tot <strong>{expiryDate}</strong>. Sla de bestanden op na het downloaden.
            </Text>
          </div>

          {/* CROSS-SELL: Het Leven Dat Je Verdient */}
          <Text style={{
            fontFamily: font,
            fontSize: '11px',
            fontWeight: 600,
            textTransform: 'uppercase' as const,
            letterSpacing: '1.5px',
            color: '#9B7AAD',
            marginBottom: '12px',
            textAlign: 'center' as const,
          }}>
            ✦ De volgende stap voor jou
          </Text>

          <Link
            href="https://www.pakjeleventerug.nl"
            style={{ textDecoration: 'none', display: 'block', marginBottom: '24px' }}
          >
            <table role="presentation" cellPadding={0} cellSpacing={0} border={0} width="100%" style={{
              backgroundColor: '#FAF5F8',
              borderRadius: '12px',
              border: '1px solid #EDD9E5',
              borderCollapse: 'separate' as const,
            }}>
              <tbody>
                <tr>
                  <td width="110" style={{ padding: '16px 0 16px 16px', verticalAlign: 'middle' as const }}>
                    <Img
                      src="https://www.pakjeleventerug.nl/het-leven-dat-je-verdient-380w.webp"
                      alt="Het Leven Dat Je Verdient"
                      width="94"
                      style={{ display: 'block', borderRadius: '6px', maxWidth: '94px' }}
                    />
                  </td>
                  <td style={{ padding: '16px 18px 16px 14px', verticalAlign: 'middle' as const }}>
                    <Text style={{
                      fontFamily: font,
                      fontSize: '15px',
                      fontWeight: 700,
                      color: '#2D1B3D',
                      margin: '0 0 4px',
                      lineHeight: '1.3',
                    }}>
                      Het Leven Dat Je Verdient
                    </Text>
                    <Text style={{
                      fontFamily: font,
                      fontSize: '12px',
                      color: '#5A3D6B',
                      margin: '0 0 8px',
                      lineHeight: '1.5',
                    }}>
                      Loslaten was de eerste stap. Nu is het tijd om je leven terug te pakken — met de LIFE RESET™ methode in 5 pijlers.
                    </Text>
                    <Text style={{
                      fontFamily: font,
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#C27BA0',
                      margin: '0',
                    }}>
                      Ontdek het boek →
                    </Text>
                  </td>
                </tr>
              </tbody>
            </table>
          </Link>

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
              📦 Je fysieke boek is onderweg en wordt binnen <strong>4–7 werkdagen</strong> bezorgd. Je ontvangt apart een track &amp; trace code.
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
            Leestips
          </Text>

          <Text style={{
            fontFamily: font,
            fontSize: '13px',
            color: '#5A3D6B',
            lineHeight: '1.5',
            marginBottom: '8px',
          }}>
            ❤️ <strong style={{ color: '#2D1B3D' }}>Neem je tijd</strong> — Lees het boek op je eigen tempo. Elk hoofdstuk bouwt voort op het vorige.
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '13px',
            color: '#5A3D6B',
            lineHeight: '1.5',
            marginBottom: '8px',
          }}>
            ✍️ <strong style={{ color: '#2D1B3D' }}>Maak aantekeningen</strong> — De oefeningen werken het beste als je ze echt uitvoert.
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '13px',
            color: '#5A3D6B',
            lineHeight: '1.5',
            marginBottom: '18px',
          }}>
            🌱 <strong style={{ color: '#2D1B3D' }}>Wees geduldig met jezelf</strong> — Verandering kost tijd. Elke kleine stap telt.
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
              Problemen met de download? Stuur een mailtje naar{' '}
              <Link href="mailto:devries@loslatenboek.nl" style={{ color: '#C27BA0', textDecoration: 'underline' }}>
                devries@loslatenboek.nl
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
            Veel leesplezier!
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
            <Link href="mailto:devries@loslatenboek.nl" style={{ color: '#C27BA0', textDecoration: 'none' }}>
              devries@loslatenboek.nl
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
            Laat Los Wat Je Kapotmaakt
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '11px',
            color: '#7a6189',
            lineHeight: '1.6',
            margin: '0',
          }}>
            {billingEntity?.legal_name || 'EverChapter OÜ'}
            {' '}&bull;{' '}
            {billingEntity?.address
              ? `${billingEntity.address.address_1 || ''}, ${billingEntity.address.postal_code || ''} ${billingEntity.address.city || ''}`
              : 'Tallinn, Estonia'}
            {billingEntity?.registration_id && (
              <>
                <br />
                Reg. nr: {billingEntity.registration_id}
              </>
            )}
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
