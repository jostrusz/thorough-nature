'use client'

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'

interface KlarnaContextType {
  isReady: boolean
  isLoaded: boolean
  error: string | null
  loadWidget: (containerId: string, category?: string) => Promise<boolean>
  authorize: (billingAddress: any, shippingAddress: any, category?: string) => Promise<{ approved: boolean; authorization_token?: string; finalize_required?: boolean }>
  finalize: (category?: string) => Promise<{ approved: boolean; authorization_token?: string }>
}

const KlarnaContext = createContext<KlarnaContextType | null>(null)

export const useKlarna = () => {
  const ctx = useContext(KlarnaContext)
  if (!ctx) throw new Error('useKlarna must be used within KlarnaWrapper')
  return ctx
}

interface KlarnaWrapperProps {
  clientToken: string
  children: React.ReactNode
}

export function KlarnaWrapper({ clientToken, children }: KlarnaWrapperProps) {
  const [isReady, setIsReady] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scriptLoaded = useRef(false)

  useEffect(() => {
    if (!clientToken || scriptLoaded.current) return

    // Check if Klarna SDK is already loaded
    if ((window as any).Klarna?.Payments) {
      try {
        ;(window as any).Klarna.Payments.init({ client_token: clientToken })
        setIsReady(true)
        scriptLoaded.current = true
        return
      } catch (err: any) {
        setError(err.message || 'Klarna init failed')
        return
      }
    }

    // Dynamically load Klarna SDK
    const script = document.createElement('script')
    script.src = 'https://x.klarnacdn.net/kp/lib/v1/api.js'
    script.async = true

    ;(window as any).klarnaAsyncCallback = () => {
      try {
        ;(window as any).Klarna.Payments.init({ client_token: clientToken })
        setIsReady(true)
      } catch (err: any) {
        setError(err.message || 'Klarna init failed')
      }
    }

    script.onerror = () => setError('Failed to load Klarna SDK')
    document.body.appendChild(script)
    scriptLoaded.current = true

    return () => {
      delete (window as any).klarnaAsyncCallback
    }
  }, [clientToken])

  const loadWidget = useCallback(async (containerId: string, category?: string): Promise<boolean> => {
    return new Promise((resolve) => {
      if (!(window as any).Klarna?.Payments) {
        setError('Klarna SDK not available')
        resolve(false)
        return
      }

      const options: any = { container: containerId }
      if (category) options.payment_method_category = category

      ;(window as any).Klarna.Payments.load(options, {}, (res: any) => {
        if (res.error) {
          setError(res.error.invalid_fields?.join(', ') || 'Load failed')
          resolve(false)
        } else {
          setIsLoaded(res.show_form)
          resolve(res.show_form)
        }
      })
    })
  }, [])

  const authorize = useCallback(async (
    billingAddress: any,
    shippingAddress: any,
    category?: string
  ) => {
    return new Promise<{ approved: boolean; authorization_token?: string; finalize_required?: boolean }>((resolve) => {
      const options: any = {}
      if (category) options.payment_method_category = category

      ;(window as any).Klarna.Payments.authorize(
        options,
        {
          billing_address: billingAddress,
          shipping_address: shippingAddress || billingAddress,
        },
        (res: any) => {
          resolve({
            approved: res.approved,
            authorization_token: res.authorization_token,
            finalize_required: res.finalize_required,
          })
        }
      )
    })
  }, [])

  const finalize = useCallback(async (category?: string) => {
    return new Promise<{ approved: boolean; authorization_token?: string }>((resolve) => {
      const options: any = {}
      if (category) options.payment_method_category = category

      ;(window as any).Klarna.Payments.finalize(options, {}, (res: any) => {
        resolve({
          approved: res.approved,
          authorization_token: res.authorization_token,
        })
      })
    })
  }, [])

  return (
    <KlarnaContext.Provider value={{ isReady, isLoaded, error, loadWidget, authorize, finalize }}>
      {children}
    </KlarnaContext.Provider>
  )
}

export default KlarnaWrapper
