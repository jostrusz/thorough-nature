import { Text, Section, Hr, Link, Button } from '@react-email/components'
import * as React from 'react'
import { Base } from './base'

export const MB_EBOOK_DELIVERY = 'mb-ebook-delivery'

export interface MbEbookDeliveryTemplateProps {
  firstName: string
  downloadUrl: string
  expiresAt: string
  /** Bonus ebook files — titles are rendered dynamically; falls back to MB defaults */
  files?: Array<{ title?: string; name?: string }>
  billingEntity?: any
  preview?: string
}

// Default bonus ebooks for Macskabiblia (used when `files` is not provided)
const DEFAULT_EBOOKS = [
  'A hosszú élet a macskatálban kezdődik',
  'A játékos macska',
  'Macska-SOS',
]

export const isMbEbookDeliveryData = (data: any): data is MbEbookDeliveryTemplateProps =>
  typeof data.firstName === 'string' &&
  typeof data.downloadUrl === 'string' &&
  typeof data.expiresAt === 'string'

const font = "'Inter', 'Segoe UI', Arial, sans-serif"
const pad = '28px'

// MB Brand colors — warm orange palette (matches mb-order-placed)
const colors = {
  headerBg: '#2D1B3D',
  headerGradient: 'linear-gradient(135deg, #2D1B3D 0%, #1A1028 100%)',
  accent: '#C27BA0',
  accentLight: '#D9A4C0',
  accentSoft: '#FAF5F8',
  accentMuted: '#9B7AAD',
  textDark: '#2D1B3D',
  textBody: '#5A3D6B',
  textMuted: '#9B7AAD',
  textLight: '#9B7AAD',
  boxBg: '#FAF5F8',
  boxBorder: '#EDD9E5',
  cardBg: '#FFFFFF',
  footerBg: '#2D1B3D',
  footerText: '#7a6189',
  footerAccent: '#C27BA0',
  greenBg: '#F0FDF4',
  greenBorder: '#BBF7D0',
  greenText: '#166534',
  amberBg: '#FFFBEB',
  amberBorder: '#FDE68A',
  amberText: '#92400E',
  divider: '#E4E4E7',
}

