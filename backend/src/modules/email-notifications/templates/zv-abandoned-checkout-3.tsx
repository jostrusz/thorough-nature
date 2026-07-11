import { Text, Section, Button, Img, Hr, Link } from '@react-email/components'
import * as React from 'react'
import { ZvBase } from './zv-base'

export const ZV_ABANDONED_CHECKOUT_3 = 'zv-abandoned-checkout-3'

export interface ZvAbandonedCheckout3Props {
  firstName: string
  checkoutUrl: string
  productName: string
  productPrice: string
  productImage?: string
  preview?: string
}

export const isZvAbandonedCheckout3Data = (data: any): data is ZvAbandonedCheckout3Props =>
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
  urgentBg: '#FEF2F2',
  urgentBorder: '#FECACA',
  urgentText: '#991B1B',
  futureBg: '#FFFBEB',
  futureBorder: '#FDE68A',
  futureText: '#78350F',
  futureHeading: '#92400E',
}

const DEFAULT_PRODUCT_IMAGE = 'https://www.nejdriv-ja.cz/het-leven-dat-je-verdient-640w.webp'

export const ZvAbandonedCheckout3Template: React.FC<ZvAbandonedCheckout3Props> & {
  PreviewProps: ZvAbandonedCheckout3Props
} = ({
  firstName,
  checkoutUrl,
  productName,
  productPrice,
  productImage,
  preview = 'Zbývá 24 hodin — pak musím tvůj košík uvolnit.',
}) => {
  return (
    <ZvBase preview={preview}>
      {/* ====== HEADER — darker/urgent ====== */}
      <div style={{
        backgroundColor: colors.dark,
        background: `linear-gradient(135deg, ${colors.heading} 0%, ${colors.dark} 50%, #2A0F1A 100%)`,
        padding: '44px 28px 38px',
        textAlign: 'center' as const,
      }}>
        <Text style={{
          fontFamily: fontBody,
          fontSize: '11px',
          fontWeight: 700,
          letterSpacing: '0.22em',
          textTransform: 'uppercase' as const,
          color: 'rgba(232,168,140,0.7)',
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
          Poslední šance, {firstName}
        </Text>
        <div style={{ width: '60px', height: '3px', background: colors.highlight, borderRadius: '2px', margin: '18px auto 0' }} />
      </div>

      {/* ====== URGENT BANNER ====== */}
      <Section style={{ padding: `22px ${pad} 0` }}>
        <div style={{
          backgroundColor: colors.urgentBg,
          border: `1px solid ${colors.urgentBorder}`,
          borderRadius: '10px',
          padding: '14px 18px',
          textAlign: 'center' as const,
        }}>
          <Text style={{
            fontFamily: fontBody,
            fontSize: '13px',
            fontWeight: 600,
            color: colors.urgentText,
            margin: '0',
          }}>
            ⏰ Tvůj košík se za 24 hodin automaticky uvolní
          </Text>
        </div>
      </Section>

      {/* ====== BODY ====== */}
      <Section style={{ padding: `22px ${pad} 0` }}>
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
          píšu ti kvůli tvé objednávce naposledy. Košík ti podržím ještě 24 hodin — pak se automaticky uvolní.
        </Text>
        <Text style={{
          fontFamily: fontBody,
          fontSize: '15px',
          lineHeight: '1.7',
          margin: '18px 0 0',
          color: colors.body,
        }}>
          Nechci na tebe tlačit. Ale chci k tobě být upřímná.
        </Text>
        <Text style={{
          fontFamily: fontBody,
          fontSize: '15px',
          lineHeight: '1.7',
          margin: '18px 0 0',
          color: colors.body,
        }}>
          Ta tíha, kterou v sobě teď nosíš — přeplněná skříň, hluk v hlavě, „ne", které nejde vyslovit, věčná únava — sama od sebe nezmizí. Zítra to nebude lepší. Naopak: za rok bude tvoje skříň plnější, hlava hlučnější a energie nižší.
        </Text>
      </Section>

      {/* ====== FUTURE PACING ====== */}
      <Section style={{ padding: `22px ${pad} 0` }}>
        <div style={{
          backgroundColor: colors.futureBg,
          border: `1px solid ${colors.futureBorder}`,
          borderRadius: '12px',
          padding: '22px 22px',
        }}>
          <Text style={{
            fontFamily: fontSerif,
            fontSize: '15px',
            fontWeight: 700,
            color: colors.futureHeading,
            margin: '0 0 10px',
            letterSpacing: '0.01em',
          }}>
            💭 Představ si tohle:
          </Text>
          <Text style={{
            fontFamily: fontBody,
            fontSize: '14px',
            color: colors.futureText,
            lineHeight: '1.75',
            margin: '0',
          }}>
            Je to za 30 dní. Otevřeš skříň a hned víš, co si vezmeš na sebe. Zavolá máma s prosbou — řekneš „dneska ne, mami" — položíš telefon, nadechneš se a jdeš dál. Bez výčitek. Večer sedíš na gauči a neděláš nic. A poprvé po letech je ticho — doma i uvnitř tebe.
          </Text>
        </div>
      </Section>

      <Section style={{ padding: `18px ${pad} 0` }}>
        <Text style={{
          fontFamily: fontBody,
          fontSize: '15px',
          lineHeight: '1.7',
          margin: '0',
          color: colors.body,
        }}>
          Není to fantazie. Přesně tohle už s metodou LIFE RESET™ zažily <strong style={{ color: colors.heading }}>stovky žen</strong>. A většina z nich začínala s úplně stejnými pochybnostmi, jaké máš teď ty.
        </Text>
        <Text style={{
          fontFamily: fontSerif,
          fontSize: '16px',
          lineHeight: '1.55',
          margin: '14px 0 0',
          color: colors.heading,
          fontWeight: 700,
          fontStyle: 'italic' as const,
        }}>
          Víš, v čem byl rozdíl? Rozhodly se začít dnes. Jedna zásuvka. Osm minut.
        </Text>
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
          Ano, začínám dnes →
        </Button>
      </Section>

      {/* ====== TRUST BADGES ====== */}
      <Section style={{ padding: `20px ${pad} 0`, textAlign: 'center' as const }}>
        <Text style={{
          fontFamily: fontBody,
          fontSize: '13px',
          color: colors.muted,
          lineHeight: '2',
          margin: '0',
        }}>
          ✓ 30denní garance vrácení peněz<br />
          ✓ Skladem v ČR — doručení do 2 pracovních dnů<br />
          ✓ 2 bonusové e-knihy zdarma
        </Text>
      </Section>

      <Hr style={{ margin: `26px ${pad}`, borderColor: colors.section }} />

      {/* ====== CLOSING ====== */}
      <Section style={{ padding: `0 ${pad}` }}>
        <Text style={{
          fontFamily: fontBody,
          fontSize: '15px',
          lineHeight: '1.7',
          margin: '0',
          color: colors.body,
        }}>
          Po tomhle e-mailu ti už žádné připomenutí nepošlu. Rozhodnutí je na tobě — a ať se rozhodneš jakkoli, plně to respektuju.
        </Text>
        <Text style={{
          fontFamily: fontBody,
          fontSize: '15px',
          lineHeight: '1.7',
          margin: '16px 0 0',
          color: colors.body,
        }}>
          Ale jestli sis někdy pomyslela <em style={{ color: colors.heading, fontStyle: 'italic' as const }}>„chtěla bych konečně pustit všechno, co mě dusí"</em> — tohle je tvoje šance.
        </Text>
      </Section>

      <Hr style={{ margin: `26px ${pad}`, borderColor: colors.section }} />

      {/* ====== SIGN-OFF ====== */}
      <Section style={{ padding: `0 ${pad}` }}>
        <Text style={{
          fontFamily: fontSerif,
          fontSize: '18px',
          fontWeight: 700,
          color: colors.heading,
          margin: '0',
        }}>
          Anna de Vries
        </Text>
        <Text style={{
          fontFamily: fontBody,
          fontSize: '13px',
          color: colors.muted,
          margin: '4px 0 0',
        }}>
          Život, který si zasloužíš
        </Text>
        <Text style={{
          fontFamily: fontBody,
          fontSize: '13px',
          color: colors.muted,
          margin: '16px 0 0',
          fontStyle: 'italic' as const,
          lineHeight: '1.65',
        }}>
          P.S. Máš otázky? Napiš mi osobně na{' '}
          <Link href="mailto:anna@nejdriv-ja.cz" style={{ color: colors.cta, textDecoration: 'underline', fontWeight: 600, fontStyle: 'normal' as const }}>
            anna@nejdriv-ja.cz
          </Link>
          . Každou zprávu čtu a odpovídám na ni osobně.
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
          Tento e-mail ti přišel, protože jsi rozpracovala objednávku na nejdriv-ja.cz. Je to poslední připomenutí — k této objednávce už ti žádná další zpráva nepřijde.
        </Text>
      </div>
    </ZvBase>
  )
}

ZvAbandonedCheckout3Template.PreviewProps = {
  firstName: 'Petra',
  checkoutUrl: 'https://www.nejdriv-ja.cz/checkout',
  productName: 'Život, který si zasloužíš',
  productPrice: '749',
  productImage: '',
  preview: 'Zbývá 24 hodin — pak musím tvůj košík uvolnit.',
} as ZvAbandonedCheckout3Props

export default ZvAbandonedCheckout3Template
