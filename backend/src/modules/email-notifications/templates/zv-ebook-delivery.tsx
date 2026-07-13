import { Text, Section, Hr, Link, Button, Img } from '@react-email/components'
import * as React from 'react'
import { Base } from './base'

export const ZV_EBOOK_DELIVERY = 'zv-ebook-delivery'

export interface ZvEbookDeliveryTemplateProps {
  firstName: string
  downloadUrl: string
  expiresAt: string
  billingEntity?: any
  preview?: string
}

export const isZvEbookDeliveryData = (data: any): data is ZvEbookDeliveryTemplateProps =>
  typeof data.firstName === 'string' &&
  typeof data.downloadUrl === 'string' &&
  typeof data.expiresAt === 'string'

const font = "'Inter', Arial, sans-serif"
const pad = '24px'

// 1:1 with zz-ebook-delivery palette
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

export const ZvEbookDeliveryTemplate: React.FC<ZvEbookDeliveryTemplateProps> & {
  PreviewProps: ZvEbookDeliveryTemplateProps
} = ({ firstName, downloadUrl, expiresAt, billingEntity, preview = 'Tvoje 2 e-knihy zdarma jsou připravené — stáhni si je hned teď.' }) => {
  const expiryDate = new Date(expiresAt).toLocaleDateString('cs-CZ', {
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
            ✦ Metoda LIFE RESET™
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
            Tvoje 2 e-knihy zdarma jsou tady!
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
            Ahoj {firstName},
          </Text>

          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            color: colors.textBody,
            lineHeight: '1.6',
            marginBottom: '14px',
          }}>
            mám radost, že ses rozhodla dát na první místo sebe. Tvoje dvě bonusové e-knihy — <strong style={{ color: colors.textDark }}>Posuň jednu věc, změň všechno</strong> a <strong style={{ color: colors.textDark }}>Ne vše má mít svoje místo</strong> — jsou připravené. Stačí kliknout na tlačítko níže a hned si je stáhnout.
          </Text>

          <Text style={{
            fontFamily: font,
            fontSize: '14px',
            color: colors.textBody,
            lineHeight: '1.6',
            marginBottom: '24px',
            fontStyle: 'italic' as const,
          }}>
            Můžeš začít ještě dnes. Tištěná kniha dorazí během pár dní — ale tyhle dvě e-knihy si můžeš otevřít hned teď.
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
              Stáhnout moje e-knihy →
            </Button>
          </div>

          {/* Expiry notice */}
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
              ⏳ Odkaz ke stažení platí do <strong>{expiryDate}</strong>. Po stažení si soubory ulož k sobě do zařízení.
            </Text>
          </div>

          {/* CROSS-SELL: Pusť to, co tě ničí */}
          <Text style={{
            fontFamily: font,
            fontSize: '11px',
            fontWeight: 600,
            textTransform: 'uppercase' as const,
            letterSpacing: '1.5px',
            color: colors.textMuted,
            marginBottom: '12px',
            textAlign: 'center' as const,
          }}>
            ✦ Mohlo by tě také zaujmout
          </Text>

          <Link
            href="https://www.pusttocotenici.cz"
            style={{ textDecoration: 'none', display: 'block', marginBottom: '24px' }}
          >
            <table role="presentation" cellPadding={0} cellSpacing={0} border={0} width="100%" style={{
              backgroundColor: colors.accentSoft,
              borderRadius: '12px',
              border: `1px solid ${colors.boxBorder}`,
              borderCollapse: 'separate' as const,
            }}>
              <tbody>
                <tr>
                  <td width="110" style={{ padding: '16px 0 16px 16px', verticalAlign: 'middle' as const }}>
                    <Img
                      src="https://bucket-production-b93e.up.railway.app:443/medusa-media/pust-to-co-te-nici-admin-01KTYC1V1ZYVZ92WZYE7SA8X2Z.png"
                      alt="Pusť to, co tě ničí"
                      width="94"
                      style={{ display: 'block', borderRadius: '6px', maxWidth: '94px' }}
                    />
                  </td>
                  <td style={{ padding: '16px 18px 16px 14px', verticalAlign: 'middle' as const }}>
                    <Text style={{
                      fontFamily: font,
                      fontSize: '15px',
                      fontWeight: 700,
                      color: colors.textDark,
                      margin: '0 0 4px',
                      lineHeight: '1.3',
                    }}>
                      Pusť to, co tě ničí
                    </Text>
                    <Text style={{
                      fontFamily: font,
                      fontSize: '12px',
                      color: colors.textBody,
                      margin: '0 0 8px',
                      lineHeight: '1.5',
                    }}>
                      Než začneš stavět nový život, musíš pustit to, co tě drží zpátky. 5 oblastí odpouštění v praktickém průvodci o 280 stranách.
                    </Text>
                    <Text style={{
                      fontFamily: font,
                      fontSize: '12px',
                      fontWeight: 600,
                      color: colors.accent,
                      margin: '0',
                    }}>
                      Prohlédnout knihu →
                    </Text>
                  </td>
                </tr>
              </tbody>
            </table>
          </Link>

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
              📦 Tvoje tištěná kniha <strong>Život, jaký si zasloužíš</strong> je skladem v ČR a Zásilkovna ti ji doručí <strong>do 2 pracovních dnů</strong>. Sledovací číslo ti pošlu samostatným e-mailem.
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
            Kde začít
          </Text>

          <Text style={{
            fontFamily: font,
            fontSize: '13px',
            color: colors.textBody,
            lineHeight: '1.5',
            marginBottom: '8px',
          }}>
            🪑 <strong style={{ color: colors.textDark }}>Začni u Feng Shui</strong> — Posuň jednu věc, změň všechno. Čtvrt hodiny a budeš vědět, co se u tebe doma musí pohnout.
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '13px',
            color: colors.textBody,
            lineHeight: '1.5',
            marginBottom: '8px',
          }}>
            🧹 <strong style={{ color: colors.textDark }}>Pak Ne vše má mít svoje místo</strong> — úklid jako projev lásky k sobě. Se systémem 4 krabic se o každé věci rozhodneš do 30 sekund.
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '13px',
            color: colors.textBody,
            lineHeight: '1.5',
            marginBottom: '18px',
          }}>
            🌿 <strong style={{ color: colors.textDark }}>Buď na sebe hodná</strong> — jeden šuplík, jednou denně. Osm minut. Víc to být nemusí.
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
              Nejde ti stažení? Napiš mi na{' '}
              <Link href="mailto:anna@nejdriv-ja.cz" style={{ color: colors.accent, textDecoration: 'underline' }}>
                anna@nejdriv-ja.cz
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
            Příjemné čtení!
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
            <Link href="mailto:anna@nejdriv-ja.cz" style={{ color: colors.accent, textDecoration: 'none' }}>
              anna@nejdriv-ja.cz
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
            Život, jaký si zasloužíš &bull; Metoda LIFE RESET™
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '11px',
            color: colors.footerText,
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
                Reg. č.: {billingEntity.registration_id}
                {billingEntity.vat_id && ` · DIČ: ${billingEntity.vat_id}`}
              </>
            )}
            <br />
            Tento e-mail ti přišel, protože sis objednala knihu na www.nejdriv-ja.cz.
          </Text>
        </div>
      </Section>
    </Base>
  )
}

ZvEbookDeliveryTemplate.PreviewProps = {
  firstName: 'Petra',
  downloadUrl: 'https://www.nejdriv-ja.cz/download/abc123-test-token',
  expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
} as ZvEbookDeliveryTemplateProps

export default ZvEbookDeliveryTemplate
