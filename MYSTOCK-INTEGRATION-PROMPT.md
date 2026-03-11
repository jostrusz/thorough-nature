# mySTOCK WMS ↔ Medusa 2.0 Integration — Claude Code Implementation Guide

## Overview

Build a Medusa 2.0 module that integrates with **mySTOCK® WMS** (by KVADOS Group) — a warehouse management system used by Euromedia Group, the largest Czech book wholesaler. This integration handles the full fulfillment lifecycle: product sync, order forwarding, inventory updates, shipment tracking, and webhook event processing.

**Business context:** Multi-project e-commerce platform selling books across EU markets (NL, BE, DE, AT, PL, CZ, SE, HU, LU). Each project = separate Shopify-like storefront, all sharing one Medusa backend + one mySTOCK WMS connection.

---

## 1. API Connection Details

### Base Configuration
- **Base URL:** Customer-specific (provided by mySTOCK, e.g. `https://customer.mystock.cz/`)
- **Authentication:** HTTP Basic Authentication (username + password)
- **Content-Type:** `application/json`
- **API Version prefix:** `/V1/`

### Environment Variables Required
```env
MYSTOCK_API_URL=https://customer.mystock.cz
MYSTOCK_API_USERNAME=your_username
MYSTOCK_API_PASSWORD=your_password
MYSTOCK_WEBHOOK_SECRET=shared_secret_for_webhook_validation
MYSTOCK_ERP_WAREHOUSE_CODE=default_warehouse_code
```

### Response Format (ALL endpoints)
Every response contains two root keys:
```json
{
  "data": { ... },    // Actual response payload (object or array)
  "errors": [ ... ]   // Array of error objects (empty on success)
}
```

### HTTP Status Codes
| Method | Success Code | Description |
|--------|-------------|-------------|
| POST   | 201         | Resource created |
| GET    | 200         | Resource retrieved |
| PUT    | 200         | Resource updated |
| DELETE | 200         | Resource deleted |

### ID Generation Pattern
- mySTOCK generates UUIDs for all created records
- The UUID is returned in the POST response
- You MUST store this UUID to reference the record in future PUT/DELETE calls
- Use `extIsId` field when the primary code cannot guarantee uniqueness

---

## 1a. Dextrum App — WMS Configuration Panel

The Medusa admin panel includes a **Dextrum** section (left sidebar) where the admin configures all mySTOCK WMS connection details. This is the single place where all credentials, mappings, and settings are managed.

### Dextrum Settings Page Layout

```
┌─ Dextrum — Warehouse Management ─────────────────────────────────┐
│                                                                    │
│  ┌─ API Connection ──────────────────────────────────────────┐    │
│  │                                                            │    │
│  │  API URL:      [https://customer.mystock.cz          ]    │    │
│  │  Username:     [api_user                              ]    │    │
│  │  Password:     [••••••••••                            ]    │    │
│  │  Warehouse:    [MAIN                                  ]    │    │
│  │                                                            │    │
│  │  [Test Connection]  ✅ Connected (last: 2 min ago)        │    │
│  │                                                            │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                    │
│  ┌─ Partner & Operating Unit ────────────────────────────────┐    │
│  │                                                            │    │
│  │  Partner ID (UUID):        [a1b2c3d4-e5f6-7890-...]      │    │
│  │  Partner Code:             [EVERCHAPTER                ]   │    │
│  │                                                            │    │
│  │  Operating Units (per project):                            │    │
│  │  ┌──────────────────┬────────────────────────────────┐    │    │
│  │  │ Project          │ Operating Unit ID (UUID)       │    │    │
│  │  ├──────────────────┼────────────────────────────────┤    │    │
│  │  │ laat-los-nl      │ [uuid-nl-operating-unit    ]   │    │    │
│  │  │ laat-los-be      │ [uuid-be-operating-unit    ]   │    │    │
│  │  │ odpusc-pl        │ [uuid-pl-operating-unit    ]   │    │    │
│  │  │ psi-superzivot   │ [uuid-cz-operating-unit    ]   │    │    │
│  │  │ + Add project    │                                │    │    │
│  │  └──────────────────┴────────────────────────────────┘    │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                    │
│  ┌─ Carrier Mapping ────────────────────────────────────────┐     │
│  │                                                            │    │
│  │  Map your Medusa shipping options to mySTOCK carriers:    │    │
│  │  ┌────────────────────┬──────────────────────────────┐    │    │
│  │  │ Shipping Option    │ mySTOCK Delivery Method UUID │    │    │
│  │  ├────────────────────┼──────────────────────────────┤    │    │
│  │  │ Zásilkovna         │ [uuid-zasilkovna         ]   │    │    │
│  │  │ PPL                │ [uuid-ppl                ]   │    │    │
│  │  │ PostNL             │ [uuid-postnl             ]   │    │    │
│  │  │ bpost              │ [uuid-bpost              ]   │    │    │
│  │  │ DPD                │ [uuid-dpd                ]   │    │    │
│  │  │ DHL                │ [uuid-dhl                ]   │    │    │
│  │  │ InPost             │ [uuid-inpost             ]   │    │    │
│  │  │ Poczta Polska      │ [uuid-poczta             ]   │    │    │
│  │  │ PostNord           │ [uuid-postnord           ]   │    │    │
│  │  │ + Add carrier      │                              │    │    │
│  │  └────────────────────┴──────────────────────────────┘    │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                    │
│  ┌─ Payment Method Mapping ─────────────────────────────────┐     │
│  │                                                            │    │
│  │  ┌────────────────────┬──────────────────────────────┐    │    │
│  │  │ Payment Provider   │ mySTOCK Payment Method UUID  │    │    │
│  │  ├────────────────────┼──────────────────────────────┤    │    │
│  │  │ Stripe (card)      │ [uuid-card-payment       ]   │    │    │
│  │  │ PayPal             │ [uuid-paypal             ]   │    │    │
│  │  │ Bank transfer      │ [uuid-bank-transfer      ]   │    │    │
│  │  │ COD (dobírka)      │ [uuid-cod                ]   │    │    │
│  │  │ + Add method       │                              │    │    │
│  │  └────────────────────┴──────────────────────────────┘    │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                    │
│  ┌─ Inventory Sync Settings ────────────────────────────────┐     │
│  │                                                            │    │
│  │  Sync interval:           [Every 15 minutes      ▼]      │    │
│  │  Low stock threshold:     [10                      ]      │    │
│  │  Critical stock threshold:[3                       ]      │    │
│  │  Out-of-stock action:     [Disable product        ▼]      │    │
│  │  Back-in-stock emails:    [✅ Enabled              ]      │    │
│  │  Max stock change alert:  [50%                     ]      │    │
│  │                                                            │    │
│  │  [Sync Now]  Last sync: 25.02. 10:15 (45 products, 3 updated)│
│  └────────────────────────────────────────────────────────────┘    │
│                                                                    │
│  ┌─ Order Settings ─────────────────────────────────────────┐     │
│  │                                                            │    │
│  │  Hold time before WMS:    [15 minutes              ]      │    │
│  │  Payment timeout:         [30 minutes              ]      │    │
│  │  Retry failed orders:     [Every 5 min, max 10x    ]      │    │
│  │  Dispatch incomplete:     [Wait for all items     ▼]      │    │
│  │                                                            │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                    │
│  ┌─ Webhook ────────────────────────────────────────────────┐     │
│  │                                                            │    │
│  │  Webhook URL:  https://api.yourstore.com/webhooks/mystock │    │
│  │  (Give this URL to mySTOCK as your event endpoint)        │    │
│  │                                                            │    │
│  │  Webhook Secret:  [shared-secret-for-validation   ]       │    │
│  │                                                            │    │
│  │  Recent events: 1,247 received · 1,245 processed · 2 err │    │
│  │  [View Event Log]                                         │    │
│  └────────────────────────────────────────────────────────────┘    │
│                                                                    │
└──────────────────────────────────────────────────────────────────┘
```

### Dextrum Database Table

All Dextrum settings are stored in one configuration table:

```sql
CREATE TABLE dextrum_config (
  id VARCHAR PRIMARY KEY,

  -- API CONNECTION
  api_url VARCHAR NOT NULL,
  api_username VARCHAR NOT NULL,
  api_password_encrypted VARCHAR NOT NULL,  -- encrypted at rest
  default_warehouse_code VARCHAR DEFAULT 'MAIN',

  -- PARTNER
  partner_id VARCHAR,                       -- mySTOCK partner UUID
  partner_code VARCHAR,

  -- WEBHOOK
  webhook_secret VARCHAR,
  webhook_url VARCHAR,                      -- auto-generated, read-only

  -- ORDER SETTINGS
  order_hold_minutes INT DEFAULT 15,
  payment_timeout_minutes INT DEFAULT 30,
  retry_max_attempts INT DEFAULT 10,
  retry_interval_minutes INT DEFAULT 5,
  dispatch_incomplete INT DEFAULT 0,        -- 0=wait for all

  -- INVENTORY SYNC
  inventory_sync_interval_minutes INT DEFAULT 15,
  low_stock_threshold INT DEFAULT 10,
  critical_stock_threshold INT DEFAULT 3,
  out_of_stock_action VARCHAR DEFAULT 'disable_product',
  back_in_stock_emails BOOLEAN DEFAULT TRUE,
  max_stock_change_percent INT DEFAULT 50,

  -- META
  last_connection_test TIMESTAMP,
  connection_status VARCHAR DEFAULT 'unknown',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Per-project operating unit mapping
CREATE TABLE dextrum_project_config (
  id VARCHAR PRIMARY KEY,
  project_code VARCHAR NOT NULL UNIQUE,     -- e.g. 'laat-los-nl'
  sales_channel_id VARCHAR,                 -- Medusa sales channel
  operating_unit_id VARCHAR NOT NULL,       -- mySTOCK operating unit UUID
  default_carrier VARCHAR,                  -- default shipping carrier code
  currency_code VARCHAR DEFAULT 'EUR',
  cod_enabled BOOLEAN DEFAULT FALSE,        -- whether COD is available for this project
  created_at TIMESTAMP DEFAULT NOW()
);

-- Carrier mapping (Medusa shipping option → mySTOCK delivery method)
CREATE TABLE dextrum_carrier_map (
  id VARCHAR PRIMARY KEY,
  medusa_shipping_option_id VARCHAR NOT NULL UNIQUE,
  carrier_name VARCHAR NOT NULL,            -- human readable: "PPL", "PostNL"
  mystock_delivery_method_id VARCHAR NOT NULL,  -- mySTOCK UUID
  created_at TIMESTAMP DEFAULT NOW()
);

-- Payment mapping (Medusa payment provider → mySTOCK payment method)
CREATE TABLE dextrum_payment_map (
  id VARCHAR PRIMARY KEY,
  medusa_payment_provider VARCHAR NOT NULL UNIQUE,
  payment_name VARCHAR NOT NULL,            -- human readable: "Stripe", "COD"
  mystock_payment_method_id VARCHAR NOT NULL,   -- mySTOCK UUID
  is_cod BOOLEAN DEFAULT FALSE,             -- marks COD for payment bypass logic
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Dextrum Admin API Endpoints

```
GET    /admin/dextrum/config           → get current config
PUT    /admin/dextrum/config           → update config
POST   /admin/dextrum/test-connection  → test mySTOCK API connection (calls GET /V1/aboutMe/)
POST   /admin/dextrum/sync-inventory   → trigger manual inventory sync

