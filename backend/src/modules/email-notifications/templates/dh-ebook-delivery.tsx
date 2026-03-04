import { Text, Section, Hr, Link, Button } from '@react-email/components'
import * as React from 'react'
import { Base } from './base'

export const DH_EBOOK_DELIVERY = 'dh-ebook-delivery'

export interface DhEbookDeliveryTemplateProps {
  firstName: string
  downloadUrl: string
  expiresAt: string
  billingEntity?: any
  preview?: string
}

export const isDhEbookDeliveryData = (data: any): data is DhEbookDeliveryTemplateProps =>
  typeof data.firstName === 'string' &&
  typeof data.downloadUrl === 'string' &&
  typeof data.expiresAt === 'string'

const font = "'Inter', Arial, sans-serif"
const pad = '24px'

// DH Brand colors
const colors = {
  headerBg: '#4C1D95',
  headerGradient: 'linear-gradient(135deg, #4C1D95 0%, #2E1065 100%)',
  accent: '#7C3AED',
  accentLight: '#A78BFA',
  accentMuted: '#8B5CF6',
  textDark: '#1F2937',
  textBody: '#374151',
  textMuted: '#6B7280',
  boxBg: '#FAF5FF',
  boxBorder: '#E9D5FF',
  footerBg: '#1E1B4B',
  amberLight: '#FEF3C7',
  amberBorder: '#FDE68A',
}

