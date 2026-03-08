import { Text, Section, Button, Hr, Link } from '@react-email/components'
import * as React from 'react'
import { Base } from './base'

export const ST_ABANDONED_CHECKOUT_3 = 'st-abandoned-checkout-3'

export interface StAbandonedCheckout3Props {
  firstName: string
  checkoutUrl: string
  productName: string
  productPrice: string
  productImage?: string
  preview?: string
}

export const isStAbandonedCheckout3Data = (data: any): data is StAbandonedCheckout3Props =>
  typeof data.firstName === 'string' && typeof data.checkoutUrl === 'string'

const font = "'Inter', 'Segoe UI', Arial, sans-serif"
const pad = '28px'

const colors = {
  headerBg: '#18181B',
  headerGradient: 'linear-gradient(135deg, #27272A 0%, #18181B 50%, #09090B 100%)',
  accent: '#C27BA0',
  accentSoft: '#FAF5F8',
  textDark: '#1A1028',
  textBody: '#3F3F46',
  textMuted: '#71717A',
  boxBorder: '#EDD9E5',
  footerBg: '#1A1028',
  footerText: '#A1A1AA',
  footerAccent: '#C27BA0',
  divider: '#EDD9E5',
  urgentBg: '#FEF2F2',
  urgentBorder: '#FECACA',
  urgentText: '#991B1B',
}

