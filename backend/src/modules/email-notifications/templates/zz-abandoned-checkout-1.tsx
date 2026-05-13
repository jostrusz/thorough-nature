import { Text, Section, Button, Img, Hr, Link } from '@react-email/components'
import * as React from 'react'
import { ZzBase } from './zz-base'

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

// Fonts mirror the najpierw-ja.pl landing page
const fontBody = "'DM Sans', Helvetica, Arial, sans-serif"
const fontSerif = "'Recoleta', Georgia, 'Times New Roman', serif"
const pad = '28px'

// Palette ported from the storefront :root (index.html)
const colors = {
  bg: '#FFF8F3',
  heading: '#4A1A2E',
  cta: '#B85C4A',
  ctaHover: '#A04A38',
  section: '#F0D5C4',
  body: '#6B3344',
  highlight: '#E8A88C',
  dark: '#3D1E2A',
  white: '#FFFFFF',
  light: '#FDF5EF',
  muted: '#9B6B7A',
  accent: '#D4916A',
}

const DEFAULT_PRODUCT_IMAGE = 'https://www.najpierw-ja.pl/%C5%BBycie%2C-jakiego-nigdy-sobie-nie-pozwoli%C5%82a%C5%9B-pichi.png'

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
    <ZzBase preview={preview}>
      {/* ====== HEADER ====== */}
      <div style={{
        backgroundColor: colors.heading,
        background: `linear-gradient(135deg, ${colors.heading} 0%, ${colors.dark} 100%)`,
        padding: '44px 28px 38px',
        textAlign: 'center' as const,
      }}>
        <Text style={{
          fontFamily: fontBody,
          fontSize: '11px',
          fontWeight: 700,
          letterSpacing: '0.22em',
          textTransform: 'uppercase' as const,
          color: colors.highlight,
          margin: '0 0 12px 0',
        }}>
          Życie, jakiego nigdy sobie nie pozwoliłaś
        </Text>
        <Text style={{
          fontFamily: fontSerif,
          fontSize: '28px',
          fontWeight: 700,
          color: colors.white,
          margin: '0',
          lineHeight: '1.15',
          letterSpacing: '-0.02em',
        }}>
          Twoja książka czeka na Ciebie 📦
        </Text>
        <div style={{ width: '60px', height: '3px', background: colors.highlight, borderRadius: '2px', margin: '18px auto 0' }} />
      </div>

      {/* ====== GREETING + BODY ====== */}
      <Section style={{ padding: `30px ${pad} 0` }}>
        <Text style={{
          fontFamily: fontBody,
          fontSize: '15px',
          color: colors.body,
          lineHeight: '1.7',
          margin: '0',
        }}>
          Cześć {firstName},
        </Text>
        <Text style={{
          fontFamily: fontBody,
          fontSize: '15px',
          lineHeight: '1.7',
          margin: '14px 0 0',
          color: colors.body,
        }}>
          Dobre wieści — Twoje zamówienie na <strong style={{ color: colors.heading, fontFamily: fontSerif, fontWeight: 700 }}>{productName}</strong> jest już zapakowane i gotowe do wysyłki. Brakuje tylko Twojego potwierdzenia.
        </Text>
        <Text style={{
          fontFamily: fontBody,
          fontSize: '15px',
          lineHeight: '1.7',
          margin: '18px 0 0',
          color: colors.body,
        }}>
          Czy znasz to uczucie, gdy szafa pęka w szwach, a Ty stoisz rano i nie wiesz, w co się ubrać? Gdy głowa nie odpoczywa nawet w nocy? Gdy robisz wszystko dla innych — i pod koniec dnia dla Ciebie nic nie zostaje? Nie jesteś sama.
        </Text>
        <Text style={{
          fontFamily: fontBody,
          fontSize: '15px',
          lineHeight: '1.7',
          margin: '18px 0 0',
          color: colors.body,
        }}>
          Ta książka łączy esencję 10 światowych bestsellerów w jeden konkretny system: <strong style={{ color: colors.heading }}>LIFE RESET™ — 5 filarów, 30 dni, 8 minut dziennie</strong>. Bez teorii. Bez weekendowych wyjazdów. Tylko ćwiczenia, które możesz zrobić jeszcze dziś.
        </Text>
      </Section>

      {/* ====== PRODUCT CARD + IMAGE ====== */}
      <Section style={{ padding: `26px ${pad} 0`, textAlign: 'center' as const }}>
        <Img
          src={productImage || DEFAULT_PRODUCT_IMAGE}
          alt={productName}
          width="220"
          style={{ display: 'block', margin: '0 auto', maxWidth: '100%', borderRadius: '12px' }}
        />
        <div style={{
          backgroundColor: colors.light,
          borderRadius: '14px',
          border: `1px solid ${colors.section}`,
          padding: '22px 26px',
          textAlign: 'center' as const,
          marginTop: '22px',
        }}>
          <Text style={{
            fontFamily: fontSerif,
            fontSize: '19px',
            fontWeight: 700,
            margin: '0 0 8px',
            color: colors.heading,
            lineHeight: '1.25',
          }}>
            {productName}
          </Text>
          <Text style={{
            fontFamily: fontSerif,
            fontSize: '24px',
            fontWeight: 700,
            margin: '0',
            color: colors.cta,
          }}>
            {productPrice} zł
          </Text>
        </div>
      </Section>

      {/* ====== CTA BUTTON ====== */}
      <Section style={{ textAlign: 'center' as const, padding: `26px ${pad} 0` }}>
        <Button
          href={checkoutUrl}
          style={{
            backgroundColor: colors.cta,
            color: colors.white,
            fontFamily: fontBody,
            fontSize: '16px',
            fontWeight: 700,
            padding: '16px 44px',
            borderRadius: '10px',
            textDecoration: 'none',
            display: 'inline-block',
            letterSpacing: '0.01em',
          }}
        >
          Tak, wyślij mi książkę →
        </Button>
      </Section>

      <Section style={{ padding: `14px ${pad} 0` }}>
        <Text style={{
          fontFamily: fontBody,
          fontSize: '13px',
          lineHeight: '1.6',
          color: colors.muted,
          textAlign: 'center' as const,
          margin: '0',
        }}>
          Twoje dane są już wypełnione — dokończenie zamówienia zajmie tylko 1 minutę.
        </Text>
      </Section>

      <Hr style={{ margin: `26px ${pad}`, borderColor: colors.section }} />

      {/* ====== SIGN-OFF ====== */}
      <Section style={{ padding: `0 ${pad}` }}>
        <Text style={{
          fontFamily: fontBody,
          fontSize: '14px',
          color: colors.body,
          lineHeight: '1.6',
          margin: '0',
        }}>
          Do usłyszenia wkrótce,
        </Text>
        <Text style={{
          fontFamily: fontSerif,
          fontSize: '18px',
          fontWeight: 700,
          color: colors.heading,
          margin: '6px 0 0',
        }}>
          Anna de Vries
        </Text>
        <Text style={{
          fontFamily: fontBody,
          fontSize: '13px',
          color: colors.muted,
          margin: '4px 0 0',
        }}>
          Życie, jakiego nigdy sobie nie pozwoliłaś •{' '}
          <Link href="mailto:anna@najpierw-ja.pl" style={{ color: colors.cta, textDecoration: 'underline' }}>
            anna@najpierw-ja.pl
          </Link>
        </Text>
      </Section>

      <div style={{ height: '32px' }}></div>

      {/* ====== FOOTER ====== */}
      <div style={{
        backgroundColor: colors.dark,
        padding: '30px 28px',
        textAlign: 'center' as const,
      }}>
        <Text style={{
          fontFamily: fontSerif,
          fontSize: '15px',
          fontWeight: 700,
          color: colors.highlight,
          margin: '0 0 10px',
          letterSpacing: '0.01em',
        }}>
          Życie, jakiego nigdy sobie nie pozwoliłaś
        </Text>
        <Text style={{
          fontFamily: fontBody,
          fontSize: '11px',
          color: 'rgba(255,255,255,0.7)',
          lineHeight: '1.7',
          margin: '0 0 8px',
        }}>
          Performance Marketing Solution s.r.o. • Rybná 716/24, 110 00 Praha, Staré Město
          <br />
          IČO: 06259928 · DIČ: CZ06259928
        </Text>
        <Text style={{
          fontFamily: fontBody,
          fontSize: '11px',
          color: 'rgba(255,255,255,0.45)',
          lineHeight: '1.5',
          margin: '0',
        }}>
          Otrzymujesz tę wiadomość, ponieważ rozpoczęłaś zamówienie na najpierw-ja.pl.
        </Text>
      </div>
    </ZzBase>
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
