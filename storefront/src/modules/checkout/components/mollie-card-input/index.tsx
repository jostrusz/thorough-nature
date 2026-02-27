"use client"

import React, { useEffect, useRef, useState } from "react"
import { useMollie, MollieComponent } from "../payment-wrapper/mollie-wrapper"
import { Text } from "@medusajs/ui"

type MollieCardInputProps = {
  onChange?: (event: { complete: boolean; error: string | null; brand: string | null }) => void
}

const MollieCardInput: React.FC<MollieCardInputProps> = ({ onChange }) => {
  const { mollieInstance, isReady, error: mollieError } = useMollie()
  const [error, setError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const componentsRef = useRef<Record<string, MollieComponent>>({})
  const fieldStates = useRef<Record<string, { valid: boolean; touched: boolean }>>({
    cardNumber: { valid: false, touched: false },
    cardHolder: { valid: false, touched: false },
    expiryDate: { valid: false, touched: false },
    verificationCode: { valid: false, touched: false },
  })

  useEffect(() => {
    if (!mollieInstance || !isReady || mounted) return

    try {
      const fields = ["cardNumber", "cardHolder", "expiryDate", "verificationCode"]
      const selectorMap: Record<string, string> = {
        cardNumber: "#mollie-card-number",
        cardHolder: "#mollie-card-holder",
        expiryDate: "#mollie-expiry-date",
        verificationCode: "#mollie-verification-code",
      }

      fields.forEach((field) => {
        const component = mollieInstance.createComponent(field)
        component.mount(selectorMap[field])
        componentsRef.current[field] = component

        component.addEventListener("change", (event: any) => {
          fieldStates.current[field] = {
            valid: !event.error,
            touched: event.touched || true,
          }

          if (event.error && event.touched) {
            setError(event.error)
          } else {
            // Check if all fields are valid
            const allValid = Object.values(fieldStates.current).every((s) => s.valid)
            const anyError = Object.values(fieldStates.current).find(
              (s) => !s.valid && s.touched
            )
            if (!anyError) setError(null)

            onChange?.({
              complete: allValid,
              error: null,
              brand: event.brand || null,
            })
          }

          if (event.error) {
            onChange?.({
              complete: false,
              error: event.error,
              brand: null,
            })
          }
        })
      })

      setMounted(true)
    } catch (e: any) {
      setError(e.message || "Failed to mount card fields")
    }

    return () => {
      // Unmount components on cleanup
      Object.values(componentsRef.current).forEach((comp) => {
        try {
          comp.unmount()
        } catch {
          // ignore unmount errors
        }
      })
      componentsRef.current = {}
      setMounted(false)
    }
  }, [mollieInstance, isReady])

  if (mollieError) {
    return (
      <div className="text-ui-fg-error text-sm p-2">
        Payment initialization failed: {mollieError}
      </div>
    )
  }

  if (!isReady) {
    return (
      <div className="text-ui-fg-subtle text-sm p-2">
        Loading payment fields...
      </div>
    )
  }

  const fieldStyle =
    "h-11 border rounded-md bg-ui-bg-field border-ui-border-base hover:bg-ui-bg-field-hover transition-all duration-300 ease-in-out px-4 flex items-center"

  return (
    <div className="mt-5 transition-all duration-150 ease-in-out">
      <Text className="txt-medium-plus text-ui-fg-base mb-1">
        Enter your card details:
      </Text>

      <div className="space-y-3">
        <div>
          <label className="text-xs text-ui-fg-subtle mb-1 block">Card number</label>
          <div id="mollie-card-number" className={fieldStyle} />
        </div>

        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-xs text-ui-fg-subtle mb-1 block">Expiry date</label>
            <div id="mollie-expiry-date" className={fieldStyle} />
          </div>
          <div className="flex-1">
            <label className="text-xs text-ui-fg-subtle mb-1 block">CVC</label>
            <div id="mollie-verification-code" className={fieldStyle} />
          </div>
        </div>

        <div>
          <label className="text-xs text-ui-fg-subtle mb-1 block">Cardholder name</label>
          <div id="mollie-card-holder" className={fieldStyle} />
        </div>
      </div>

      {error && (
        <div className="text-ui-fg-error text-xs mt-2">{error}</div>
      )}
    </div>
  )
}

export default MollieCardInput
