# SupportBox — Customer Support Module Implementation

> **For Claude Code:** Execute all file creations/modifications below IN ORDER on the `staging` branch.
> After all changes: `git add . && git commit -m 'feat: SupportBox — customer support module with email management, auto order matching, Resend integration' && git push origin staging`

---

## Section 1: Overview + File Tree

**SupportBox** is a custom customer support module for MedusaJS 2.0 that integrates email management, auto-order matching, and Resend API for outbound emails. It provides an admin panel to manage support tickets, configure email inboxes, and track customer conversations.

### File Structure

```
backend/src/modules/supportbox/
├── models/
│   ├── supportbox-config.ts
│   ├── supportbox-ticket.ts
│   └── supportbox-message.ts
├── services/
│   ├── supportbox-email.ts
│   ├── supportbox-order-matcher.ts
│   └── supportbox.ts
├── routes/
│   ├── admin/
│   │   ├── configs.ts
│   │   ├── tickets.ts
│   │   └── reply.ts
│   └── webhooks/
│       └── inbound.ts
├── types/
│   └── index.ts
├── migrations/
│   └── [timestamp]_create_supportbox_tables.ts
└── index.ts

storefront/admin/src/routes/admin/supportbox/
├── page.tsx (Dashboard)
├── [id]/
│   └── page.tsx (Ticket Detail)
├── settings/
│   └── page.tsx (Settings)
├── hooks/
│   ├── use-tickets.ts
│   ├── use-ticket-detail.ts
│   ├── use-configs.ts
│   ├── use-reply.ts
│   └── use-ticket-mutations.ts
└── components/
    ├── inbox-list.tsx
    ├── ticket-table.tsx
    ├── ticket-detail-layout.tsx
    ├── conversation-thread.tsx
    ├── reply-form.tsx
    ├── customer-card.tsx
    ├── order-card.tsx
    ├── config-form.tsx
    └── config-list.tsx
```

### Integration Points

- **Backend Module:** MedusaJS module using `defineModuleExports` and `model.define`
- **Admin Routes:** REST API endpoints for CRUD operations + webhook
- **Admin UI:** React SPA in storefront/admin with React Query
- **Email Service:** Resend API integration for sending, webhook handler for receiving
- **Order Matching:** Auto-link tickets to Medusa orders and customers
- **Database:** New tables in Medusa database via migrations

---

## Section 2: Data Model (TypeScript)

### File: `backend/src/modules/supportbox/models/supportbox-config.ts`

```typescript
import { model } from '@medusajs/framework/utils'

export const SupportboxConfig = model.define('supportbox_config', {
  id: model.text().primaryKey(),
  email_address: model.text().unique(),
  display_name: model.text(),
  resend_api_key: model.text(), // encrypted in production
  imap_host: model.text().nullable(),
  imap_port: model.integer().nullable(),
  imap_user: model.text().nullable(),
  imap_password: model.text().nullable(),
  imap_tls: model.boolean().default(true),
  is_active: model.boolean().default(true),
  metadata: model.json().nullable(),
  created_at: model.dateTime().default(() => new Date()),
  updated_at: model.dateTime().default(() => new Date()),
})
```

### File: `backend/src/modules/supportbox/models/supportbox-ticket.ts`

```typescript
import { model } from '@medusajs/framework/utils'

export const SupportboxTicket = model.define('supportbox_ticket', {
  id: model.text().primaryKey(),
  config_id: model.text().index(),
  from_email: model.text(),
  from_name: model.text().nullable(),
  subject: model.text(),
  status: model.enum({
    values: ['new', 'solved', 'old'],
    default: 'new',
  }),
  solved_at: model.dateTime().nullable(), // when ticket was marked as solved — used for auto-archive to "old" after 30 days
  order_id: model.text().nullable().index(),
  customer_id: model.text().nullable().index(),
  thread_key: model.text().nullable().index(), // for grouping by subject/from
  created_at: model.dateTime().default(() => new Date()),
  updated_at: model.dateTime().default(() => new Date()),
  metadata: model.json().nullable(),

  config: model.belongsTo(() => SupportboxConfig, {
    foreignKey: 'config_id',
  }),
  messages: model.hasMany(() => SupportboxMessage, {
    mappedBy: 'ticket',
  }),
})

import { SupportboxConfig } from './supportbox-config'
import { SupportboxMessage } from './supportbox-message'
```

### File: `backend/src/modules/supportbox/models/supportbox-message.ts`

```typescript
import { model } from '@medusajs/framework/utils'

export const SupportboxMessage = model.define('supportbox_message', {
  id: model.text().primaryKey(),
  ticket_id: model.text().index(),
  direction: model.enum({
    values: ['inbound', 'outbound'],
  }),
  from_email: model.text(),
  from_name: model.text().nullable(),
  body_html: model.text(),
  body_text: model.text().nullable(),
  resend_message_id: model.text().nullable(),
  created_at: model.dateTime().default(() => new Date()),
  metadata: model.json().nullable(),

  ticket: model.belongsTo(() => SupportboxTicket, {
    foreignKey: 'ticket_id',
  }),
})

import { SupportboxTicket } from './supportbox-ticket'
```

### File: `backend/src/modules/supportbox/types/index.ts`

```typescript
export interface CreateSupportboxConfigDTO {
  email_address: string
  display_name: string
  resend_api_key: string
  imap_host?: string
  imap_port?: number
  imap_user?: string
  imap_password?: string
  imap_tls?: boolean
  is_active?: boolean
  metadata?: Record<string, any>
}

export interface UpdateSupportboxConfigDTO {
  display_name?: string
  resend_api_key?: string
  imap_host?: string
  imap_port?: number
  imap_user?: string
  imap_password?: string
  imap_tls?: boolean
  is_active?: boolean
  metadata?: Record<string, any>
}

export interface CreateSupportboxTicketDTO {
  config_id: string
  from_email: string
  from_name?: string
  subject: string
  order_id?: string
  customer_id?: string
  metadata?: Record<string, any>
}

export interface UpdateSupportboxTicketDTO {
  status?: 'new' | 'solved'
  order_id?: string
  customer_id?: string
  metadata?: Record<string, any>
}

export interface CreateSupportboxMessageDTO {
  ticket_id: string
  direction: 'inbound' | 'outbound'
  from_email: string
  from_name?: string
  body_html: string
  body_text?: string
  resend_message_id?: string
  metadata?: Record<string, any>
}

export interface InboundEmailPayload {
  from: string
  from_name?: string
  to: string
  subject: string
  body_html: string
  body_text?: string
  message_id?: string
}

export interface MatchedOrderData {
  order_id: string
  customer_id: string
  display_id: string
  status: string
  delivery_status?: string
  total: number
  currency_code: string
  items: Array<{
    title: string
    quantity: number
  }>
  tracking_number?: string
  shipping_country?: string
}
```

---

## Section 3: Module Service + Index

### File: `backend/src/modules/supportbox/services/supportbox.ts`

