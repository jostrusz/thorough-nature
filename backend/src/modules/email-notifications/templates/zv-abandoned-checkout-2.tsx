import { Text, Section, Button, Img, Hr, Link } from '@react-email/components'
import * as React from 'react'
import { ZvBase } from './zv-base'

export const ZV_ABANDONED_CHECKOUT_2 = 'zv-abandoned-checkout-2'

export interface ZvAbandonedCheckout2Props {
  firstName: string
  checkoutUrl: string
  productName: string
  productPrice: string
  productImage?: string
  preview?: string
}

export const isZvAbandonedCheckout2Data = (data: any): data is ZvAbandonedCheckout2Props =>
  typeof data.firstName === 'string' && typeof data.checkoutUrl === 'string'

const fontBody = "'DM Sans', Helvetica, Arial, sans-serif"
const fontSerif = "'Recoleta', Georgia, 'Times New Roman', serif"
const pad = '28px'

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
  starColor: '#F0A500',
  guaranteeBg: '#F0FDF4',
  guaranteeBorder: '#BBF7D0',
  guaranteeText: '#166534',
}

const DEFAULT_PRODUCT_IMAGE = 'https://www.nejdriv-ja.cz/het-leven-dat-je-verdient-640w.webp'

const ReviewCard: React.FC<{ text: string; author: string }> = ({ text, author }) => (
  <div style={{
    backgroundColor: colors.light,
    border: `1px solid ${colors.section}`,
    borderLeft: `4px solid ${colors.highlight}`,
    borderRadius: '10px',
    padding: '18px 20px',
    marginBottom: '12px',
  }}>
    <Text style={{
      fontFamily: fontBody,
      fontSize: '14px',
      color: colors.starColor,
      margin: '0 0 8px',
      letterSpacing: '2px',
    }}>
      ★★★★★
    </Text>
    <Text style={{
      fontFamily: fontSerif,
      fontSize: '15px',
      fontStyle: 'italic' as const,
      color: colors.heading,
      lineHeight: '1.55',
      margin: '0 0 10px',
    }}>
      &ldquo;{text}&rdquo;
    </Text>
    <Text style={{
      fontFamily: fontBody,
      fontSize: '12px',
      fontWeight: 600,
      color: colors.muted,
      margin: '0',
      letterSpacing: '0.03em',
    }}>
      — {author}
    </Text>
  </div>
)

export const ZvAbandonedCheckout2Template: React.FC<ZvAbandonedCheckout2Props> & {
  PreviewProps: ZvAbandonedCheckout2Props
} = ({
  firstName,
  checkoutUrl,
  productName,
  productPrice,
  productImage,
  preview = 'Už po týdnu jsem se cítila lehčí než za poslední roky...',
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
          fontSize: '26px',
          fontWeight: 700,
          color: colors.white,
          margin: '0',
          lineHeight: '1.2',
          letterSpacing: '-0.02em',
        }}>
          Příběh, který stojí za touhle knihou
        </Text>
        <div style={{ width: '60px', height: '3px', background: colors.highlight, borderRadius: '2px', margin: '18px auto 0' }} />
      </div>

      {/* ====== PERSONAL MESSAGE ====== */}
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
          chtěla jsem ti napsat osobně. Ne proto, abych na tebe tlačila — ale protože věřím, že tohle potřebuješ slyšet.
        </Text>
        <Text style={{
          fontFamily: fontBody,
          fontSize: '15px',
          lineHeight: '1.7',
          margin: '18px 0 0',
          color: colors.body,
        }}>
          Před 5 lety jsem seděla na podlaze v kuchyni a brečela. Zvenku vypadalo všechno dokonale — uklizený dům, nakrmené děti, plný kalendář. A uvnitř? Úplně vyčerpaná. Z toho, že jsem musela mít všechno pod kontrolou.
        </Text>
        <Text style={{
          fontFamily: fontBody,
          fontSize: '15px',
          lineHeight: '1.7',
          margin: '18px 0 0',
          color: colors.body,
        }}>
          Ten večer jsem si objednala 10 světových bestsellerů o odpouštění, hranicích, úklidu a klidu. Za 4 měsíce jsem je přečetla všechny. A zjistila jsem, že všechny říkají to samé — jen každá z jiné strany. Spojila jsem je do jednoho systému: <strong style={{ color: colors.heading }}>LIFE RESET™ — 5 pilířů, 30 dní</strong>.
        </Text>
        <Text style={{
          fontFamily: fontBody,
          fontSize: '15px',
          lineHeight: '1.7',
          margin: '18px 0 0',
          color: colors.body,
        }}>
          Nemusíš být psycholožka. Nepotřebuješ terapeutku. 8 minut denně. Jedna zásuvka. Jedno „ne". A po 30 dnech jsi jiný člověk — v tom dobrém slova smyslu.
        </Text>
      </Section>

      <Hr style={{ margin: `26px ${pad}`, borderColor: colors.section }} />

      {/* ====== REVIEWS ====== */}
      <Section style={{ padding: `0 ${pad}` }}>
        <Text style={{
          fontFamily: fontBody,
          fontSize: '12px',
          fontWeight: 700,
          textTransform: 'uppercase' as const,
          letterSpacing: '0.2em',
          color: colors.cta,
          margin: '0 0 16px',
        }}>
          Co říkají další čtenářky
        </Text>

        <ReviewCard
          text="Z 347 kousků oblečení mi zůstalo 73. A poprvé po letech vím, co na sebe. Maličkost — a úplně mi změnila rána."
          author="Karolína, 38, Brno"
        />
        <ReviewCard
          text="Přesunula jsem postel. Poprvé po měsících prospím celou noc. Nevím, proč to funguje — ale funguje."
          author="Magda, 41, Ostrava"
        />
        <ReviewCard
          text="Naučila jsem se říkat NE bez výčitek. Ta dvě písmena zachránila moje manželství."
          author="Olga, 39, Praha"
        />
      </Section>

      {/* ====== GUARANTEE ====== */}
      <Section style={{ padding: `22px ${pad} 0` }}>
        <div style={{
          backgroundColor: colors.guaranteeBg,
          border: `1px solid ${colors.guaranteeBorder}`,
          borderRadius: '10px',
          padding: '16px 20px',
          textAlign: 'center' as const,
        }}>
          <Text style={{
            fontFamily: fontBody,
            fontSize: '14px',
            fontWeight: 600,
            color: colors.guaranteeText,
            margin: '0',
            lineHeight: '1.55',
          }}>
            ✓ 100% garance vrácení peněz do 30 dnů.
            <br />
            Bez otázek, bez komplikací. Riziko nesu já, ne ty.
          </Text>
        </div>
      </Section>

      {/* ====== PRODUCT CARD + IMAGE ====== */}
      <Section style={{ padding: `22px ${pad} 0`, textAlign: 'center' as const }}>
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
          }}
        >
          Chci zpátky svůj život →
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
          Tvoje kniha může být na cestě už zítra.
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
          Srdečně,
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

ZvAbandonedCheckout2Template.PreviewProps = {
  firstName: 'Petra',
  checkoutUrl: 'https://www.nejdriv-ja.cz/checkout',
  productName: 'Život, který si zasloužíš',
  productPrice: '749',
  productImage: '',
  preview: 'Už po týdnu jsem se cítila lehčí než za poslední roky...',
} as ZvAbandonedCheckout2Props

export default ZvAbandonedCheckout2Template