export const DhEbookDeliveryTemplate: React.FC<DhEbookDeliveryTemplateProps> & {
  PreviewProps: DhEbookDeliveryTemplateProps
} = ({ firstName, downloadUrl, expiresAt, billingEntity, preview = 'Je e-book staat klaar!' }) => {
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
          backgroundColor: colors.headerBg,
          background: colors.headerGradient,
          padding: '32px 24px',
          textAlign: 'center' as const,
        }}>
          <Text style={{
            fontFamily: font,
            fontSize: '11px',
            fontWeight: 500,
            letterSpacing: '3px',
            textTransform: 'uppercase' as const,
            color: colors.accentLight,
            marginBottom: '8px',
          }}>
            De Hondenbijbel
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
            Je e-book staat klaar!
          </Text>
        </div>

        {/* Body */}
        <div style={{ padding: `28px ${pad}` }}>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            color: colors.textBody,
            lineHeight: '1.6',
            marginBottom: '6px',
          }}>
            Hoi {firstName},
          </Text>

          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            color: colors.textBody,
            lineHeight: '1.6',
            marginBottom: '24px',
          }}>
            Geweldig dat je De Hondenbijbel hebt aangeschaft! Je digitale exemplaar is klaar om te lezen. Klik op de knop hieronder om je e-book te downloaden.
          </Text>

          {/* CTA Button */}
          <div style={{ textAlign: 'center' as const, marginBottom: '24px' }}>
            <Button
              href={downloadUrl}
              style={{
                backgroundColor: colors.accent,
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
              Download je e-book →
            </Button>
          </div>

          {/* Link expiry notice */}
          <div style={{
            backgroundColor: colors.amberLight,
            borderRadius: '8px',
            padding: '12px 16px',
            textAlign: 'center' as const,
            border: `1px solid ${colors.amberBorder}`,
            marginBottom: '24px',
          }}>
            <Text style={{
              fontFamily: font,
              fontSize: '13px',
              color: '#795548',
              margin: '0',
            }}>
              ⏳ Deze download-link is geldig tot <strong>{expiryDate}</strong>. Sla het bestand op na het downloaden.
            </Text>
          </div>

          <Hr style={{ borderColor: colors.boxBorder, margin: '4px 0' }} />

          {/* Physical book note */}
          <div style={{
            backgroundColor: colors.boxBg,
            borderRadius: '10px',
            border: `1px solid ${colors.boxBorder}`,
            padding: '16px 20px',
            textAlign: 'center' as const,
            marginTop: '20px',
            marginBottom: '20px',
          }}>
            <Text style={{
              fontFamily: font,
              fontSize: '13px',
              color: colors.textBody,
              lineHeight: '1.6',
              margin: '0',
            }}>
              📦 Je fysieke boek is onderweg en wordt binnen <strong>4–7 werkdagen</strong> bezorgd. Je ontvangt apart een track &amp; trace code.
            </Text>
          </div>

          {/* Training tips */}
          <Text style={{
            fontFamily: font,
            fontSize: '11px',
            fontWeight: 600,
            textTransform: 'uppercase' as const,
            letterSpacing: '1.5px',
            color: colors.accentMuted,
            marginBottom: '14px',
          }}>
            Trainingstips
          </Text>

          <Text style={{
            fontFamily: font,
            fontSize: '13px',
            color: colors.textBody,
            lineHeight: '1.5',
            marginBottom: '8px',
          }}>
            🐕 <strong style={{ color: colors.textDark }}>Begin rustig</strong> — Start met korte trainingssessies van 5–10 minuten. Honden leren het best in kleine stapjes.
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '13px',
            color: colors.textBody,
            lineHeight: '1.5',
            marginBottom: '8px',
          }}>
            🦴 <strong style={{ color: colors.textDark }}>Wees consistent</strong> — Gebruik altijd dezelfde commando's en beloon gewenst gedrag direct.
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '13px',
            color: colors.textBody,
            lineHeight: '1.5',
            marginBottom: '18px',
          }}>
            ❤️ <strong style={{ color: colors.textDark }}>Geduld is alles</strong> — Elke hond leert in zijn eigen tempo. Vier de kleine overwinningen!
          </Text>

          {/* Help */}
          <div style={{
            backgroundColor: colors.boxBg,
            borderRadius: '10px',
            border: `1px solid ${colors.boxBorder}`,
            padding: '16px 20px',
            textAlign: 'center' as const,
            marginBottom: '20px',
          }}>
            <Text style={{
              fontFamily: font,
              fontSize: '13px',
              color: colors.textBody,
              lineHeight: '1.6',
              margin: '0',
            }}>
              Problemen met de download? Stuur een mailtje naar{' '}
              <Link href="mailto:support@dehondenbijbel.nl" style={{ color: colors.accent, textDecoration: 'underline' }}>
                support@dehondenbijbel.nl
              </Link>
            </Text>
          </div>

          {/* Signature */}
          <Text style={{
            fontFamily: font,
            fontSize: '14px',
            color: colors.textBody,
            marginBottom: '4px',
          }}>
            Veel succes met de training!
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '14px',
            fontWeight: 700,
            color: colors.textDark,
            marginBottom: '2px',
          }}>
            Lars Vermeulen
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '12px',
            color: colors.textMuted,
          }}>
            <Link href="mailto:support@dehondenbijbel.nl" style={{ color: colors.accent, textDecoration: 'none' }}>
              support@dehondenbijbel.nl
            </Link>
          </Text>
        </div>

        {/* Footer */}
        <div style={{
          backgroundColor: colors.footerBg,
          padding: '24px 24px',
          textAlign: 'center' as const,
        }}>
          <Text style={{
            fontFamily: font,
            fontSize: '12px',
            color: colors.accentLight,
            marginBottom: '6px',
          }}>
            De Hondenbijbel
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '11px',
            color: '#6366F1',
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
            Je ontvangt deze e-mail omdat je een bestelling hebt geplaatst bij dehondenbijbel.nl.
          </Text>
        </div>
      </Section>
    </Base>
  )
}

DhEbookDeliveryTemplate.PreviewProps = {
  firstName: 'Jan',
  downloadUrl: 'https://dehondenbijbel.nl/download/abc123-test-token',
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
} as DhEbookDeliveryTemplateProps

export default DhEbookDeliveryTemplate