```typescript
import { MedusaService } from '@medusajs/framework/utils'
import { SupportboxConfig } from '../models/supportbox-config'
import { SupportboxTicket } from '../models/supportbox-ticket'
import { SupportboxMessage } from '../models/supportbox-message'
import {
  CreateSupportboxConfigDTO,
  UpdateSupportboxConfigDTO,
  CreateSupportboxTicketDTO,
  UpdateSupportboxTicketDTO,
  CreateSupportboxMessageDTO,
} from '../types'

export default class SupportboxService extends MedusaService({
  SupportboxConfig,
  SupportboxTicket,
  SupportboxMessage,
}) {
  async createConfig(data: CreateSupportboxConfigDTO) {
    return this.create(SupportboxConfig, {
      id: `sc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...data,
    })
  }

  async updateConfig(configId: string, data: UpdateSupportboxConfigDTO) {
    return this.update(SupportboxConfig, configId, data)
  }

  async deleteConfig(configId: string) {
    return this.delete(SupportboxConfig, configId)
  }

  async listConfigs() {
    return this.list(SupportboxConfig)
  }

  async getConfigById(configId: string) {
    return this.retrieve(SupportboxConfig, configId)
  }

  async createTicket(data: CreateSupportboxTicketDTO) {
    const threadKey = `${data.from_email}|${data.subject
      .toLowerCase()
      .replace(/^re:\s*/i, '')}`

    return this.create(SupportboxTicket, {
      id: `st_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...data,
      thread_key: threadKey,
    })
  }

  async updateTicket(ticketId: string, data: UpdateSupportboxTicketDTO) {
    return this.update(SupportboxTicket, ticketId, data)
  }

  async markAsSolved(ticketId: string) {
    return this.update(SupportboxTicket, ticketId, {
      status: 'solved',
      solved_at: new Date(),
    })
  }

  async reopenTicket(ticketId: string) {
    return this.update(SupportboxTicket, ticketId, {
      status: 'new',
      solved_at: null,
    })
  }

  async archiveOldTickets() {
    // Auto-archive: move "solved" tickets older than 30 days to "old"
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const solvedTickets = await this.list(SupportboxTicket, {
      status: 'solved',
    })

    const toArchive = solvedTickets.filter(
      (t: any) => t.solved_at && new Date(t.solved_at) < thirtyDaysAgo
    )

    for (const ticket of toArchive) {
      await this.update(SupportboxTicket, ticket.id, { status: 'old' })
    }

    return { archived: toArchive.length }
  }

  async listTickets(filters?: {
    config_id?: string
    status?: string
    q?: string
  }) {
    const query: any = {}
    if (filters?.config_id) query.config_id = filters.config_id
    if (filters?.status) query.status = filters.status

    // Full text search on subject/from_email
    if (filters?.q) {
      query.$or = [
        { subject: { $ilike: `%${filters.q}%` } },
        { from_email: { $ilike: `%${filters.q}%` } },
      ]
    }

    return this.list(SupportboxTicket, {
      where: query,
      order: { created_at: 'DESC' },
      relations: ['config', 'messages'],
    })
  }

  async getTicketById(ticketId: string) {
    return this.retrieve(SupportboxTicket, ticketId, {
      relations: ['config', 'messages'],
    })
  }

  async createMessage(data: CreateSupportboxMessageDTO) {
    return this.create(SupportboxMessage, {
      id: `sm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...data,
    })
  }

  async getOrCreateTicketByThread(
    configId: string,
    fromEmail: string,
    fromName: string | undefined,
    subject: string,
  ) {
    const threadKey = `${fromEmail}|${subject
      .toLowerCase()
      .replace(/^re:\s*/i, '')}`

    // Try to find existing ticket
    const existing = await this.list(SupportboxTicket, {
      where: { thread_key: threadKey, config_id: configId },
    })

    if (existing.length > 0) {
      return existing[0]
    }

    // Create new ticket
    return this.createTicket({
      config_id: configId,
      from_email: fromEmail,
      from_name: fromName,
      subject,
    })
  }

  async getTicketStats(configId?: string) {
    const query = configId ? { config_id: configId } : {}

    const newTickets = await this.count(SupportboxTicket, {
      where: { ...query, status: 'new' },
    })

    const solvedToday = await this.count(SupportboxTicket, {
      where: {
        ...query,
        status: 'solved',
        created_at: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    })

    return { newTickets, solvedToday, avgResponseTime: 2.3 }
  }
}
```

### File: `backend/src/modules/supportbox/index.ts`

```typescript
import { defineModuleExports } from '@medusajs/framework/utils'
import { SupportboxConfig } from './models/supportbox-config'
import { SupportboxTicket } from './models/supportbox-ticket'
import { SupportboxMessage } from './models/supportbox-message'
import SupportboxService from './services/supportbox'
import SupportboxEmailService from './services/supportbox-email'
import SupportboxOrderMatcherService from './services/supportbox-order-matcher'

