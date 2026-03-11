import React from "react"
import { colors, radii, shadows } from "./design-tokens"

export interface TabDef {
  id: string
  label: string
  deliveryStatus?: string
  paymentStatus?: string
  country?: string
}

export const TABS: TabDef[] = [
  { id: "all", label: "All" },
  { id: "new", label: "New", deliveryStatus: "NEW" },
  { id: "waiting", label: "Waiting", deliveryStatus: "WAITING" },
  { id: "imported", label: "Imported", deliveryStatus: "IMPORTED" },
  { id: "processed", label: "Processed", deliveryStatus: "PROCESSED" },
  { id: "packed", label: "Packed", deliveryStatus: "PACKED" },
  { id: "dispatched", label: "Dispatched", deliveryStatus: "DISPATCHED" },
  { id: "in_transit", label: "In Transit", deliveryStatus: "IN_TRANSIT" },
  { id: "delivered", label: "Delivered", deliveryStatus: "DELIVERED" },
  { id: "issues", label: "Issues", deliveryStatus: "ALLOCATION_ISSUE" },
  { id: "refunded", label: "Refunded", paymentStatus: "refunded" },
  { id: "paid", label: "Paid", paymentStatus: "paid" },
  { id: "pending", label: "Pending", paymentStatus: "pending" },
  { id: "nlbe", label: "NL/BE", country: "NL,BE" },
  { id: "deatlu", label: "DE/AT/LU", country: "DE,AT,LU" },
  { id: "czsk", label: "CZ/SK", country: "CZ,SK" },
  { id: "pl", label: "PL", country: "PL" },
  { id: "swe", label: "SWE", country: "SE" },
  { id: "hu", label: "HU", country: "HU" },
]

interface OrderTabsProps {
  activeTab: string
  onTabChange: (tabId: string) => void
  tabCounts?: Record<string, number>
}

export function OrderTabs({ activeTab, onTabChange, tabCounts }: OrderTabsProps) {
  return (
    <div
      style={{
        background: "rgba(0,0,0,0.03)",
        borderRadius: "8px",
        padding: "3px",
        display: "flex",
        gap: "2px",
        overflowX: "auto",
      }}
    >
      {TABS.map((tab) => {
        const isActive = tab.id === activeTab
        const count = tabCounts?.[tab.id]
        return (
          <div
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            style={{
              padding: "7px 14px",
              borderRadius: "6px",
              fontSize: "13px",
              fontWeight: isActive ? 600 : 500,
              color: isActive ? "#1A1D2E" : "#6B7185",
              cursor: "pointer",
              border: "none",
              background: isActive ? "#FFFFFF" : "transparent",
              whiteSpace: "nowrap",
              transition: "all 0.15s",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              boxShadow: isActive ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
              userSelect: "none",
            }}
          >
            {tab.label}
            {count !== undefined && (
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  padding: "1px 7px",
                  borderRadius: "10px",
                  minWidth: "20px",
                  textAlign: "center",
                  background: isActive ? "rgba(108,92,231,0.08)" : "rgba(0,0,0,0.04)",
                  color: isActive ? "#6C5CE7" : "#9CA3B8",
                }}
              >
                {count}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
