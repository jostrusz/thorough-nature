import { Text, Section, Button, Hr, Link } from '@react-email/components'
import * as React from 'react'
import { Base } from './base'

export const DH_ABANDONED_CHECKOUT_3 = 'dh-abandoned-checkout-3'

export interface DhAbandonedCheckout3Props {
  firstName: string
  checkoutUrl: string
  productName: string
  productPrice: string
  productImage?: string
  preview?: string
}

export const isDhAbandonedCheckout3Data = (data: any): data is DhAbandonedCheckout3Props =>
  typeof data.firstName === 'string' && typeof data.checkoutUrl === 'string'

const font = "'Inter', 'Segoe UI', Arial, sans-serif"
const pad = '28px'

const colors = {
  headerBg: '#18181B',
  headerGradient: 'linear-gradient(135deg, #27272A 0%, #18181B 50%, #09090B 100%)',
  accent: '#EA580C',
  accentSoft: '#FFF7ED',
  textDark: '#18181B',
  textBody: '#3F3F46',
  textMuted: '#71717A',
  boxBorder: '#E4E4E7',
  footerBg: '#18181B',
  footerText: '#A1A1AA',
  footerAccent: '#FB923C',
  divider: '#E4E4E7',
  urgentBg: '#FEF2F2',
  urgentBorder: '#FECACA',
  urgentText: '#991B1B',
}

