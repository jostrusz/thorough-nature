import { Text, Section, Button, Img, Hr } from '@react-email/components'
import * as React from 'react'
import { Base } from './base'

export const ABANDONED_CHECKOUT = 'abandoned-checkout'

export interface AbandonedCheckoutTemplateProps {
  firstName: string
  checkoutUrl: string
  productName: string
  productPrice: string
  productImage?: string
  preview?: string
}

export const isAbandonedCheckoutData = (data: any): data is AbandonedCheckoutTemplateProps =>
  typeof data.firstName === 'string' && typeof data.checkoutUrl === 'string'

const font = "'Inter', Arial, sans-serif"
const pad = '24px'

export const AbandonedCheckoutTemplate: React.FC<AbandonedCheckoutTemplateProps> & {
  PreviewProps: AbandonedCheckoutTemplateProps
} = ({
  firstName,
  checkoutUrl,
  productName,
  productPrice,
  productImage,
  preview = 'Je hebt nog iets in je winkelwagen laten liggen!',
}) => {
  return (
    <Base preview={preview}>
      <Section>
        {/* Header */}
        <div style={{
          backgroundColor: '#2D1B3D',
          background: 'linear-gradient(135deg, #2D1B3D 0%, #1A1028 100%)',
          padding: '32px 24px',
          textAlign: 'center' as const,
        }}>
          <Text style={{
            fontFamily: font,
            fontSize: '11px',
            fontWeight: 500,
            letterSpacing: '3px',
            textTransform: 'uppercase' as const,
            color: '#C27BA0',
            marginBottom: '8px',
          }}>
            Laat Los Wat Je Kapotmaakt
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '22px',
            fontWeight: 700,
            color: '#ffffff',
            margin: '0',
            lineHeight: '1.3',
          }}>
            Je bent iets vergeten!
          </Text>
        </div>

        {/* Body */}
        <div style={{ padding: `28px ${pad}` }}>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            color: '#5A3D6B',
            lineHeight: '1.6',
            marginBottom: '6px',
          }}>
            Hoi {firstName},
          </Text>

          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            lineHeight: '1.6',
            margin: '0 0 22px',
            color: '#5A3D6B',
          }}>
            Je hebt nog iets in je winkelwagen laten liggen! Geen zorgen — je bestelling
            is nog beschikbaar en wacht op je.
          </Text>

          {productImage && (
            <div style={{ textAlign: 'center' as const, margin: '0 0 18px' }}>
              <Img
                src={productImage}
                alt={productName}
                width="200"
                style={{ borderRadius: '8px', maxWidth: '100%' }}
              />
            </div>
          )}

          <div style={{
            backgroundColor: '#FAF5F8',
            borderRadius: '10px',
            border: '1px solid #EDD9E5',
            padding: '16px 20px',
            margin: '0 0 22px',
            textAlign: 'center' as const,
          }}>
            <Text style={{ fontFamily: font, fontSize: '16px', fontWeight: 600, margin: '0 0 4px', color: '#2D1B3D' }}>
              {productName}
            </Text>
            <Text style={{ fontFamily: font, fontSize: '18px', fontWeight: 700, margin: '0', color: '#C27BA0' }}>
              €{productPrice}
            </Text>
          </div>

          <div style={{ textAlign: 'center' as const, margin: '0 0 22px' }}>
            <Button
              href={checkoutUrl}
              style={{
                backgroundColor: '#C27BA0',
                color: '#ffffff',
                fontFamily: font,
                fontSize: '16px',
                fontWeight: 600,
                padding: '14px 32px',
                borderRadius: '8px',
                textDecoration: 'none',
                display: 'inline-block',
              }}
            >
              Rond je bestelling af →
            </Button>
          </div>

          <Text style={{ fontFamily: font, fontSize: '13px', lineHeight: '1.5', color: '#9B7AAD', textAlign: 'center' as const, margin: '0 0 8px' }}>
            Klik op de knop hierboven om direct verder te gaan waar je gebleven was.
            Je gegevens zijn al ingevuld.
          </Text>

          <Hr style={{ margin: '22px 0 14px', borderColor: '#EDD9E5' }} />

          <Text style={{ fontFamily: font, fontSize: '13px', color: '#9B7AAD', textAlign: 'center' as const, margin: '0' }}>
            Vragen? Neem contact op via devries@loslatenboek.nl
          </Text>
        </div>

        {/* Footer */}
        <div style={{
          backgroundColor: '#2D1B3D',
          padding: '24px 24px',
          textAlign: 'center' as const,
        }}>
          <Text style={{
            fontFamily: font,
            fontSize: '12px',
            color: '#C27BA0',
            marginBottom: '6px',
          }}>
            Laat Los Wat Je Kapotmaakt
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '11px',
            color: '#7a6189',
            lineHeight: '1.6',
            margin: '0',
          }}>
            EverChapter OÜ &bull; Tallinn, Estonia
            <br />
            Je ontvangt deze e-mail omdat je een checkout hebt gestart.
          </Text>
        </div>
      </Section>
    </Base>
  )
}

AbandonedCheckoutTemplate.PreviewProps = {
  firstName: 'Sophie',
  checkoutUrl: 'https://loslatenboek.nl/checkout',
  productName: 'Laat Los Wat Je Kapotmaakt',
  productPrice: '35,00',
  productImage: '',
  preview: 'Je hebt nog iets in je winkelwagen laten liggen!',
} as AbandonedCheckoutTemplateProps

export default AbandonedCheckoutTemplate
