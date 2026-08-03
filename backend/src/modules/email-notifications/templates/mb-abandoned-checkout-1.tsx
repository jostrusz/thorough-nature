import { Text, Section, Button, Img, Hr, Link } from '@react-email/components'
import * as React from 'react'
import { Base } from './base'

export const MB_ABANDONED_CHECKOUT_1 = 'mb-abandoned-checkout-1'

export interface MbAbandonedCheckout1Props {
  firstName: string
  checkoutUrl: string
  productName: string
  productPrice: string
  productImage?: string
  preview?: string
}

export const isMbAbandonedCheckout1Data = (data: any): data is MbAbandonedCheckout1Props =>
  typeof data.firstName === 'string' && typeof data.checkoutUrl === 'string'

const font = "'Inter', 'Segoe UI', Arial, sans-serif"
const pad = '28px'

const colors = {
  headerBg: '#2D1B3D',
  headerGradient: 'linear-gradient(135deg, #3D2B4D 0%, #2D1B3D 50%, #1A1028 100%)',
  accent: '#C27BA0',
  accentLight: '#E8B4D0',
  accentSoft: '#FAF5F8',
  textDark: '#18181B',
  textBody: '#3F3F46',
  textMuted: '#71717A',
  boxBorder: '#EDD9E5',
  footerBg: '#2D1B3D',
  footerText: '#9B7AAD',
  footerAccent: '#C27BA0',
  divider: '#EDD9E5',
}

export const MbAbandonedCheckout1Template: React.FC<MbAbandonedCheckout1Props> & {
  PreviewProps: MbAbandonedCheckout1Props
} = ({
  firstName,
  checkoutUrl,
  productName,
  productPrice,
  productImage,
  preview = 'A könyved be van csomagolva. Csak te maradtál félúton.',
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
            color: 'rgba(255,255,255,0.65)',
            margin: '0 0 10px 0',
          }}>
            Macskabiblia
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
            A könyved be van csomagolva 📦
          </Text>
        </div>

        {/* ====== GREETING + BODY ====== */}
        <div style={{ padding: `28px ${pad} 0` }}>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            color: colors.textBody,
            lineHeight: '1.7',
            margin: '0',
          }}>
            Szia {firstName},
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            lineHeight: '1.7',
            margin: '12px 0 0',
            color: colors.textBody,
          }}>
            Nem akarok rád telepedni — azt itthon a macskám csinálja, minden este fél tízkor, pontosan a mellkasomra. Csak szólok, hogy a <strong style={{ color: colors.textDark }}>{productName}</strong> ott maradt félúton a kosaradban. Be van csomagolva, feladásra kész, egyetlen kattintás hiányzik.
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            lineHeight: '1.7',
            margin: '16px 0 0',
            color: colors.textBody,
          }}>
            Egy dolgot hadd mondjak el addig is. A macska soha nem „csak úgy” pisil a kanapé mögé. Nem bosszúból, nem dacból, nem azért, mert nem szeret. Hanem mert <em>mond</em> valamit. Olyan nyelven, amit még nem tanultál meg.
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            lineHeight: '1.7',
            margin: '16px 0 0',
            color: colors.textBody,
          }}>
            Én az első macskámnál kilenc hónapig hittem, hogy az állat direkt szívat. Nem szívatott. Én nem figyeltem. Ebben a könyvben pont ezt a figyelést tanítom meg — konkrét lépésekkel, macskaviselkedés-szakértőtől, homályos elméletek nélkül. Plusz 3 ingyenes bonusz e-könyv.
          </Text>
        </div>

        {/* ====== PRODUCT IMAGE ====== */}
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
              {productPrice} Ft
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
            Igen, kérem a könyvem &#8594;
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
            Az adataid megvannak, a befejezés nagyjából egy perc. Kevesebb, mint amíg a macskád eldönti, hogy bemegy-e az ajtón.
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
            Üdv,
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '14px',
            fontWeight: 700,
            color: colors.textDark,
            margin: '4px 0 0',
          }}>
            Nagy Zoltán
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '13px',
            color: colors.textMuted,
            margin: '2px 0 0',
          }}>
            Macskabiblia &bull;{' '}
            <Link href="mailto:konyv@macskabiblia-konyv.hu" style={{ color: colors.accent, textDecoration: 'underline' }}>
              konyv@macskabiblia-konyv.hu
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
            Macskabiblia
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '11px',
            color: colors.footerText,
            lineHeight: '1.7',
            margin: '0 0 8px',
          }}>
            Performance Marketing Solution s.r.o. &bull; Rybná 716/24, 110 00 Praha
            <br />
            IČO: 06259928
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '11px',
            color: '#71717A',
            lineHeight: '1.5',
            margin: '0',
          }}>
            Ezt az e-mailt azért kaptad, mert a rendelésed a macskabiblia-konyv.hu oldalon befejezetlen maradt.
          </Text>
        </div>
      </Section>
    </Base>
  )
}

MbAbandonedCheckout1Template.PreviewProps = {
  firstName: 'Anna',
  checkoutUrl: 'https://www.macskabiblia-konyv.hu/checkout',
  productName: 'Macskabiblia',
  productPrice: '7 990',
  productImage: '',
  preview: 'A könyved be van csomagolva. Csak te maradtál félúton.',
} as MbAbandonedCheckout1Props

export default MbAbandonedCheckout1Template