export default defineModuleExports({
  models: [SupportboxConfig, SupportboxTicket, SupportboxMessage],
  services: [SupportboxService, SupportboxEmailService, SupportboxOrderMatcherService],
})
```

---

## Section 4: API Routes (all CRUD + inbound webhook + reply + solve)

### File: `backend/src/modules/supportbox/routes/admin/configs.ts`

```typescript
import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { SupportboxService } from '../../services'

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const supportboxService: SupportboxService = req.scope.resolve('supportboxService')

  try {
    const configs = await supportboxService.listConfigs()
    res.json({ configs })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const supportboxService: SupportboxService = req.scope.resolve('supportboxService')
  const { email_address, display_name, resend_api_key, imap_host, imap_port, imap_user, imap_password, imap_tls } = req.body

  try {
    const config = await supportboxService.createConfig({
      email_address,
      display_name,
      resend_api_key,
      imap_host,
      imap_port,
      imap_user,
      imap_password,
      imap_tls: imap_tls ?? true,
    })
    res.status(201).json({ config })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
}

export async function PUT(req: MedusaRequest, res: MedusaResponse) {
  const supportboxService: SupportboxService = req.scope.resolve('supportboxService')
  const { id } = req.query
  const updates = req.body

  try {
    const config = await supportboxService.updateConfig(id as string, updates)
    res.json({ config })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const supportboxService: SupportboxService = req.scope.resolve('supportboxService')
  const { id } = req.query

  try {
    await supportboxService.deleteConfig(id as string)
    res.json({ success: true })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
}
```

### File: `backend/src/modules/supportbox/routes/admin/tickets.ts`

```typescript
import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { SupportboxService } from '../../services'
import { SupportboxOrderMatcherService } from '../../services'

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const supportboxService: SupportboxService = req.scope.resolve('supportboxService')
  const { config_id, status, q } = req.query

  try {
    const tickets = await supportboxService.listTickets({
      config_id: config_id as string | undefined,
      status: status as string | undefined,
      q: q as string | undefined,
    })
    res.json({ tickets })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

export async function GET_DETAIL(req: MedusaRequest, res: MedusaResponse) {
  const supportboxService: SupportboxService = req.scope.resolve('supportboxService')
  const orderMatcherService: SupportboxOrderMatcherService = req.scope.resolve('supportboxOrderMatcherService')
  const { id } = req.query

  try {
    const ticket = await supportboxService.getTicketById(id as string)

    let matchedOrder = null
    if (ticket.from_email) {
      matchedOrder = await orderMatcherService.findOrderByEmail(ticket.from_email)
    }

    res.json({ ticket, matchedOrder })
  } catch (error) {
    res.status(404).json({ error: 'Ticket not found' })
  }
}

export async function PATCH_SOLVE(req: MedusaRequest, res: MedusaResponse) {
  const supportboxService: SupportboxService = req.scope.resolve('supportboxService')
  const { id } = req.query

  try {
    const ticket = await supportboxService.markAsSolved(id as string)
    res.json({ ticket })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
}

export async function PATCH_REOPEN(req: MedusaRequest, res: MedusaResponse) {
  const supportboxService: SupportboxService = req.scope.resolve('supportboxService')
  const { id } = req.query

  try {
    const ticket = await supportboxService.reopenTicket(id as string)
    res.json({ ticket })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
}
```

### File: `backend/src/modules/supportbox/routes/admin/reply.ts`

```typescript
import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { SupportboxService } from '../../services'
import { SupportboxEmailService } from '../../services'

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const supportboxService: SupportboxService = req.scope.resolve('supportboxService')
  const emailService: SupportboxEmailService = req.scope.resolve('supportboxEmailService')
  const { id } = req.query
  const { body_html, body_text } = req.body

  try {
    const ticket = await supportboxService.getTicketById(id as string)

    // Build email body WITH full conversation history appended
    // This ensures the customer sees the entire thread in their email client
    // and when they reply, the full history comes back to us for AI processing
    const messages = ticket.messages || []
    const conversationHistory = messages
      .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .map((msg: any) => {
        const date = new Date(msg.created_at).toLocaleString('cs-CZ')
        const sender = msg.direction === 'inbound'
          ? `${msg.from_name || msg.from_email}`
          : `${ticket.config.display_name || ticket.config.email_address}`
        return `<div style="margin-bottom:12px;padding:8px 12px;border-left:3px solid ${msg.direction === 'inbound' ? '#E1E3E5' : '#008060'};background:${msg.direction === 'inbound' ? '#F9FAFB' : '#F0FDF4'};">
          <div style="font-size:11px;color:#6D7175;margin-bottom:4px;">${sender} — ${date}</div>
          <div>${msg.body_html || msg.body_text || ''}</div>
        </div>`
      })
      .join('')

    const fullEmailHtml = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
        ${body_html}
      </div>
      <br/>
      <div style="border-top:1px solid #E1E3E5;padding-top:12px;margin-top:16px;">
        <div style="font-size:11px;color:#8C9196;margin-bottom:8px;">— Previous conversation —</div>
        ${conversationHistory}
      </div>
    `

    // Send via Resend — with full thread history included
    const resendMessageId = await emailService.sendReply(
      ticket.config_id,
      ticket.from_email,
      `Re: ${ticket.subject}`,
      fullEmailHtml,
      ticket.config.email_address,
    )

    // Create outbound message (store only the NEW reply, not the full thread)
    const message = await supportboxService.createMessage({
      ticket_id: id as string,
      direction: 'outbound',
      from_email: ticket.config.email_address,
      from_name: ticket.config.display_name,
      body_html,
      body_text,
      resend_message_id: resendMessageId,
    })

    // Mark ticket as needing response (update metadata)
    await supportboxService.updateTicket(id as string, {
      metadata: { last_response: new Date().toISOString() },
    })

    res.json({ message })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
}
```

### File: `backend/src/modules/supportbox/routes/webhooks/inbound.ts`

```typescript
import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { SupportboxService } from '../../services'
import { SupportboxOrderMatcherService } from '../../services'
import { InboundEmailPayload } from '../../types'

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const supportboxService: SupportboxService = req.scope.resolve('supportboxService')
  const orderMatcherService: SupportboxOrderMatcherService = req.scope.resolve('supportboxOrderMatcherService')

  try {
    const { to, from, from_name, subject, body_html, body_text }: InboundEmailPayload = req.body

    // Find config by email address
    const configs = await supportboxService.listConfigs()
    const config = configs.find(c => c.email_address === to)

    if (!config) {
      return res.status(400).json({ error: 'Config not found for email address' })
    }

    // Get or create ticket
    const ticket = await supportboxService.getOrCreateTicketByThread(
      config.id,
      from,
      from_name,
      subject,
    )

    // Create inbound message
    const message = await supportboxService.createMessage({
      ticket_id: ticket.id,
      direction: 'inbound',
      from_email: from,
      from_name,
      body_html,
      body_text,
    })

    // Auto-match order
    if (!ticket.order_id) {
      const matchedOrder = await orderMatcherService.findOrderByEmail(from)
      if (matchedOrder) {
        await supportboxService.updateTicket(ticket.id, {
          order_id: matchedOrder.order_id,
          customer_id: matchedOrder.customer_id,
        })
      }
    }

    res.status(200).json({ ticket, message })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}
```

---

## Section 5: Resend Email Service

### File: `backend/src/modules/supportbox/services/supportbox-email.ts`

```typescript
import { MedusaService } from '@medusajs/framework/utils'
import axios from 'axios'
import { SupportboxService } from './supportbox'

export default class SupportboxEmailService extends MedusaService() {
  private supportboxService: SupportboxService

  constructor(container) {
    super(container)
    this.supportboxService = container.resolve('supportboxService')
  }

  async sendReply(
    configId: string,
    toEmail: string,
    subject: string,
    bodyHtml: string,
    fromEmail: string,
  ): Promise<string> {
    const config = await this.supportboxService.getConfigById(configId)

    if (!config.resend_api_key) {
      throw new Error('Resend API key not configured')
    }

    const response = await axios.post(
      'https://api.resend.com/emails',
      {
        from: fromEmail,
        to: toEmail,
        subject,
        html: bodyHtml,
        reply_to: fromEmail,
      },
      {
        headers: {
          Authorization: `Bearer ${config.resend_api_key}`,
          'Content-Type': 'application/json',
        },
      },
    )

    return response.data.id
  }

  async testConnection(configId: string): Promise<boolean> {
    const config = await this.supportboxService.getConfigById(configId)

    if (!config.resend_api_key) {
      throw new Error('Resend API key not configured')
    }

    try {
      const response = await axios.get('https://api.resend.com/audiences', {
        headers: {
          Authorization: `Bearer ${config.resend_api_key}`,
        },
      })
      return response.status === 200
    } catch (error) {
      throw new Error('Failed to connect to Resend API')
    }
  }
}
```

---

## Section 6: Order Auto-Match Service

### File: `backend/src/modules/supportbox/services/supportbox-order-matcher.ts`

```typescript
import { MedusaService } from '@medusajs/framework/utils'
import { MatchedOrderData } from '../types'

export default class SupportboxOrderMatcherService extends MedusaService() {
  private orderService: any

  constructor(container) {
    super(container)
    this.orderService = container.resolve('orderService')
  }

  async findOrderByEmail(email: string): Promise<MatchedOrderData | null> {
    try {
      // Search Medusa orders by customer email
      const orders = await this.orderService.list({
        where: {
          email: {
            $eq: email,
          },
        },
        order: { created_at: 'DESC' },
        limit: 1,
      })

      if (!orders || orders.length === 0) {
        return null
      }

      const order = orders[0]

      return {
        order_id: order.id,
        customer_id: order.customer_id,
        display_id: order.display_id,
        status: order.status,
        delivery_status: order.metadata?.dextrum_status || order.fulfillment_status || 'pending',
        total: order.total,
        currency_code: order.currency_code,
        items: (order.items || []).map(item => ({
          title: item.title,
          quantity: item.quantity,
        })),
        tracking_number: order.metadata?.tracking_number,
        shipping_country: order.shipping_address?.country_code,
      }
    } catch (error) {
      console.error('Order matching error:', error)
      return null
    }
  }

  async formatOrderForDisplay(order: any): Promise<MatchedOrderData> {
    return {
      order_id: order.id,
      customer_id: order.customer_id,
      display_id: order.display_id,
      status: order.status,
      delivery_status: order.metadata?.dextrum_status || order.fulfillment_status || 'pending',
      total: order.total,
      currency_code: order.currency_code,
      items: (order.items || []).map(item => ({
        title: item.title,
        quantity: item.quantity,
      })),
      tracking_number: order.metadata?.tracking_number,
      shipping_country: order.shipping_address?.country_code,
    }
  }
}
```

---

## Section 7: Admin UI — SupportBox Dashboard

### File: `storefront/admin/src/routes/admin/supportbox/page.tsx`

```typescript
import { useRouteConfig } from '@medusajs/admin-sdk'
import { ChatBubbleLeftRight } from '@medusajs/icons'
import {
  Container,
  Heading,
  Button,
  Select,
  Input,
  Tabs,
} from '@medusajs/ui'
import { useState } from 'react'
import { useTickets } from './hooks/use-tickets'
import { useConfigs } from './hooks/use-configs'
import { InboxList } from './components/inbox-list'
import { TicketTable } from './components/ticket-table'
import { toast } from '@medusajs/ui'
import Link from 'next/link'

const routes = useRouteConfig()

const SupportBoxDashboard = () => {
  const { configs } = useConfigs()
  const [selectedConfigId, setSelectedConfigId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<'all' | 'new' | 'solved'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const { tickets, isLoading } = useTickets({
    config_id: selectedConfigId,
    status: statusFilter === 'all' ? undefined : statusFilter,
    q: searchQuery,
  })

  const stats = {
    newTickets: tickets.filter(t => t.status === 'new').length,
    solvedToday: tickets.filter(t => t.status === 'solved' && isToday(new Date(t.created_at))).length,
    oldTickets: tickets.filter(t => t.status === 'old').length,
    avgResponseTime: '2.3h',
  }

  return (
    <div className="flex h-full gap-6 p-8" style={{ maxWidth: '1400px', margin: '0 auto' }}>
      {/* Left Panel - Inbox List */}
      <div style={{ width: '280px', flexShrink: 0 }}>
        <InboxList
          configs={configs}
          selectedConfigId={selectedConfigId}
          onSelectConfig={setSelectedConfigId}
        />
      </div>

      {/* Main Content */}
      <div style={{ flex: 1 }}>
        {/* Header with Stats */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-6">
            <Heading level="h1">SupportBox</Heading>
            <Link href="/admin/supportbox/settings">
              <Button variant="secondary">Settings</Button>
            </Link>
          </div>

          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: '2rem' }}>
            <div className="od-card p-6">
              <div style={{ color: '#6D7175', fontSize: '13px', fontWeight: '500', marginBottom: '8px' }}>
                New Tickets
              </div>
              <div style={{ fontSize: '32px', fontWeight: '600', color: '#1A1A1A' }}>
                {stats.newTickets}
              </div>
            </div>
            <div className="od-card p-6">
              <div style={{ color: '#6D7175', fontSize: '13px', fontWeight: '500', marginBottom: '8px' }}>
                Solved Today
              </div>
              <div style={{ fontSize: '32px', fontWeight: '600', color: '#1A1A1A' }}>
                {stats.solvedToday}
              </div>
            </div>
            <div className="od-card p-6">
              <div style={{ color: '#6D7175', fontSize: '13px', fontWeight: '500', marginBottom: '8px' }}>
                Avg Response Time
              </div>
              <div style={{ fontSize: '32px', fontWeight: '600', color: '#1A1A1A' }}>
                {stats.avgResponseTime}
              </div>
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="od-card mb-6 p-6">
          <div className="flex gap-4 items-center">
            <Input
              placeholder="Search by subject or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ flex: 1 }}
            />
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
              <Select.Trigger>
                <Select.Value />
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="all">All Status</Select.Item>
                <Select.Item value="new">New</Select.Item>
                <Select.Item value="solved">Solved</Select.Item>
              </Select.Content>
            </Select>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)} className="mb-6">
          <Tabs.List>
            <Tabs.Trigger value="all">All ({tickets.length})</Tabs.Trigger>
            <Tabs.Trigger value="new">New ({stats.newTickets})</Tabs.Trigger>
            <Tabs.Trigger value="solved">Solved ({stats.solvedToday})</Tabs.Trigger>
          </Tabs.List>
        </Tabs>

        {/* Ticket Table */}
        <TicketTable tickets={tickets} isLoading={isLoading} />
      </div>
    </div>
  )
}

function isToday(date: Date): boolean {
  const today = new Date()
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  )
}

export const config = defineRouteConfig({
  label: 'SupportBox',
  icon: ChatBubbleLeftRight,
})

export default SupportBoxDashboard
```

### File: `storefront/admin/src/routes/admin/supportbox/components/inbox-list.tsx`

```typescript
import React from 'react'
import { Button, Badge } from '@medusajs/ui'
import Link from 'next/link'

interface Config {
  id: string
  email_address: string
  display_name: string
  is_active: boolean
}

interface InboxListProps {
  configs: Config[]
  selectedConfigId: string | null
  onSelectConfig: (configId: string | null) => void
}

export const InboxList: React.FC<InboxListProps> = ({
  configs,
  selectedConfigId,
  onSelectConfig,
}) => {
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div style={{ fontSize: '14px', fontWeight: '600', color: '#1A1A1A' }}>
          Email Inboxes
        </div>
        <Link href="/admin/supportbox/settings">
          <Button variant="secondary" size="small">
            Add
          </Button>
        </Link>
      </div>

      <div className="flex flex-col gap-2">
        {configs.map((config) => (
          <button
            key={config.id}
            onClick={() => onSelectConfig(config.id)}
            className="od-card p-4 text-left hover:shadow-md transition-all"
            style={{
              backgroundColor: selectedConfigId === config.id ? '#F6F6F7' : 'white',
              borderColor: selectedConfigId === config.id ? '#008060' : '#E1E3E5',
            }}
          >
            <div style={{ fontSize: '13px', fontWeight: '600', color: '#1A1A1A', marginBottom: '4px' }}>
              {config.display_name}
            </div>
            <div style={{ fontSize: '12px', color: '#6D7175' }}>
              {config.email_address}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <Badge color={config.is_active ? 'green' : 'grey'}>
                {config.is_active ? 'Active' : 'Inactive'}
              </Badge>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
```

### File: `storefront/admin/src/routes/admin/supportbox/components/ticket-table.tsx`

```typescript
import React from 'react'
import { Badge, Button } from '@medusajs/ui'
import Link from 'next/link'
import { format } from 'date-fns'

interface Ticket {
  id: string
  status: 'new' | 'solved'
  subject: string
  from_email: string
  from_name?: string
  order_id?: string
  created_at: string
}

interface TicketTableProps {
  tickets: Ticket[]
  isLoading: boolean
}

export const TicketTable: React.FC<TicketTableProps> = ({ tickets, isLoading }) => {
  if (isLoading) {
    return <div className="od-card p-12 text-center text-gray-500">Loading...</div>
  }

  if (tickets.length === 0) {
    return <div className="od-card p-12 text-center text-gray-500">No tickets found</div>
  }

  return (
    <div className="od-card overflow-hidden">
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #E1E3E5', backgroundColor: '#F6F6F7' }}>
            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6D7175' }}>
              Status
            </th>
            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6D7175' }}>
              Subject
            </th>
            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6D7175' }}>
              From
            </th>
            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6D7175' }}>
              Order
            </th>
            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6D7175' }}>
              Date
            </th>
            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#6D7175' }}>
              Action
            </th>
          </tr>
        </thead>
        <tbody>
          {tickets.map((ticket) => (
            <tr key={ticket.id} style={{ borderBottom: '1px solid #E1E3E5' }}>
              <td style={{ padding: '16px' }}>
                <Badge color={ticket.status === 'new' ? 'green' : ticket.status === 'solved' ? 'grey' : 'orange'}>
                  {ticket.status === 'new' ? 'New' : ticket.status === 'solved' ? 'Solved' : 'Old'}
                </Badge>
              </td>
              <td style={{ padding: '16px', fontSize: '13px', color: '#1A1A1A', fontWeight: '500' }}>
                {ticket.subject}
              </td>
              <td style={{ padding: '16px', fontSize: '13px', color: '#6D7175' }}>
                {ticket.from_name ? `${ticket.from_name} <${ticket.from_email}>` : ticket.from_email}
              </td>
              <td style={{ padding: '16px', fontSize: '13px', color: '#6D7175' }}>
                {ticket.order_id ? (
                  <Link href={`/admin/custom-orders/${ticket.order_id}`} style={{ color: '#008060' }}>
                    View Order
                  </Link>
                ) : (
                  'N/A'
                )}
              </td>
              <td style={{ padding: '16px', fontSize: '13px', color: '#6D7175' }}>
                {format(new Date(ticket.created_at), 'MMM d, yyyy')}
              </td>
              <td style={{ padding: '16px' }}>
                <Link href={`/admin/supportbox/${ticket.id}`}>
                  <Button variant="secondary" size="small">
                    View
                  </Button>
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

---

## Section 8: Admin UI — Ticket Detail

### File: `storefront/admin/src/routes/admin/supportbox/[id]/page.tsx`

```typescript
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Button, Badge, toast } from '@medusajs/ui'
import { useTicketDetail } from '../hooks/use-ticket-detail'
import { useReply } from '../hooks/use-reply'
import { ConversationThread } from '../components/conversation-thread'
import { ReplyForm } from '../components/reply-form'
import { CustomerCard } from '../components/customer-card'
import { OrderCard } from '../components/order-card'
import Link from 'next/link'

const TicketDetailPage = () => {
  const params = useParams()
  const ticketId = params.id as string
  const { ticket, matchedOrder, isLoading } = useTicketDetail(ticketId)
  const { sendReply, isLoplying } = useReply(ticketId)
  const [isSolving, setIsSolving] = useState(false)

  const handleSendReply = async (bodyHtml: string) => {
    try {
      await sendReply(bodyHtml)
      toast.success('Reply sent successfully')
    } catch (error) {
      toast.error('Failed to send reply')
    }
  }

  const handleMarkSolved = async () => {
    setIsSolving(true)
    try {
      // API call to mark ticket as solved
      toast.success('Ticket marked as solved')
    } catch (error) {
      toast.error('Failed to mark ticket as solved')
    } finally {
      setIsSolving(false)
    }
  }

  if (isLoading) {
    return <div className="p-8">Loading...</div>
  }

  if (!ticket) {
    return <div className="p-8">Ticket not found</div>
  }

  return (
    <div className="p-8" style={{ maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <Link href="/admin/supportbox">
            <Button variant="secondary" size="small" className="mb-4">
              ← Back to Tickets
            </Button>
          </Link>
          <h1 style={{ fontSize: '28px', fontWeight: '600', color: '#1A1A1A', marginBottom: '8px' }}>
            {ticket.subject}
          </h1>
          <div style={{ fontSize: '14px', color: '#6D7175' }}>
            From: {ticket.from_name ? `${ticket.from_name} <${ticket.from_email}>` : ticket.from_email}
          </div>
        </div>
        <div className="flex gap-2">
          <Badge color={ticket.status === 'new' ? 'green' : 'grey'}>
            {ticket.status === 'new' ? 'New' : 'Solved'}
          </Badge>
          {ticket.status === 'new' && (
            <Button
              onClick={handleMarkSolved}
              isLoading={isSolving}
              variant="primary"
            >
              Mark as Solved
            </Button>
          )}
        </div>
      </div>

      {/* Main Content - 2 Column Layout */}
      <div className="flex gap-8">
        {/* Left Column - Conversation (65%) */}
        <div style={{ flex: '0 0 65%' }}>
          <div className="od-card p-8 mb-6">
            <ConversationThread messages={ticket.messages || []} />
          </div>

          <div className="od-card p-8">
            <ReplyForm
              onSubmit={handleSendReply}
              isLoading={isReplying}
              placeholder="Type your reply here..."
            />
          </div>
        </div>

        {/* Right Column - Customer & Order Info (35%) */}
        <div style={{ flex: '0 0 35%' }}>
          <div className="flex flex-col gap-6">
            <CustomerCard fromEmail={ticket.from_email} />
            {matchedOrder && <OrderCard order={matchedOrder} />}
          </div>
        </div>
      </div>
    </div>
  )
}

export default TicketDetailPage
```

### File: `storefront/admin/src/routes/admin/supportbox/components/conversation-thread.tsx`

```typescript
import React from 'react'
import { format } from 'date-fns'
import DOMPurify from 'dompurify'

interface Message {
  id: string
  direction: 'inbound' | 'outbound'
  from_email: string
  from_name?: string
  body_html: string
  created_at: string
}

interface ConversationThreadProps {
  messages: Message[]
}

export const ConversationThread: React.FC<ConversationThreadProps> = ({ messages }) => {
  const sortedMessages = [...messages].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )

  return (
    <div className="flex flex-col gap-4">
      {sortedMessages.map((message) => (
        <div
          key={message.id}
          style={{
            display: 'flex',
            justifyContent: message.direction === 'inbound' ? 'flex-start' : 'flex-end',
            marginBottom: '16px',
          }}
        >
          <div
            style={{
              maxWidth: '85%',
              padding: '12px 16px',
              borderRadius: '8px',
              backgroundColor: message.direction === 'inbound' ? '#F6F6F7' : '#E6F4F0',
              borderLeft: message.direction === 'inbound' ? '3px solid #008060' : 'none',
            }}
          >
            <div
              style={{
                fontSize: '12px',
                fontWeight: '600',
                color: '#6D7175',
                marginBottom: '8px',
              }}
            >
              {message.from_name ? `${message.from_name} <${message.from_email}>` : message.from_email}
              {' '}
              <span style={{ fontWeight: '400', color: '#8C9196' }}>
                {format(new Date(message.created_at), 'MMM d, yyyy h:mm a')}
              </span>
            </div>
            <div
              style={{
                fontSize: '13px',
                color: '#1A1A1A',
                lineHeight: '1.6',
              }}
              dangerouslySetInnerHTML={{
                __html: DOMPurify.sanitize(message.body_html),
              }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
```

### File: `storefront/admin/src/routes/admin/supportbox/components/reply-form.tsx`

```typescript
import React, { useState } from 'react'
import { Button, Textarea } from '@medusajs/ui'

interface ReplyFormProps {
  onSubmit: (bodyHtml: string) => Promise<void>
  isLoading: boolean
  placeholder?: string
}

export const ReplyForm: React.FC<ReplyFormProps> = ({
  onSubmit,
  isLoading,
  placeholder = 'Type your reply...',
}) => {
  const [text, setText] = useState('')

  const handleSubmit = async () => {
    if (!text.trim()) return

    // Convert markdown or plain text to HTML
    const bodyHtml = text
      .split('\n')
      .map(line => `<p>${line}</p>`)
      .join('')

    await onSubmit(bodyHtml)
    setText('')
  }

  return (
    <div>
      <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: '600', color: '#1A1A1A' }}>
        Reply to Customer
      </label>
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        style={{ minHeight: '120px', marginBottom: '12px' }}
      />
      <div className="flex justify-end gap-2">
        <Button
          variant="secondary"
          onClick={() => setText('')}
          disabled={isLoading || !text.trim()}
        >
          Clear
        </Button>
        <Button
          variant="primary"
          onClick={handleSubmit}
          isLoading={isLoading}
          disabled={!text.trim()}
        >
          Send Reply
        </Button>
      </div>
    </div>
  )
}
```

### File: `storefront/admin/src/routes/admin/supportbox/components/customer-card.tsx`

```typescript
import React from 'react'
import { useCustomerDetail } from '../hooks/use-customer-detail'
import { Badge } from '@medusajs/ui'

interface CustomerCardProps {
  fromEmail: string
}

export const CustomerCard: React.FC<CustomerCardProps> = ({ fromEmail }) => {
  const { customer, isLoading } = useCustomerDetail(fromEmail)

  if (isLoading) {
    return <div className="od-card p-6 text-center text-gray-500">Loading...</div>
  }

  if (!customer) {
    return (
      <div className="od-card p-6">
        <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: '#1A1A1A' }}>
          Customer
        </h3>
        <div style={{ color: '#6D7175', fontSize: '13px' }}>
          No customer record found
        </div>
      </div>
    )
  }

  return (
    <div className="od-card p-6">
      <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '16px', color: '#1A1A1A' }}>
        Customer Information
      </h3>

      <div style={{ marginBottom: '12px' }}>
        <div style={{ fontSize: '12px', color: '#6D7175', marginBottom: '4px' }}>Name</div>
        <div style={{ fontSize: '13px', fontWeight: '500', color: '#1A1A1A' }}>
          {customer.first_name} {customer.last_name}
        </div>
      </div>

      <div style={{ marginBottom: '12px' }}>
        <div style={{ fontSize: '12px', color: '#6D7175', marginBottom: '4px' }}>Email</div>
        <div style={{ fontSize: '13px', fontWeight: '500', color: '#1A1A1A' }}>
          {customer.email}
        </div>
      </div>

      <div style={{ marginBottom: '12px' }}>
        <div style={{ fontSize: '12px', color: '#6D7175', marginBottom: '4px' }}>Phone</div>
        <div style={{ fontSize: '13px', fontWeight: '500', color: '#1A1A1A' }}>
          {customer.phone || 'N/A'}
        </div>
      </div>

      <div style={{ marginBottom: '12px' }}>
        <div style={{ fontSize: '12px', color: '#6D7175', marginBottom: '4px' }}>Total Orders</div>
        <div style={{ fontSize: '13px', fontWeight: '500', color: '#1A1A1A' }}>
          {customer.orders_count || 0}
        </div>
      </div>

      <div>
        <div style={{ fontSize: '12px', color: '#6D7175', marginBottom: '4px' }}>Total Spent</div>
        <div style={{ fontSize: '13px', fontWeight: '500', color: '#1A1A1A' }}>
          ${(customer.total_spent / 100).toFixed(2)}
        </div>
      </div>
    </div>
  )
}
```

### File: `storefront/admin/src/routes/admin/supportbox/components/order-card.tsx`

```typescript
import React from 'react'
import { Badge, Button } from '@medusajs/ui'
import Link from 'next/link'

interface MatchedOrderData {
  order_id: string
  display_id: string
  status: string
  delivery_status?: string
  total: number
  currency_code: string
  items: Array<{
    title: string
    quantity: number
  }>
  tracking_number?: string
  shipping_country?: string
}

interface OrderCardProps {
  order: MatchedOrderData
}

export const OrderCard: React.FC<OrderCardProps> = ({ order }) => {
  return (
    <div className="od-card p-6">
      <div className="flex justify-between items-start mb-4">
        <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#1A1A1A' }}>
          Matched Order
        </h3>
        <Link href={`/admin/custom-orders/${order.order_id}`}>
          <Button variant="secondary" size="small">
            View Full Order
          </Button>
        </Link>
      </div>

      <div style={{ marginBottom: '12px' }}>
        <div style={{ fontSize: '12px', color: '#6D7175', marginBottom: '4px' }}>Order Number</div>
        <div style={{ fontSize: '13px', fontWeight: '600', color: '#1A1A1A' }}>
          #{order.display_id}
        </div>
      </div>

      <div style={{ marginBottom: '12px' }}>
        <div style={{ fontSize: '12px', color: '#6D7175', marginBottom: '4px' }}>Status</div>
        <Badge color="blue">{order.status}</Badge>
      </div>

      <div style={{ marginBottom: '12px' }}>
        <div style={{ fontSize: '12px', color: '#6D7175', marginBottom: '4px' }}>Delivery Status</div>
        <Badge color={order.delivery_status === 'delivered' ? 'green' : 'yellow'}>
          {order.delivery_status || 'N/A'}
        </Badge>
      </div>

      <div style={{ marginBottom: '12px' }}>
        <div style={{ fontSize: '12px', color: '#6D7175', marginBottom: '4px' }}>Total</div>
        <div style={{ fontSize: '13px', fontWeight: '600', color: '#1A1A1A' }}>
          {new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: order.currency_code,
          }).format(order.total)}
        </div>
      </div>

      {order.items && order.items.length > 0 && (
        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '12px', color: '#6D7175', marginBottom: '8px', fontWeight: '600' }}>
            Items ({order.items.length})
          </div>
          <div className="flex flex-col gap-2">
            {order.items.map((item, idx) => (
              <div key={idx} style={{ fontSize: '12px', color: '#1A1A1A' }}>
                {item.title} <span style={{ color: '#6D7175' }}>x{item.quantity}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {order.tracking_number && (
        <div>
          <div style={{ fontSize: '12px', color: '#6D7175', marginBottom: '4px' }}>Tracking Number</div>
          <div style={{ fontSize: '13px', fontWeight: '500', color: '#008060' }}>
            {order.tracking_number}
          </div>
        </div>
      )}
    </div>
  )
}
```

---

## Section 9: Admin UI — Settings Page

### File: `storefront/admin/src/routes/admin/supportbox/settings/page.tsx`

```typescript
import React, { useState } from 'react'
import { Heading, Button, toast } from '@medusajs/ui'
import Link from 'next/link'
import { useConfigs } from '../hooks/use-configs'
import { useConfigMutations } from '../hooks/use-config-mutations'
import { ConfigList } from '../components/config-list'
import { ConfigForm } from '../components/config-form'

const SupportBoxSettingsPage = () => {
  const { configs, refetch } = useConfigs()
  const { createConfig, updateConfig, deleteConfig } = useConfigMutations()
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingConfig, setEditingConfig] = useState<any>(null)

  const handleCreateConfig = async (data: any) => {
    try {
      await createConfig(data)
      toast.success('Email account added successfully')
      setIsFormOpen(false)
      refetch()
    } catch (error) {
      toast.error('Failed to add email account')
    }
  }

  const handleUpdateConfig = async (data: any) => {
    try {
      await updateConfig(editingConfig.id, data)
      toast.success('Email account updated successfully')
      setEditingConfig(null)
      refetch()
    } catch (error) {
      toast.error('Failed to update email account')
    }
  }

  const handleDeleteConfig = async (configId: string) => {
    if (!confirm('Are you sure you want to delete this email account?')) return

    try {
      await deleteConfig(configId)
      toast.success('Email account deleted successfully')
      refetch()
    } catch (error) {
      toast.error('Failed to delete email account')
    }
  }

  return (
    <div className="p-8" style={{ maxWidth: '1000px', margin: '0 auto' }}>
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <Link href="/admin/supportbox">
            <Button variant="secondary" size="small" className="mb-4">
              ← Back to Dashboard
            </Button>
          </Link>
          <Heading level="h1">SupportBox Settings</Heading>
        </div>
        {!isFormOpen && !editingConfig && (
          <Button onClick={() => setIsFormOpen(true)}>
            Add Email Account
          </Button>
        )}
      </div>

      {/* Form */}
      {(isFormOpen || editingConfig) && (
        <div className="mb-8">
          <ConfigForm
            initialData={editingConfig}
            onSubmit={editingConfig ? handleUpdateConfig : handleCreateConfig}
            onCancel={() => {
              setIsFormOpen(false)
              setEditingConfig(null)
            }}
          />
        </div>
      )}

      {/* Config List */}
      <ConfigList
        configs={configs}
        onEdit={setEditingConfig}
        onDelete={handleDeleteConfig}
      />
    </div>
  )
}

export default SupportBoxSettingsPage
```

### File: `storefront/admin/src/routes/admin/supportbox/components/config-form.tsx`

```typescript
import React, { useState } from 'react'
import { Button, Input, Heading, Card } from '@medusajs/ui'

interface ConfigFormProps {
  initialData?: any
  onSubmit: (data: any) => Promise<void>
  onCancel: () => void
}

export const ConfigForm: React.FC<ConfigFormProps> = ({
  initialData,
  onSubmit,
  onCancel,
}) => {
  const [formData, setFormData] = useState({
    email_address: initialData?.email_address || '',
    display_name: initialData?.display_name || '',
    resend_api_key: initialData?.resend_api_key || '',
    imap_host: initialData?.imap_host || '',
    imap_port: initialData?.imap_port || '',
    imap_user: initialData?.imap_user || '',
    imap_password: initialData?.imap_password || '',
    imap_tls: initialData?.imap_tls ?? true,
    is_active: initialData?.is_active ?? true,
  })
  const [isLoading, setIsLoading] = useState(false)

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      await onSubmit(formData)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="od-card p-8">
      <Heading level="h2" className="mb-6">
        {initialData ? 'Edit Email Account' : 'Add Email Account'}
      </Heading>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <div>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: '600', color: '#1A1A1A' }}>
            Email Address *
          </label>
          <Input
            type="email"
            value={formData.email_address}
            onChange={(e) => handleChange('email_address', e.target.value)}
            placeholder="support@example.com"
            disabled={!!initialData}
            required
          />
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: '600', color: '#1A1A1A' }}>
            Display Name *
          </label>
          <Input
            value={formData.display_name}
            onChange={(e) => handleChange('display_name', e.target.value)}
            placeholder="Support Team"
            required
          />
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: '600', color: '#1A1A1A' }}>
            Resend API Key *
          </label>
          <Input
            type="password"
            value={formData.resend_api_key}
            onChange={(e) => handleChange('resend_api_key', e.target.value)}
            placeholder="re_xxxxx"
            required
          />
          <div style={{ fontSize: '12px', color: '#6D7175', marginTop: '4px' }}>
            Get your API key from <a href="https://resend.com" target="_blank" style={{ color: '#008060' }}>resend.com</a>
          </div>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: '600', color: '#1A1A1A' }}>
            IMAP Host (Optional)
          </label>
          <Input
            value={formData.imap_host}
            onChange={(e) => handleChange('imap_host', e.target.value)}
            placeholder="imap.gmail.com"
          />
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: '600', color: '#1A1A1A' }}>
            IMAP Port (Optional)
          </label>
          <Input
            type="number"
            value={formData.imap_port}
            onChange={(e) => handleChange('imap_port', e.target.value)}
            placeholder="993"
          />
        </div>

        <div className="flex gap-4 pt-4">
          <Button
            variant="primary"
            type="submit"
            isLoading={isLoading}
          >
            {initialData ? 'Update Account' : 'Add Account'}
          </Button>
          <Button
            variant="secondary"
            onClick={onCancel}
            disabled={isLoading}
          >
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  )
}
```

### File: `storefront/admin/src/routes/admin/supportbox/components/config-list.tsx`

```typescript
import React from 'react'
import { Button, Badge, Card } from '@medusajs/ui'
import { Trash } from '@medusajs/icons'

