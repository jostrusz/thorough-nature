import { Text, Section, Button, Img, Hr, Link } from '@react-email/components'
import * as React from 'react'
import { ZvBase } from './zv-base'

export const ZV_ABANDONED_CHECKOUT_1 = 'zv-abandoned-checkout-1'

export interface ZvAbandonedCheckout1Props {
  firstName: string
  checkoutUrl: string
  productName: string
  productPrice: string
  productImage?: string
  preview?: string
}

export const isZvAbandonedCheckout1Data = (data: any): data is ZvAbandonedCheckout1Props =>
  typeof data.firstName === 'string' && typeof data.checkoutUrl === 'string'

// Fonts mirror the nejdriv-ja.cz landing page
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

const DEFAULT_PRODUCT_IMAGE = 'https://www.nejdriv-ja.cz/het-leven-dat-je-verdient-640w.webp'

export const ZvAbandonedCheckout1Template: React.FC<ZvAbandonedCheckout1Props> & {
  PreviewProps: ZvAbandonedCheckout1Props
} = ({
  firstName,
  checkoutUrl,
  productName,
  productPrice,
  productImage,
  preview = 'Tvoje kniha je zabalená a čeká jen na tebe!',
}) => {
  return (
    <ZvBase preview={preview}>
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
          Život, který si zasloužíš
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
          Tvoje kniha na tebe čeká 📦
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
          Ahoj {firstName},
        </Text>
        <Text style={{
          fontFamily: fontBody,
          fontSize: '15px',
          lineHeight: '1.7',
          margin: '14px 0 0',
          color: colors.body,
        }}>
          dobrá zpráva — tvoje objednávka knihy <strong style={{ color: colors.heading, fontFamily: fontSerif, fontWeight: 700 }}>{productName}</strong> je zabalená a připravená k odeslání. Chybí už jen tvoje potvrzení.
        </Text>
        <Text style={{
          fontFamily: fontBody,
          fontSize: '15px',
          lineHeight: '1.7',
          margin: '18px 0 0',
          color: colors.body,
        }}>
          Znáš ten pocit, když skříň praská ve švech a ty ráno stojíš před ní a nevíš, co na sebe? Když hlava nevypne ani v noci? Když děláš všechno pro ostatní — a na konci dne na tebe nezbude nic? Nejsi v tom sama.
        </Text>
        <Text style={{
          fontFamily: fontBody,
          fontSize: '15px',
          lineHeight: '1.7',
          margin: '18px 0 0',
          color: colors.body,
        }}>
          Tahle kniha spojuje to nejlepší z 10 světových bestsellerů do jednoho konkrétního systému: <strong style={{ color: colors.heading }}>LIFE RESET™ — 5 pilířů, 30 dní, 8 minut denně</strong>. Žádná teorie. Žádné víkendové pobyty. Jen cvičení, která můžeš udělat ještě dnes.
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
            {productPrice} Kč
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
          Ano, pošlete mi knihu →
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
          Tvoje údaje už jsou vyplněné — dokončení objednávky zabere jen minutu.
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
          Brzy naslyšenou,
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
          Život, který si zasloužíš •{' '}
          <Link href="mailto:anna@nejdriv-ja.cz" style={{ color: colors.cta, textDecoration: 'underline' }}>
            anna@nejdriv-ja.cz
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
          Život, který si zasloužíš
        </Text>
        <Text style={{
          fontFamily: fontBody,
          fontSize: '11px',
          color: 'rgba(255,255,255,0.7)',
          lineHeight: '1.7',
          margin: '0 0 8px',
        }}>
          EverChapter OÜ &bull; Tallinn, Estonia
        </Text>
        <Text style={{
          fontFamily: fontBody,
          fontSize: '11px',
          color: 'rgba(255,255,255,0.45)',
          lineHeight: '1.5',
          margin: '0',
        }}>
          Tento e-mail ti přišel, protože jsi rozpracovala objednávku na nejdriv-ja.cz.
        </Text>
      </div>
    </ZvBase>
  )
}

ZvAbandonedCheckout1Template.PreviewProps = {
  firstName: 'Petra',
  checkoutUrl: 'https://www.nejdriv-ja.cz/checkout',
  productName: 'Život, který si zasloužíš',
  productPrice: '749',
  productImage: '',
  preview: 'Tvoje kniha je zabalená a čeká jen na tebe!',
} as ZvAbandonedCheckout1Props

export default ZvAbandonedCheckout1Template
