import { Text, Section, Button, Img, Hr, Link } from '@react-email/components'
import * as React from 'react'
import { Base } from './base'

export const DH_ABANDONED_CHECKOUT_2 = 'dh-abandoned-checkout-2'

export interface DhAbandonedCheckout2Props {
  firstName: string
  checkoutUrl: string
  productName: string
  productPrice: string
  productImage?: string
  preview?: string
}

export const isDhAbandonedCheckout2Data = (data: any): data is DhAbandonedCheckout2Props =>
  typeof data.firstName === 'string' && typeof data.checkoutUrl === 'string'

const font = "'Inter', 'Segoe UI', Arial, sans-serif"
const pad = '28px'

const colors = {
  headerBg: '#EA580C',
  headerGradient: 'linear-gradient(135deg, #F97316 0%, #EA580C 50%, #C2410C 100%)',
  accent: '#EA580C',
  accentSoft: '#FFF7ED',
  textDark: '#18181B',
  textBody: '#3F3F46',
  textMuted: '#71717A',
  boxBorder: '#E4E4E7',
  starColor: '#F59E0B',
  footerBg: '#18181B',
  footerText: '#A1A1AA',
  footerAccent: '#FB923C',
  divider: '#E4E4E7',
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
      &ldquo;{text}&rdquo;
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

export const DhAbandonedCheckout2Template: React.FC<DhAbandonedCheckout2Props> & {
  PreviewProps: DhAbandonedCheckout2Props
} = ({
  firstName,
  checkoutUrl,
  productName,
  productPrice,
  productImage,
  preview = 'Na 1 week liep onze hond al rustiger aan de lijn...',
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
            De Hondenbijbel
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

        {/* ====== PERSONAL MESSAGE ====== */}
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
            Ik heb De Hondenbijbel niet geschreven omdat het &ldquo;leuk&rdquo; leek om een boek te schrijven. Ik heb het geschreven omdat ik jarenlang zag hoe hondenbaasjes worstelden met dezelfde problemen — trekken aan de lijn, niet luisteren, agressie naar andere honden — en steeds weer hetzelfde advies kregen dat gewoon niet werkte.
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            lineHeight: '1.7',
            margin: '16px 0 0',
            color: colors.textBody,
          }}>
            Dit boek is het resultaat van alles wat ik heb geleerd. Elke techniek is getest. Elke methode is bewezen. En het mooiste? Je hoeft geen &ldquo;hondenexpert&rdquo; te zijn om resultaat te zien.
          </Text>
        </div>

        <Hr style={{ margin: `24px ${pad}`, borderColor: colors.divider }} />

        {/* ====== REVIEWS ====== */}
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
            Wat andere baasjes zeggen
          </Text>

          <ReviewCard
            text="Onze hond trok altijd aan de lijn. Na 1 week met dit boek loopt hij rustig naast me. Echt een aanrader!"
            author="Marieke D., Utrecht"
          />
          <ReviewCard
            text="Ik had al van alles geprobeerd. Dit boek legt het zó helder uit dat het meteen klikte. Mijn hond luistert nu echt."
            author="Thomas B., Antwerpen"
          />
          <ReviewCard
            text="Binnen 3 dagen merkbaar verschil. Ik wou dat ik dit boek eerder had gevonden."
            author="Sanne K., Amsterdam"
          />
        </div>

        {/* ====== GUARANTEE ====== */}
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

        {/* ====== PRODUCT CARD ====== */}
        <div style={{ padding: `20px ${pad} 0` }}>
          <div style={{
            backgroundColor: colors.accentSoft,
            borderRadius: '12px',
            border: '1px solid #FED7AA',
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
              &euro;{productPrice}
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
            Ik wil resultaat met mijn hond &#8594;
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
            Je pakketje kan morgen al onderweg zijn.
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
            Hartelijke groet,
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '14px',
            fontWeight: 700,
            color: colors.textDark,
            margin: '4px 0 0',
          }}>
            Lars Vermeulen
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '13px',
            color: colors.textMuted,
            margin: '2px 0 0',
          }}>
            De Hondenbijbel &bull;{' '}
            <Link href="mailto:support@dehondenbijbel.nl" style={{ color: colors.accent, textDecoration: 'underline' }}>
              support@dehondenbijbel.nl
            </Link>
          </Text>
        </div>

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
            De Hondenbijbel
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '11px',
            color: colors.footerText,
            lineHeight: '1.7',
            margin: '0 0 8px',
          }}>
            EverChapter OÜ &bull; Tallinn, Estonia
            <br />
            Reg. nr: 16938029
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '11px',
            color: '#71717A',
            lineHeight: '1.5',
            margin: '0',
          }}>
            Je ontvangt deze e-mail omdat je een checkout hebt gestart op dehondenbijbel.nl.
          </Text>
        </div>
      </Section>
    </Base>
  )
}

DhAbandonedCheckout2Template.PreviewProps = {
  firstName: 'Jan',
  checkoutUrl: 'https://dehondenbijbel.nl/pages/checkout.html',
  productName: 'De Hondenbijbel',
  productPrice: '35,00',
  productImage: '',
  preview: 'Na 1 week liep onze hond al rustiger aan de lijn...',
} as DhAbandonedCheckout2Props

export default DhAbandonedCheckout2Template
