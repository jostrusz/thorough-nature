import { Text, Section, Button, Img, Hr, Link } from '@react-email/components'
import * as React from 'react'
import { Base } from './base'

export const HL_ABANDONED_CHECKOUT_1 = 'hl-abandoned-checkout-1'

export interface HlAbandonedCheckout1Props {
  firstName: string
  checkoutUrl: string
  productName: string
  productPrice: string
  productImage?: string
  billingEntity?: any
  preview?: string
}

export const isHlAbandonedCheckout1Data = (data: any): data is HlAbandonedCheckout1Props =>
  typeof data.firstName === 'string' && typeof data.checkoutUrl === 'string'

const font = "'Inter', 'Segoe UI', Arial, sans-serif"
const pad = '28px'

// Het Leven Dat Je Verdient brand palette — matches index page CSS variables
// (--bg #FFF8F3, --heading #4A1A2E, --cta #B85C4A, gold #C9A96E)
const colors = {
  headerBg: '#4A1A2E',
  headerGradient: 'linear-gradient(135deg, #5A2D3E 0%, #4A1A2E 50%, #3D1E2A 100%)',
  accent: '#B85C4A',           // --cta on the site
  accentSoft: '#FFF8F3',       // --bg cream
  textDark: '#2D1B26',
  textBody: '#5A3D40',
  textMuted: '#8A7884',
  boxBorder: '#F0DCC4',        // warm gold border (matches site)
  footerBg: '#3D1E2A',
  footerText: '#9B7889',
  footerAccent: '#C9A96E',     // brand gold
  divider: '#F0DCC4',
}

export const HlAbandonedCheckout1Template: React.FC<HlAbandonedCheckout1Props> & {
  PreviewProps: HlAbandonedCheckout1Props
} = ({
  firstName,
  checkoutUrl,
  productName,
  productPrice,
  productImage,
  billingEntity,
  preview = 'Je boek ligt klaar — je hoeft alleen nog op verzenden te drukken.',
}) => {
  return (
    <Base preview={preview}>
      <Section>
        {/* HEADER */}
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
            color: 'rgba(255,255,255,0.65)',
            margin: '0 0 10px 0',
          }}>
            ✦ LIFE RESET™ Methode
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
            Je boek staat klaar 📦
          </Text>
        </div>

        {/* BODY */}
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
            Wist je dat de meeste vrouwen niet vastzitten omdat ze niet sterk genoeg zijn? Ze zitten vast omdat alles tegelijk op hun schouders rust — het huis, het hoofd, de mensen, de energie. Steeds maar door, zonder dat iemand zegt: jij mag er ook zijn.
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            lineHeight: '1.7',
            margin: '16px 0 0',
            color: colors.textBody,
          }}>
            In 350 pagina's neem ik je mee door de 5 pijlers van de LIFE RESET™-methode: Spullen, Ruimte, Mensen, Geest en Energie. 30 dagen, stap voor stap. Geen vage adviezen, geen weekendretreats — alleen oefeningen die je nog dezelfde dag kunt doen.
          </Text>
        </div>

        {/* PRODUCT IMAGE */}
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

        {/* PRODUCT CARD */}
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
              €{productPrice}
            </Text>
          </div>
        </div>

        {/* CTA BUTTON */}
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
            Ja, verstuur mijn boek →
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

        {/* SIGN-OFF */}
        <div style={{ padding: `0 ${pad}` }}>
          <Text style={{
            fontFamily: font,
            fontSize: '14px',
            color: colors.textBody,
            lineHeight: '1.6',
            margin: '0',
          }}>
            Warme groet,
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
            Het Leven Dat Je Verdient &bull;{' '}
            <Link href="mailto:annadevries@pakjeleventerug.nl" style={{ color: colors.accent, textDecoration: 'underline' }}>
              annadevries@pakjeleventerug.nl
            </Link>
          </Text>
        </div>

        <div style={{ height: '28px' }}></div>

        {/* FOOTER */}
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
            Het Leven Dat Je Verdient &bull; LIFE RESET™ Methode
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '11px',
            color: colors.footerText,
            lineHeight: '1.7',
            margin: '0 0 8px',
          }}>
            {billingEntity?.legal_name || 'Performance Marketing Solution s.r.o.'}
            {' '}&bull;{' '}
            {billingEntity?.address
              ? `${billingEntity.address.address_1 || ''}, ${billingEntity.address.postal_code || ''} ${billingEntity.address.city || ''}${billingEntity.address.district ? ', ' + billingEntity.address.district : ''}`
              : 'Rybná 716/24, 110 00 Staré Město, Praha, CZ'}
            <br />
            IČ: {billingEntity?.registration_id || '06259928'}
            {(billingEntity?.vat_id || !billingEntity) && (
              <>
                {' '}&bull;{' '}
                DIČ: {billingEntity?.vat_id || 'CZ06259928'}
              </>
            )}
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '11px',
            color: '#71717A',
            lineHeight: '1.5',
            margin: '0',
          }}>
            Je ontvangt deze e-mail omdat je een checkout hebt gestart op pakjeleventerug.nl.
          </Text>
        </div>
      </Section>
    </Base>
  )
}

HlAbandonedCheckout1Template.PreviewProps = {
  firstName: 'Sophie',
  checkoutUrl: 'https://www.pakjeleventerug.nl/checkout',
  productName: 'Het Leven Dat Je Verdient',
  productPrice: '36,00',
  productImage: 'https://www.pakjeleventerug.nl/het-leven-dat-je-verdient-380w.webp',
  preview: 'Je boek ligt klaar — je hoeft alleen nog op verzenden te drukken.',
} as HlAbandonedCheckout1Props

export default HlAbandonedCheckout1Template
