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
        <Text style={{ fontSize: '22px', fontWeight: 'bold', textAlign: 'center', margin: '0 0 20px', color: '#333' }}>
          Hoi {firstName},
        </Text>

        <Text style={{ fontSize: '16px', lineHeight: '1.6', margin: '0 0 25px', color: '#555' }}>
          Je hebt nog iets in je winkelwagen laten liggen! Geen zorgen — je bestelling
          is nog beschikbaar en wacht op je.
        </Text>

        {productImage && (
          <div style={{ textAlign: 'center', margin: '0 0 20px' }}>
            <Img
              src={productImage}
              alt={productName}
              width="200"
              style={{ borderRadius: '8px', maxWidth: '100%' }}
            />
          </div>
        )}

        <div style={{
          background: '#f9f5f0',
          borderRadius: '10px',
          padding: '16px 20px',
          margin: '0 0 25px',
          textAlign: 'center',
        }}>
          <Text style={{ fontSize: '17px', fontWeight: '600', margin: '0 0 4px', color: '#333' }}>
            {productName}
          </Text>
          <Text style={{ fontSize: '20px', fontWeight: 'bold', margin: '0', color: '#8B5E3C' }}>
            €{productPrice}
          </Text>
        </div>

        <div style={{ textAlign: 'center', margin: '0 0 25px' }}>
          <Button
            href={checkoutUrl}
            style={{
              backgroundColor: '#8B5E3C',
              color: '#ffffff',
              fontSize: '16px',
              fontWeight: 'bold',
              padding: '14px 32px',
              borderRadius: '8px',
              textDecoration: 'none',
              display: 'inline-block',
            }}
          >
            Rond je bestelling af →
          </Button>
        </div>

        <Text style={{ fontSize: '14px', lineHeight: '1.5', color: '#888', textAlign: 'center', margin: '0 0 10px' }}>
          Klik op de knop hierboven om direct verder te gaan waar je gebleven was.
          Je gegevens zijn al ingevuld.
        </Text>

        <Hr style={{ margin: '25px 0 15px', borderColor: '#eee' }} />

        <Text style={{ fontSize: '13px', color: '#aaa', textAlign: 'center', margin: '0' }}>
          Vragen? Neem contact op via devries@loslatenboek.nl
        </Text>
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