export const MbEbookDeliveryTemplate: React.FC<MbEbookDeliveryTemplateProps> & {
  PreviewProps: MbEbookDeliveryTemplateProps
} = ({ firstName, downloadUrl, expiresAt, files, billingEntity, preview = 'Az e-könyveid készen állnak!' }) => {
  const expiryDate = new Date(expiresAt).toLocaleDateString('hu-HU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  // Ebook titles come dynamically from `files`; fall back to MB defaults
  const ebookTitles = (files || [])
    .map((f) => f?.title || f?.name)
    .filter((t): t is string => !!t)
  const bonusTitles = ebookTitles.length > 0 ? ebookTitles : DEFAULT_EBOOKS

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
            Macskabiblia
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
            Az e-könyveid készen állnak! 📖
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '13px',
            color: 'rgba(255,255,255,0.7)',
            margin: '0',
          }}>
            Töltsd le a digitális bónuszaidat
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
            Szia {firstName}!
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            color: colors.textBody,
            lineHeight: '1.7',
            margin: '8px 0 0',
          }}>
            Nagyon köszönjük, hogy megvetted a Macskabiblia című könyvet! 🐱 A bónusz e-könyveid készen állnak a letöltésre. Kattints az alábbi gombra, és töltsd le őket.
          </Text>
        </div>

        {/* ====== BONUS EBOOKS LIST ====== */}
        <div style={{ padding: `20px ${pad} 0` }}>
          <div style={{
            backgroundColor: colors.boxBg,
            borderRadius: '12px',
            border: `1px solid ${colors.boxBorder}`,
            padding: '16px 20px',
          }}>
            <Text style={{
              fontFamily: font,
              fontSize: '12px',
              fontWeight: 700,
              textTransform: 'uppercase' as const,
              letterSpacing: '1px',
              color: colors.accent,
              margin: '0 0 10px',
            }}>
              A bónusz e-könyveid
            </Text>
            {bonusTitles.map((title, i) => (
              <Text key={i} style={{
                fontFamily: font,
                fontSize: '14px',
                color: colors.textBody,
                lineHeight: '1.6',
                margin: i === bonusTitles.length - 1 ? '0' : '0 0 8px',
              }}>
                &#128218; <strong style={{ color: colors.textDark }}>{title}</strong>
              </Text>
            ))}
          </div>
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
            E-könyvek letöltése &#8594;
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
              &#9203; A letöltési link eddig érvényes: <strong>{expiryDate}</strong>. Letöltés után mentsd el a fájlt.
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
              &#128230; A nyomtatott könyved úton van, és <strong>2–3 munkanapon</strong> belül megérkezik. A csomagkövetési számot külön e-mailben küldjük el.
            </Text>
          </div>
        </div>

        {/* ====== TIPS ====== */}
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
            Tippek az olvasáshoz
          </Text>

          <div style={{
            backgroundColor: colors.accentSoft,
            borderRadius: '12px',
            border: '1px solid #EDD9E5',
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
              &#128049; <strong style={{ color: colors.textDark }}>Kezdd nyugodtan</strong> — Ne siess. Minden fejezet új ismereteket ad a macskádról.
            </Text>
            <Text style={{
              fontFamily: font,
              fontSize: '14px',
              color: colors.textBody,
              lineHeight: '1.6',
              margin: '0 0 12px',
            }}>
              &#128221; <strong style={{ color: colors.textDark }}>Jegyzetelj</strong> — Írd le, ami megfogott. Vissza fogsz még térni hozzá.
            </Text>
            <Text style={{
              fontFamily: font,
              fontSize: '14px',
              color: colors.textBody,
              lineHeight: '1.6',
              margin: '0',
            }}>
              &#10084;&#65039; <strong style={{ color: colors.textDark }}>Légy türelmes</strong> — A macskád viselkedésében a változások fokozatosan jönnek. Minden apró előrelépés számít!
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
              Problémád van a letöltéssel?
              <br />
              <Link href="mailto:konyv@macskabiblia-konyv.hu" style={{ color: colors.accent, textDecoration: 'underline', fontWeight: 700 }}>
                konyv@macskabiblia-konyv.hu
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
            Sok macskás örömöt kívánok a könyvhöz! 🐱
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            fontWeight: 700,
            color: colors.textDark,
            margin: '0 0 2px',
          }}>
            Nagy Zoltán
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '13px',
            color: colors.textMuted,
            margin: '0',
          }}>
            <Link href="mailto:konyv@macskabiblia-konyv.hu" style={{ color: colors.accent, textDecoration: 'none' }}>
              konyv@macskabiblia-konyv.hu
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
            Macskabiblia
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '11px',
            color: colors.footerText,
            lineHeight: '1.7',
            margin: '0 0 8px',
          }}>
            Performance Marketing Solution s.r.o. &bull; Rybná 716/24, Staré Město, 110 00 Praha
            <br />
            IČO: 06259928 &bull; DIČ: CZ06259928
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '11px',
            color: '#71717A',
            lineHeight: '1.5',
            margin: '0',
          }}>
            Ezt az e-mailt azért kaptad, mert rendelést adtál le a macskabiblia-konyv.hu oldalon.
          </Text>
        </div>
      </Section>
    </Base>
  )
}

MbEbookDeliveryTemplate.PreviewProps = {
  firstName: 'Anna',
  downloadUrl: 'https://www.macskabiblia-konyv.hu/download/abc123-test-token',
  expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  files: [
    { title: 'A hosszú élet a macskatálban kezdődik' },
    { title: 'A játékos macska' },
    { title: 'Macska-SOS' },
  ],
} as MbEbookDeliveryTemplateProps

export default MbEbookDeliveryTemplate
