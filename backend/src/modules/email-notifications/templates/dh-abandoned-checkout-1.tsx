import { Text, Section, Button, Img, Hr, Link } from '@react-email/components'
import * as React from 'react'
import { Base } from './base'

export const DH_ABANDONED_CHECKOUT_1 = 'dh-abandoned-checkout-1'

export interface DhAbandonedCheckout1Props {
  firstName: string
  checkoutUrl: string
  productName: string
  productPrice: string
  productImage?: string
  preview?: string
}

export const isDhAbandonedCheckout1Data = (data: any): data is DhAbandonedCheckout1Props =>
  typeof data.firstName === 'string' && typeof data.checkoutUrl === 'string'

const font = "'Inter', 'Segoe UI', Arial, sans-serif"
const pad = '28px'

const colors = {
  headerBg: '#EA580C',
  headerGradient: 'linear-gradient(135deg, #F97316 0%, #EA580C 50%, #C2410C 100%)',
  accent: '#EA580C',
  accentLight: '#FDBA74',
  accentSoft: '#FFF7ED',
  textDark: '#18181B',
  textBody: '#3F3F46',
  textMuted: '#71717A',
  boxBorder: '#E4E4E7',
  footerBg: '#18181B',
  footerText: '#A1A1AA',
  footerAccent: '#FB923C',
  divider: '#E4E4E7',
}

export const DhAbandonedCheckout1Template: React.FC<DhAbandonedCheckout1Props> & {
  PreviewProps: DhAbandonedCheckout1Props
} = ({
  firstName,
  checkoutUrl,
  productName,
  productPrice,
  productImage,
  preview = 'Je Hondenbijbel ligt ingepakt en wacht op jou!',
}) => {
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
            Je pakketje staat klaar! 📦
          </Text>
        </div>

        {/* ====== GREETING + BODY ====== */}
        <div style={{ padding: `28px ${pad} 0` }}>
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
            Goed nieuws — je bestelling van <strong style={{ color: colors.textDark }}>{productName}</strong> ligt al ingepakt en klaar om verzonden te worden. Het enige wat nog ontbreekt, is jouw bevestiging.
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            lineHeight: '1.7',
            margin: '16px 0 0',
            color: colors.textBody,
          }}>
            Wist je dat de meeste gedragsproblemen bij honden niet komen door de hond zelf, maar door hoe wij als baasje communiceren? Eén kleine verandering in jouw aanpak kan het verschil maken tussen een hond die trekt, blaft en niet luistert — en een hond die ontspannen naast je loopt.
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            lineHeight: '1.7',
            margin: '16px 0 0',
            color: colors.textBody,
          }}>
            Dat is precies wat je ontdekt in De Hondenbijbel. Geen strenge methodes. Geen dure trainers. Gewoon heldere, bewezen technieken die je vandaag nog kunt toepassen.
          </Text>
        </div>

        {/* ====== PRODUCT IMAGE ====== */}
        {productImage && (
          <div style={{ textAlign: 'center' as const, padding: `20px ${pad} 0` }}>
            <Img
              src={productImage}
              alt={productName}
              width="200"
              style={{ borderRadius: '12px', maxWidth: '100%', border: `1px solid ${colors.boxBorder}` }}
            />
          </div>
        )}

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
            Ja, verstuur mijn boek &#8594;
          </Button>
        </div>

        <div style={{ padding: `14px ${pad} 0` }}>
          <Text style={{
            fontFamily: font,
            fontSize: '13px',
            lineHeight: '1.6',
            color: colors.textMuted,
            textAlign: 'center' as const,
            margin: '0',
          }}>
            Je gegevens zijn al ingevuld — het duurt nog maar 1 minuut om je bestelling af te ronden.
          </Text>
        </div>

        <Hr style={{ margin: `24px ${pad}`, borderColor: colors.divider }} />

        {/* ====== SIGN-OFF ====== */}
        <div style={{ padding: `0 ${pad}` }}>
          <Text style={{
            fontFamily: font,
            fontSize: '14px',
            color: colors.textBody,
            lineHeight: '1.6',
            margin: '0',
          }}>
            Tot snel,
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '14px',
            fontWeight: 700,
            color: colors.textDark,
            margin: '4px 0 0',
          }}>
            Lars Vermeulen
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '13px',
            color: colors.textMuted,
            margin: '2px 0 0',
          }}>
            De Hondenbijbel &bull;{' '}
            <Link href="mailto:support@dehondenbijbel.nl" style={{ color: colors.accent, textDecoration: 'underline' }}>
              support@dehondenbijbel.nl
            </Link>
          </Text>
        </div>

        {/* ====== SPACER ====== */}
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
            Je ontvangt deze e-mail omdat je een checkout hebt gestart op dehondenbijbel.nl.
          </Text>
        </div>
      </Section>
    </Base>
  )
}

DhAbandonedCheckout1Template.PreviewProps = {
  firstName: 'Jan',
  checkoutUrl: 'https://dehondenbijbel.nl/pages/checkout.html',
  productName: 'De Hondenbijbel',
  productPrice: '35,00',
  productImage: '',
  preview: 'Je Hondenbijbel ligt ingepakt en wacht op jou!',
} as DhAbandonedCheckout1Props

export default DhAbandonedCheckout1Template