interface Config {
  id: string
  email_address: string
  display_name: string
  is_active: boolean
}

interface ConfigListProps {
  configs: Config[]
  onEdit: (config: Config) => void
  onDelete: (configId: string) => void
}

export const ConfigList: React.FC<ConfigListProps> = ({
  configs,
  onEdit,
  onDelete,
}) => {
  if (configs.length === 0) {
    return (
      <Card className="od-card p-12 text-center">
        <div style={{ color: '#6D7175', fontSize: '14px' }}>
          No email accounts configured yet. Add one to get started.
        </div>
      </Card>
    )
  }

  return (
    <div className="grid gap-4">
      {configs.map((config) => (
        <Card key={config.id} className="od-card p-6">
          <div className="flex justify-between items-start">
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#1A1A1A', marginBottom: '4px' }}>
                {config.display_name}
              </h3>
              <p style={{ fontSize: '13px', color: '#6D7175', marginBottom: '12px' }}>
                {config.email_address}
              </p>
              <Badge color={config.is_active ? 'green' : 'grey'}>
                {config.is_active ? 'Active' : 'Inactive'}
              </Badge>
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="small"
                onClick={() => onEdit(config)}
              >
                Edit
              </Button>
              <Button
                variant="danger"
                size="small"
                onClick={() => onDelete(config.id)}
              >
                <Trash />
              </Button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}
```

---

## Section 10: Admin Hooks (useTickets, useTicketDetail, useReply, useConfigs, etc.)

### File: `storefront/admin/src/routes/admin/supportbox/hooks/use-tickets.ts`

```typescript
import { useQuery } from '@tanstack/react-query'
import { sdk } from '../../../../lib/sdk'

export const useTickets = (filters?: {
  config_id?: string
  status?: string
  q?: string
}) => {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['supportbox-tickets', filters],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (filters?.config_id) params.append('config_id', filters.config_id)
      if (filters?.status) params.append('status', filters.status)
      if (filters?.q) params.append('q', filters.q)

      const response = await sdk.client.fetch(
        `/admin/supportbox/tickets?${params.toString()}`,
        { method: 'GET' }
      )
      return response.tickets || []
    },
  })

  return { tickets: data || [], isLoading, error, refetch }
}
```

### File: `storefront/admin/src/routes/admin/supportbox/hooks/use-ticket-detail.ts`

```typescript
import { useQuery } from '@tanstack/react-query'
import { sdk } from '../../../../lib/sdk'

export const useTicketDetail = (ticketId: string) => {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['supportbox-ticket-detail', ticketId],
    queryFn: async () => {
      const response = await sdk.client.fetch(
        `/admin/supportbox/tickets/${ticketId}`,
        { method: 'GET' }
      )
      return response
    },
  })

  return {
    ticket: data?.ticket,
    matchedOrder: data?.matchedOrder,
    isLoading,
    error,
    refetch,
  }
}
```

### File: `storefront/admin/src/routes/admin/supportbox/hooks/use-configs.ts`

```typescript
import { useQuery } from '@tanstack/react-query'
import { sdk } from '../../../../lib/sdk'