GET    /admin/dextrum/projects         → list project configs
POST   /admin/dextrum/projects         → add project config
PUT    /admin/dextrum/projects/:id     → update project config
DELETE /admin/dextrum/projects/:id     → remove project config

GET    /admin/dextrum/carriers         → list carrier mappings
POST   /admin/dextrum/carriers         → add carrier mapping
PUT    /admin/dextrum/carriers/:id     → update carrier mapping
DELETE /admin/dextrum/carriers/:id     → remove carrier mapping

GET    /admin/dextrum/payments         → list payment mappings
POST   /admin/dextrum/payments         → add payment mapping
PUT    /admin/dextrum/payments/:id     → update payment mapping
DELETE /admin/dextrum/payments/:id     → remove payment mapping

GET    /admin/dextrum/events           → list recent webhook events (paginated)
GET    /admin/dextrum/sync-log         → list inventory sync history
```

---

## 1ab. Customer Card — Dextrum Info Section

Every customer profile in the Medusa admin should display a **Dextrum** info panel with their warehouse/fulfillment data aggregated from all their orders.

### Customer Card — Dextrum Section

```
┌─ Dextrum — Warehouse Info ──────────────────────────────────┐
│                                                              │
│  Total orders via WMS:    12                                 │
│  Active in WMS:           1  (NL-1089 — PACKED)             │
│  Delivered:               10                                 │
│  Issues:                  1  (NL-1034 — ALLOCATION_ISSUE)   │
│                                                              │
│  Last order:   NL-1089 · 22.02.2026 · PACKED                │
│  Last carrier: PostNL · 3SPOST1234567 · [Track →]           │
│                                                              │
│  ┌─ Recent WMS Orders ──────────────────────────────────┐   │
│  │ NL-1089 · 22.02 · Laat los × 1      · PACKED  🟢    │   │
│  │ NL-1078 · 18.02 · Hondenbijbel × 2  · DELIVERED 🟢  │   │
│  │ NL-1067 · 14.02 · Laat los × 1      · DELIVERED 🟢  │   │
│  │ NL-1034 · 02.02 · Laat los × 3      · ALLOC.ISS 🔴  │   │
│  │ [Show all 12 orders]                                  │   │
│  └───────────────────────────────────────────────────────┘   │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Data Source

Customer Dextrum info is aggregated from `mystock_order_map` by joining on Medusa customer → orders → mystock_order_map:

```sql
-- Customer WMS summary
SELECT
  COUNT(*) as total_orders,
  COUNT(*) FILTER (WHERE delivery_status NOT IN ('DELIVERED','CANCELLED')) as active_orders,
  COUNT(*) FILTER (WHERE delivery_status = 'DELIVERED') as delivered_orders,
  COUNT(*) FILTER (WHERE delivery_status IN ('ALLOCATION_ISSUE','FAILED','PARTIALLY_PICKED')) as issue_orders,
  MAX(created_at) as last_order_date
FROM mystock_order_map
WHERE medusa_order_id IN (
  SELECT id FROM orders WHERE customer_id = :customer_id
);
```

---

## 1aa. Order Matching / Pairing Between Systems (CRITICAL)

### How Orders are Identified in Both Systems

Each system has its own identifier. The pairing works through TWO keys stored in `mystock_order_map`:

```
MEDUSA side:                           mySTOCK side:
─────────────                          ────────────
medusa_order_id  (Medusa internal)     mystock_order_id  (UUID generated by mySTOCK)
display_id       (#1042)               documentCode      (= your orderCode)
                                       documentId        (= same as mystock_order_id)
```

### The Pairing Flow

```
Step 1: YOU send orderCode to mySTOCK
────────────────────────────────────────
POST /V1/orderIncoming/
{
  "orderCode": "ORD-1042",         ← you define this (based on Medusa display_id)
  ...
}

Response (201):
{
  "data": {
    "id": "a1b2c3d4-e5f6-7890-abcd-1234567890ab"    ← mySTOCK generated UUID
  }
}

Step 2: YOU store both in mystock_order_map
────────────────────────────────────────
{
  medusa_order_id:    "ord_01H...",                     ← Medusa internal ID
  mystock_order_id:   "a1b2c3d4-e5f6-7890-abcd-...",   ← mySTOCK UUID (from response)
  mystock_order_code: "ORD-1042"                        ← your orderCode you sent
}

Step 3: mySTOCK sends webhook events BACK to you
────────────────────────────────────────
Every webhook contains:
{
  "eventId": "unique-event-uuid",
  "documentId": "a1b2c3d4-e5f6-7890-abcd-...",    ← = mystock_order_id
  "documentCode": "ORD-1042",                       ← = mystock_order_code
  ...
}

Step 4: YOU match it back to Medusa order
────────────────────────────────────────
Look up in mystock_order_map by EITHER:
  - WHERE mystock_order_id = event.documentId       ← primary (UUID, guaranteed unique)
  - WHERE mystock_order_code = event.documentCode   ← fallback (your code)

→ Found: medusa_order_id = "ord_01H..."
→ Now you can update the Medusa order
```

### orderCode Format

The `orderCode` you send to mySTOCK must be:
- **Unique** across all orders ever sent
- **Human-readable** (warehouse workers see this on packing slips)
- **Traceable** back to your system

**Recommended format:** `{PROJECT_PREFIX}-{DISPLAY_ID}`

```
Project             orderCode example
─────────────────   ──────────────────
laat-los-nl         NL-1042
laat-los-be         BE-1043
odpusc-pl           PL-1044
psi-superzivot      CZ-1045
hondenbijbel-nl     HB-1046
```

This way:
- Warehouse workers see "NL-1042" on the packing slip and know it's a Dutch order
- You can search in both systems by this code
- No collisions between projects (each has its own prefix)

### Product Matching — Same Principle

```
MEDUSA side:                           mySTOCK side:
─────────────                          ────────────
medusa_variant_id (internal)           mystock_product_id (UUID from mySTOCK)
variant.sku       (ISBN/SKU)           productCode        (= your SKU/ISBN)

Products are matched by productCode (= ISBN for books).
The ISBN is the universal link between both systems.
```

### Matching Summary Table

| Entity | Your key (→ mySTOCK) | mySTOCK key (→ you) | Stored in |
|--------|---------------------|---------------------|-----------|
| **Order** | `orderCode` (e.g. "NL-1042") | `documentId` / `documentCode` in webhooks | `mystock_order_map` |
| **Product** | `productCode` (= ISBN/SKU) | `productId` in webhooks & stock cards | `mystock_product_map` |
| **Partner** | `code` (e.g. "EVERCHAPTER") | `partnerId` (UUID) | `dextrum_config` |
| **Op. Unit** | `code` (e.g. "SHOP-NL") | `operatingUnitId` (UUID) | `dextrum_project_config` |
| **Carrier** | shipping_option_id | `deliveryMethodId` (UUID) | `dextrum_carrier_map` |
| **Payment** | payment_provider | `paymentMethodId` (UUID) | `dextrum_payment_map` |

---

## 1b. Order Delivery Status Lifecycle

### Definitive Status List & Colors

These are the ONLY statuses used in the `delivery` field. Each status maps to a specific color for visual clarity in the admin panel.

| Status | Label | Color (hex) | Background | When |
|--------|-------|-------------|------------|------|
| `NEW` | New | `#3B82F6` | Blue | Order just created, payment being verified |
| `WAITING` | Waiting | `#F59E0B` | Amber/Orange | 15-min hold period — order data may still change |
| `IMPORTED` | Imported | `#8B5CF6` | Purple | Successfully sent to mySTOCK WMS (POST 201) |
| `PROCESSED` | Processed | `#06B6D4` | Cyan | WMS fully picked & prepared (Event 7, subtype 3) |
| `PACKED` | Packed | `#10B981` | Emerald/Green | Package assembled with label (Event 26) |
| `DISPATCHED` | Dispatched | `#22C55E` | Green | Carrier picked up, tracking number available (Event 12) |
| `IN_TRANSIT` | In Transit | `#6366F1` | Indigo | Carrier status update received (Event 29) |
| `DELIVERED` | Delivered | `#16A34A` | Dark Green | Final delivery confirmed (Event 29 final) |

**Error/exception statuses (not part of happy path):**

| Status | Label | Color (hex) | Background | When |
|--------|-------|-------------|------------|------|
| `ALLOCATION_ISSUE` | Stock Issue | `#EF4444` | Red | WMS cannot allocate items (Event 34) |
| `PARTIALLY_PICKED` | Partial Pick | `#F97316` | Orange | Not all items picked (Event 28) |
| `CANCELLED` | Cancelled | `#6B7280` | Gray | Order cancelled (Event 20) |
| `FAILED` | Failed | `#DC2626` | Dark Red | API call to WMS failed after retries |

### Payment Validation Rule (CRITICAL)

**An order MUST be PAID before it transitions from WAITING → IMPORTED.**

```
Before sending to WMS, validate:
  IF payment_method === "COD" (dobírka):
    → SKIP payment check, send immediately after hold
    → Include cashAmount in paymentInformation
  ELSE:
    → Order MUST have payment_status === "captured" or "paid"
    → If NOT paid after hold expires → keep in WAITING, retry check every 2 min
    → After 30 min unpaid → flag for manual review
```

**COD exception applies ONLY to projects that support it.** Per-project config determines whether COD is available.

### 15-Minute Hold Logic (CRITICAL)

When an order enters `WAITING` status, a 15-minute timer starts. During this period, the order can be updated (new items, address changes, etc.). **When the timer expires:**

```
1. Timer expires (15 min after order.placed)
2. RE-FETCH the full order from Medusa DB (fresh data!)
   - This catches any updates made during the hold period
   - New line items added
   - Shipping address changes
   - Customer email/phone updates
   - Payment method changes
   - Order notes
3. Validate payment (see rule above)
4. If PAID (or COD): build payload from FRESH data → POST to mySTOCK → status = IMPORTED
5. If NOT PAID: keep WAITING, schedule retry
```

