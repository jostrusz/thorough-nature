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
