import { Text, Section, Hr, Link, Button } from '@react-email/components'
import * as React from 'react'
import { Base } from './base'

export const KB_EBOOK_DELIVERY = 'kb-ebook-delivery'

export interface KbEbookDeliveryTemplateProps {
  firstName: string
  downloadUrl: string
  expiresAt: string
  /** Bonus e-book files — titles are rendered dynamically; falls back to KB defaults */
  files?: Array<{ title?: string; name?: string }>
  billingEntity?: any
  preview?: string
}

// Default bonus e-books for Kočičí bible (used when `files` is not provided)
const DEFAULT_EBOOKS = [
  'Dlouhověkost začíná v kočičí misce',
  'Hravá kočka',
  'Kočičí SOS: 100 Problémů, 100 Řešení',
]

export const isKbEbookDeliveryData = (data: any): data is KbEbookDeliveryTemplateProps =>
  typeof data.firstName === 'string' &&
  typeof data.downloadUrl === 'string' &&
  typeof data.expiresAt === 'string'

const font = "'Inter', 'Segoe UI', Arial, sans-serif"
const pad = '28px'

// KB Brand colors — warm orange palette (matches kb-order-placed)
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

export const KbEbookDeliveryTemplate: React.FC<KbEbookDeliveryTemplateProps> & {
  PreviewProps: KbEbookDeliveryTemplateProps
} = ({ firstName, downloadUrl, expiresAt, files, billingEntity, preview = 'Tvoje e-booky jsou připravené!' }) => {
  const expiryDate = new Date(expiresAt).toLocaleDateString('cs-CZ', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  // E-book titles come dynamically from `files`; fall back to KB defaults
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
            Kočičí bible
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
            Tvoje e-booky jsou připravené! 📖
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '13px',
            color: 'rgba(255,255,255,0.7)',
            margin: '0',
          }}>
            Stáhni si své digitální bonusy
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
            Ahoj {firstName},
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            color: colors.textBody,
            lineHeight: '1.7',
            margin: '8px 0 0',
          }}>
            Moc děkujeme za tvůj nákup knihy Kočičí bible! 🐱 Tvoje bonusové e-booky jsou připravené ke stažení. Klikni na tlačítko níže a stáhni si je.
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
              Tvoje bonusové e-booky
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
            Stáhnout e-booky &#8594;
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
              &#9203; Odkaz ke stažení je platný do <strong>{expiryDate}</strong>. Po stažení si soubor ulož.
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
              &#128230; Tvoje tištěná kniha je na cestě a dorazí během <strong>2–3 pracovních dnů</strong>. Sledovací číslo ti pošleme v samostatném e-mailu.
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
            Tipy pro čtení
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
              &#128049; <strong style={{ color: colors.textDark }}>Začni v klidu</strong> — Nespěchej. Každá kapitola ti přinese nové poznatky o tvé kočce.
            </Text>
            <Text style={{
              fontFamily: font,
              fontSize: '14px',
              color: colors.textBody,
              lineHeight: '1.6',
              margin: '0 0 12px',
            }}>
              &#128221; <strong style={{ color: colors.textDark }}>Dělej si poznámky</strong> — Zapiš si, co tě zaujme. Budeš se k tomu chtít vrátit.
            </Text>
            <Text style={{
              fontFamily: font,
              fontSize: '14px',
              color: colors.textBody,
              lineHeight: '1.6',
              margin: '0',
            }}>
              &#10084;&#65039; <strong style={{ color: colors.textDark }}>Buď trpělivý/á</strong> — Změny v chování kočky přijdou postupně. Každý malý pokrok se počítá!
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
              Máš problém se stahováním?
              <br />
              <Link href="mailto:peterka@kocicibible.cz" style={{ color: colors.accent, textDecoration: 'underline', fontWeight: 700 }}>
                peterka@kocicibible.cz
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
            Ať ti kniha přinese spoustu kočičí radosti! 🐱
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            fontWeight: 700,
            color: colors.textDark,
            margin: '0 0 2px',
          }}>
            Michal Peterka
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '13px',
            color: colors.textMuted,
            margin: '0',
          }}>
            <Link href="mailto:peterka@kocicibible.cz" style={{ color: colors.accent, textDecoration: 'none' }}>
              peterka@kocicibible.cz
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
            Kočičí bible
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
            Tento e-mail ti přišel, protože jsi si objednal/a na kocicibible.cz.
          </Text>
        </div>
      </Section>
    </Base>
  )
}

KbEbookDeliveryTemplate.PreviewProps = {
  firstName: 'Petra',
  downloadUrl: 'https://kocicibible.cz/download/abc123-test-token',
  expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  files: [
    { title: 'Dlouhověkost začíná v kočičí misce' },
    { title: 'Hravá kočka' },
    { title: 'Kočičí SOS: 100 Problémů, 100 Řešení' },
  ],
} as KbEbookDeliveryTemplateProps

export default KbEbookDeliveryTemplate