**Why re-fetch?** During the 15-min window, customer service or the customer themselves may modify the order (add a product, change delivery address, apply a discount code). The WMS must receive the FINAL version.

### Status Flow Diagram

```
  ┌──────────┐
  │   NEW    │ ← Order created
  │  #3B82F6 │
  └────┬─────┘
       │ payment detected / COD
  ┌────▼─────┐
  │ WAITING  │ ← 15-min hold starts
  │ #F59E0B  │   (order can be modified)
  └────┬─────┘
       │ hold expires + re-fetch + payment OK
  ┌────▼─────┐
  │ IMPORTED │ ← Sent to mySTOCK (POST 201)
  │ #8B5CF6  │
  └────┬─────┘
       │ Event 7 (subtype 3)
  ┌────▼──────┐
  │ PROCESSED │ ← All items picked
  │ #06B6D4   │
  └────┬──────┘
       │ Event 26
  ┌────▼─────┐
  │  PACKED  │ ← Packaged + labeled
  │ #10B981  │
  └────┬─────┘
       │ Event 12 (+ tracking number)
  ┌────▼──────────┐
  │  DISPATCHED   │ ← Carrier has it
  │  #22C55E      │
  └────┬──────────┘
       │ Event 29
  ┌────▼──────────┐
  │  IN_TRANSIT   │ ← On the way
  │  #6366F1      │
  └────┬──────────┘
       │ Event 29 (delivered)
  ┌────▼──────────┐
  │  DELIVERED    │ ← Done!
  │  #16A34A      │
  └───────────────┘

  Exception branches:
  IMPORTED ──Event 34──→ ALLOCATION_ISSUE (#EF4444)
  IMPORTED ──Event 28──→ PARTIALLY_PICKED (#F97316)
  Any ──────Event 20──→ CANCELLED (#6B7280)
  Any ──────API fail──→ FAILED (#DC2626)
```

---

## 2. Module Architecture

### File Structure
```
backend/src/modules/mystock/
├── index.ts                          # Module definition
├── service.ts                        # Main MyStockModuleService
├── types.ts                          # TypeScript interfaces
├── api/
│   ├── middlewares.ts                 # Auth middleware for webhooks
│   └── webhooks/
│       └── mystock/
│           └── route.ts              # POST /webhooks/mystock (event receiver)
├── clients/
│   └── mystock-api.ts                # HTTP client wrapper
├── subscribers/
│   ├── order-placed.ts               # Medusa order.placed → mySTOCK
│   ├── order-canceled.ts             # Medusa order.canceled → mySTOCK
│   ├── product-created.ts            # Medusa product.created → mySTOCK
│   └── product-updated.ts            # Medusa product.updated → mySTOCK
├── jobs/
│   ├── sync-inventory.ts             # Cron: poll Stock Card → update Medusa inventory
│   └── retry-failed-orders.ts        # Cron: retry failed order submissions
├── workflows/
│   ├── forward-order-to-wms.ts       # Full order forwarding workflow
│   ├── process-wms-event.ts          # Handle incoming webhook event
│   └── sync-stock-card.ts            # Inventory sync workflow
└── migrations/
    └── create-mystock-tables.ts      # DB tables for mapping IDs
```

### Database Tables (Migrations)

```sql
-- Maps Medusa order IDs to mySTOCK order IDs
-- This is the PRIMARY order record — contains delivery status + tracking
CREATE TABLE mystock_order_map (
  id VARCHAR PRIMARY KEY,
  medusa_order_id VARCHAR NOT NULL UNIQUE,
  mystock_order_id VARCHAR,           -- UUID from mySTOCK response
  mystock_order_code VARCHAR NOT NULL, -- orderCode sent to mySTOCK

  -- DELIVERY STATUS (shown in order card)
  delivery_status VARCHAR DEFAULT 'NEW',  -- NEW, WAITING, IMPORTED, PROCESSED, PACKED, DISPATCHED, IN_TRANSIT, DELIVERED, ALLOCATION_ISSUE, PARTIALLY_PICKED, CANCELLED, FAILED
  delivery_status_color VARCHAR DEFAULT '#3B82F6',  -- hex color for UI rendering
  delivery_status_updated_at TIMESTAMP,

  -- TRACKING (shown in order card when available)
  tracking_number VARCHAR,            -- e.g. "CZ1234567890" — from Event 12
  tracking_url VARCHAR,               -- e.g. "https://tracking.ppl.cz/..." — from Event 12
  carrier_name VARCHAR,               -- e.g. "PPL", "Zásilkovna", "PostNL" — from Event 12

  -- PACKAGING INFO (from Event 26)
  package_weight DECIMAL,             -- kg
  package_length INT,                 -- mm
  package_width INT,                  -- mm
  package_height INT,                 -- mm
  package_sscc VARCHAR,               -- SSCC barcode

  -- INTERNAL
  last_event_id VARCHAR,              -- last processed eventId for deduplication
  error_message TEXT,
  retry_count INT DEFAULT 0,
  hold_expires_at TIMESTAMP,          -- when 15-min hold ends
  payment_verified BOOLEAN DEFAULT FALSE,
  sent_to_wms_at TIMESTAMP,           -- when POST to mySTOCK was made
  dispatched_at TIMESTAMP,            -- when carrier picked up (Event 12)
  delivered_at TIMESTAMP,             -- when delivered (Event 29)
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Maps Medusa product IDs to mySTOCK product IDs
CREATE TABLE mystock_product_map (
  id VARCHAR PRIMARY KEY,
  medusa_product_id VARCHAR NOT NULL,
  medusa_variant_id VARCHAR NOT NULL UNIQUE,
  mystock_product_id VARCHAR,         -- UUID from mySTOCK
  mystock_product_code VARCHAR NOT NULL, -- productCode (typically SKU/ISBN)
  synced_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Stores raw webhook events for audit and replay
CREATE TABLE mystock_events (
  id VARCHAR PRIMARY KEY,
  event_id VARCHAR NOT NULL UNIQUE,    -- mySTOCK eventId for deduplication
  event_type INT NOT NULL,
  event_subtype INT,
  document_code VARCHAR,
  payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMP,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Order event history / timeline — every status change and WMS event logged here
CREATE TABLE mystock_order_timeline (
  id VARCHAR PRIMARY KEY,
  medusa_order_id VARCHAR NOT NULL,    -- FK to order
  mystock_order_code VARCHAR,          -- for quick lookup

  -- WHAT HAPPENED
  event_type VARCHAR NOT NULL,         -- 'status_change', 'wms_event', 'api_call', 'manual', 'error'
  status_from VARCHAR,                 -- previous delivery_status (null for first entry)
  status_to VARCHAR,                   -- new delivery_status (null if not a status change)

  -- EVENT DETAILS
  title VARCHAR NOT NULL,              -- Human-readable: "Sent to warehouse", "Carrier picked up"
  description TEXT,                    -- Details: "POST /V1/orderIncoming/ returned 201, UUID: abc-123"

  -- WMS EVENT REFERENCE (if triggered by webhook)
  wms_event_id VARCHAR,                -- mySTOCK eventId
  wms_event_type INT,                  -- mySTOCK event type number
  wms_event_subtype INT,               -- mySTOCK event subtype

  -- TRACKING (stored per-event for history, even if overwritten on order)
  tracking_number VARCHAR,             -- if this event provided tracking
  tracking_url VARCHAR,                -- if this event provided tracking URL
  carrier_name VARCHAR,                -- if this event provided carrier info

  -- METADATA
  raw_payload JSONB,                   -- full event payload for debugging
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_order_timeline_order ON mystock_order_timeline(medusa_order_id, created_at);
CREATE INDEX idx_order_timeline_code ON mystock_order_timeline(mystock_order_code);

-- Inventory sync tracking — stock levels per product
CREATE TABLE mystock_inventory (
  id VARCHAR PRIMARY KEY,
  medusa_variant_id VARCHAR NOT NULL,
  mystock_product_id VARCHAR NOT NULL,
  mystock_product_code VARCHAR NOT NULL,   -- SKU/ISBN
  warehouse_code VARCHAR NOT NULL,

  -- STOCK LEVELS (from Stock Card API)
  available_stock INT DEFAULT 0,           -- can be sold
  physical_stock INT DEFAULT 0,            -- physically in warehouse
  reserved_stock INT DEFAULT 0,            -- allocated to orders
  blocked_stock INT DEFAULT 0,             -- damaged/quarantined

  -- SYNC METADATA
  last_synced_at TIMESTAMP,
  previous_available_stock INT,            -- for change detection
  stock_changed_at TIMESTAMP,              -- when stock last changed

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(mystock_product_id, warehouse_code)
);

CREATE INDEX idx_inventory_variant ON mystock_inventory(medusa_variant_id);
CREATE INDEX idx_inventory_product ON mystock_inventory(mystock_product_code);

-- Inventory sync log — audit trail of all sync operations
CREATE TABLE mystock_inventory_sync_log (
  id VARCHAR PRIMARY KEY,
  sync_type VARCHAR NOT NULL,              -- 'scheduled', 'event_triggered', 'manual'
  warehouse_code VARCHAR,

  -- RESULTS
  products_checked INT DEFAULT 0,
  products_updated INT DEFAULT 0,
  products_out_of_stock INT DEFAULT 0,     -- became 0
  products_back_in_stock INT DEFAULT 0,    -- was 0, now > 0
  errors INT DEFAULT 0,

  -- DETAILS
  changes JSONB,                           -- array of { productCode, oldStock, newStock }
  error_details TEXT,

  duration_ms INT,                         -- how long the sync took
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 3. API Client Implementation

### HTTP Client (`clients/mystock-api.ts`)

```typescript
import axios, { AxiosInstance } from "axios"

interface MyStockResponse<T> {
  data: T
  errors: Array<{ code: string; message: string }>
}

class MyStockApiClient {
  private client: AxiosInstance

  constructor(baseUrl: string, username: string, password: string) {
    this.client = axios.create({
      baseURL: `${baseUrl}/V1`,
      auth: { username, password },
      headers: { "Content-Type": "application/json" },
      timeout: 30000,
    })
  }

  // Generic request handler with error extraction
  private async request<T>(method: string, url: string, data?: any): Promise<T> {
    const response = await this.client.request<MyStockResponse<T>>({
      method, url, data,
    })
    if (response.data.errors?.length > 0) {
      throw new Error(`mySTOCK API Error: ${JSON.stringify(response.data.errors)}`)
    }
    return response.data.data
  }

  // Connection test
  async aboutMe() { return this.request("GET", "/aboutMe/") }

  // Products
  async createProduct(product: MyStockProduct) { return this.request("POST", "/product/", product) }
  async updateProduct(product: MyStockProduct) { return this.request("PUT", "/product/", product) }