export const StAbandonedCheckout3Template: React.FC<StAbandonedCheckout3Props> & {
  PreviewProps: StAbandonedCheckout3Props
} = ({
  firstName,
  checkoutUrl,
  productName,
  productPrice,
  productImage,
  preview = 'Ännu 24 timmar — sedan måste jag frigöra din varukorg.',
}) => {
  return (
    <Base preview={preview}>
      <Section>
        {/* ====== HEADER — dark/urgent ====== */}
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
            color: 'rgba(255,255,255,0.5)',
            margin: '0 0 10px 0',
          }}>
            Släpp Taget
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
            Sista chansen, {firstName}
          </Text>
        </div>

        {/* ====== URGENT BANNER ====== */}
        <div style={{ padding: `20px ${pad} 0` }}>
          <div style={{
            backgroundColor: colors.urgentBg,
            border: `1px solid ${colors.urgentBorder}`,
            borderRadius: '10px',
            padding: '14px 18px',
            textAlign: 'center' as const,
          }}>
            <Text style={{
              fontFamily: font,
              fontSize: '13px',
              fontWeight: 600,
              color: colors.urgentText,
              margin: '0',
            }}>
              ⏰ Din varukorg frigörs automatiskt inom 24 timmar
            </Text>
          </div>
        </div>

        {/* ====== BODY ====== */}
        <div style={{ padding: `20px ${pad} 0` }}>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            color: colors.textBody,
            lineHeight: '1.7',
            margin: '0',
          }}>
            Hej {firstName},
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            lineHeight: '1.7',
            margin: '12px 0 0',
            color: colors.textBody,
          }}>
            Det här är sista gången jag skriver om din beställning. Jag sparar din varukorg i 24 timmar till — sedan frigörs den automatiskt.
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            lineHeight: '1.7',
            margin: '16px 0 0',
            color: colors.textBody,
          }}>
            Jag vill inte pressa dig. Men jag vill vara ärlig mot dig.
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            lineHeight: '1.7',
            margin: '16px 0 0',
            color: colors.textBody,
          }}>
            Varje destruktivt mönster du bär på just nu — skuldkänslorna, bitterheten, de relationer som tär på dig — försvinner inte av sig självt. Det blir inte bättre med tiden. Tvärtom. Ju längre du väntar, desto djupare rotar sig mönstren.
          </Text>
        </div>

        {/* ====== FUTURE PACING ====== */}
        <div style={{ padding: `20px ${pad} 0` }}>
          <div style={{
            backgroundColor: '#FFFBEB',
            border: '1px solid #FDE68A',
            borderRadius: '10px',
            padding: '20px 22px',
          }}>
            <Text style={{
              fontFamily: font,
              fontSize: '14px',
              fontWeight: 700,
              color: '#92400E',
              margin: '0 0 8px',
            }}>
              💭 Föreställ dig det här:
            </Text>
            <Text style={{
              fontFamily: font,
              fontSize: '14px',
              color: '#78350F',
              lineHeight: '1.7',
              margin: '0',
            }}>
              Det är nästa vecka. Du vaknar på morgonen utan den där tunga känslan i bröstet. Tankarna som brukade mala har tystnat. Du känner dig lättare, friare, mer närvarande. Dina vänner märker skillnaden. &ldquo;Vad har hänt med dig?&rdquo; frågar de.
            </Text>
          </div>
        </div>

        <div style={{ padding: `16px ${pad} 0` }}>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            lineHeight: '1.7',
            margin: '0',
            color: colors.textBody,
          }}>
            Det är ingen fantasi. Det är vad <strong style={{ color: colors.textDark }}>tusentals läsare</strong> redan har upplevt. Och för de flesta började det med precis samma tvivel som du känner nu.
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            lineHeight: '1.7',
            margin: '12px 0 0',
            color: colors.textDark,
            fontWeight: 600,
          }}>
            Vet du vad skillnaden var? De valde att börja idag.
          </Text>
        </div>

        {/* ====== PRODUCT CARD ====== */}
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
              {productPrice} kr
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
            Ja, jag börjar idag &#8594;
          </Button>
        </div>

        {/* ====== TRUST BADGES ====== */}
        <div style={{ padding: `18px ${pad} 0`, textAlign: 'center' as const }}>
          <Text style={{
            fontFamily: font,
            fontSize: '13px',
            color: colors.textMuted,
            lineHeight: '1.8',
            margin: '0',
          }}>
            ✓ 100% nöjd-eller-pengarna-tillbaka-garanti<br />
            ✓ Fri frakt inom Sverige<br />
            ✓ Tusentals nöjda läsare
          </Text>
        </div>

        <Hr style={{ margin: `24px ${pad}`, borderColor: colors.divider }} />

        {/* ====== CLOSING ====== */}
        <div style={{ padding: `0 ${pad}` }}>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            lineHeight: '1.7',
            margin: '0',
            color: colors.textBody,
          }}>
            Efter det här meddelandet skickar jag inga fler påminnelser. Valet är ditt — och oavsett vad du väljer respekterar jag det fullt ut.
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            lineHeight: '1.7',
            margin: '16px 0 0',
            color: colors.textBody,
          }}>
            Men om du någon gång har tänkt <em>&ldquo;Jag önskar att jag kunde släppa det som tynger mig&rdquo;</em> — då är det här ditt tillfälle.
          </Text>
        </div>

        <Hr style={{ margin: `24px ${pad}`, borderColor: colors.divider }} />

        {/* ====== SIGN-OFF ====== */}
        <div style={{ padding: `0 ${pad}` }}>
          <Text style={{
            fontFamily: font,
            fontSize: '14px',
            fontWeight: 700,
            color: colors.textDark,
            margin: '0',
          }}>
            Joris De Vries
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '13px',
            color: colors.textMuted,
            margin: '2px 0 0',
          }}>
            Släpp Taget
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '13px',
            color: colors.textMuted,
            margin: '14px 0 0',
            fontStyle: 'italic' as const,
          }}>
            P.S. Har du frågor? Skriv till mig personligen på{' '}
            <Link href="mailto:hej@slapptagetboken.se" style={{ color: colors.accent, textDecoration: 'underline', fontWeight: 600, fontStyle: 'normal' as const }}>
              hej@slapptagetboken.se
            </Link>
            . Jag läser och svarar på varje meddelande själv.
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
            Släpp Taget
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
            Du får detta e-postmeddelande för att du har påbörjat en beställning på slapptagetboken.se. Det här är den sista påminnelsen — du kommer inte att få fler e-postmeddelanden om den här beställningen.
          </Text>
        </div>
      </Section>
    </Base>
  )
}

StAbandonedCheckout3Template.PreviewProps = {
  firstName: 'Anna',
  checkoutUrl: 'https://www.slapptagetboken.se/checkout',
  productName: 'Släpp Taget',
  productPrice: '399',
  productImage: '',
  preview: 'Ännu 24 timmar — sedan måste jag frigöra din varukorg.',
} as StAbandonedCheckout3Props

export default StAbandonedCheckout3Template
