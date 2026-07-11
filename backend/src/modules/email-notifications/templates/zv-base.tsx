import { Html, Body, Container, Preview, Head, Font } from '@react-email/components'
import * as React from 'react'

interface ZvBaseProps {
  preview?: string
  children: React.ReactNode
}

/**
 * Email base styled to match the zivot-zaslugy storefront (nejdriv-ja.cz).
 *
 * Mirrors the landing-page palette:
 *   --bg #FFF8F3 (warm peach page background)
 *   white card container with subtle shadow on top
 *
 * Loads Recoleta (serif, used for headings on the landing page) from the
 * same Cloudinary CDN the storefront uses, plus DM Sans for body text from
 * Google Fonts. Clients that strip @font-face fall back to Georgia / system
 * sans-serif respectively.
 */
export const ZvBase: React.FC<ZvBaseProps> = ({ preview, children }) => {
  return (
    <Html>
      <Head>
        <Font
          fontFamily="DM Sans"
          fallbackFontFamily={['Helvetica', 'Arial', 'sans-serif']}
          webFont={{
            url: 'https://fonts.gstatic.com/s/dmsans/v17/rP2Yp2ywxg089UriI5-g4vlH9VoD8Cmcqbu0-K6z9mXgjU0.woff2',
            format: 'woff2',
          }}
          fontWeight={400}
          fontStyle="normal"
        />
        <Font
          fontFamily="DM Sans"
          fallbackFontFamily={['Helvetica', 'Arial', 'sans-serif']}
          webFont={{
            url: 'https://fonts.gstatic.com/s/dmsans/v17/rP2rp2ywxg089UriCZaSExd86J3t9jz86Mvy4qCRAL19DksVat-JDV30TGcro9o45zw.woff2',
            format: 'woff2',
          }}
          fontWeight={700}
          fontStyle="normal"
        />
        <Font
          fontFamily="Recoleta"
          fallbackFontFamily={['Georgia', 'Times New Roman', 'serif']}
          webFont={{
            url: 'https://res.cloudinary.com/dckynhswz/raw/upload/v1771307812/recoleta-600_kjbl47.woff2',
            format: 'woff2',
          }}
          fontWeight={600}
          fontStyle="normal"
        />
        <Font
          fontFamily="Recoleta"
          fallbackFontFamily={['Georgia', 'Times New Roman', 'serif']}
          webFont={{
            url: 'https://res.cloudinary.com/dckynhswz/raw/upload/v1771307812/recoleta-700_sue47k.woff2',
            format: 'woff2',
          }}
          fontWeight={700}
          fontStyle="normal"
        />
      </Head>
      <Preview>{preview || ''}</Preview>
      <Body style={{ backgroundColor: '#FFF8F3', margin: 0, padding: 0, fontFamily: "'DM Sans', Helvetica, Arial, sans-serif" }}>
        <Container style={{ margin: '32px auto', padding: 0, maxWidth: '600px', width: '100%', borderRadius: '14px', backgroundColor: '#ffffff', overflow: 'hidden', boxShadow: '0 4px 24px rgba(74,26,46,0.08)' }}>
          <div style={{ wordBreak: 'break-word' }}>
            {children}
          </div>
        </Container>
      </Body>
    </Html>
  )
}