  // Product Barcodes
  async createProductBarcode(barcode: MyStockBarcode) { return this.request("POST", "/productBarcode/", barcode) }
  async updateProductBarcode(barcode: MyStockBarcode) { return this.request("PUT", "/productBarcode/", barcode) }

  // Orders
  async createOrderIncoming(order: MyStockOrderIncoming) { return this.request("POST", "/orderIncoming/", order) }
  async updateOrderIncoming(order: MyStockOrderIncoming) { return this.request("PUT", "/orderIncoming/", order) }
  async deleteOrderIncoming(order: { id: string }) { return this.request("DELETE", "/orderIncoming/", order) }

  // Order Processing Lock
  async lockOrder(data: { orderIncomingId: string; locked: boolean }) {
    return this.request("POST", "/orderIncomingProcessing/", data)
  }

  // Inventory
  async getStockCard(warehouseCode: string) {
    return this.request("GET", `/stockCard/${warehouseCode}/`)
  }
  async getProductStockCard(productId: string) {
    return this.request("GET", `/productStockCard/${productId}`)
  }

  // Shipping Labels
  async createShippingLabel(label: MyStockShippingLabel) { return this.request("POST", "/shippingLabel/", label) }
  async updateShippingLabel(label: MyStockShippingLabel) { return this.request("PUT", "/shippingLabel/", label) }
  async deleteShippingLabel(label: { id: string }) { return this.request("DELETE", "/shippingLabel/", label) }

  // Partners
  async createPartner(partner: MyStockPartner) { return this.request("POST", "/partner/", partner) }
  async updatePartner(partner: MyStockPartner) { return this.request("PUT", "/partner/", partner) }
}
```

---

## 4. Data Model Mappings

### 4.1 Medusa Product → mySTOCK Product (POST /V1/product/)

```json
{
  "productCode": "<medusa_variant.sku || ISBN>",
  "name": "<medusa_product.title>",
  "shortName": "<first 50 chars of title>",
  "measurementUnitCode": "ks",
  "productGroupCode": "<mapped_from_collection>",
  "partnerId": "<your_partner_uuid>",
  "weight": "<medusa_variant.weight in kg>",
  "length": "<medusa_variant.length in mm>",
  "width": "<medusa_variant.width in mm>",
  "height": "<medusa_variant.height in mm>",
  "extensionData": {
    "entities": [
      {
        "entity": "Product",
        "action": "INSERT",
        "properties": [
          { "property": "RecommendedPrice", "value": "<medusa_variant.price>" },
          { "property": "NumberOfPages", "value": "<from_metadata>" }
        ],
        "relations": [
          {
            "entity": "ProductCategory",
            "action": "INSERT",
            "properties": [
              { "property": "ItemListCode", "value": "<category_code>" }
            ]
          }
        ]
      }
    ]
  }
}
```

**Key fields:**
- `productCode` — Use ISBN or SKU (max unique identifier for books)
- `measurementUnitCode` — Always `"ks"` (kusy = pieces) for books
- `weight` — In kilograms (decimal)
- Dimensions — In millimeters (integers)
- `extensionData` — For additional book metadata (categories, price, page count)

### 4.2 Medusa Order → mySTOCK Order Incoming (POST /V1/orderIncoming/)

This is the **most critical mapping** — it forwards customer orders to the warehouse for fulfillment.

```json
{
  "orderCode": "<medusa_order.display_id or custom sequential code>",
  "type": 1,
  "partnerId": "<pre_configured_partner_uuid>",
  "operatingUnitId": "<pre_configured_operating_unit_uuid>",
  "deliveryMethodId": "<mapped_carrier_uuid>",
  "paymentMethodId": "<mapped_payment_uuid>",
  "requiredExpeditionDate": "<ISO_date_when_order_should_ship>",
  "note": "<order_notes>",
  "dispatchIncomplete": 0,
  "partyIdentification": {
    "company": "<shipping_address.company || null>",
    "firstName": "<shipping_address.first_name>",
    "lastName": "<shipping_address.last_name>",
    "street": "<shipping_address.address_1>",
    "city": "<shipping_address.city>",
    "zip": "<shipping_address.postal_code>",
    "country": "<shipping_address.country_code>",
    "email": "<order.email>",
    "phone": "<shipping_address.phone>",
    "pickupPlaceCode": "<if_pickup_point_delivery>",
    "externalCarrierCode": "<carrier_specific_code>"
  },
  "paymentInformation": {
    "variableSymbol": "<order.display_id>",
    "cashAmount": "<COD_amount_if_applicable>",
    "currencyCode": "<order.currency_code>"
  },
  "items": [
    {
      "productId": "<mystock_product_uuid from mystock_product_map>",
      "amount": {
        "quantity": "<line_item.quantity>",
        "measurementUnitCode": "ks"
      },
      "pricePerUnit": "<line_item.unit_price>",
      "referenceCode": "<line_item.id>"
    }
  ]
}
```

**Critical fields explained:**
- `type: 1` — External order (customer order). Use `10` for supplier returns.
- `partnerId` — UUID of the pre-created partner record in mySTOCK (your company)
- `operatingUnitId` — UUID of the pre-created operating unit (can be per-project)
- `deliveryMethodId` — UUID mapped from Medusa shipping method → mySTOCK carrier
- `paymentMethodId` — UUID mapped from Medusa payment method
- `dispatchIncomplete` values:
  - `0` = Wait for all items (default for book orders)
  - `10` = Ship available, cancel rest
  - `20` = Ship available, backorder rest
  - `25` = Ship available, backorder rest then cancel
  - `31` = Wait up to requiredExpeditionDate, then ship available
  - `40` = Same as 31 but cancel unavailable
  - `50` = Same as 31 but backorder unavailable
- `partyIdentification` — B2C delivery address (where the package goes)
- `pickupPlaceCode` — For pickup point deliveries (Zásilkovna, PPL ParcelShop, etc.)
- `externalCarrierCode` — External carrier identifier for pickup point networks
- `paymentInformation.cashAmount` — Set this for COD (cash on delivery) orders only

### 4.3 mySTOCK Stock Card → Medusa Inventory

**GET /V1/stockCard/{erpWarehouseCode}/**

Response structure:
```json
{
  "data": [
    {
      "productId": "<mystock_product_uuid>",
      "productCode": "<SKU/ISBN>",
      "warehouseCode": "<warehouse_code>",
      "locationCode": "<location_in_warehouse>",
      "availableStock": 150,
      "physicalStock": 160,
      "reservedStock": 10,
      "blockedStock": 0,
      "lotNumber": "<batch>",
      "expirationDate": "<if_applicable>"
    }
  ]
}
```

**Mapping logic:**
```
availableStock → medusa inventory_item.stocked_quantity - reserved
physicalStock  → total physical count in warehouse
reservedStock  → allocated to orders but not yet shipped
blockedStock   → damaged/quarantined items
```

**For Medusa inventory update, use `availableStock`** as the source of truth for "how many can be sold."

**GET /V1/productStockCard/{productId}** — Same but for a single product across all warehouses.

### 4.4 Carrier / Delivery Method Mapping

Create a configuration map (store in DB or config file):

```typescript
const CARRIER_MAP: Record<string, string> = {
  // Medusa shipping_option.id → mySTOCK deliveryMethodId (UUID)
  "so_czech_post":     "uuid-from-mystock-for-ceska-posta",
  "so_zasilkovna":     "uuid-from-mystock-for-zasilkovna",
  "so_ppl":            "uuid-from-mystock-for-ppl",
  "so_dpd":            "uuid-from-mystock-for-dpd",
  "so_gls":            "uuid-from-mystock-for-gls",
  "so_dhl":            "uuid-from-mystock-for-dhl",
  "so_postnl":         "uuid-from-mystock-for-postnl",
  "so_bpost":          "uuid-from-mystock-for-bpost",
  "so_inpost_pl":      "uuid-from-mystock-for-inpost",
  "so_poczta_polska":  "uuid-from-mystock-for-poczta-polska",
  "so_postnord":       "uuid-from-mystock-for-postnord",
}

