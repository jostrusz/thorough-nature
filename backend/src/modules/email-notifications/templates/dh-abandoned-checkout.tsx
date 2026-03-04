import { Text, Section, Button, Img, Hr } from '@react-email/components'
import * as React from 'react'
import { Base } from './base'

export const DH_ABANDONED_CHECKOUT = 'dh-abandoned-checkout'

export interface DhAbandonedCheckoutTemplateProps {
  firstName: string
  checkoutUrl: string
  productName: string
  productPrice: string
  productImage?: string
  preview?: string
}

export const isDhAbandonedCheckoutData = (data: any): data is DhAbandonedCheckoutTemplateProps =>
  typeof data.firstName === 'string' && typeof data.checkoutUrl === 'string'

const font = "'Inter', Arial, sans-serif"
const pad = '24px'

// DH Brand colors
const colors = {
  headerBg: '#4C1D95',
  headerGradient: 'linear-gradient(135deg, #4C1D95 0%, #2E1065 100%)',
  accent: '#7C3AED',
  accentLight: '#A78BFA',
  accentMuted: '#8B5CF6',
  textDark: '#1F2937',
  textBody: '#374151',
  textMuted: '#6B7280',
  boxBg: '#FAF5FF',
  boxBorder: '#E9D5FF',
  footerBg: '#1E1B4B',
}

export const DhAbandonedCheckoutTemplate: React.FC<DhAbandonedCheckoutTemplateProps> & {
  PreviewProps: DhAbandonedCheckoutTemplateProps
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
          backgroundColor: colors.headerBg,
          background: colors.headerGradient,
          padding: '32px 24px',
          textAlign: 'center' as const,
        }}>
          <Text style={{
            fontFamily: font,
            fontSize: '11px',
            fontWeight: 500,
            letterSpacing: '3px',
            textTransform: 'uppercase' as const,
            color: colors.accentLight,
            marginBottom: '8px',
          }}>
            De Hondenbijbel
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '22px',
            fontWeight: 700,
            color: '#ffffff',
            margin: '0',
            lineHeight: '1.3',
          }}>
            Je bent iets vergeten! 🐾
          </Text>
        </div>

        {/* Body */}
        <div style={{ padding: `28px ${pad}` }}>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            color: colors.textBody,
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
            color: colors.textBody,
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
            backgroundColor: colors.boxBg,
            borderRadius: '10px',
            border: `1px solid ${colors.boxBorder}`,
            padding: '16px 20px',
            margin: '0 0 22px',
            textAlign: 'center' as const,
          }}>
            <Text style={{ fontFamily: font, fontSize: '16px', fontWeight: 600, margin: '0 0 4px', color: colors.textDark }}>
              {productName}
            </Text>
            <Text style={{ fontFamily: font, fontSize: '18px', fontWeight: 700, margin: '0', color: colors.accent }}>
              €{productPrice}
            </Text>
          </div>

          <div style={{ textAlign: 'center' as const, margin: '0 0 22px' }}>
            <Button
              href={checkoutUrl}
              style={{
                backgroundColor: colors.accent,
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

          <Text style={{ fontFamily: font, fontSize: '13px', lineHeight: '1.5', color: colors.textMuted, textAlign: 'center' as const, margin: '0 0 8px' }}>
            Klik op de knop hierboven om direct verder te gaan waar je gebleven was.
            Je gegevens zijn al ingevuld.
          </Text>

          <Hr style={{ margin: '22px 0 14px', borderColor: colors.boxBorder }} />

          <Text style={{ fontFamily: font, fontSize: '13px', color: colors.textMuted, textAlign: 'center' as const, margin: '0' }}>
            Vragen? Neem contact op via support@dehondenbijbel.nl
          </Text>
        </div>

        {/* Footer */}
        <div style={{
          backgroundColor: colors.footerBg,
          padding: '24px 24px',
          textAlign: 'center' as const,
        }}>
          <Text style={{
            fontFamily: font,
            fontSize: '12px',
            color: colors.accentLight,
            marginBottom: '6px',
          }}>
            De Hondenbijbel
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '11px',
            color: '#6366F1',
            lineHeight: '1.6',
            margin: '0',
          }}>
            EverChapter OÜ &bull; Tallinn, Estonia
            <br />
            Je ontvangt deze e-mail omdat je een checkout hebt gestart op dehondenbijbel.nl.
          </Text>
        </div>
      </Section>
    </Base>
  )
}

DhAbandonedCheckoutTemplate.PreviewProps = {
  firstName: 'Jan',
  checkoutUrl: 'https://dehondenbijbel.nl/checkout',
  productName: 'De Hondenbijbel',
  productPrice: '34,95',
  productImage: '',
  preview: 'Je hebt nog iets in je winkelwagen laten liggen!',
} as DhAbandonedCheckoutTemplateProps

export default DhAbandonedCheckoutTemplate
