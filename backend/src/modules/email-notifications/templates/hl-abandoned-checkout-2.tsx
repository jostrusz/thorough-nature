import { Text, Section, Button, Hr, Link } from '@react-email/components'
import * as React from 'react'
import { Base } from './base'

export const HL_ABANDONED_CHECKOUT_2 = 'hl-abandoned-checkout-2'

export interface HlAbandonedCheckout2Props {
  firstName: string
  checkoutUrl: string
  productName: string
  productPrice: string
  productImage?: string
  preview?: string
}

export const isHlAbandonedCheckout2Data = (data: any): data is HlAbandonedCheckout2Props =>
  typeof data.firstName === 'string' && typeof data.checkoutUrl === 'string'

const font = "'Inter', 'Segoe UI', Arial, sans-serif"
const pad = '28px'

const colors = {
  headerBg: '#4A1A2E',
  headerGradient: 'linear-gradient(135deg, #5A2D3E 0%, #4A1A2E 50%, #3D1E2A 100%)',
  accent: '#B85C4A',
  accentSoft: '#FFF8F3',
  textDark: '#2D1B26',
  textBody: '#5A3D40',
  textMuted: '#8A7884',
  boxBorder: '#F0DCC4',
  starColor: '#F59E0B',
  footerBg: '#3D1E2A',
  footerText: '#9B7889',
  footerAccent: '#C9A96E',
  divider: '#F0DCC4',
  guaranteeBg: '#F0FDF4',
  guaranteeBorder: '#BBF7D0',
  guaranteeText: '#166534',
}

const ReviewCard: React.FC<{ text: string; author: string }> = ({ text, author }) => (
  <div style={{
    backgroundColor: '#FAFAFA',
    border: `1px solid ${colors.boxBorder}`,
    borderRadius: '10px',
    padding: '16px 18px',
    marginBottom: '10px',
  }}>
    <Text style={{
      fontFamily: font,
      fontSize: '14px',
      color: colors.starColor,
      margin: '0 0 6px',
      letterSpacing: '2px',
    }}>
      ★★★★★
    </Text>
    <Text style={{
      fontFamily: font,
      fontSize: '14px',
      fontStyle: 'italic' as const,
      color: colors.textBody,
      lineHeight: '1.6',
      margin: '0 0 8px',
    }}>
      „{text}"
    </Text>
    <Text style={{
      fontFamily: font,
      fontSize: '12px',
      fontWeight: 600,
      color: colors.textMuted,
      margin: '0',
    }}>
      — {author}
    </Text>
  </div>
)

export const HlAbandonedCheckout2Template: React.FC<HlAbandonedCheckout2Props> & {
  PreviewProps: HlAbandonedCheckout2Props
} = ({
  firstName,
  checkoutUrl,
  productName,
  productPrice,
  productImage,
  preview = 'Het verhaal achter dit boek — en waarom ik het móést schrijven.',
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
            fontSize: '24px',
            fontWeight: 800,
            color: '#ffffff',
            margin: '0',
            lineHeight: '1.2',
            letterSpacing: '-0.02em',
          }}>
            Het verhaal achter dit boek
          </Text>
        </div>

        {/* PERSONAL MESSAGE */}
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
            Ik wilde je even persoonlijk mailen. Niet om je te pushen — maar omdat ik denk dat je dit moet weten.
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            lineHeight: '1.7',
            margin: '16px 0 0',
            color: colors.textBody,
          }}>
            Ik heb dit boek niet geschreven omdat het een leuk idee leek. Ik heb het geschreven omdat ik 5 jaar geleden zelf op de keukenvloer zat te huilen. Met een huis vol spullen, een agenda die nooit stilstond en een hoofd dat 's nachts niet wilde stoppen met malen. Van buiten leek het prima. Vanbinnen viel ik stilletjes uit elkaar.
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            lineHeight: '1.7',
            margin: '16px 0 0',
            color: colors.textBody,
          }}>
            Toen kocht ik 10 toonaangevende boeken over loslaten, opruimen, grenzen stellen, rust en energie. Las ze allemaal. En ontdekte iets vreemds: ze zeiden eigenlijk allemaal hetzelfde — alleen ieder vanuit een andere hoek. Ik bracht die kern samen in één systeem: <strong style={{ color: colors.textDark }}>de LIFE RESET™-methode</strong>. 5 pijlers, 30 dagen, geen theorie. Alleen oefeningen die je nog dezelfde dag kunt doen.
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            lineHeight: '1.7',
            margin: '16px 0 0',
            color: colors.textBody,
          }}>
            350 pagina's, 12 werkboeken en 2 bonus e-books. Geen zelfhulpboek dat je vertelt om „positief te denken". Een praktisch systeem dat je huis, je hoofd, je relaties én je energie écht verandert.
          </Text>
        </div>

        <Hr style={{ margin: `24px ${pad}`, borderColor: colors.divider }} />

        {/* REVIEWS */}
        <div style={{ padding: `0 ${pad}` }}>
          <Text style={{
            fontFamily: font,
            fontSize: '13px',
            fontWeight: 700,
            textTransform: 'uppercase' as const,
            letterSpacing: '1.5px',
            color: colors.textMuted,
            margin: '0 0 14px',
          }}>
            Wat andere lezers zeggen
          </Text>

          <ReviewCard
            text="Van 347 kledingstukken hield ik er 73 over. En voor het eerst weet ik wat ik aan kan doen."
            author="Femke, 38"
          />
          <ReviewCard
            text="Ik heb mijn bed verplaatst. Ik slaap voor het eerst in maanden de hele nacht door."
            author="Marieke, 41"
          />
          <ReviewCard
            text="Ik heb geleerd om zonder schuldgevoel NEE te zeggen. Voor het eerst heb ik tijd voor mezelf."
            author="Sanne, 39"
          />
        </div>

        {/* GUARANTEE */}
        <div style={{ padding: `20px ${pad} 0` }}>
          <div style={{
            backgroundColor: colors.guaranteeBg,
            border: `1px solid ${colors.guaranteeBorder}`,
            borderRadius: '10px',
            padding: '16px 20px',
            textAlign: 'center' as const,
          }}>
            <Text style={{
              fontFamily: font,
              fontSize: '14px',
              fontWeight: 600,
              color: colors.guaranteeText,
              margin: '0',
              lineHeight: '1.5',
            }}>
              ✓ 100% Niet-goed-geld-terug garantie binnen 30 dagen.
              <br />
              Geen vragen, geen gedoe. Het risico is voor mij, niet voor jou.
            </Text>
          </div>
        </div>

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
            Ik wil mijn rust terug →
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
            Je boek kan morgen al onderweg zijn.
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
            Performance Marketing Solution s.r.o. &bull; Rybná 716/24, 110 00 Staré Město, Praha, CZ
            <br />
            IČ: 06259928 &bull; DIČ: CZ06259928
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

HlAbandonedCheckout2Template.PreviewProps = {
  firstName: 'Sophie',
  checkoutUrl: 'https://www.pakjeleventerug.nl/checkout',
  productName: 'Het Leven Dat Je Verdient',
  productPrice: '36,00',
  productImage: '',
  preview: 'Het verhaal achter dit boek — en waarom ik het móést schrijven.',
} as HlAbandonedCheckout2Props

export default HlAbandonedCheckout2Template