const PAYMENT_MAP: Record<string, string> = {
  // Medusa payment_provider → mySTOCK paymentMethodId (UUID)
  "stripe":   "uuid-for-card-payment",
  "paypal":   "uuid-for-paypal",
  "cod":      "uuid-for-cod",       // Cash on delivery
  "transfer": "uuid-for-bank-transfer",
}
```

---

## 5. Webhook Event Processing

### Webhook Endpoint Setup

mySTOCK sends events via POST to your `/V1/event` endpoint. You must implement this as a Medusa API route.

**Route:** `POST /webhooks/mystock`

**Critical rules:**
1. Always return HTTP 200 immediately (even if processing fails — queue it for retry)
2. Use `eventId` for **deduplication** — mySTOCK retransmits on failure
3. Store all events in `mystock_events` table for audit trail
4. Process events asynchronously (queue/worker pattern)

### Event Payload Structure

```json
{
  "eventId": "<unique_uuid>",
  "eventType": 12,
  "eventSubType": 0,
  "documentId": "<uuid_of_related_document>",
  "documentCode": "<human_readable_code>",
  "timestamp": "2026-02-25T10:30:00Z",
  // ... event-specific fields below
}
```

### Critical Events for E-commerce

#### Event 5 — Dispensing (item shipped/unshipped quantity update)
**When:** WMS picks items from shelves for an order
```json
{
  "eventType": 5,
  "items": [
    {
      "productId": "<uuid>",
      "productCode": "<SKU>",
      "issuedQuantity": 1,
      "unissuedQuantity": 0
    }
  ]
}
```
**Action:** Update order line item fulfillment status. If `unissuedQuantity > 0`, handle partial fulfillment.

#### Event 7 — Document Processing Completion
**When:** A document has been fully processed in the WMS
```json
{
  "eventType": 7,
  "eventSubType": <subtype>,
  "documentId": "<uuid>",
  "documentCode": "<code>"
}
```
**Subtypes:**
| SubType | Document | Action |
|---------|----------|--------|
| 1 | Receipt completed | Inbound goods received — trigger inventory sync |
| 2 | Issue completed | Outbound issue done |
| 3 | Order Incoming completed | Order fully processed — ready for dispatch |
| 4 | Production contract | N/A for e-commerce |
| 5 | Inventory check | Trigger full inventory resync |
| 6 | Logistics units | Package assembled |

**Action for subtype 3:** Set delivery = `PROCESSED` (#06B6D4) — all items picked and ready.

#### Event 12 — Shipment Dispatch (MOST IMPORTANT)
**When:** Package leaves the warehouse with carrier
```json
{
  "eventType": 12,
  "documentId": "<order_uuid>",
  "documentCode": "<order_code>",
  "shipments": [
    {
      "shipmentId": "<uuid>",
      "carrierName": "PPL",
      "trackingNumber": "CZ1234567890",
      "trackingUrl": "https://tracking.ppl.cz/...",
      "dispatchDate": "2026-02-25"
    }
  ]
}
```
**Action:**
1. Set delivery = `DISPATCHED` (#22C55E)
2. Create Medusa Fulfillment with tracking info
3. Update `mystock_shipments` table with trackingNumber + carrierName
4. Trigger email notification to customer with tracking link

#### Event 26 — Logistics Units Export (packaging details)
**When:** WMS reports packaging information
```json
{
  "eventType": 26,
  "documentId": "<order_uuid>",
  "logisticsUnits": [
    {
      "logisticsUnitId": "<uuid>",
      "sscc": "<SSCC_barcode>",
      "weight": 1.5,
      "length": 300,
      "width": 200,
      "height": 50,
      "items": [
        {
          "productId": "<uuid>",
          "productCode": "<SKU>",
          "quantity": 2
        }
      ]
    }
  ]
}
```
**Action:**
1. Set delivery = `PACKED` (#10B981)
2. Store packaging details (weight, dimensions, SSCC) — useful for multi-package shipments and shipping cost reconciliation.

#### Event 29 — Shipment Status from Carrier
**When:** Carrier sends status update through mySTOCK
```json
{
  "eventType": 29,
  "shipmentId": "<uuid>",
  "status": "<carrier_status_code>",
  "statusDescription": "Delivered",
  "timestamp": "2026-02-25T14:30:00Z"
}
```
**Action:**
1. If in-transit status → set delivery = `IN_TRANSIT` (#6366F1)
2. If delivered status → set delivery = `DELIVERED` (#16A34A)
3. Update `mystock_shipments` status
4. If failed delivery → alert customer support

#### Event 34 — Insufficient Quantity for Allocation
**When:** WMS cannot allocate requested quantity for an order
```json
{
  "eventType": 34,
  "documentId": "<order_uuid>",
  "documentCode": "<order_code>",
  "items": [
    {
      "productId": "<uuid>",
      "productCode": "<SKU>",
      "requestedQuantity": 5,
      "availableQuantity": 2
    }
  ]
}
```
**Action:**
1. Set delivery = `ALLOCATION_ISSUE` (#EF4444)
2. Trigger inventory resync for affected products
3. Notify admin team
4. Depending on `dispatchIncomplete` setting, WMS may auto-handle partial fulfillment

#### Event 20 — Document Cancellation
**When:** A document is cancelled in WMS
```json
{
  "eventType": 20,
  "documentId": "<uuid>",
  "documentCode": "<code>"
}
```
**Action:** Set delivery = `CANCELLED` (#6B7280). If this is an order → cancel the corresponding Medusa order or flag for review.

#### Event 28 — Incompletely Picked Document
**When:** Not all items could be picked
```json
{
  "eventType": 28,
  "documentId": "<order_uuid>",
  "items": [
    {
      "productId": "<uuid>",
      "pickedQuantity": 1,
      "requestedQuantity": 3
    }
  ]
}
```
**Action:** Set delivery = `PARTIALLY_PICKED` (#F97316). Handle partial fulfillment — update order, notify customer if applicable.

### Other Events (log but typically no action needed)

| Event | Name | Notes |
|-------|------|-------|
| 1 | Print request | Barcode/delivery note/invoice printing — typically WMS-internal |
| 2 | Shipping label print request | WMS prints carrier label |
| 3 | Location/warehouse change | Internal warehouse reorganization |
| 6 | Product receipt | Goods received at warehouse (trigger inventory sync) |
| 8 | Ready for loading | Packages staged for carrier pickup |
| 11 | Product dimensions change | Update product dimensions in Medusa |
| 14 | Product putaway | Goods stored in location |
| 15 | Stocking up completion | Shelf restocking done |
| 16 | Shipment generation start | WMS started creating shipment |
| 17 | Picking start | Warehouse workers started picking order |
| 19 | Serial numbers | Serial number tracking (N/A for books) |
| 21 | Delivery method change | Carrier changed by WMS — update Medusa shipping info |
| 22 | Atest date export | Expiration dates (N/A for books) |
| 24 | Received carrier | Which carrier picked up |
| 25 | Inventory check results | Trigger full inventory resync |
| 27 | Record creation request | WMS asks ERP to create a record |
| 30 | Dispensing with logistics units | Detailed pick info with packaging |
| 32 | Manufactured product receipt | N/A for books |
| 33 | Inventory items price request | WMS asks for price updates |

---

## 6. Core Workflows

### 6.1 Order Forwarding (order.placed → mySTOCK)

```
1. Medusa event: order.placed
2. Subscriber: order-placed.ts
   a. Create mystock_order_map record with status = 'NEW'
   b. Set delivery field = 'NEW' (#3B82F6)
   c. Validate payment exists or COD → set delivery = 'WAITING' (#F59E0B)
   d. Schedule delayed job: "forward-to-wms" with 15-minute delay

3. Delayed job: forward-to-wms (runs after 15 min)
   a. RE-FETCH full order from Medusa DB (FRESH data — catches all modifications!)
      - Line items (may have been added/removed)
      - Shipping address (may have been corrected)
      - Customer email, phone
      - Payment info, discount codes
      - Order notes
   b. PAYMENT CHECK:
      - If payment_method === 'COD': proceed (include cashAmount in payload)
      - Else if payment_status === 'captured'/'paid': proceed
      - Else: keep WAITING, schedule retry in 2 min (max 30 min total, then flag)
   c. Look up mySTOCK product UUIDs from mystock_product_map
   d. Map shipping method → deliveryMethodId
   e. Map payment method → paymentMethodId
   f. Build mySTOCK Order Incoming payload FROM FRESH DATA
   g. POST /V1/orderIncoming/
   h. On success (201): store mySTOCK UUID, set delivery = 'IMPORTED' (#8B5CF6)
   i. On failure: set delivery = 'FAILED' (#DC2626), retry_count++

4. Retry job picks up failed orders every 5 minutes (max 10 retries)
```

### 6.2 Order Cancellation (order.canceled → mySTOCK)

```
1. Medusa event: order.canceled
2. Subscriber: order-canceled.ts
   a. Look up mySTOCK order UUID from mystock_order_map
   b. Check if order is still cancellable (not yet dispatched)
   c. DELETE /V1/orderIncoming/ with { id: mystock_order_uuid }
   d. Update mystock_order_map status to 'canceled'
   e. If DELETE fails (already in processing) → try lock + update
```

### 6.3 Inventory / Stock Synchronization (COMPREHENSIVE)

Stock sync keeps Medusa storefront inventory accurate by pulling real data from the mySTOCK warehouse. There are 3 sync mechanisms — they work together:

#### Mechanism A: Scheduled Polling (Primary — every 15 min)

```
1. Cron job: every 15 minutes (configurable via MYSTOCK_INVENTORY_SYNC_INTERVAL)
2. GET /V1/stockCard/{warehouseCode}/
3. For each product in response:
   a. Look up Medusa variant from mystock_product_map by productCode
   b. Look up current record in mystock_inventory table
   c. Compare new availableStock with previous_available_stock
   d. If changed:
      - Update mystock_inventory (available, physical, reserved, blocked)
      - Update Medusa inventory level (set stocked_quantity = availableStock)
      - Store previous value for change detection
      - If availableStock === 0 AND previous > 0 → product went OUT OF STOCK
      - If availableStock > 0 AND previous === 0 → product BACK IN STOCK
4. Log sync to mystock_inventory_sync_log:
   - products_checked, products_updated
   - products_out_of_stock, products_back_in_stock
   - Array of all changes with old/new values
   - duration_ms
5. If any product went out of stock → trigger alerts (see below)
```

#### Mechanism B: Event-Triggered Sync (Instant — on specific webhooks)

These WMS events should trigger an IMMEDIATE inventory resync for affected products, not waiting for the 15-min poll:

```
Event 6  (Product receipt)         → New stock arrived, resync immediately
Event 7.1 (Receipt completed)      → Inbound goods fully processed, resync
Event 7.5 (Inventory check done)   → Physical count completed, full resync
Event 25 (Inventory check results) → Count results ready, full resync
Event 34 (Insufficient quantity)   → Stock issue detected, resync affected product
Event 5  (Dispensing)              → Items picked for order, resync affected product

For each triggered event:
1. Extract productId(s) from event payload
2. GET /V1/productStockCard/{productId} for each affected product
3. Update mystock_inventory + Medusa inventory
4. Log to mystock_inventory_sync_log with sync_type = 'event_triggered'
```

#### Mechanism C: Manual / On-Demand Sync

Admin can trigger a full sync from the dashboard:
```
1. Admin clicks "Sync Inventory Now" in admin panel
2. Full GET /V1/stockCard/{warehouseCode}/ for all warehouses
3. Process all products, same as Mechanism A
4. Log with sync_type = 'manual'
5. Return summary to admin
```

#### Stock Level Mapping (mySTOCK → Medusa)

```
mySTOCK field        → What it means                      → Medusa mapping
─────────────────────────────────────────────────────────────────────────
availableStock       → Can be sold right now               → inventory_item.stocked_quantity
physicalStock        → Total physically in warehouse       → (store in mystock_inventory for reference)
reservedStock        → Allocated to orders, not shipped    → (store for analytics — "pending orders")
blockedStock         → Damaged, quarantined, QC hold       → (store for alerts — "unusable stock")

Key formula: availableStock = physicalStock - reservedStock - blockedStock
```

#### What Happens When Stock Changes

```
availableStock > threshold          → Normal, no action
availableStock <= low_stock_alert   → Send low stock notification to admin
availableStock === 0                → Mark product as OUT OF STOCK on storefront
                                      Disable "Add to Cart" button
                                      Show "Vyprodáno" / "Uitverkocht" / "Wyprzedane"
                                      Log to timeline: "Product went out of stock"
availableStock > 0 (was 0)          → Mark product as BACK IN STOCK
                                      Re-enable purchasing
                                      Optionally trigger "back in stock" email to waitlist
```

#### Per-Product Stock Card (Real-time single product)

For checking a single product's stock (e.g., on product detail page or before order submission):

```
GET /V1/productStockCard/{productId}

Response:
{
  "data": [
    {
      "productId": "uuid",
      "productCode": "ISBN-978-...",
      "warehouseCode": "MAIN",
      "locationCode": "B-14-03",         // shelf location
      "availableStock": 150,
      "physicalStock": 160,
      "reservedStock": 10,
      "blockedStock": 0,
      "lotNumber": "2026-PRINT-01",      // print run
      "expirationDate": null             // N/A for books
    },
    {
      "productId": "uuid",
      "productCode": "ISBN-978-...",
      "warehouseCode": "MAIN",
      "locationCode": "A-02-01",         // second location in same warehouse
      "availableStock": 50,
      ...
    }
  ]
}

Note: One product can be in MULTIPLE locations within the same warehouse.
Total available = sum of availableStock across all locations.
```

#### Sync Configuration

```typescript
const INVENTORY_SYNC_CONFIG = {
  // Polling
  scheduledInterval: "*/15 * * * *",   // Every 15 min
  warehouseCodes: ["MAIN"],            // Which warehouses to poll

  // Thresholds
  lowStockThreshold: 10,               // Alert when below this
  criticalStockThreshold: 3,           // Urgent alert
  outOfStockAction: "disable_product", // disable_product | show_preorder | do_nothing

  // Event-triggered sync
  instantSyncEvents: [5, 6, 25, 34],  // Which events trigger immediate resync

  // Back-in-stock notifications
  backInStockEmailEnabled: true,
  backInStockWebhook: null,            // Optional webhook URL for external systems

  // Safety
  maxStockChangePercent: 50,           // If stock changes >50% in one sync, flag for review
  preventOversell: true,               // Never allow selling more than availableStock
}
```

#### Inventory Sync Log (Audit Trail)

Every sync operation (scheduled, event-triggered, manual) is logged to `mystock_inventory_sync_log`:

```
┌─ Inventory Sync Log ────────────────────────────────────┐
│                                                          │
│  25.02. 10:00  Scheduled sync                           │
│  Checked: 45 products · Updated: 3 · Duration: 1.2s    │
│  Changes:                                                │
│    ISBN-978-90-... : 150 → 148 (-2)                     │
│    ISBN-978-83-... : 0 → 500 (+500) ← BACK IN STOCK    │
│    ISBN-978-80-... : 5 → 0 (-5) ← OUT OF STOCK ⚠️       │
│                                                          │
│  25.02. 10:08  Event-triggered (Event 34)               │
│  Checked: 1 product · Updated: 1 · Duration: 0.3s      │
│  Changes:                                                │
│    ISBN-978-90-... : 148 → 145 (-3)                     │
│    Reason: Insufficient stock for order #1043           │
│                                                          │
│  25.02. 10:15  Scheduled sync                           │
│  Checked: 45 products · Updated: 0 · Duration: 1.1s    │
│  No changes                                              │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### 6.4 Webhook Event Processing

```
1. POST /webhooks/mystock received
2. Validate request (shared secret or IP whitelist)
3. Check eventId in mystock_events (deduplication)
4. If new: store in mystock_events, return 200 immediately
5. Async worker processes event:
   a. Route by eventType
   b. Execute appropriate action (see Section 5)
   c. Mark event as processed
   d. On failure: log error, mark for retry
```

### 6.5 Product Sync (product.created/updated → mySTOCK)

```
1. Medusa event: product.created or product.updated
2. Subscriber: product-created.ts / product-updated.ts
   a. For each variant:
      - Check if exists in mystock_product_map
      - If new: POST /V1/product/ → store UUID
      - If existing: PUT /V1/product/ with stored UUID
      - Sync barcode: POST/PUT /V1/productBarcode/
   b. Update mystock_product_map
```

---

## 7. Additional API Endpoints Reference

### Partner (pre-setup, typically one-time)
**POST /V1/partner/**
```json
{
  "code": "MYSHOP",
  "name": "My Book Shop s.r.o.",
  "registrationNumber": "12345678",
  "taxRegistrationNumber": "CZ12345678",
  "type": 2
}
```
Type: `1` = Supplier, `2` = Customer, `3` = Supplier+Customer

### Partner Operating Unit
**POST /V1/partnerOperatingUnit/**
```json
{
  "partnerId": "<partner_uuid>",
  "code": "SHOP-NL",
  "name": "Netherlands Store",
  "street": "Keizersgracht 123",
  "city": "Amsterdam",
  "zip": "1015CJ",
  "country": "NL",
  "email": "nl@myshop.com",
  "phone": "+31612345678"
}
```
Use this to create per-project operating units (one per country/store).

### Despatch Advice (inbound shipment notification)
**POST /V1/despatchAdvice/**
```json
{
  "despatchAdviceCode": "DA-2026-001",
  "partnerId": "<supplier_uuid>",
  "operatingUnitId": "<operating_unit_uuid>",
  "warehouseCode": "MAIN",
  "expectedDeliveryDate": "2026-03-01",
  "items": [
    {
      "productId": "<product_uuid>",
      "amount": { "quantity": 500, "measurementUnitCode": "ks" }
    }
  ],
  "logisticsUnits": [
    {
      "sscc": "00123456789012345678",
      "items": [
        {
          "productId": "<product_uuid>",
          "amount": { "quantity": 500, "measurementUnitCode": "ks" }
        }
      ]
    }
  ]
}
```

### Shipping Label
**POST /V1/shippingLabel/**
```json
{
  "orderIncomingId": "<order_uuid>",
  "carrierCode": "PPL",
  "trackingNumber": "CZ1234567890",
  "labelFormat": "PDF",
  "labelData": "<Base64_encoded_PDF>"
}
```
Use when generating carrier labels externally (e.g., from Medusa shipping integration).

### Order Incoming Processing (Lock/Unlock)
**POST /V1/orderIncomingProcessing/**
```json
{
  "orderIncomingId": "<order_uuid>",
  "locked": true
}
```
Lock an order before modifying delivery method (PUT). Unlock after update. This prevents WMS from processing the order during modification.

---

## 8. Extension Data System

mySTOCK uses a flexible extension data system for additional fields. The structure supports nested entities with properties and relations.

### Structure
```json
{
  "extensionData": {
    "entities": [
      {
        "entity": "<EntityName>",
        "action": "INSERT",          // INSERT, UPDATE, DELETE
        "properties": [
          {
            "property": "<PropertyName>",
            "value": "<value>"
          }
        ],
        "relations": [
          {
            "entity": "<RelatedEntityName>",
            "action": "INSERT",
            "properties": [
              { "property": "<PropertyName>", "value": "<value>" }
            ]
          }
        ]
      }
    ]
  }
}
```

### Available Extension Entities for Products
| Entity | Properties | Use Case |
|--------|-----------|----------|
| Product | RecommendedPrice, NumberOfPages | Book-specific metadata |
| ProductColor | ItemListCode | Product color variant |
| ProductCategory | ItemListCode | Product category assignment |
| ProductSeason | ItemListCode | Season (if applicable) |
| ProductLotVariant | ItemListCode | Product variant (edition) |

### Item Lists (lookup tables)
**POST /V1/itemList/** — Create lookup values for colors, categories, seasons, brands, lot variants
```json
{
  "type": "AssortmentCategory",
  "code": "CAT-FICTION",
  "name": "Fiction Books"
}
```
Types: `Color`, `AssortmentBrand`, `AssortmentSeason`, `AssortmentCategory`, `LotVariant`

---

## 9. Error Handling & Resilience

### Retry Strategy
```typescript
const RETRY_CONFIG = {
  maxRetries: 10,
  initialDelay: 5000,      // 5 seconds
  maxDelay: 300000,         // 5 minutes
  backoffMultiplier: 2,     // Exponential backoff
}
```

### Common Error Scenarios

| Scenario | Handling |
|----------|----------|
| Network timeout | Retry with exponential backoff |
| 401 Unauthorized | Alert admin — credential issue |
| 400 Bad Request | Log full payload, do not retry (data issue) |
| 409 Conflict | Record already exists — check `extIsId` or code uniqueness |
| 500 Server Error | Retry with backoff |
| Product not in mySTOCK | Auto-create product before order submission |
| Order already exists | Check by `orderCode`, use PUT to update |
| Webhook duplicate | Check `eventId` in mystock_events table |

### Webhook Deduplication
```typescript
async function processWebhook(event: MyStockEvent) {
  // Check if already processed
  const existing = await db.mystock_events.findOne({ event_id: event.eventId })
  if (existing?.processed) return { status: "already_processed" }

  // Store event
  await db.mystock_events.upsert({
    event_id: event.eventId,
    event_type: event.eventType,
    event_subtype: event.eventSubType,
    payload: event,
  })

  // Process asynchronously
  await queue.add("process-mystock-event", { eventId: event.eventId })

  return { status: "accepted" }
}
```

---

## 10. Configuration & Environment

### Medusa Config Addition (`medusa-config.js`)
```javascript
module.exports = {
  // ... existing config
  modules: [
    // ... existing modules
    {
      resolve: "./src/modules/mystock",
      options: {
        apiUrl: process.env.MYSTOCK_API_URL,
        username: process.env.MYSTOCK_API_USERNAME,
        password: process.env.MYSTOCK_API_PASSWORD,
        webhookSecret: process.env.MYSTOCK_WEBHOOK_SECRET,
        defaultWarehouseCode: process.env.MYSTOCK_ERP_WAREHOUSE_CODE,
        inventorySyncInterval: "*/15 * * * *",  // Every 15 minutes
        retryFailedOrdersInterval: "*/5 * * * *", // Every 5 minutes
      }
    }
  ]
}
```

### Multi-Project Support
Each project (NL, BE, PL, CZ, etc.) maps to a separate `operatingUnitId` in mySTOCK. The integration should:
1. Store per-project operating unit UUIDs in config
2. Include the correct `operatingUnitId` when creating orders
3. Use project context from Medusa sales channel to determine the correct mapping

```typescript
const PROJECT_CONFIG: Record<string, ProjectWmsConfig> = {
  "laat-los-nl": {
    operatingUnitId: "uuid-nl",
    defaultCarrier: "postnl",
    currencyCode: "EUR",
  },
  "laat-los-be": {
    operatingUnitId: "uuid-be",
    defaultCarrier: "bpost",
    currencyCode: "EUR",
  },
  "odpusc-pl": {
    operatingUnitId: "uuid-pl",
    defaultCarrier: "inpost",
    currencyCode: "PLN",
  },
  "psi-superzivot-cz": {
    operatingUnitId: "uuid-cz",
    defaultCarrier: "zasilkovna",
    currencyCode: "CZK",
  },
  // ... etc
}
```

---

## 11. Order Card — Displayed Data

Every order in the admin panel / delivery dashboard shows this information. Data comes from `mystock_order_map` (current state) + `mystock_order_timeline` (full history).

### Order Card Layout

```
┌──────────────────────────────────────────────────────────────────┐
│  Order #1042                                                      │
│  Laat los wat je kapotmaakt × 1, De Hondenbijbel × 2             │
│  Jan de Vries · jan@email.nl · +31612345678                       │
│  Keizersgracht 123, 1015CJ Amsterdam, NL                         │
│                                                                    │
│  ┌───────────────┐                                                │
│  │  DISPATCHED   │  ← colored status badge                       │
│  └───────────────┘                                                │
│                                                                    │
│  ┌─ Tracking ──────────────────────────────────────────────┐      │
│  │  Carrier:    PPL                                         │      │
│  │  Number:     CZ1234567890                                │      │
│  │  Track:      https://tracking.ppl.cz/CZ1234567890  [→]  │      │
│  └──────────────────────────────────────────────────────────┘      │
│                                                                    │
│  ┌─ Package ───────────────────────────────────────────────┐      │
│  │  Weight: 1.2 kg · Dimensions: 30 × 20 × 5 cm           │      │
│  │  SSCC: 00123456789012345678                              │      │
│  └──────────────────────────────────────────────────────────┘      │
│                                                                    │
│  ┌─ Warehouse History ─────────────────────────────────────┐      │
│  │                                                          │      │
│  │  ● 25.02. 10:00  NEW                                    │      │
│  │  │  Order received, payment verification started         │      │
│  │  │                                                       │      │
│  │  ● 25.02. 10:00  WAITING                                │      │
│  │  │  15-min hold started, payment confirmed (Stripe)      │      │
│  │  │                                                       │      │
│  │  ● 25.02. 10:15  IMPORTED                               │      │
│  │  │  Sent to warehouse (order re-fetched, 2 items)        │      │
│  │  │  mySTOCK ID: a1b2c3d4-e5f6-...                       │      │
│  │  │                                                       │      │
│  │  ● 25.02. 11:30  PROCESSED                              │      │
│  │  │  All items picked from shelf B-14                     │      │
│  │  │  WMS Event 7.3                                        │      │
│  │  │                                                       │      │
│  │  ● 25.02. 12:00  PACKED                                 │      │
│  │  │  1 package: 1.2kg, 30×20×5cm                         │      │
│  │  │  SSCC: 00123456789012345678                           │      │
│  │  │  WMS Event 26                                         │      │
│  │  │                                                       │      │
│  │  ● 25.02. 14:00  DISPATCHED                             │      │
│  │  │  Carrier: PPL                                         │      │
│  │  │  Tracking: CZ1234567890                               │      │
│  │  │  WMS Event 12                                         │      │
│  │  │                                                       │      │
│  │  ● 26.02. 09:15  IN_TRANSIT                             │      │
│  │  │  Zásilka v přepravě — depo Praha                      │      │
│  │  │  WMS Event 29                                         │      │
│  │  │                                                       │      │
│  │  ● 26.02. 14:30  DELIVERED                              │      │
│  │     Delivered to recipient                               │      │
│  │     WMS Event 29 (final)                                 │      │
│  │                                                          │      │
│  └──────────────────────────────────────────────────────────┘      │
└──────────────────────────────────────────────────────────────────┘
```

### Timeline Entry Types

Every event is logged to `mystock_order_timeline`. These are all entry types that can appear:

| event_type | title | description example | WMS Event |
|------------|-------|---------------------|-----------|
| `status_change` | Order received | Status changed to NEW | — |
| `status_change` | 15-min hold started | Payment confirmed (Stripe), hold until 10:15 | — |
| `status_change` | Sent to warehouse | POST /V1/orderIncoming/ → 201, UUID: abc-123 | — |
| `wms_event` | Picking started | Warehouse started picking items | Event 17 |
| `wms_event` | All items picked | 2/2 items picked from shelves | Event 7.3 |
| `wms_event` | Package assembled | 1 package: 1.2kg, 30×20×5cm, SSCC: 001... | Event 26 |
| `wms_event` | Label printed | Shipping label for PPL generated | Event 2 |
| `wms_event` | Ready for loading | Staged for carrier pickup | Event 8 |
| `wms_event` | Dispatched | Carrier: PPL, Tracking: CZ1234567890 | Event 12 |
| `wms_event` | Carrier update | Zásilka v přepravě — depo Praha | Event 29 |
| `wms_event` | Delivered | Delivered to recipient | Event 29 |
| `wms_event` | Stock issue | Requested: 5, Available: 2 (Laat los) | Event 34 |
| `wms_event` | Partial pick | Picked 1/3 of "De Hondenbijbel" | Event 28 |
| `wms_event` | Cancelled by WMS | Document cancelled in warehouse | Event 20 |
| `wms_event` | Carrier changed | Delivery method changed from PPL to DPD | Event 21 |
| `wms_event` | Dimensions updated | Product dimensions changed: 30×21×3cm | Event 11 |
| `api_call` | Order updated in WMS | PUT /V1/orderIncoming/ — address corrected | — |
| `api_call` | Order locked | Lock requested for modification | — |
| `api_call` | Order unlocked | Lock released, processing resumed | — |
| `api_call` | Order cancelled | DELETE /V1/orderIncoming/ → 200 | — |
| `manual` | Note added | "Customer called, wants express shipping" | — |
| `error` | WMS API failed | POST /V1/orderIncoming/ → 500, retry 3/10 | — |
| `error` | Payment timeout | Order unpaid after 30 min, flagged for review | — |

### How Timeline is Written

```typescript
// Every status change or event → insert into mystock_order_timeline
async function logTimelineEntry(orderId: string, entry: {
  event_type: "status_change" | "wms_event" | "api_call" | "manual" | "error",
  status_from?: string,
  status_to?: string,
  title: string,
  description?: string,
  wms_event_id?: string,
  wms_event_type?: number,
  wms_event_subtype?: number,
  tracking_number?: string,
  tracking_url?: string,
  carrier_name?: string,
  raw_payload?: object,
}) {
  await db.mystock_order_timeline.insert({
    id: generateId(),
    medusa_order_id: orderId,
    ...entry,
  })
}

