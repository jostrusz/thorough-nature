import { Text, Section, Button, Img, Hr, Link } from '@react-email/components'
import * as React from 'react'
import { Base } from './base'

export const ZZ_ABANDONED_CHECKOUT_1 = 'zz-abandoned-checkout-1'

export interface ZzAbandonedCheckout1Props {
  firstName: string
  checkoutUrl: string
  productName: string
  productPrice: string
  productImage?: string
  preview?: string
}

export const isZzAbandonedCheckout1Data = (data: any): data is ZzAbandonedCheckout1Props =>
  typeof data.firstName === 'string' && typeof data.checkoutUrl === 'string'

const font = "'Inter', 'Segoe UI', Arial, sans-serif"
const pad = '28px'

const colors = {
  headerBg: '#4A1A2E',
  headerGradient: 'linear-gradient(135deg, #6B2A45 0%, #4A1A2E 50%, #3D1E2A 100%)',
  accent: '#B85C4A',
  accentLight: '#D4886F',
  accentSoft: '#FDF5EF',
  textDark: '#4A1A2E',
  textBody: '#6B3344',
  textMuted: '#9B6B7A',
  boxBorder: '#F0D5C4',
  footerBg: '#3D1E2A',
  footerText: '#C4A0A8',
  footerAccent: '#D4886F',
  divider: '#F0D5C4',
}

export const ZzAbandonedCheckout1Template: React.FC<ZzAbandonedCheckout1Props> & {
  PreviewProps: ZzAbandonedCheckout1Props
} = ({
  firstName,
  checkoutUrl,
  productName,
  productPrice,
  productImage,
  preview = 'Twoja książka jest zapakowana i czeka na Ciebie!',
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
            Życie, jakiego nigdy sobie nie pozwoliłaś
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
            Twoja książka czeka na Ciebie! 📦
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
            Cześć {firstName},
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            lineHeight: '1.7',
            margin: '12px 0 0',
            color: colors.textBody,
          }}>
            Dobre wieści — Twoje zamówienie na <strong style={{ color: colors.textDark }}>{productName}</strong> jest już zapakowane i gotowe do wysyłki. Brakuje tylko Twojego potwierdzenia.
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            lineHeight: '1.7',
            margin: '16px 0 0',
            color: colors.textBody,
          }}>
            Czy znasz to uczucie, gdy szafa pęka w szwach, a Ty stoisz rano i nie wiesz, w co się ubrać? Gdy głowa nie odpoczywa nawet w nocy? Gdy robisz wszystko dla innych — i pod koniec dnia dla Ciebie nic nie zostaje? Nie jesteś sama. I nie chodzi o to, żebyś była silniejsza.
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            lineHeight: '1.7',
            margin: '16px 0 0',
            color: colors.textBody,
          }}>
            Ta książka łączy esencję 10 światowych bestsellerów w jeden konkretny system: <strong style={{ color: colors.textDark }}>LIFE RESET™ — 5 filarów, 30 dni, 8 minut dziennie</strong>. Bez teorii. Bez weekendowych wyjazdów. Tylko ćwiczenia, które możesz zrobić jeszcze dziś.
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
            border: `1px solid ${colors.boxBorder}`,
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
              {productPrice} zł
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
            Tak, wyślij mi książkę &#8594;
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
            Twoje dane są już wypełnione — dokończenie zamówienia zajmie tylko 1 minutę.
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
            Do usłyszenia wkrótce,
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '14px',
            fontWeight: 700,
            color: colors.textDark,
            margin: '4px 0 0',
          }}>
            Anna de Vries
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '13px',
            color: colors.textMuted,
            margin: '2px 0 0',
          }}>
            Życie, jakiego nigdy sobie nie pozwoliłaś &bull;{' '}
            <Link href="mailto:anna@najpierw-ja.pl" style={{ color: colors.accent, textDecoration: 'underline' }}>
              anna@najpierw-ja.pl
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
            Życie, jakiego nigdy sobie nie pozwoliłaś
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '11px',
            color: colors.footerText,
            lineHeight: '1.7',
            margin: '0 0 8px',
          }}>
            Performance Marketing Solution s.r.o. &bull; Rybná 716/24, 110 00 Praha, Staré Město
            <br />
            IČO: 06259928 &middot; DIČ: CZ06259928
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '11px',
            color: colors.footerText,
            lineHeight: '1.5',
            margin: '0',
          }}>
            Otrzymujesz tę wiadomość, ponieważ rozpoczęłaś zamówienie na najpierw-ja.pl.
          </Text>
        </div>
      </Section>
    </Base>
  )
}

ZzAbandonedCheckout1Template.PreviewProps = {
  firstName: 'Anna',
  checkoutUrl: 'https://www.najpierw-ja.pl/checkout',
  productName: 'Życie, jakiego nigdy sobie nie pozwoliłaś',
  productPrice: '129',
  productImage: '',
  preview: 'Twoja książka jest zapakowana i czeka na Ciebie!',
} as ZzAbandonedCheckout1Props

export default ZzAbandonedCheckout1Template