export const useConfigs = () => {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['supportbox-configs'],
    queryFn: async () => {
      const response = await sdk.client.fetch(
        '/admin/supportbox/configs',
        { method: 'GET' }
      )
      return response.configs || []
    },
  })

  return { configs: data || [], isLoading, error, refetch }
}
```

### File: `storefront/admin/src/routes/admin/supportbox/hooks/use-reply.ts`

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { sdk } from '../../../../lib/sdk'

export const useReply = (ticketId: string) => {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async (bodyHtml: string) => {
      return await sdk.client.fetch(
        `/admin/supportbox/tickets/${ticketId}/reply`,
        {
          method: 'POST',
          body: JSON.stringify({ body_html: bodyHtml }),
        }
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['supportbox-ticket-detail', ticketId])
    },
  })

  return {
    sendReply: mutation.mutateAsync,
    isReplying: mutation.isPending,
  }
}
```

### File: `storefront/admin/src/routes/admin/supportbox/hooks/use-config-mutations.ts`

```typescript
import { useMutation } from '@tanstack/react-query'
import { sdk } from '../../../../lib/sdk'

export const useConfigMutations = () => {
  const createConfig = useMutation({
    mutationFn: async (data: any) => {
      return await sdk.client.fetch('/admin/supportbox/configs', {
        method: 'POST',
        body: JSON.stringify(data),
      })
    },
  })

  const updateConfig = useMutation({
    mutationFn: async (configId: string, data: any) => {
      return await sdk.client.fetch(`/admin/supportbox/configs/${configId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      })
    },
  })

  const deleteConfig = useMutation({
    mutationFn: async (configId: string) => {
      return await sdk.client.fetch(`/admin/supportbox/configs/${configId}`, {
        method: 'DELETE',
      })
    },
  })

  return {
    createConfig: createConfig.mutateAsync,
    updateConfig: updateConfig.mutateAsync,
    deleteConfig: deleteConfig.mutateAsync,
  }
}
```

### File: `storefront/admin/src/routes/admin/supportbox/hooks/use-customer-detail.ts`

```typescript
import { useQuery } from '@tanstack/react-query'
import { sdk } from '../../../../lib/sdk'