// Example: when Event 12 (dispatch) arrives
logTimelineEntry(orderId, {
  event_type: "wms_event",
  status_from: "PACKED",
  status_to: "DISPATCHED",
  title: "Dispatched",
  description: `Carrier: ${event.carrierName}, Tracking: ${event.trackingNumber}`,
  wms_event_id: event.eventId,
  wms_event_type: 12,
  tracking_number: event.trackingNumber,
  tracking_url: event.trackingUrl,
  carrier_name: event.carrierName,
  raw_payload: event,
})
```

### Fields Available on Order Card

| Field | Source | Available from |
|-------|--------|----------------|
| `delivery_status` | Internal + webhook events | Always (starts as NEW) |
| `delivery_status_color` | Mapped from status | Always |
| `carrier_name` | Event 12 → `carrierName` | After DISPATCHED |
| `tracking_number` | Event 12 → `trackingNumber` | After DISPATCHED |
| `tracking_url` | Event 12 → `trackingUrl` | After DISPATCHED |
| `package_weight` | Event 26 → `weight` | After PACKED |
| `package_length` | Event 26 → `length` | After PACKED |
| `package_width` | Event 26 → `width` | After PACKED |
| `package_height` | Event 26 → `height` | After PACKED |
| `package_sscc` | Event 26 → `sscc` | After PACKED |
| `hold_expires_at` | Calculated: created_at + 15min | During WAITING |
| `sent_to_wms_at` | POST success timestamp | After IMPORTED |
| `dispatched_at` | Event 12 timestamp | After DISPATCHED |
| `delivered_at` | Event 29 final timestamp | After DELIVERED |
| `timeline[]` | `mystock_order_timeline` ordered by created_at | Always (grows over time) |

### Status Badge Rendering

```typescript
const STATUS_CONFIG = {
  NEW:               { label: "New",            color: "#3B82F6", textColor: "#FFFFFF" },
  WAITING:           { label: "Waiting",        color: "#F59E0B", textColor: "#000000" },
  IMPORTED:          { label: "Imported",       color: "#8B5CF6", textColor: "#FFFFFF" },
  PROCESSED:         { label: "Processed",      color: "#06B6D4", textColor: "#FFFFFF" },
  PACKED:            { label: "Packed",         color: "#10B981", textColor: "#FFFFFF" },
  DISPATCHED:        { label: "Dispatched",     color: "#22C55E", textColor: "#FFFFFF" },
  IN_TRANSIT:        { label: "In Transit",     color: "#6366F1", textColor: "#FFFFFF" },
  DELIVERED:         { label: "Delivered",       color: "#16A34A", textColor: "#FFFFFF" },
  ALLOCATION_ISSUE:  { label: "Stock Issue",    color: "#EF4444", textColor: "#FFFFFF" },
  PARTIALLY_PICKED:  { label: "Partial Pick",   color: "#F97316", textColor: "#FFFFFF" },
  CANCELLED:         { label: "Cancelled",      color: "#6B7280", textColor: "#FFFFFF" },
  FAILED:            { label: "Failed",         color: "#DC2626", textColor: "#FFFFFF" },
}
```

---

## 12. All mySTOCK API Capabilities & How You Could Use Them

Beyond the core order/product/inventory flow, mySTOCK offers many more features. Here's the full list with practical use cases for your e-commerce platform:

### 12a. Partner & Operating Unit Management

**Endpoints:** `POST/PUT /V1/partner/`, `POST/PUT /V1/partnerOperatingUnit/`

**What it does:** Create and manage business partners (suppliers, customers) and their operating units (branches, stores, warehouses).

**How you'd use it:**
- **One-time setup:** Create your company as a partner, then create one operating unit per project (NL, BE, PL, CZ, SE...). Each storefront's orders go to its own operating unit.
- **Supplier management:** If you start buying from multiple publishers, register each as a partner. Track which supplier delivered what.
- **B2B expansion:** If you ever sell wholesale to bookstores, create them as partners so the WMS knows which orders go to whom.

### 12b. Product Barcodes

**Endpoint:** `POST/PUT /V1/productBarcode/`

**What it does:** Assign multiple barcodes (EAN-13, ISBN, UPC) to a single product.

**How you'd use it:**
- **ISBN tracking:** Books have ISBN-10 and ISBN-13. Register both so warehouse scanners recognize either barcode.
- **Custom barcodes:** If you create bundles (e.g., "3 books for €39"), generate a custom barcode for the bundle so the warehouse picks it as one unit.
- **Multi-edition support:** Same book, different editions (hardcover, paperback) = different barcodes, same product group.

### 12c. Product Handling Equipment

**Endpoint:** `POST/PUT /V1/productHandlingEquipment/`

**What it does:** Define which packaging/handling materials are needed for a product (pallets, boxes, foam inserts, etc.).

**How you'd use it:**
- **Fragile items:** If you sell premium/special editions with dust jackets, specify that they need protective packaging.
- **Oversized books:** Art books or atlases might need a different box type. The warehouse automatically picks the right packaging.

### 12d. Product Groups

**Endpoint:** `POST/PUT /V1/productGroup/`

**What it does:** Organize products into logical groups within the warehouse.

**How you'd use it:**
- **Per-project grouping:** Group all "Laat los" products separately from "Odpuść" products.
- **Warehouse efficiency:** Products in the same group are stored near each other, speeding up picking for multi-item orders.

### 12e. Item Lists (Lookup Tables)

**Endpoint:** `POST/PUT /V1/itemList/`

**Types:** Color, AssortmentBrand, AssortmentSeason, AssortmentCategory, LotVariant

**How you'd use it:**
- **Categories:** Create book categories (Fiction, Self-Help, Children's, Dog Training) as AssortmentCategory items. Used for warehouse reporting.
- **Seasons:** If you do seasonal promotions (Christmas gift sets), tag products with AssortmentSeason.
- **Brands/Publishers:** Track which publisher (AssortmentBrand) each book comes from.
- **Lot Variants:** Track different print runs (1st edition, 2nd edition, reprint) as LotVariants. Useful for quality control.

### 12f. Document Attachments

**Endpoint:** `POST/PUT/DELETE /V1/document/`

**What it does:** Attach files (PDF invoices, packing slips, customs declarations) to any WMS document as Base64-encoded data.

**How you'd use it:**
- **Auto-generated invoices:** Attach a PDF invoice to each order so the warehouse prints and includes it in the package.
- **Customs declarations:** For shipments outside EU (if you expand to UK/CH), attach customs forms that the warehouse prints and sticks on the package.
- **Return labels:** Attach a pre-paid return shipping label so customers can easily return items.
- **Packing slips:** Custom-branded packing slip per project (different branding for NL vs PL store).

### 12g. Despatch Advice (Inbound Shipments)

**Endpoint:** `POST /V1/despatchAdvice/`

**What it does:** Notify the warehouse that a shipment of new stock is coming from a supplier. Includes expected products, quantities, and logistics units (pallets/boxes).

**How you'd use it:**
- **Restock notification:** When you order 5,000 copies of "Laat los" from the printer, send a despatch advice so the warehouse knows what's arriving and can prepare space.
- **Faster receiving:** Warehouse workers can pre-scan expected items, dramatically speeding up goods receipt.
- **Multi-supplier receiving:** Different publishers ship different books → separate despatch advices → warehouse knows which pallet belongs to which order.

### 12h. Receipt (Goods Receiving Confirmation)

**Endpoint:** `POST/PUT /V1/receipt/`

**What it does:** Confirm that goods have been physically received at the warehouse. Can differ from what was expected (damaged items, wrong quantities).

**How you'd use it:**
- **Automatic inventory update:** When the warehouse confirms receipt, trigger inventory sync to make new stock available on storefronts immediately.
- **Discrepancy alerts:** If the warehouse received 4,800 instead of 5,000 books, you get notified and can follow up with the printer.

### 12i. Order Processing Lock/Unlock

**Endpoint:** `POST /V1/orderIncomingProcessing/`

**What it does:** Lock an order to prevent the warehouse from processing it while you make changes. Unlock to resume.

**How you'd use it:**
- **Address correction:** Customer emails "wrong address!" after order is in WMS. Lock the order → update address via PUT → unlock. Warehouse continues with correct address.
- **Add item to order:** Customer wants to add another book. Lock → add item → unlock.
- **Change carrier:** Customer wants pickup point instead of home delivery. Lock → change deliveryMethodId → unlock.
- **Safety mechanism:** Prevents warehouse from picking an order that's being modified.

### 12j. Shipping Labels

**Endpoint:** `POST/PUT/DELETE /V1/shippingLabel/`

**What it does:** Upload carrier shipping labels (PDF or ZPL format, Base64 encoded) for orders. The warehouse prints and attaches them.

**How you'd use it:**
- **External label generation:** If you generate labels through your own carrier API (e.g., Zásilkovna API, PostNL API), upload them to mySTOCK so the warehouse uses your labels.
- **Multi-carrier support:** Different projects use different carriers. Generate the right label per project and upload it.
- **Label replacement:** Customer changed pickup point? Delete old label, upload new one.

### 12k. Inventory Transfer Request

**Endpoint:** `POST/PUT/DELETE /V1/inventoryTransferRequest/`

**What it does:** Request transfer of stock between warehouses or warehouse locations.

**How you'd use it:**
- **Multi-warehouse setup:** If you ever use 2+ warehouses (one in CZ, one in NL), transfer slow-moving stock to where it sells better.
- **Zone optimization:** Move fast-selling books to a pick-face zone closer to the packing stations.

### 12l. Assembly / Production

**Endpoints:** `POST /V1/assembly/`, `POST /V1/productionContract/`, `POST/PUT /V1/productionContractProcedure/`

**What it does:** Create assembly orders — combine multiple items into one finished product.

**How you'd use it:**
- **Gift sets:** Combine 3 different books + a branded tote bag into a "Christmas Gift Set" SKU.
- **Bundles with extras:** Book + signed bookmark + custom envelope = premium bundle. The warehouse assembles them.
- **Kitting:** Create pre-made bundles during slow periods so they ship immediately during peak sales.

### 12m. Inventory Check (Stocktaking)

**Endpoints:** `POST /V1/inventoryCheck/`, `GET /V1/inventoryCheckResult/`

**What it does:** Request a physical inventory count. The warehouse physically counts items and reports results.

**How you'd use it:**
- **Quarterly audits:** Request full stock count every quarter to reconcile physical vs. system inventory.
- **Discrepancy resolution:** If customers report "out of stock" but system shows availability, trigger a spot check for that specific product.
- **Year-end accounting:** Annual inventory valuation for tax purposes.

### 12n. Inventory Pricing

**Endpoints:** `GET /V1/inventoryPriceRequest/`, `PUT /V1/inventoryItemsPrice/`

**What it does:** Warehouse requests pricing for inventory valuation. You respond with prices.

**How you'd use it:**
- **Inventory valuation:** Warehouse needs to know the cost value of stock for insurance and accounting. You provide purchase prices.
- **Write-down management:** Mark damaged/returned books at reduced value.

### 12o. Stock Card & Product Stock Card (Real-time Inventory)

**Endpoints:** `GET /V1/stockCard/{warehouseCode}/`, `GET /V1/productStockCard/{productId}`

**What it does:** Get current inventory levels — available, physical, reserved, blocked — per product, per warehouse, per location.

**How you'd use it:**
- **Live stock sync:** Poll every 15 minutes to keep storefront inventory accurate.
- **Low stock alerts:** If availableStock drops below threshold, trigger notification or auto-reorder.
- **Multi-warehouse visibility:** See stock across all warehouses for a single product.
- **Reserved stock insight:** Know how many units are reserved for pending orders vs. actually available for new sales.

### 12p. Extension Data System

**Pattern used across all endpoints**

**What it does:** Flexible metadata system. Add custom fields, categories, relationships to any entity without schema changes.

**How you'd use it:**
- **Book metadata:** Number of pages, recommended retail price, publisher, language, edition year.
- **Custom sorting:** Add warehouse-specific sorting fields (e.g., "shelf priority").
- **Project tagging:** Tag products with which project they belong to for warehouse reporting.

### 12q. Webhook Events — Full Automation Potential

Beyond the core 8 statuses, these events unlock more automation:

| Event | Automation Opportunity |
|-------|----------------------|
| **Event 1** (Print request) | Auto-generate invoice PDF and upload via Document API before warehouse needs it |
| **Event 6** (Product receipt) | Immediately update storefront stock levels when new inventory arrives — faster than polling |
| **Event 11** (Dimension change) | Auto-update product dimensions on storefront → more accurate shipping cost estimates |
| **Event 17** (Picking start) | Show "Being prepared" in customer's order tracking page |
| **Event 21** (Delivery method change) | If warehouse switches carrier (e.g., PPL unavailable, switched to DPD), update customer email notification |
| **Event 24** (Carrier receipt) | Log which carrier physically picked up — useful for disputes |
| **Event 25** (Inventory check results) | Trigger full inventory resync automatically after stocktaking |
| **Event 33** (Price request) | Auto-respond with current purchase prices from your product database |
| **Event 34** (Insufficient stock) | Auto-disable product on storefront + trigger reorder email to publisher |

---

## 13. Testing Checklist

### Unit Tests
- [ ] Product mapping: Medusa product → mySTOCK product payload
- [ ] Order mapping: Medusa order → mySTOCK Order Incoming payload
- [ ] Stock Card response → Medusa inventory update
- [ ] Event deduplication logic
- [ ] Carrier mapping per project
- [ ] COD payment handling
- [ ] Pickup point address mapping
- [ ] 15-min hold + re-fetch logic
- [ ] Payment validation (PAID vs COD bypass)
- [ ] Status transitions and color mapping

### Integration Tests (against mySTOCK demo)
- [ ] `GET /V1/aboutMe/` — connection test
- [ ] `POST /V1/product/` — create test product
- [ ] `POST /V1/orderIncoming/` — create test order
- [ ] `GET /V1/stockCard/{code}/` — fetch inventory
- [ ] `DELETE /V1/orderIncoming/` — cancel test order
- [ ] Webhook receiver accepts and deduplicates events
- [ ] Order card displays tracking number + link after Event 12

### End-to-End Tests
- [ ] Place order in storefront → order appears in mySTOCK
- [ ] Cancel order in Medusa admin → order deleted in mySTOCK
- [ ] WMS dispatches order → Medusa fulfillment created with tracking
- [ ] Inventory change in WMS → Medusa stock updated within 15 min
- [ ] Out-of-stock in WMS → product marked as out-of-stock in storefront
- [ ] Order card shows correct status badge + color at each stage
- [ ] Tracking number + link appear on order card after dispatch
- [ ] Unpaid order stays in WAITING, doesn't reach WMS

---

## 14. Implementation Priority

### Phase 1 — Core (Week 1-2)
1. API client with authentication and error handling
2. Database migrations for mapping tables
3. Product sync (Medusa → mySTOCK)
4. Order forwarding (Medusa → mySTOCK)
5. Webhook endpoint with event storage and deduplication

### Phase 2 — Fulfillment (Week 2-3)
6. Event 12 processing (shipment dispatch → Medusa fulfillment)
7. Event 29 processing (carrier tracking updates)
8. Event 5 processing (item dispensing / partial fulfillment)
9. Event 34 processing (insufficient stock alerts)
10. Order cancellation flow

### Phase 3 — Inventory & Polish (Week 3-4)
11. Stock Card polling job
12. Event 7 processing (document completion)
13. Event 28 processing (incomplete picking)
14. Retry failed orders job
15. Admin dashboard widgets for WMS status
16. Per-project carrier/payment configuration UI

---

*Generated from mySTOCK API Blueprint documentation (mystock.apib, 6408 lines). Last updated: 2026-02-25.*
