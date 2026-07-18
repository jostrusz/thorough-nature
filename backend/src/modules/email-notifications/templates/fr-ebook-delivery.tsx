import { Text, Section, Hr, Link, Button } from '@react-email/components'
import * as React from 'react'
import { Base } from './base'

export const FR_EBOOK_DELIVERY = 'fr-ebook-delivery'

export interface FrEbookDeliveryTemplateProps {
  firstName: string
  downloadUrl: string
  expiresAt: string
  billingEntity?: any
  preview?: string
}

export const isFrEbookDeliveryData = (data: any): data is FrEbookDeliveryTemplateProps =>
  typeof data.firstName === 'string' &&
  typeof data.downloadUrl === 'string' &&
  typeof data.expiresAt === 'string'

const font = "'Inter', 'Segoe UI', Arial, sans-serif"
const pad = '28px'

// Lâche prise Brand colors — Velvet Dusk palette
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

export const FrEbookDeliveryTemplate: React.FC<FrEbookDeliveryTemplateProps> & {
  PreviewProps: FrEbookDeliveryTemplateProps
} = ({ firstName, downloadUrl, expiresAt, billingEntity, preview = 'Tes e-books sont prêts !' }) => {
  const expiryDate = new Date(expiresAt).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const entityName = billingEntity?.legal_name || 'Performance Marketing Solution s.r.o.'
  const entityAddress = billingEntity?.address
    ? `${billingEntity.address.city || 'Prague'}, ${billingEntity.address.district || billingEntity.address.country_code?.toUpperCase() || 'République tchèque'}`
    : 'Rybná 716/24, Staré Město, 110 00 Prague'
  const entityRegId = billingEntity?.registration_id || '06259928'

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
            Lâche prise sur ce qui te détruit
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
            Tes e-books sont prêts&nbsp;!
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '13px',
            color: 'rgba(255,255,255,0.7)',
            margin: '0',
          }}>
            Télécharge tes exemplaires numériques
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
            Bonjour {firstName},
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            color: colors.textBody,
            lineHeight: '1.7',
            margin: '8px 0 0',
          }}>
            Quelle joie de te compter parmi nos lecteurs&nbsp;! Tes exemplaires numériques sont prêts à être téléchargés. Clique sur le bouton ci-dessous pour récupérer tes e-books.
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
            Télécharger mes e-books &#8594;
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
              &#9203; Ce lien de téléchargement est valable jusqu&rsquo;au <strong>{expiryDate}</strong>. Pense à enregistrer les fichiers après le téléchargement.
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
              &#128230; Ton livre papier est en route et sera livré sous <strong>2–3 jours ouvrés</strong>. Tu recevras séparément un e-mail avec le numéro de suivi.
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
            Conseils de lecture
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
              &#128218; <strong style={{ color: colors.textDark }}>Prends ton temps</strong> — Lis un chapitre à la fois et laisse-toi l&rsquo;espace d&rsquo;y réfléchir.
            </Text>
            <Text style={{
              fontFamily: font,
              fontSize: '14px',
              color: colors.textBody,
              lineHeight: '1.6',
              margin: '0 0 12px',
            }}>
              &#9997;&#65039; <strong style={{ color: colors.textDark }}>Prends des notes</strong> — Garde un carnet à portée de main pour tes pensées et tes découvertes.
            </Text>
            <Text style={{
              fontFamily: font,
              fontSize: '14px',
              color: colors.textBody,
              lineHeight: '1.6',
              margin: '0',
            }}>
              &#10084;&#65039; <strong style={{ color: colors.textDark }}>Fais preuve de douceur envers toi-même</strong> — Le changement prend du temps. Célèbre chaque petit pas&nbsp;!
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
              Un souci avec le téléchargement&nbsp;?
              <br />
              <Link href="mailto:joris@lacheprise-livre.fr" style={{ color: colors.accent, textDecoration: 'underline', fontWeight: 700 }}>
                joris@lacheprise-livre.fr
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
            Bonne lecture&nbsp;!
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
            <Link href="mailto:joris@lacheprise-livre.fr" style={{ color: colors.accent, textDecoration: 'none' }}>
              joris@lacheprise-livre.fr
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
            Lâche prise sur ce qui te détruit
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '11px',
            color: colors.footerText,
            lineHeight: '1.7',
            margin: '0 0 8px',
          }}>
            {entityName} &bull; {entityAddress}
            <br />
            N&deg; d&rsquo;enregistrement&nbsp;: {entityRegId}
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '11px',
            color: '#71717A',
            lineHeight: '1.5',
            margin: '0',
          }}>
            Tu reçois cet e-mail suite à ta commande sur www.lacheprise-livre.fr.
          </Text>
        </div>
      </Section>
    </Base>
  )
}

FrEbookDeliveryTemplate.PreviewProps = {
  firstName: 'Claire',
  downloadUrl: 'https://www.lacheprise-livre.fr/download/abc123-test-token',
  expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  billingEntity: {
    legal_name: 'Performance Marketing Solution s.r.o.',
    registration_id: '06259928',
    address: { city: 'Prague', district: 'République tchèque' },
  },
} as FrEbookDeliveryTemplateProps

export default FrEbookDeliveryTemplate
