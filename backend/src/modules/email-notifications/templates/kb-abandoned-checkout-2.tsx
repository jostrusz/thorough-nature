import { Text, Section, Button, Hr, Link } from '@react-email/components'
import * as React from 'react'
import { Base } from './base'

export const KB_ABANDONED_CHECKOUT_2 = 'kb-abandoned-checkout-2'

export interface KbAbandonedCheckout2Props {
  firstName: string
  checkoutUrl: string
  productName: string
  productPrice: string
  productImage?: string
  preview?: string
}

export const isKbAbandonedCheckout2Data = (data: any): data is KbAbandonedCheckout2Props =>
  typeof data.firstName === 'string' && typeof data.checkoutUrl === 'string'

const font = "'Inter', 'Segoe UI', Arial, sans-serif"
const pad = '28px'

const colors = {
  headerBg: '#2D1B3D',
  headerGradient: 'linear-gradient(135deg, #3D2B4D 0%, #2D1B3D 50%, #1A1028 100%)',
  accent: '#C27BA0',
  accentSoft: '#FAF5F8',
  textDark: '#18181B',
  textBody: '#3F3F46',
  textMuted: '#71717A',
  boxBorder: '#EDD9E5',
  starColor: '#F59E0B',
  footerBg: '#2D1B3D',
  footerText: '#9B7AAD',
  footerAccent: '#C27BA0',
  divider: '#EDD9E5',
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
      &bdquo;{text}&ldquo;
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

export const KbAbandonedCheckout2Template: React.FC<KbAbandonedCheckout2Props> & {
  PreviewProps: KbAbandonedCheckout2Props
} = ({
  firstName,
  checkoutUrl,
  productName,
  productPrice,
  productImage,
  preview = 'Kočka nám čůrala za gauč tři roky. Po dvou týdnech je klid...',
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
            Kočičí bible
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
            Příběh, který stojí za touto knihou
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
            Ahoj {firstName},
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            lineHeight: '1.7',
            margin: '12px 0 0',
            color: colors.textBody,
          }}>
            Chtěl jsem ti napsat osobně. Ne abych na tebe tlačil — ale protože si myslím, že bys tohle měla vědět.
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            lineHeight: '1.7',
            margin: '16px 0 0',
            color: colors.textBody,
          }}>
            Tuhle knihu jsem nenapsal proto, že by se mi zdálo „hezké“ napsat knihu. Napsal jsem ji, protože jsem léta jako behaviorista sledoval, jak se majitelé koček trápí pořád stejnými problémy — čůrání mimo záchod, noční koncerty, poškrábaný nábytek — a dostávají pořád stejné rady, které nefungují. Protože řeší příznaky, ne příčinu.
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '15px',
            lineHeight: '1.7',
            margin: '16px 0 0',
            color: colors.textBody,
          }}>
            Kompletní průvodce kočičím chováním + 3 bonusové e-booky. Všechno postavené na kočičí psychologii a etologii. Tohle není příručka plná pouček — je to praktický systém, se kterým konečně porozumíš tomu, co ti kočka celou dobu říká.
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
            Co říkají ostatní čtenáři
          </Text>

          <ReviewCard
            text="Kočka nám čůrala za gauč tři roky. TŘI ROKY. Po dvou týdnech podle knihy je klid. Nechápu, že to nikdo neporadil dřív."
            author="Petra, Brno"
          />
          <ReviewCard
            text="Zkoušeli jsme spreje, feromony, rady z fór. Nic. Tahle kniha vysvětlila PROČ to Mia dělá — a najednou to dávalo smysl. Konečně spíme celou noc."
            author="Martin, Praha"
          />
          <ReviewCard
            text="Znatelný rozdíl už během týdne. Postupy jsou tak konkrétní, že hned víš, co dělat jinak. Náš kocour je jako vyměněný."
            author="Lucie, Ostrava"
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
              ✓ 100% garance vrácení peněz do 30 dnů.
              <br />
              Žádné otázky, žádné komplikace. Riziko nesu já, ne ty.
            </Text>
          </div>
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
              {productPrice} Kč
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
            Chci rozumět své kočce &#8594;
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
            Tvoje kniha může být na cestě už zítra.
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
            Srdečně,
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '14px',
            fontWeight: 700,
            color: colors.textDark,
            margin: '4px 0 0',
          }}>
            Michal Peterka
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '13px',
            color: colors.textMuted,
            margin: '2px 0 0',
          }}>
            Kočičí bible &bull;{' '}
            <Link href="mailto:peterka@kocicibible.cz" style={{ color: colors.accent, textDecoration: 'underline' }}>
              peterka@kocicibible.cz
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
            Kočičí bible
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
            Tento e-mail ti přišel, protože jsi rozpracoval/a objednávku na kocicibible.cz.
          </Text>
        </div>
      </Section>
    </Base>
  )
}

KbAbandonedCheckout2Template.PreviewProps = {
  firstName: 'Petra',
  checkoutUrl: 'https://www.kocicibible.cz/checkout',
  productName: 'Kočičí bible',
  productPrice: '550',
  productImage: '',
  preview: 'Kočka nám čůrala za gauč tři roky. Po dvou týdnech je klid...',
} as KbAbandonedCheckout2Props

export default KbAbandonedCheckout2Template