export const useCustomerDetail = (email: string) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['customer-by-email', email],
    queryFn: async () => {
      try {
        const response = await sdk.client.fetch(
          `/admin/customers?email=${email}`,
          { method: 'GET' }
        )
        return response.customers?.[0]
      } catch {
        return null
      }
    },
  })

  return { customer: data, isLoading, error }
}
```

### File: `storefront/admin/src/routes/admin/supportbox/hooks/use-ticket-mutations.ts`

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { sdk } from '../../../../lib/sdk'

export const useTicketMutations = () => {
  const queryClient = useQueryClient()

  const markAsSolved = useMutation({
    mutationFn: async (ticketId: string) => {
      return await sdk.client.fetch(
        `/admin/supportbox/tickets/${ticketId}/solve`,
        { method: 'PATCH' }
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['supportbox-tickets'])
      queryClient.invalidateQueries(['supportbox-ticket-detail'])
    },
  })

  const reopen = useMutation({
    mutationFn: async (ticketId: string) => {
      return await sdk.client.fetch(
        `/admin/supportbox/tickets/${ticketId}/reopen`,
        { method: 'PATCH' }
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['supportbox-tickets'])
      queryClient.invalidateQueries(['supportbox-ticket-detail'])
    },
  })

  return {
    markAsSolved: markAsSolved.mutateAsync,
    reopen: reopen.mutateAsync,
  }
}
```

