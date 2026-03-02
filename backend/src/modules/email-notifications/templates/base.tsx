import { Html, Body, Container, Preview, Tailwind, Head } from '@react-email/components'
import * as React from 'react'

interface BaseProps {
  preview?: string
  children: React.ReactNode
}

export const Base: React.FC<BaseProps> = ({ preview, children }) => {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Tailwind>
        <Body className="my-auto mx-auto font-sans" style={{ backgroundColor: '#f4f0f5', margin: 0, padding: 0 }}>
          <Container className="my-[32px] mx-auto p-0 max-w-[600px] w-full overflow-hidden" style={{ borderRadius: '12px', backgroundColor: '#ffffff' }}>
            <div className="max-w-full break-words">
              {children}
            </div>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  )
}
