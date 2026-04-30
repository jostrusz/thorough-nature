import { Text, Section, Hr, Link, Button } from '@react-email/components'
import * as React from 'react'
import { Base } from './base'

export const HL_EBOOK_DELIVERY = 'hl-ebook-delivery'

export interface HlEbookDeliveryTemplateProps {
  firstName: string
  downloadUrl: string
  expiresAt: string
  billingEntity?: any
  preview?: string
}

export const isHlEbookDeliveryData = (data: any): data is HlEbookDeliveryTemplateProps =>
  typeof data.firstName === 'string' &&
  typeof data.downloadUrl === 'string' &&
  typeof data.expiresAt === 'string'

const font = "'Inter', Arial, sans-serif"
const pad = '24px'

const colors = {
  headerBg: '#4A1A2E',
  headerGradient: 'linear-gradient(135deg, #5A2D3E 0%, #4A1A2E 50%, #3D1E2A 100%)',
  accent: '#B85C4A',
  accentSoft: '#FFF8F3',
  textDark: '#2D1B26',
  textBody: '#5A3D40',
  textMuted: '#8A7884',
  boxBorder: '#F0DCC4',
  footerBg: '#3D1E2A',
  footerText: '#9B7889',
  footerAccent: '#C9A96E',
  divider: '#F0DCC4',
}

export const HlEbookDeliveryTemplate: React.FC<HlEbookDeliveryTemplateProps> & {
  PreviewProps: HlEbookDeliveryTemplateProps
} = ({ firstName, downloadUrl, expiresAt, billingEntity, preview = 'Je 2 gratis e-books staan klaar — download ze nu.' }) => {
  const expiryDate = new Date(expiresAt).toLocaleDateString('nl-NL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <Base preview={preview}>
      <Section>
        {/* HEADER */}
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
            color: colors.footerAccent,
            marginBottom: '8px',
          }}>
            ✦ LIFE RESET™ Methode
          </Text>
          <Text style={{
            fontSize: '32px',
            marginBottom: '6px',
          }}>
            🎁
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '22px',
            fontWeight: 700,
            color: '#ffffff',
            margin: '0',
            lineHeight: '1.3',
          }}>
            Je 2 gratis e-books staan klaar!
          </Text>
        </div>

        {/* BODY */}
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
            marginBottom: '14px',
          }}>
            Wat fijn dat je voor jezelf hebt gekozen. Je twee bonus e-books — <strong style={{ color: colors.textDark }}>Verschuif Eén Ding, Verander Alles</strong> en <strong style={{ color: colors.textDark }}>Niet Alles Verdient Een Plek</strong> — staan klaar. Klik op de knop hieronder om ze meteen te downloaden.
          </Text>

          <Text style={{
            fontFamily: font,
            fontSize: '14px',
            color: colors.textBody,
            lineHeight: '1.6',
            marginBottom: '24px',
            fontStyle: 'italic' as const,
          }}>
            Begin er gerust al mee. Het fysieke boek volgt over een paar dagen — maar deze twee kun je vandaag al openslaan.
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
              Download mijn e-books →
            </Button>
          </div>

          {/* Expiry notice */}
          <div style={{
            backgroundColor: '#FFF8E1',
            borderRadius: '8px',
            padding: '12px 16px',
            textAlign: 'center' as const,
            border: '1px solid #FFE082',
            marginBottom: '24px',
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

          <Hr style={{ borderColor: colors.divider, margin: '4px 0' }} />

          {/* Physical book note */}
          <div style={{
            backgroundColor: colors.accentSoft,
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
              📦 Je fysieke boek <strong>Het Leven Dat Je Verdient</strong> is onderweg en wordt binnen <strong>3–5 werkdagen</strong> bezorgd via GLS. Je krijgt apart een track &amp; trace code.
            </Text>
          </div>

          {/* Reading tips */}
          <Text style={{
            fontFamily: font,
            fontSize: '11px',
            fontWeight: 600,
            textTransform: 'uppercase' as const,
            letterSpacing: '1.5px',
            color: colors.textMuted,
            marginBottom: '14px',
          }}>
            Hoe je begint
          </Text>

          <Text style={{
            fontFamily: font,
            fontSize: '13px',
            color: colors.textBody,
            lineHeight: '1.5',
            marginBottom: '8px',
          }}>
            🪑 <strong style={{ color: colors.textDark }}>Begin met Feng Shui</strong> — Verschuif Eén Ding, Verander Alles. Een kwartiertje en je weet wat er thuis anders moet.
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '13px',
            color: colors.textBody,
            lineHeight: '1.5',
            marginBottom: '8px',
          }}>
            🧹 <strong style={{ color: colors.textDark }}>Daarna Niet Alles Verdient Een Plek</strong> — opruimen als daad van zelfliefde. Met het 4-dozen-systeem beslis je in 30 seconden per voorwerp.
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '13px',
            color: colors.textBody,
            lineHeight: '1.5',
            marginBottom: '18px',
          }}>
            🌿 <strong style={{ color: colors.textDark }}>Wees mild voor jezelf</strong> — eén la, één keer per dag. Acht minuten. Meer hoeft het niet te zijn.
          </Text>

          {/* Help */}
          <div style={{
            backgroundColor: colors.accentSoft,
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
              Problemen met de download? Stuur me even een mailtje naar{' '}
              <Link href="mailto:annadevries@pakjeleventerug.nl" style={{ color: colors.accent, textDecoration: 'underline' }}>
                annadevries@pakjeleventerug.nl
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
            Veel leesplezier!
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '14px',
            fontWeight: 700,
            color: colors.textDark,
            marginBottom: '2px',
          }}>
            Anna de Vries
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '12px',
            color: colors.textMuted,
          }}>
            <Link href="mailto:annadevries@pakjeleventerug.nl" style={{ color: colors.accent, textDecoration: 'none' }}>
              annadevries@pakjeleventerug.nl
            </Link>
          </Text>
        </div>

        {/* FOOTER */}
        <div style={{
          backgroundColor: colors.footerBg,
          padding: '24px 24px',
          textAlign: 'center' as const,
        }}>
          <Text style={{
            fontFamily: font,
            fontSize: '12px',
            color: colors.footerAccent,
            marginBottom: '6px',
          }}>
            Het Leven Dat Je Verdient &bull; LIFE RESET™ Methode
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '11px',
            color: colors.footerText,
            lineHeight: '1.6',
            margin: '0',
          }}>
            {billingEntity?.legal_name || 'Performance Marketing Solution s.r.o.'}
            {' '}&bull;{' '}
            {billingEntity?.address
              ? `${billingEntity.address.address_1 || ''}, ${billingEntity.address.postal_code || ''} ${billingEntity.address.city || ''}`
              : 'Rybná 716/24, 110 00 Staré Město, Praha, CZ'}
            <br />
            IČ: {billingEntity?.registration_id || '06259928'}
            {(billingEntity?.vat_id || !billingEntity) && (
              <>
                {' '}&bull;{' '}
                DIČ: {billingEntity?.vat_id || 'CZ06259928'}
              </>
            )}
            <br />
            Je ontvangt deze e-mail omdat je een bestelling hebt geplaatst op pakjeleventerug.nl.
          </Text>
        </div>
      </Section>
    </Base>
  )
}

HlEbookDeliveryTemplate.PreviewProps = {
  firstName: 'Sophie',
  downloadUrl: 'https://www.pakjeleventerug.nl/download/abc123-test-token',
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
} as HlEbookDeliveryTemplateProps

export default HlEbookDeliveryTemplate