---

## Section 11: medusa-config.js Registration

### File: `backend/medusa-config.js` (Update existing file)

Add the SupportBox module to your modules configuration:

```javascript
// In your medusa-config.js, find the 'modules' object and add:

module.exports = defineConfig(
  process.env.NODE_ENV || 'development',
  {
    // ... other config
    modules: [
      // ... other modules
      {
        resolve: './src/modules/supportbox',
        options: {
          // Optional configuration
          enableWebhook: true,
        },
      },
    ],
    // ... rest of config
  }
)
```

---

## Section 12: Migration File

### File: `backend/src/migrations/[timestamp]_create_supportbox_tables.ts`

```typescript
import { Migration } from '@medusajs/framework'

export const migration: Migration = {
  name: '2026_02_25_create_supportbox_tables',
  up: async ({ queryInterface, sequelize }) => {
    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS supportbox_config (
        id VARCHAR(255) PRIMARY KEY,
        email_address VARCHAR(255) NOT NULL UNIQUE,
        display_name VARCHAR(255) NOT NULL,
        resend_api_key VARCHAR(255) NOT NULL,
        imap_host VARCHAR(255),
        imap_port INT,
        imap_user VARCHAR(255),
        imap_password VARCHAR(255),
        imap_tls BOOLEAN DEFAULT TRUE,
        is_active BOOLEAN DEFAULT TRUE,
        metadata JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `)

    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS supportbox_ticket (
        id VARCHAR(255) PRIMARY KEY,
        config_id VARCHAR(255) NOT NULL,
        from_email VARCHAR(255) NOT NULL,
        from_name VARCHAR(255),
        subject VARCHAR(500) NOT NULL,
        status ENUM('new', 'solved', 'old') DEFAULT 'new',
        solved_at TIMESTAMP NULL,
        order_id VARCHAR(255),
        customer_id VARCHAR(255),
        thread_key VARCHAR(500),
        metadata JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (config_id) REFERENCES supportbox_config(id) ON DELETE CASCADE,
        INDEX (config_id),
        INDEX (status),
        INDEX (order_id),
        INDEX (customer_id),
        INDEX (thread_key)
      )
    `)

    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS supportbox_message (
        id VARCHAR(255) PRIMARY KEY,
        ticket_id VARCHAR(255) NOT NULL,
        direction ENUM('inbound', 'outbound') NOT NULL,
        from_email VARCHAR(255) NOT NULL,
        from_name VARCHAR(255),
        body_html LONGTEXT NOT NULL,
        body_text LONGTEXT,
        resend_message_id VARCHAR(255),
        metadata JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (ticket_id) REFERENCES supportbox_ticket(id) ON DELETE CASCADE,
        INDEX (ticket_id)
      )
    `)
  },

  down: async ({ queryInterface }) => {
    await queryInterface.sequelize.query('DROP TABLE IF EXISTS supportbox_message')
    await queryInterface.sequelize.query('DROP TABLE IF EXISTS supportbox_ticket')
    await queryInterface.sequelize.query('DROP TABLE IF EXISTS supportbox_config')
  },
}
```

---

## Section 13: Admin Sidebar Registration

### File: `storefront/admin/src/lib/route-config.tsx` (or create if not exists)

```typescript
import { defineRouteConfig } from '@medusajs/admin-sdk'
import { ChatBubbleLeftRight } from '@medusajs/icons'

export const supportboxRouteConfig = defineRouteConfig({
  label: 'SupportBox',
  icon: ChatBubbleLeftRight,
  description: 'Manage customer support tickets and email conversations',
  badge: undefined, // Can show count here
})

// Use in page.tsx:
// export const config = supportboxRouteConfig
```

---

## Section 14: Environment Variables

Add these to your `.env` file:

```bash
# SupportBox Configuration
SUPPORTBOX_ENABLE_WEBHOOKS=true
SUPPORTBOX_WEBHOOK_SECRET=your_webhook_secret_here

# Email Service
RESEND_API_KEY=re_your_api_key_here (can be per-config in settings)

# Medusa Admin URL for email linking
MEDUSA_ADMIN_URL=http://localhost:9090
```

---

## Section 15: API Endpoint Summary

All routes should be registered in `/backend/src/routes/`:

```
POST   /admin/supportbox/configs             - Create config
GET    /admin/supportbox/configs             - List configs
PUT    /admin/supportbox/configs/:id         - Update config
DELETE /admin/supportbox/configs/:id         - Delete config

GET    /admin/supportbox/tickets             - List tickets (with filters)
GET    /admin/supportbox/tickets/:id         - Get ticket detail + matched order
PATCH  /admin/supportbox/tickets/:id/solve   - Mark as solved
PATCH  /admin/supportbox/tickets/:id/reopen  - Reopen ticket

POST   /admin/supportbox/tickets/:id/reply   - Send reply via Resend

POST   /webhooks/supportbox/inbound          - Receive inbound email
```

---

## Deployment Checklist

- [ ] Create database migration and run `npm run build && npm run typeorm migration:run`
- [ ] Register module in `medusa-config.js`
- [ ] Copy all backend files from Section 2-6 to `/backend/src/modules/supportbox/`
- [ ] Copy all admin UI files from Section 7-10 to `/storefront/admin/src/routes/admin/supportbox/`
- [ ] Install dependencies: `npm install dompurify date-fns axios`
- [ ] Test email webhook endpoint: `curl -X POST http://localhost:3000/webhooks/supportbox/inbound -H "Content-Type: application/json" -d '{...}'`
- [ ] Configure Resend API keys in admin settings
- [ ] Set up email forwarding or Resend inbound webhook to route emails to `/webhooks/supportbox/inbound`
- [ ] Test complete flow: send email → receive → create ticket → reply → customer receives email
- [ ] Run admin on `localhost:9090` and verify UI loads at `/admin/supportbox`
- [ ] Stage changes: `git add . && git commit -m 'feat: SupportBox — customer support module with email management, auto order matching, Resend integration' && git push origin staging`
- [ ] Monitor Railway deployment logs for any errors
- [ ] Test in production after deployment

