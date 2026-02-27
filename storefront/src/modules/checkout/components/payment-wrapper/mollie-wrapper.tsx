"use client"

import React, { createContext, useContext, useEffect, useRef, useState } from "react"

declare global {
  interface Window {
    Mollie?: (profileId: string, options?: { locale?: string; testmode?: boolean }) => MollieInstance
  }
}

export interface MollieInstance {
  createComponent: (type: string) => MollieComponent
  createToken: () => Promise<{ token?: string; error?: { message: string } }>
}

export interface MollieComponent {
  mount: (selector: string) => void
  unmount: () => void
  addEventListener: (event: string, handler: (e: any) => void) => void
}

interface MollieContextValue {
  mollieInstance: MollieInstance | null
  isReady: boolean
  error: string | null
}

export const MollieContext = createContext<MollieContextValue>({
  mollieInstance: null,
  isReady: false,
  error: null,
})

export const useMollie = () => useContext(MollieContext)

type MollieWrapperProps = {
  profileId: string
  testmode?: boolean
  locale?: string
  children: React.ReactNode
}

const MollieWrapper: React.FC<MollieWrapperProps> = ({
  profileId,
  testmode = false,
  locale = "en_US",
  children,
}) => {
  const [mollieInstance, setMollieInstance] = useState<MollieInstance | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scriptLoadedRef = useRef(false)

  useEffect(() => {
    if (!profileId) {
      setError("Mollie profile ID is missing")
      return
    }

    const initMollie = () => {
      try {
        if (window.Mollie) {
          const instance = window.Mollie(profileId, { locale, testmode })
          setMollieInstance(instance)
          setIsReady(true)
        }
      } catch (e: any) {
        setError(e.message || "Failed to initialize Mollie")
      }
    }

    // Check if Mollie.js is already loaded
    if (window.Mollie) {
      initMollie()
      return
    }

    // Load Mollie.js script
    if (!scriptLoadedRef.current) {
      scriptLoadedRef.current = true
      const script = document.createElement("script")
      script.src = "https://js.mollie.com/v1/mollie.js"
      script.async = true
      script.onload = initMollie
      script.onerror = () => setError("Failed to load Mollie.js")
      document.head.appendChild(script)
    }
  }, [profileId, testmode, locale])

  return (
    <MollieContext.Provider value={{ mollieInstance, isReady, error }}>
      {children}
    </MollieContext.Provider>
  )
}

export default MollieWrapper
