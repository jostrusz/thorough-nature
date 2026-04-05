import { Text, Section, Hr, Link, Button } from '@react-email/components'
import * as React from 'react'
import { Base } from './base'

export const ST_EBOOK_DELIVERY = 'st-ebook-delivery'

export interface StEbookDeliveryTemplateProps {
  firstName: string
  downloadUrl: string
  expiresAt: string
  billingEntity?: any
  preview?: string
}

export const isStEbookDeliveryData = (data: any): data is StEbookDeliveryTemplateProps =>
  typeof data.firstName === 'string' &&
  typeof data.downloadUrl === 'string' &&
  typeof data.expiresAt === 'string'

const font = "'Inter', 'Segoe UI', Arial, sans-serif"
const pad = '28px'

// ST Brand colors — deep purple/mauve palette
const colors = {
  headerBg: '#2D1B3D',
  headerGradient: 'linear-gradient(135deg, #5A3D6B 0%, #2D1B3D 50%, #1A1028 100%)',
  accent: '#C27BA0',
  accentLight: '#D498B5',
  accentSoft: '#FAF5F8',
  accentMuted: '#D9A4C0',
  textDark: '#1A1028',
  textBody: '#3F3F46',
  textMuted: '#71717A',
  textLight: '#A1A1AA',
  boxBg: '#FAFAFA',
  boxBorder: '#EDD9E5',
  footerBg: '#1A1028',
  footerText: '#A1A1AA',
  footerAccent: '#C27BA0',
  greenBg: '#F0FDF4',
  greenBorder: '#BBF7D0',
  greenText: '#166534',
  amberBg: '#FFFBEB',
  amberBorder: '#FDE68A',
  amberText: '#92400E',
  divider: '#EDD9E5',
}