export const DhAbandonedCheckout3Template: React.FC<DhAbandonedCheckout3Props> & {
  PreviewProps: DhAbandonedCheckout3Props
} = ({
  firstName,
  checkoutUrl,
  productName,
  productPrice,
  productImage,
  preview = 'Nog 24 uur — daarna moet ik je winkelwagen vrijgeven.',
}) => {
  return (
    <Base preview={preview}>
      <Section>
        {/* ====== HEADER — dark/urgent ====== */}
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
            color: 'rgba(255,255,255,0.5)',
            margin: '0 0 10px 0',
          }}>
            De Hondenbijbel
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '26px',
            fontWeight: 800,
            color: '#ffffff',
            margin: '0',
            lineHeight: '1.2',
            letterSpacing: '-0.02em',
          }}>
            Laatste kans, {firstName}
          </Text>
        </div>

        {/* ====== URGENT BANNER ====== */}
        <div style={{ padding: `20px ${pad} 0` }}>
          <div style={{
            backgroundColor: colors.urgentBg,
            border: `1px solid ${colors.urgentBorder}`,
            borderRadius: '10px',
            padding: '14px 18px',
            textAlign: 'center' as const,
          }}>
            <Text style={{
              fontFamily: font,
              fontSize: '13px',
              fontWeight: 600,
              color: colors.urgentText,
              margin: '0',
            }}>
              ⏰ Je winkelwagen wordt binnen 24 uur automatisch vrijgegeven
            </Text>
          </div>
        </div>

        {/* ====== BODY ====== */}
        <div style={{ padding: `20px ${pad} 0` }}>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            color: colors.textBody,
            lineHeight: '1.7',
            margin: '0',
          }}>
            Hoi {firstName},
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            lineHeight: '1.7',
            margin: '12px 0 0',
            color: colors.textBody,
          }}>
            Dit is de laatste keer dat ik je mail over je bestelling. Ik bewaar je winkelwagen nog 24 uur — daarna wordt hij automatisch vrijgegeven.
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            lineHeight: '1.7',
            margin: '16px 0 0',
            color: colors.textBody,
          }}>
            Ik wil je niet onder druk zetten. Maar ik wil wél eerlijk tegen je zijn.
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            lineHeight: '1.7',
            margin: '16px 0 0',
            color: colors.textBody,
          }}>
            Elk gedragsprobleem dat je nu bij je hond ziet — het trekken, het blaffen, het niet luisteren — wordt niet vanzelf beter. Het wordt erger. Niet omdat je hond &ldquo;stout&rdquo; is, maar omdat hij elke dag leert dat dit gedrag oké is. Hoe langer je wacht, hoe dieper het patroon zich vastzet.
          </Text>
        </div>

        {/* ====== FUTURE PACING ====== */}
        <div style={{ padding: `20px ${pad} 0` }}>
          <div style={{
            backgroundColor: '#FFFBEB',
            border: '1px solid #FDE68A',
            borderRadius: '10px',
            padding: '20px 22px',
          }}>
            <Text style={{
              fontFamily: font,
              fontSize: '14px',
              fontWeight: 700,
              color: '#92400E',
              margin: '0 0 8px',
            }}>
              💭 Stel je dit eens voor:
            </Text>
            <Text style={{
              fontFamily: font,
              fontSize: '14px',
              color: '#78350F',
              lineHeight: '1.7',
              margin: '0',
            }}>
              Het is volgende week. Je loopt door het park met je hond. Geen trekken. Geen blaffen naar andere honden. Je hond kijkt naar jou, luistert naar jou, en loopt ontspannen naast je. Andere baasjes kijken jaloers. &ldquo;Hoe heb je dat voor elkaar gekregen?&rdquo; vragen ze.
            </Text>
          </div>
        </div>

        <div style={{ padding: `16px ${pad} 0` }}>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            lineHeight: '1.7',
            margin: '0',
            color: colors.textBody,
          }}>
            Dat is geen fantasie. Dat is wat <strong style={{ color: colors.textDark }}>meer dan 4.800 hondenbaasjes</strong> al hebben bereikt. En voor de meesten begon het met precies dezelfde twijfel die jij nu voelt.
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            lineHeight: '1.7',
            margin: '12px 0 0',
            color: colors.textDark,
            fontWeight: 600,
          }}>
            Weet je wat het verschil was? Ze kozen ervoor om vandáág te beginnen.
          </Text>
        </div>

        {/* ====== PRODUCT CARD ====== */}
        <div style={{ padding: `20px ${pad} 0` }}>
          <div style={{
            backgroundColor: colors.accentSoft,
            borderRadius: '12px',
            border: '1px solid #FED7AA',
            padding: '20px 24px',
            textAlign: 'center' as const,
          }}>
            <Text style={{
              fontFamily: font,
              fontSize: '17px',
              fontWeight: 700,
              margin: '0 0 6px',
              color: colors.textDark,
            }}>
              {productName}
            </Text>
            <Text style={{
              fontFamily: font,
              fontSize: '20px',
              fontWeight: 800,
              margin: '0',
              color: colors.accent,
            }}>
              &euro;{productPrice}
            </Text>
          </div>
        </div>

        {/* ====== CTA BUTTON ====== */}
        <div style={{ textAlign: 'center' as const, padding: `24px ${pad} 0` }}>
          <Button
            href={checkoutUrl}
            style={{
              backgroundColor: colors.accent,
              color: '#ffffff',
              fontFamily: font,
              fontSize: '16px',
              fontWeight: 700,
              padding: '14px 40px',
              borderRadius: '10px',
              textDecoration: 'none',
              display: 'inline-block',
            }}
          >
            Ja, ik begin vandaag &#8594;
          </Button>
        </div>

        {/* ====== TRUST BADGES ====== */}
        <div style={{ padding: `18px ${pad} 0`, textAlign: 'center' as const }}>
          <Text style={{
            fontFamily: font,
            fontSize: '13px',
            color: colors.textMuted,
            lineHeight: '1.8',
            margin: '0',
          }}>
            ✓ 100% Niet-goed-geld-terug garantie<br />
            ✓ Gratis verzending (NL &amp; BE)<br />
            ✓ Meer dan 4.800 tevreden hondenbaasjes
          </Text>
        </div>

        <Hr style={{ margin: `24px ${pad}`, borderColor: colors.divider }} />

        {/* ====== CLOSING ====== */}
        <div style={{ padding: `0 ${pad}` }}>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            lineHeight: '1.7',
            margin: '0',
            color: colors.textBody,
          }}>
            Na dit bericht stuur ik je geen herinneringen meer. De keuze is aan jou — en welke keuze je ook maakt, ik respecteer het volledig.
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            lineHeight: '1.7',
            margin: '16px 0 0',
            color: colors.textBody,
          }}>
            Maar als je ooit hebt gedacht <em>&ldquo;Ik wou dat mijn hond beter luisterde&rdquo;</em> — dan is dit je moment.
          </Text>
        </div>

        <Hr style={{ margin: `24px ${pad}`, borderColor: colors.divider }} />

        {/* ====== SIGN-OFF ====== */}
        <div style={{ padding: `0 ${pad}` }}>
          <Text style={{
            fontFamily: font,
            fontSize: '14px',
            fontWeight: 700,
            color: colors.textDark,
            margin: '0',
          }}>
            Lars Vermeulen
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '13px',
            color: colors.textMuted,
            margin: '2px 0 0',
          }}>
            De Hondenbijbel
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '13px',
            color: colors.textMuted,
            margin: '14px 0 0',
            fontStyle: 'italic' as const,
          }}>
            P.S. Nog twijfels? Mail me persoonlijk op{' '}
            <Link href="mailto:support@dehondenbijbel.nl" style={{ color: colors.accent, textDecoration: 'underline', fontWeight: 600, fontStyle: 'normal' as const }}>
              support@dehondenbijbel.nl
            </Link>
            . Ik lees en beantwoord elk bericht zelf.
          </Text>
        </div>

        <div style={{ height: '28px' }}></div>

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
            De Hondenbijbel
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '11px',
            color: colors.footerText,
            lineHeight: '1.7',
            margin: '0 0 8px',
          }}>
            EverChapter OÜ &bull; Tallinn, Estonia
            <br />
            Reg. nr: 16938029
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '11px',
            color: '#71717A',
            lineHeight: '1.5',
            margin: '0',
          }}>
            Je ontvangt deze e-mail omdat je een checkout hebt gestart op dehondenbijbel.nl. Dit is de laatste herinnering — je ontvangt geen verdere e-mails over deze bestelling.
          </Text>
        </div>
      </Section>
    </Base>
  )
}

DhAbandonedCheckout3Template.PreviewProps = {
  firstName: 'Jan',
  checkoutUrl: 'https://dehondenbijbel.nl/pages/checkout.html',
  productName: 'De Hondenbijbel',
  productPrice: '35,00',
  productImage: '',
  preview: 'Nog 24 uur — daarna moet ik je winkelwagen vrijgeven.',
} as DhAbandonedCheckout3Props

export default DhAbandonedCheckout3Template
