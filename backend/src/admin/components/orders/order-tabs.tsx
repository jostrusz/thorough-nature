import React from "react"

export interface TabDef {
  id: string
  label: string
  deliveryStatus?: string
  paymentStatus?: string
  country?: string
}

export const TABS: TabDef[] = [
  { id: "all", label: "All" },
  { id: "imported", label: "Imported", deliveryStatus: "imported" },
  { id: "processing", label: "Processing", deliveryStatus: "processing" },
  { id: "sent", label: "Order sent", deliveryStatus: "sent" },
  { id: "transit", label: "In Transit", deliveryStatus: "transit" },
  { id: "delivered", label: "Delivered", deliveryStatus: "delivered" },
  { id: "returned", label: "Returned", deliveryStatus: "returned" },
  { id: "refunded", label: "Refunded", paymentStatus: "refunded" },
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
        display: "flex",
        alignItems: "center",
        gap: 0,
        padding: "0 16px",
        borderBottom: "1px solid #E1E3E5",
        overflowX: "auto",
        scrollbarWidth: "none",
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
              padding: "12px 14px",
              fontSize: "13px",
              fontWeight: isActive ? 600 : 500,
              color: isActive ? "#1A1A1A" : "#6D7175",
              cursor: "pointer",
              borderBottom: isActive ? "2px solid #1A1A1A" : "2px solid transparent",
              whiteSpace: "nowrap",
              transition: "all 0.2s ease",
              userSelect: "none",
            }}
          >
            {tab.label}
            {count !== undefined && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: "20px",
                  height: "20px",
                  padding: "0 6px",
                  borderRadius: "10px",
                  background: isActive ? "#1A1A1A" : "#F1F1F1",
                  color: isActive ? "#fff" : "#6D7175",
                  fontSize: "11px",
                  fontWeight: 600,
                  marginLeft: "6px",
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