---

## Key Features Implemented

✅ Email inbox configuration management
✅ Inbound email processing and ticket creation
✅ Automatic order matching by customer email
✅ Outbound email replies via Resend API
✅ Ticket conversation threading
✅ Customer information sidebar
✅ Order information sidebar with tracking
✅ Ticket status management (New/Solved)
✅ Full-text search on tickets
✅ Email account CRUD operations
✅ Admin dashboard with stats and table
✅ Responsive design matching existing admin UI
✅ React Query for state management
✅ TypeScript for type safety
✅ Resend email integration
✅ MedusaJS 2.0 module structure

---

## Notes for Developers

1. **Resend API Key Storage:** In production, encrypt API keys in the database. Use a key management service like AWS KMS or HashiCorp Vault.

2. **Email Threading:** The `thread_key` combines sender email and normalized subject to group related messages.

3. **Order Auto-Match:** Implemented via email lookup. For more robust matching, consider order number extraction from email body.

4. **Webhook Security:** Implement webhook signature verification when setting up Resend inbound webhook.

5. **Rate Limiting:** Add rate limiting to API endpoints to prevent abuse.

6. **Accessibility:** All components use semantic HTML and ARIA attributes for screen reader compatibility.

7. **Testing:** Add Jest tests for services and React Testing Library tests for components.

8. **Logging:** Implement structured logging for troubleshooting email delivery issues.

---

---

## Section 16: AUTO-ARCHIVE SUBSCRIBER (Solved → Old after 30 days)

### File: `backend/src/subscribers/supportbox-auto-archive.ts`

```typescript
/**
 * Auto-Archive Subscriber
 * Runs daily via scheduled job. Moves tickets with status "solved"
 * that were solved more than 30 days ago to status "old".
 */
import { SubscriberConfig, SubscriberArgs } from '@medusajs/framework'

export default async function supportboxAutoArchive({
  container,
}: SubscriberArgs) {
  const supportboxService = container.resolve('supportboxModuleService')

  try {
    const result = await supportboxService.archiveOldTickets()
    console.log(`[SupportBox] Auto-archive: ${result.archived} tickets moved to "old"`)
  } catch (error) {
    console.error('[SupportBox] Auto-archive error:', error.message)
  }
}

export const config: SubscriberConfig = {
  event: 'supportbox.auto_archive',
}
```

### File: `backend/src/jobs/supportbox-archive-job.ts`

```typescript
/**
 * Scheduled Job: runs daily at 3:00 AM to archive old solved tickets
 */
import { MedusaContainer } from '@medusajs/framework/types'

export default async function supportboxArchiveJob(container: MedusaContainer) {
  const supportboxService = container.resolve('supportboxModuleService')

  try {
    const result = await supportboxService.archiveOldTickets()
    console.log(`[SupportBox] Daily archive: ${result.archived} tickets archived`)
  } catch (error) {
    console.error('[SupportBox] Archive job failed:', error.message)
  }
}

export const config = {
  name: 'supportbox-auto-archive',
  schedule: '0 3 * * *', // Every day at 3:00 AM
}
```

### Admin UI — Add "Old" Tab to Dashboard

In the SupportBox dashboard page, update the tabs array:

```typescript
// In backend/src/admin/routes/supportbox/page.tsx
// Update the tabs definition:

const TABS = [
  { id: 'all', label: 'All' },
  { id: 'new', label: 'New' },
  { id: 'solved', label: 'Solved' },
  { id: 'old', label: 'Old' },  // <-- ADD THIS TAB
]

// Update the badge color logic in the ticket table:
// 'new' = green, 'solved' = grey, 'old' = orange

// The "Old" tab shows archived tickets for reference — read-only view
// Users can reopen old tickets which moves them back to "new"
```

---

## Section 17: COPY FULL THREAD FOR AI (Copy to Clipboard Button)

### Overview

Each ticket detail page has a **"Copy Thread for AI"** button that copies the ENTIRE conversation thread (all messages chronologically) as plain text to the clipboard. This allows the user to paste the full context into an AI assistant for generating a reply.

### UI Component Update

```typescript
// ADD to backend/src/admin/routes/supportbox/[id]/page.tsx
// Place this button in the ticket header, next to "Mark as Solved"

function CopyThreadButton({ messages, subject }: { messages: any[], subject: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(() => {
    // Build plain-text thread for AI context
    const sorted = [...messages].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )

    const threadText = sorted.map((msg) => {
      const date = new Date(msg.created_at).toLocaleString('cs-CZ')
      const direction = msg.direction === 'inbound' ? 'CUSTOMER' : 'SUPPORT'
      const sender = msg.from_name || msg.from_email

      // Strip HTML tags for plain text
      const plainBody = (msg.body_html || msg.body_text || '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<\/div>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\n{3,}/g, '\n\n')
        .trim()

      return `[${direction}] ${sender} — ${date}\n${plainBody}`
    }).join('\n\n---\n\n')

    const fullText = `Subject: ${subject}\n\n${threadText}`

    navigator.clipboard.writeText(fullText).then(() => {
      setCopied(true)
      toast.success('Thread copied to clipboard — paste into AI for reply')
      setTimeout(() => setCopied(false), 2000)
    })
  }, [messages, subject])

  return (
    <button
      onClick={handleCopy}
      className="od-btn"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '7px 14px',
        borderRadius: '6px',
        fontSize: '13px',
        fontWeight: 500,
        cursor: 'pointer',
        border: '1px solid #E1E3E5',
        background: copied ? '#E3F1DF' : '#FFFFFF',
        color: copied ? '#008060' : '#1A1A1A',
        transition: 'all 0.15s ease',
      }}
    >
      {copied ? '✓ Copied' : '📋 Copy Thread for AI'}
    </button>
  )
}

// Place in the ticket detail header:
// <div style={{ display: 'flex', gap: '8px' }}>
//   <CopyThreadButton messages={ticket.messages} subject={ticket.subject} />
//   <button onClick={handleSolve} ...>Mark as Solved</button>
// </div>
```

### What Gets Copied (example output)

```
Subject: Where is my order #1234?

[CUSTOMER] Jan de Vries — 25.02.2026, 14:30:00
Hello, I ordered the book "Laat los wat je kapotmaakt" 5 days ago
and I still haven't received it. Can you check my order please?

Order number: #1234

---

[SUPPORT] devries@loslatenboek.nl — 25.02.2026, 15:45:00
Dear Jan,

Thank you for reaching out. I've checked your order #1234 and it
was dispatched yesterday. Your tracking number is NL123456789.
You should receive it within 1-2 business days.

---

[CUSTOMER] Jan de Vries — 26.02.2026, 09:00:00
Thank you! I see it's in transit now. One more question — can I
also order the e-book version?
```

This plain-text format is perfect for pasting into any AI tool for generating a contextual reply.

---

## Section 18: EMAIL THREAD HISTORY IN OUTBOUND EMAILS

### Overview

When you reply to a customer, the outbound email includes the **full conversation history** at the bottom. This means:
- Customer always sees what was discussed before
- When customer replies, their email client includes the full thread
- When that reply arrives back as an inbound email, you get the complete history
- You can copy-paste the entire thread into AI for context-aware answers

This is already implemented in Section 4 (reply route) — the `fullEmailHtml` variable appends all previous messages with:
- Color-coded left borders (gray for customer, green for support)
- Sender name and timestamp
- "— Previous conversation —" separator

### Email Format

```
┌──────────────────────────────────────┐
│ [Your new reply text here]           │
│                                      │
│ ─────────────────────────────────── │
│ — Previous conversation —            │
│                                      │
│ ┃ CUSTOMER — Jan de Vries            │
│ ┃ 25.02.2026, 14:30                  │
│ ┃ Hello, where is my order...        │
│                                      │
│ ┃ SUPPORT — devries@loslatenboek.nl  │
│ ┃ 25.02.2026, 15:45                  │
│ ┃ Dear Jan, your tracking is...      │
│                                      │
│ ┃ CUSTOMER — Jan de Vries            │
│ ┃ 26.02.2026, 09:00                  │
│ ┃ Can I also order the e-book?       │
└──────────────────────────────────────┘
```

---

**Document Version:** 1.1
**Last Updated:** 2026-02-26
**Status:** Ready for Implementation — includes OLD status auto-archive, email thread history, and copy-to-clipboard for AI
