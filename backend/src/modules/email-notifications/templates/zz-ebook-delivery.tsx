import { Text, Section, Hr, Link, Button, Img } from '@react-email/components'
import * as React from 'react'
import { Base } from './base'

export const ZZ_EBOOK_DELIVERY = 'zz-ebook-delivery'

export interface ZzEbookDeliveryTemplateProps {
  firstName: string
  downloadUrl: string
  expiresAt: string
  billingEntity?: any
  preview?: string
}

export const isZzEbookDeliveryData = (data: any): data is ZzEbookDeliveryTemplateProps =>
  typeof data.firstName === 'string' &&
  typeof data.downloadUrl === 'string' &&
  typeof data.expiresAt === 'string'

const font = "'Inter', Arial, sans-serif"
const pad = '24px'

// 1:1 with hl-ebook-delivery palette
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

export const ZzEbookDeliveryTemplate: React.FC<ZzEbookDeliveryTemplateProps> & {
  PreviewProps: ZzEbookDeliveryTemplateProps
} = ({ firstName, downloadUrl, expiresAt, billingEntity, preview = 'Twoje 2 darmowe e-booki czekają — pobierz je teraz.' }) => {
  const expiryDate = new Date(expiresAt).toLocaleDateString('pl-PL', {
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
            Twoje 2 darmowe e-booki czekają!
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
            Cześć {firstName},
          </Text>

          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            color: colors.textBody,
            lineHeight: '1.6',
            marginBottom: '14px',
          }}>
            Cieszę się, że wybrałaś siebie. Twoje dwa bonusowe e-booki — <strong style={{ color: colors.textDark }}>Przesuń jedną rzecz, zmień wszystko</strong> oraz <strong style={{ color: colors.textDark }}>Nie wszystko zasługuje na miejsce</strong> — są gotowe. Kliknij przycisk poniżej, aby je od razu pobrać.
          </Text>

          <Text style={{
            fontFamily: font,
            fontSize: '14px',
            color: colors.textBody,
            lineHeight: '1.6',
            marginBottom: '24px',
            fontStyle: 'italic' as const,
          }}>
            Możesz zacząć już dziś. Książka w wersji papierowej dotrze za kilka dni — ale te dwa e-booki możesz otworzyć już teraz.
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
              Pobierz moje e-booki →
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
              ⏳ Ten link do pobrania jest ważny do <strong>{expiryDate}</strong>. Po pobraniu zapisz pliki na dysku.
            </Text>
          </div>

          {/* CROSS-SELL: Odpuść to, co cię niszczy */}
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
            ✦ Może też Cię zainteresować
          </Text>

          <Link
            href="https://www.odpusc-ksiazka.pl"
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
                      src="https://bucket-production-b93e.up.railway.app:443/medusa-media/odpusc-ksiazka-thumbnail-01KK8RBZFKFSMZJJDDRR82PJ1D.png"
                      alt="Odpuść to, co cię niszczy"
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
                      Odpuść to, co cię niszczy
                    </Text>
                    <Text style={{
                      fontFamily: font,
                      fontSize: '12px',
                      color: colors.textBody,
                      margin: '0 0 8px',
                      lineHeight: '1.5',
                    }}>
                      Zanim zbudujesz nowe życie, musisz puścić to, co cię trzyma. 5 obszarów odpuszczania w 280-stronicowym praktycznym przewodniku.
                    </Text>
                    <Text style={{
                      fontFamily: font,
                      fontSize: '12px',
                      fontWeight: 600,
                      color: colors.accent,
                      margin: '0',
                    }}>
                      Poznaj książkę →
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
              📦 Twoja papierowa książka <strong>Życie, jakiego nigdy sobie nie pozwoliłaś</strong> jest już w drodze i zostanie dostarczona w ciągu <strong>3–5 dni roboczych</strong> przez InPost. Numer do śledzenia otrzymasz osobnym mailem.
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
            Od czego zacząć
          </Text>

          <Text style={{
            fontFamily: font,
            fontSize: '13px',
            color: colors.textBody,
            lineHeight: '1.5',
            marginBottom: '8px',
          }}>
            🪑 <strong style={{ color: colors.textDark }}>Zacznij od Feng Shui</strong> — Przesuń jedną rzecz, zmień wszystko. Kwadrans i już wiesz, co w domu musi się ruszyć.
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '13px',
            color: colors.textBody,
            lineHeight: '1.5',
            marginBottom: '8px',
          }}>
            🧹 <strong style={{ color: colors.textDark }}>Potem Nie wszystko zasługuje na miejsce</strong> — porządkowanie jako akt miłości do siebie. Z systemem 4 pudełek decydujesz w 30 sekund per przedmiot.
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '13px',
            color: colors.textBody,
            lineHeight: '1.5',
            marginBottom: '18px',
          }}>
            🌿 <strong style={{ color: colors.textDark }}>Bądź dla siebie łagodna</strong> — jedna szuflada, raz dziennie. Osiem minut. Więcej nie musi być.
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
              Problem z pobraniem? Napisz do mnie na{' '}
              <Link href="mailto:anna@najpierw-ja.pl" style={{ color: colors.accent, textDecoration: 'underline' }}>
                anna@najpierw-ja.pl
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
            Udanej lektury!
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
            <Link href="mailto:anna@najpierw-ja.pl" style={{ color: colors.accent, textDecoration: 'none' }}>
              anna@najpierw-ja.pl
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
            Życie, jakiego nigdy sobie nie pozwoliłaś &bull; Metoda LIFE RESET™
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
            Otrzymujesz tę wiadomość, ponieważ złożyłaś zamówienie na najpierw-ja.pl.
          </Text>
        </div>
      </Section>
    </Base>
  )
}

ZzEbookDeliveryTemplate.PreviewProps = {
  firstName: 'Magdalena',
  downloadUrl: 'https://www.najpierw-ja.pl/download/abc123-test-token',
  expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
} as ZzEbookDeliveryTemplateProps

export default ZzEbookDeliveryTemplate