export const StEbookDeliveryTemplate: React.FC<StEbookDeliveryTemplateProps> & {
  PreviewProps: StEbookDeliveryTemplateProps
} = ({ firstName, downloadUrl, expiresAt, billingEntity, preview = 'Din e-bok är redo!' }) => {
  const expiryDate = new Date(expiresAt).toLocaleDateString('sv-SE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const entityName = billingEntity?.legal_name || 'Performance Marketing Solution s.r.o.'
  const entityAddress = billingEntity?.address
    ? `${billingEntity.address.street || 'Rybná 716/24'}, ${billingEntity.address.city || 'Prag'}, ${billingEntity.address.postal_code || '110 00'}, ${billingEntity.address.district || 'Tjeckien'}`
    : 'Rybná 716/24, Prag, 110 00, Tjeckien'
  const entityRegId = billingEntity?.registration_id || '06259928'
  const entityVatId = billingEntity?.vat_id || 'CZ06259928'

  return (
    <Base preview={preview}>
      <Section>
        {/* ====== HEADER ====== */}
        <div style={{
          backgroundColor: colors.headerBg,
          background: colors.headerGradient,
          padding: '40px 28px 36px',
          textAlign: 'center' as const,
        }}>
          <Text style={{
            fontFamily: font,
            fontSize: '11px',
            fontWeight: 600,
            letterSpacing: '3px',
            textTransform: 'uppercase' as const,
            color: 'rgba(255,255,255,0.75)',
            margin: '0 0 10px 0',
          }}>
            Släpp Taget
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '26px',
            fontWeight: 800,
            color: '#ffffff',
            margin: '0 0 4px 0',
            lineHeight: '1.2',
            letterSpacing: '-0.02em',
          }}>
            Din e-bok är redo!
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '13px',
            color: 'rgba(255,255,255,0.7)',
            margin: '0',
          }}>
            Ladda ner ditt digitala exemplar
          </Text>
        </div>

        {/* ====== GREETING ====== */}
        <div style={{ padding: `28px ${pad} 0` }}>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            color: colors.textBody,
            lineHeight: '1.7',
            margin: '0',
          }}>
            Hej {firstName},
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            color: colors.textBody,
            lineHeight: '1.7',
            margin: '8px 0 0',
          }}>
            Vad kul att du har köpt Släpp Taget! Din digitala kopia är redo att läsas. Klicka på knappen nedan för att ladda ner din e-bok.
          </Text>
        </div>

        {/* ====== CTA BUTTON ====== */}
        <div style={{ padding: `24px ${pad} 0`, textAlign: 'center' as const }}>
          <Button
            href={downloadUrl}
            style={{
              backgroundColor: colors.accent,
              color: '#ffffff',
              fontFamily: font,
              fontSize: '16px',
              fontWeight: 700,
              textDecoration: 'none',
              padding: '14px 48px',
              borderRadius: '10px',
              display: 'inline-block',
            }}
          >
            Ladda ner din e-bok &#8594;
          </Button>
        </div>

        {/* ====== LINK EXPIRY NOTICE ====== */}
        <div style={{ padding: `16px ${pad} 0` }}>
          <div style={{
            backgroundColor: colors.amberBg,
            borderRadius: '12px',
            padding: '14px 18px',
            textAlign: 'center' as const,
            border: `1px solid ${colors.amberBorder}`,
          }}>
            <Text style={{
              fontFamily: font,
              fontSize: '13px',
              color: colors.amberText,
              margin: '0',
              lineHeight: '1.6',
            }}>
              &#9203; Nedladdningslänken är giltig till <strong>{expiryDate}</strong>. Spara filen efter nedladdning.
            </Text>
          </div>
        </div>

        <Hr style={{ borderColor: colors.divider, margin: `20px ${pad}` }} />

        {/* ====== PHYSICAL BOOK NOTE ====== */}
        <div style={{ padding: `0 ${pad}` }}>
          <div style={{
            backgroundColor: colors.boxBg,
            borderRadius: '12px',
            border: `1px solid ${colors.boxBorder}`,
            padding: '16px 20px',
            textAlign: 'center' as const,
          }}>
            <Text style={{
              fontFamily: font,
              fontSize: '14px',
              color: colors.textBody,
              lineHeight: '1.6',
              margin: '0',
            }}>
              &#128230; Din fysiska bok är på väg och levereras inom <strong>2–4 arbetsdagar</strong>. Du får ett separat spårningsnummer via e-post.
            </Text>
          </div>
        </div>

        {/* ====== READING TIPS ====== */}
        <div style={{ padding: `24px ${pad} 0` }}>
          <Text style={{
            fontFamily: font,
            fontSize: '12px',
            fontWeight: 700,
            textTransform: 'uppercase' as const,
            letterSpacing: '1px',
            color: colors.accent,
            marginBottom: '16px',
          }}>
            Lästips
          </Text>

          <div style={{
            backgroundColor: colors.accentSoft,
            borderRadius: '12px',
            border: `1px solid ${colors.boxBorder}`,
            padding: '18px 20px',
            marginBottom: '10px',
          }}>
            <Text style={{
              fontFamily: font,
              fontSize: '14px',
              color: colors.textBody,
              lineHeight: '1.6',
              margin: '0 0 12px',
            }}>
              &#128218; <strong style={{ color: colors.textDark }}>Börja lugnt</strong> — Läs ett kapitel i taget och ge dig själv tid att reflektera.
            </Text>
            <Text style={{
              fontFamily: font,
              fontSize: '14px',
              color: colors.textBody,
              lineHeight: '1.6',
              margin: '0 0 12px',
            }}>
              &#9997;&#65039; <strong style={{ color: colors.textDark }}>Skriv ner dina tankar</strong> — Ha en anteckningsbok bredvid dig för insikter och reflektioner.
            </Text>
            <Text style={{
              fontFamily: font,
              fontSize: '14px',
              color: colors.textBody,
              lineHeight: '1.6',
              margin: '0',
            }}>
              &#10084;&#65039; <strong style={{ color: colors.textDark }}>Var snäll mot dig själv</strong> — Förändring tar tid. Fira varje litet steg framåt!
            </Text>
          </div>
        </div>

        {/* ====== HELP SECTION ====== */}
        <div style={{ padding: `20px ${pad} 0` }}>
          <div style={{
            backgroundColor: colors.boxBg,
            borderRadius: '12px',
            border: `1px solid ${colors.boxBorder}`,
            padding: '16px 20px',
            textAlign: 'center' as const,
          }}>
            <Text style={{
              fontFamily: font,
              fontSize: '14px',
              color: colors.textBody,
              lineHeight: '1.6',
              margin: '0',
            }}>
              Problem med nedladdningen?
              <br />
              <Link href="mailto:hej@slapptagetboken.se" style={{ color: colors.accent, textDecoration: 'underline', fontWeight: 700 }}>
                hej@slapptagetboken.se
              </Link>
            </Text>
          </div>
        </div>

        {/* ====== SIGNATURE ====== */}
        <div style={{ padding: `24px ${pad} 28px` }}>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            color: colors.textBody,
            margin: '0 0 4px',
          }}>
            Lycka till med läsningen!
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            fontWeight: 700,
            color: colors.textDark,
            margin: '0 0 2px',
          }}>
            Joris de Vries
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '13px',
            color: colors.textMuted,
            margin: '0',
          }}>
            <Link href="mailto:hej@slapptagetboken.se" style={{ color: colors.accent, textDecoration: 'none' }}>
              hej@slapptagetboken.se
            </Link>
          </Text>
        </div>

        {/* ====== FOOTER ====== */}
        <div style={{
          backgroundColor: colors.footerBg,
          padding: '28px 28px',
          textAlign: 'center' as const,
        }}>
          <Text style={{
            fontFamily: font,
            fontSize: '13px',
            fontWeight: 700,
            color: colors.footerAccent,
            margin: '0 0 8px',
            letterSpacing: '0.5px',
          }}>
            Släpp Taget
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '11px',
            color: colors.footerText,
            lineHeight: '1.7',
            margin: '0 0 8px',
          }}>
            {entityName}
            <br />
            {entityAddress}
            <br />
            Org.nr: {entityRegId} &bull; Momsnr: {entityVatId}
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '11px',
            color: '#71717A',
            lineHeight: '1.5',
            margin: '0',
          }}>
            Du får detta e-postmeddelande för att du har lagt en beställning på slapptagetboken.se.
          </Text>
        </div>
      </Section>
    </Base>
  )
}

StEbookDeliveryTemplate.PreviewProps = {
  firstName: 'Anna',
  downloadUrl: 'https://www.slapptagetboken.se/download/abc123-test-token',
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  billingEntity: {
    legal_name: 'Performance Marketing Solution s.r.o.',
    registration_id: '06259928',
    vat_id: 'CZ06259928',
    address: { street: 'Rybná 716/24', city: 'Prag', postal_code: '110 00', district: 'Tjeckien' },
  },
} as StEbookDeliveryTemplateProps

export default StEbookDeliveryTemplate
