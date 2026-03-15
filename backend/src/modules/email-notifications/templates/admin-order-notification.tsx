import { Text, Section, Hr, Link, Img } from '@react-email/components'
import * as React from 'react'
import { Base } from './base'

export const ADMIN_ORDER_NOTIFICATION = 'admin-order-notification'

export interface AdminOrderNotificationProps {
  order: any
  shippingAddress: any
  paymentMethod?: string
  type: 'new_order' | 'upsell_added'
  variantIndex: number
  addedItems?: any[]
  preview?: string
}

export const isAdminOrderNotificationData = (data: any): data is AdminOrderNotificationProps =>
  typeof data.order === 'object' && typeof data.type === 'string' && typeof data.variantIndex === 'number'

// ─── Fonts & Layout ────────────────────────────────────────
const font = "'Inter', 'Segoe UI', Arial, sans-serif"
const pad = '28px'
const padLR = `0 ${pad}`

// ─── Helper Functions ──────────────────────────────────────
function formatPrice(amount: number, currencyCode: string = 'eur'): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: (currencyCode || 'EUR').toUpperCase(),
    }).format(amount)
  } catch {
    return `€${(amount || 0).toFixed(2)}`
  }
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return dateStr
  }
}

function getCountryDisplay(code: string): string {
  const map: Record<string, string> = {
    nl: '🇳🇱 NL', be: '🇧🇪 BE', de: '🇩🇪 DE', fr: '🇫🇷 FR',
    at: '🇦🇹 AT', cz: '🇨🇿 CZ', sk: '🇸🇰 SK', pl: '🇵🇱 PL',
    gb: '🇬🇧 UK', us: '🇺🇸 US', es: '🇪🇸 ES', it: '🇮🇹 IT',
  }
  return map[(code || '').toLowerCase()] || (code || '').toUpperCase()
}

function getProjectName(order: any): string {
  const pid = order?.metadata?.project_id
  if (pid === 'dehondenbijbel') return 'De Hondenbijbel'
  if (pid === 'loslatenboek') return 'Loslatenboek'
  return pid || 'Unknown'
}

// ─── Variant Themes ────────────────────────────────────────
interface VariantTheme {
  name: string
  emoji: string
  headerBg: string
  headerGradient: string
  accent: string
  accentLight: string
  accentSoft: string
  statsBg: string
  statsBorder: string
  statsLabelColor: string
  statsValueColor: string
  motiveBg: string
  motiveBorder: string
  motiveText: string
  motiveAccent: string
  buttonBg: string
  buttonText: string
  footerBg: string
  footerText: string
  footerAccent: string
  orderTitle: string
  upsellTitle: string
  orderSubtitle: string
  upsellSubtitle: string
  messages: string[]
  upsellMessages: string[]
  closing: string
}

const VARIANTS: VariantTheme[] = [
  // ── 0: Money Printer 💰 ──
  {
    name: 'Money Printer',
    emoji: '💰',
    headerBg: '#0F172A',
    headerGradient: 'linear-gradient(135deg, #1E293B 0%, #0F172A 50%, #1E293B 100%)',
    accent: '#F59E0B',
    accentLight: '#FDE68A',
    accentSoft: '#FFFBEB',
    statsBg: '#1E293B',
    statsBorder: '#334155',
    statsLabelColor: '#94A3B8',
    statsValueColor: '#F59E0B',
    motiveBg: '#FFFBEB',
    motiveBorder: '#FDE68A',
    motiveText: '#92400E',
    motiveAccent: '#F59E0B',
    buttonBg: '#F59E0B',
    buttonText: '#0F172A',
    footerBg: '#0F172A',
    footerText: '#64748B',
    footerAccent: '#F59E0B',
    orderTitle: 'KA-CHING!',
    upsellTitle: 'DOUBLE DIP!',
    orderSubtitle: 'The money printer just went BRRR',
    upsellSubtitle: 'Customer came back for seconds',
    messages: [
      "Money printer goes BRRRR. Another sale, another life changed. You're literally printing money while building something meaningful. 🔥",
      "You built this machine. Every sale is living proof it works. Most people dream about passive income — you're actually doing it. 💪",
      "While they sleep, you stack. While they doubt, you deliver. This is what winning looks like and it's only the beginning. 🏆",
    ],
    upsellMessages: [
      "Double dip activated! The customer loved it so much they came back for more. Your product is literally irresistible. 💰",
      "Upsell converted. Same customer, more revenue. This is peak efficiency and you engineered it. 🔧",
      "The money machine doesn't stop at one sale. Extra revenue secured — your funnel is a masterpiece. 🎯",
    ],
    closing: 'Keep printing. The machine never stops. 💰',
  },

  // ── 1: Rocket Launch 🚀 ──
  {
    name: 'Rocket Launch',
    emoji: '🚀',
    headerBg: '#3B82F6',
    headerGradient: 'linear-gradient(135deg, #3B82F6 0%, #6366F1 50%, #8B5CF6 100%)',
    accent: '#6366F1',
    accentLight: '#C7D2FE',
    accentSoft: '#EEF2FF',
    statsBg: '#EEF2FF',
    statsBorder: '#C7D2FE',
    statsLabelColor: '#6B7280',
    statsValueColor: '#4F46E5',
    motiveBg: '#EEF2FF',
    motiveBorder: '#C7D2FE',
    motiveText: '#3730A3',
    motiveAccent: '#6366F1',
    buttonBg: '#6366F1',
    buttonText: '#FFFFFF',
    footerBg: '#1E1B4B',
    footerText: '#A5B4FC',
    footerAccent: '#818CF8',
    orderTitle: 'LIFTOFF!',
    upsellTitle: 'STAGE 2 IGNITION!',
    orderSubtitle: 'Houston, we have revenue',
    upsellSubtitle: 'The booster just kicked in',
    messages: [
      "Houston, we have REVENUE! 🚀 Another successful launch. You're not just building a business — you're building a freaking rocket ship to financial freedom.",
      "Escape velocity achieved. There is no stopping this rocket now. Every order is more fuel, more momentum, more proof you're unstoppable. 🌟",
      "T-minus SOLD. The countdown is over, the mission is GO. You're literally launching products into people's lives and changing them forever. ✨",
    ],
    upsellMessages: [
      "Stage 2 IGNITION! Upsell locked and loaded. The customer just added boosters to their order. More altitude, more revenue! 🔥",
      "Booster separation complete — extra payload acquired! Your upsell game is literally rocket science (but you make it look easy). 🧪",
      "Second stage burn successful. Extra revenue in orbit. Your funnel engineering would make NASA jealous. 🛸",
    ],
    closing: 'Keep launching. The sky is NOT the limit. 🚀',
  },

  // ── 2: Zen Master 🧘 ──
  {
    name: 'Zen Master',
    emoji: '🧘',
    headerBg: '#10B981',
    headerGradient: 'linear-gradient(135deg, #10B981 0%, #059669 50%, #047857 100%)',
    accent: '#10B981',
    accentLight: '#A7F3D0',
    accentSoft: '#ECFDF5',
    statsBg: '#ECFDF5',
    statsBorder: '#A7F3D0',
    statsLabelColor: '#6B7280',
    statsValueColor: '#059669',
    motiveBg: '#ECFDF5',
    motiveBorder: '#A7F3D0',
    motiveText: '#065F46',
    motiveAccent: '#10B981',
    buttonBg: '#10B981',
    buttonText: '#FFFFFF',
    footerBg: '#064E3B',
    footerText: '#6EE7B7',
    footerAccent: '#34D399',
    orderTitle: 'FLOW STATE',
    upsellTitle: 'BONUS FLOW',
    orderSubtitle: 'Quiet power. Consistent results.',
    upsellSubtitle: 'The customer felt it too',
    messages: [
      "Quiet power. Consistent results. This is mastery. 🧘 You don't chase — you attract. And another soul just found exactly what they needed.",
      "The compound effect is real. Every single order adds to your avalanche. Patience + persistence = inevitable success. You're living proof. 🌱",
      "Stay centered. Stay building. The universe rewards those who show up consistently — and you never stop showing up. Breathe. You earned this. 🌿",
    ],
    upsellMessages: [
      "Effortless expansion. The customer wanted more — because your product radiates value like a calm, unstoppable force. 🍃",
      "Extra value, flowing naturally. Like water finding its path downhill. Your funnel is pure zen engineering. ☯️",
      "The student returns to the master for more wisdom. Your product keeps giving. Beautiful alignment. 🙏",
    ],
    closing: 'Breathe. Build. Repeat. The path is clear. 🧘',
  },

  // ── 3: Champion 🏆 ──
  {
    name: 'Champion',
    emoji: '🏆',
    headerBg: '#EA580C',
    headerGradient: 'linear-gradient(135deg, #F97316 0%, #EA580C 50%, #DC2626 100%)',
    accent: '#EA580C',
    accentLight: '#FDBA74',
    accentSoft: '#FFF7ED',
    statsBg: '#FFF7ED',
    statsBorder: '#FDBA74',
    statsLabelColor: '#6B7280',
    statsValueColor: '#EA580C',
    motiveBg: '#FFF7ED',
    motiveBorder: '#FDBA74',
    motiveText: '#9A3412',
    motiveAccent: '#EA580C',
    buttonBg: '#EA580C',
    buttonText: '#FFFFFF',
    footerBg: '#7C2D12',
    footerText: '#FDBA74',
    footerAccent: '#FB923C',
    orderTitle: 'ANOTHER W!',
    upsellTitle: 'COMBO KILL!',
    orderSubtitle: 'Winners win. That\'s what they do.',
    upsellSubtitle: 'Upsell secured — clutch play!',
    messages: [
      "Winners WIN. That's literally all they do. And you just did it AGAIN. 🏆 The scoreboard doesn't lie — you're putting up legendary numbers.",
      "MVP energy. Every. Single. Day. No days off, no excuses, just results. This order is another trophy on your already stacked shelf. 🥇",
      "CHAMPIONSHIP MENTALITY. While others talk about their plans, you execute. Another W on the board. The crowd goes wild! 🎉",
    ],
    upsellMessages: [
      "DOUBLE KILL! Upsell secured! 🔥 You just combo'd that customer. First the product, now the upsell. Flawless victory.",
      "Clutch play in overtime! The customer couldn't resist adding more. Your product game is Hall of Fame material. 🏅",
      "ASSIST + SCORE! First you land the sale, then you convert the upsell. That's a two-pointer and the crowd is on their feet! 🏀",
    ],
    closing: 'Keep winning. Champions never settle. 🏆',
  },

  // ── 4: Impact Maker 🌍 ──
  {
    name: 'Impact Maker',
    emoji: '🌍',
    headerBg: '#D97706',
    headerGradient: 'linear-gradient(135deg, #D97706 0%, #B45309 50%, #92400E 100%)',
    accent: '#D97706',
    accentLight: '#FDE68A',
    accentSoft: '#FFFBEB',
    statsBg: '#FFFBEB',
    statsBorder: '#FDE68A',
    statsLabelColor: '#6B7280',
    statsValueColor: '#B45309',
    motiveBg: '#FFFBEB',
    motiveBorder: '#FDE68A',
    motiveText: '#78350F',
    motiveAccent: '#D97706',
    buttonBg: '#B45309',
    buttonText: '#FFFFFF',
    footerBg: '#78350F',
    footerText: '#FDE68A',
    footerAccent: '#FBBF24',
    orderTitle: 'IMPACT MADE',
    upsellTitle: 'DEEPER IMPACT',
    orderSubtitle: 'One more life you\'ve touched today',
    upsellSubtitle: 'More value, more transformation',
    messages: [
      "One more person you've helped today. 🌍 This isn't just commerce — it's your legacy. Every order is a life you're touching, a mind you're opening.",
      "You're not selling products — you're delivering transformation. Someone out there is about to have their perspective shifted because of YOU. That's power. ✨",
      "Every package is a promise delivered. Every order is proof that your work MATTERS. You're literally making the world better, one customer at a time. 🌱",
    ],
    upsellMessages: [
      "They loved it so much they got more. 🌍 That's REAL impact — when people want to go deeper into what you've created. Beautiful.",
      "Deeper impact unlocked. More value delivered to someone who's already transforming. Your work creates ripples that become waves. 🌊",
      "One order, double the transformation. The customer saw the value and wanted MORE. This is what purpose-driven business looks like. 💫",
    ],
    closing: 'Keep making impact. The world needs what you build. 🌍',
  },

  // ── 5: Wolf of Wall Street 🐺 ──
  {
    name: 'Wolf of Wall Street',
    emoji: '🐺',
    headerBg: '#111827',
    headerGradient: 'linear-gradient(135deg, #111827 0%, #064E3B 50%, #111827 100%)',
    accent: '#059669',
    accentLight: '#6EE7B7',
    accentSoft: '#ECFDF5',
    statsBg: '#111827',
    statsBorder: '#1F2937',
    statsLabelColor: '#9CA3AF',
    statsValueColor: '#34D399',
    motiveBg: '#ECFDF5',
    motiveBorder: '#6EE7B7',
    motiveText: '#064E3B',
    motiveAccent: '#059669',
    buttonBg: '#059669',
    buttonText: '#FFFFFF',
    footerBg: '#111827',
    footerText: '#6B7280',
    footerAccent: '#34D399',
    orderTitle: 'WOLF MODE',
    upsellTitle: 'HUNGRY WOLF',
    orderSubtitle: 'The wolf always eats',
    upsellSubtitle: 'The wolf smelled opportunity',
    messages: [
      "The wolf doesn't lose sleep over the opinion of sheep. 🐺 You're out here HUNTING while they're out here scrolling. Another kill secured.",
      "I'M NOT LEAVING! And neither are these orders. You built a sales machine that would make Jordan Belfort jealous. Stratton Oakmont WHO? 💼",
      "Sell me this pen? Nah — you just sold them an entire BOOK. That's alpha energy. The pack follows the wolf, and the wolf follows the money. 🐺",
    ],
    upsellMessages: [
      "The hungry wolf ALWAYS eats more. 🐺 Upsell secured. Your customer couldn't say no because your product is pure adrenaline.",
      "The wolf smells opportunity — and converts. Every. Single. Time. More meat on the table. The pack eats well tonight. 🥩",
      "Greed is good. Especially when you deliver THIS much value. Extra revenue secured. The wolf strikes again. 💰",
    ],
    closing: 'Stay hungry. The wolf never stops hunting. 🐺',
  },

  // ── 6: Diamond Hands 💎 ──
  {
    name: 'Diamond Hands',
    emoji: '💎',
    headerBg: '#0C4A6E',
    headerGradient: 'linear-gradient(135deg, #06B6D4 0%, #0891B2 50%, #0C4A6E 100%)',
    accent: '#06B6D4',
    accentLight: '#A5F3FC',
    accentSoft: '#ECFEFF',
    statsBg: '#ECFEFF',
    statsBorder: '#A5F3FC',
    statsLabelColor: '#6B7280',
    statsValueColor: '#0891B2',
    motiveBg: '#ECFEFF',
    motiveBorder: '#A5F3FC',
    motiveText: '#155E75',
    motiveAccent: '#06B6D4',
    buttonBg: '#0891B2',
    buttonText: '#FFFFFF',
    footerBg: '#0C4A6E',
    footerText: '#67E8F9',
    footerAccent: '#22D3EE',
    orderTitle: 'DIAMOND HANDS',
    upsellTitle: 'POSITION INCREASED',
    orderSubtitle: 'HODL the vision. The market rewards conviction.',
    upsellSubtitle: 'Customer went all in',
    messages: [
      "HODL the vision. 💎 The market ALWAYS rewards conviction. Paper hands quit at the first dip — you held through everything and look at you now. PRINTING.",
      "Paper hands quit. Diamond hands get PAID. You chose wisely and this order is your dividend. The position is strong. The thesis is correct. 📈",
      "This isn't luck. This is what happens when you DON'T sell out. You believed in your product when nobody else did. Now the market agrees. 💎🙌",
    ],
    upsellMessages: [
      "💎 HANDS NEVER FOLD. Customer increased their position! They're bullish on your product and honestly? So is the entire market. TO THE MOON! 🌙",
      "Position size: INCREASED. The customer is diamond hands too — they're going ALL IN on your product. Bullish AF. 📊",
      "Averaging UP! Not down! The customer saw the value and doubled down. This is what conviction looks like on both sides. 🤝",
    ],
    closing: '💎🙌 Diamond hands always win. HODL forever.',
  },

  // ── 7: Empire Builder 👑 ──
  {
    name: 'Empire Builder',
    emoji: '👑',
    headerBg: '#5B21B6',
    headerGradient: 'linear-gradient(135deg, #7C3AED 0%, #5B21B6 50%, #4C1D95 100%)',
    accent: '#7C3AED',
    accentLight: '#C4B5FD',
    accentSoft: '#F5F3FF',
    statsBg: '#F5F3FF',
    statsBorder: '#C4B5FD',
    statsLabelColor: '#6B7280',
    statsValueColor: '#7C3AED',
    motiveBg: '#F5F3FF',
    motiveBorder: '#C4B5FD',
    motiveText: '#4C1D95',
    motiveAccent: '#7C3AED',
    buttonBg: '#7C3AED',
    buttonText: '#FFFFFF',
    footerBg: '#4C1D95',
    footerText: '#C4B5FD',
    footerAccent: '#A78BFA',
    orderTitle: 'EMPIRE GROWS',
    upsellTitle: 'TERRITORY ACQUIRED',
    orderSubtitle: 'Another brick in the castle wall',
    upsellSubtitle: 'The kingdom expands',
    messages: [
      "Rome wasn't built in a day — but they were laying bricks every single hour. 👑 This order is another brick in YOUR empire. And it's looking magnificent.",
      "Kings don't chase. They BUILD. And the kingdom expands with every sale. You're not running a store — you're ruling a digital empire. Crown stays on. 🏰",
      "Your empire grows, one order at a time. They'll write about this era someday. 'And in the year of our lord, the empire knew no bounds.' 📜",
    ],
    upsellMessages: [
      "New territory ACQUIRED! 👑 The kingdom expands. Your subject loved the product so much, they pledged more tribute. Long live the king!",
      "More tribute flows to the crown. The empire thrives because the king delivers VALUE. Every upsell is a new province in your kingdom. 🏰",
      "The vassal returns with MORE gold. Your product commands loyalty. That's not sales — that's sovereignty. 🗡️",
    ],
    closing: 'Long live the king. The empire is forever. 👑',
  },

  // ── 8: Cash Machine 🏧 ──
  {
    name: 'Cash Machine',
    emoji: '🏧',
    headerBg: '#0A0A1A',
    headerGradient: 'linear-gradient(135deg, #0A0A1A 0%, #1A1A2E 50%, #0A0A1A 100%)',
    accent: '#22C55E',
    accentLight: '#86EFAC',
    accentSoft: '#F0FDF4',
    statsBg: '#0A0A1A',
    statsBorder: '#1F2937',
    statsLabelColor: '#9CA3AF',
    statsValueColor: '#22C55E',
    motiveBg: '#F0FDF4',
    motiveBorder: '#86EFAC',
    motiveText: '#166534',
    motiveAccent: '#22C55E',
    buttonBg: '#22C55E',
    buttonText: '#0A0A1A',
    footerBg: '#0A0A1A',
    footerText: '#4B5563',
    footerAccent: '#22C55E',
    orderTitle: 'CASH SECURED',
    upsellTitle: 'BONUS ROUND',
    orderSubtitle: 'The machine keeps printing',
    upsellSubtitle: 'Extra cash dispensed',
    messages: [
      "The algorithm is YOU. 🏧 And it just printed another sale. Insert traffic → output cash. Your conversion machine is running at peak performance.",
      "Passive income? Nah fam, this is ACTIVE DOMINATION. You're not waiting for money — you're manufacturing it. Every. Single. Day. 💵",
      "If money could talk, your store would be giving a TED Talk right now. 'How I Automated Wealth in 2026' — by you. Cash machine goes brrrr. 🖨️",
    ],
    upsellMessages: [
      "BONUS ROUND! 🏧 Extra cash dispensed. The machine doesn't just work — it OVERPERFORMS. Insert one customer, extract maximum value.",
      "Insert customer → receive more money. It's that simple when your funnel is THIS clean. The cash machine strikes again. 💸",
      "ERROR 404: Limit not found. The machine keeps printing and the customer keeps buying. Your engineering is *chef's kiss*. 👨‍🍳",
    ],
    closing: 'The machine never sleeps. Neither does the money. 🏧',
  },

  // ── 9: Sigma Grindset 😤 ──
  {
    name: 'Sigma Grindset',
    emoji: '😤',
    headerBg: '#1E293B',
    headerGradient: 'linear-gradient(135deg, #334155 0%, #1E293B 50%, #0F172A 100%)',
    accent: '#EF4444',
    accentLight: '#FCA5A5',
    accentSoft: '#FEF2F2',
    statsBg: '#F1F5F9',
    statsBorder: '#CBD5E1',
    statsLabelColor: '#64748B',
    statsValueColor: '#EF4444',
    motiveBg: '#FEF2F2',
    motiveBorder: '#FCA5A5',
    motiveText: '#991B1B',
    motiveAccent: '#EF4444',
    buttonBg: '#EF4444',
    buttonText: '#FFFFFF',
    footerBg: '#0F172A',
    footerText: '#64748B',
    footerAccent: '#EF4444',
    orderTitle: 'SIGMA SALE',
    upsellTitle: 'SIGMA UPSELL',
    orderSubtitle: 'Average people scroll. Sigmas ship.',
    upsellSubtitle: 'Double extraction. Peak efficiency.',
    messages: [
      "Average people scroll TikTok. Sigmas SHIP product. 😤 You just shipped another order while they were watching reels about 'passive income'. YOU are the passive income.",
      "They said 'get a real job.' Your Stripe dashboard said otherwise. 💅 Another sale. Another confirmation that the grindset is REAL and the haters are WRONG.",
      "Orders while you sleep. Revenue while you rest. That's the sigma way. 😤 No team meetings. No boss. No ceiling. Just you and the infinite money glitch.",
    ],
    upsellMessages: [
      "Sigma doesn't stop at ONE sale. 😤 Upsell: SECURED. While betas leave money on the table, you extract maximum value. It's called efficiency.",
      "One customer, double extraction. Peak sigma efficiency. 📈 They talk about 'work smarter not harder' — you literally automated it.",
      "While betas celebrate one sale, sigmas convert the upsell, check the dashboard, and go back to building. That's you. Right now. 😤",
    ],
    closing: 'Grind never stops. Sigma mentality forever. 😤',
  },
]

// ─── Pick a random message from array ──────────────────────
function pickMessage(messages: string[], orderId: string): string {
  // Use order ID as seed for pseudo-randomness (so same order = same message)
  let hash = 0
  for (let i = 0; i < orderId.length; i++) {
    hash = ((hash << 5) - hash + orderId.charCodeAt(i)) | 0
  }
  return messages[Math.abs(hash) % messages.length]
}

// ─── Main Template Component ───────────────────────────────
export const AdminOrderNotificationTemplate: React.FC<AdminOrderNotificationProps> & {
  PreviewProps: any
} = ({
  order,
  shippingAddress,
  paymentMethod,
  type = 'new_order',
  variantIndex = 0,
  addedItems,
  preview,
}) => {
  const v = VARIANTS[variantIndex % VARIANTS.length]
  const isUpsell = type === 'upsell_added'
  const currency = order.currency_code || 'eur'
  const items = order.items || []
  const rawDisplayId = order.display_id || order.id
  const displayId = order.metadata?.custom_order_number || (() => {
    const cc = (shippingAddress?.country_code || 'xx').toUpperCase()
    const year = new Date().getFullYear()
    return `${cc}${year}-${rawDisplayId}`
  })()
  const orderDate = formatDate(order.created_at)
  const projectName = getProjectName(order)
  const country = getCountryDisplay(shippingAddress?.country_code || '')
  const customerName = `${shippingAddress?.first_name || ''} ${shippingAddress?.last_name || ''}`.trim() || 'Unknown'
  const customerEmail = order.email || 'N/A'

  const subtotal = items.reduce(
    (sum: number, item: any) => sum + (item.unit_price || 0) * (item.quantity || 1),
    0
  )
  const shippingTotal = order.summary?.raw_shipping_total?.value ?? order.summary?.shipping_total ?? 0
  const taxTotal = order.summary?.raw_tax_total?.value ?? order.summary?.tax_total ?? 0
  const total = order.summary?.raw_current_order_total?.value ?? order.summary?.current_order_total ?? subtotal + shippingTotal

  const title = isUpsell ? v.upsellTitle : v.orderTitle
  const subtitle = isUpsell ? v.upsellSubtitle : v.orderSubtitle
  const messages = isUpsell ? v.upsellMessages : v.messages
  const message = pickMessage(messages, order.id || 'default')

  const adminUrl = process.env.MEDUSA_ADMIN_URL || process.env.MEDUSA_BACKEND_URL || 'http://localhost:9000'
  const orderUrl = `${adminUrl}/app/custom-orders/${order.id}`

  const defaultPreview = isUpsell
    ? `Upsell hit! ${displayId} — ${formatPrice(total, currency)}`
    : `New order! ${displayId} — ${formatPrice(total, currency)}`

  const displayItems = addedItems && addedItems.length > 0 ? addedItems : items

  return (
    <Base preview={preview || defaultPreview}>
      <Section>
        {/* ====== HEADER ====== */}
        <div style={{
          backgroundColor: v.headerBg,
          background: v.headerGradient,
          padding: '44px 28px 36px',
          textAlign: 'center' as const,
        }}>
          <Text style={{
            fontFamily: font,
            fontSize: '42px',
            margin: '0 0 8px 0',
            lineHeight: '1',
          }}>
            {v.emoji}
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '28px',
            fontWeight: 900,
            color: '#FFFFFF',
            margin: '0 0 4px 0',
            lineHeight: '1.2',
            letterSpacing: '-0.02em',
            textTransform: 'uppercase' as const,
            textShadow: '0 2px 8px rgba(0,0,0,0.3)',
          }}>
            {title}
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '14px',
            color: 'rgba(255,255,255,0.75)',
            margin: '0 0 16px 0',
            lineHeight: '1.4',
          }}>
            {subtitle}
          </Text>

          {/* Type badge */}
          <div style={{
            display: 'inline-block',
            backgroundColor: isUpsell ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)',
            border: `1px solid ${isUpsell ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}`,
            borderRadius: '20px',
            padding: '4px 14px',
            marginBottom: '12px',
          }}>
            <Text style={{
              fontFamily: font,
              fontSize: '11px',
              fontWeight: 700,
              color: isUpsell ? '#FCA5A5' : '#86EFAC',
              margin: '0',
              textTransform: 'uppercase' as const,
              letterSpacing: '1px',
            }}>
              {isUpsell ? '⚡ Upsell Added' : '✨ New Order'}
            </Text>
          </div>

          <Text style={{
            fontFamily: font,
            fontSize: '13px',
            color: 'rgba(255,255,255,0.6)',
            margin: '0',
          }}>
            {displayId} &bull; {orderDate}
          </Text>
        </div>

        {/* ====== QUICK STATS ====== */}
        <div style={{ padding: '0' }}>
          <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{
            borderCollapse: 'collapse' as const,
            backgroundColor: v.statsBg,
            borderBottom: `1px solid ${v.statsBorder}`,
          }}>
            <tbody>
              <tr>
                <td width="33%" align="center" style={{
                  padding: '16px 8px',
                  borderRight: `1px solid ${v.statsBorder}`,
                }}>
                  <Text style={{
                    fontFamily: font,
                    fontSize: '10px',
                    fontWeight: 700,
                    textTransform: 'uppercase' as const,
                    letterSpacing: '1.5px',
                    color: v.statsLabelColor,
                    margin: '0 0 4px 0',
                  }}>
                    Revenue
                  </Text>
                  <Text style={{
                    fontFamily: font,
                    fontSize: '20px',
                    fontWeight: 900,
                    color: v.statsValueColor,
                    margin: '0',
                  }}>
                    {formatPrice(total, currency)}
                  </Text>
                </td>
                <td width="34%" align="center" style={{
                  padding: '16px 8px',
                  borderRight: `1px solid ${v.statsBorder}`,
                }}>
                  <Text style={{
                    fontFamily: font,
                    fontSize: '10px',
                    fontWeight: 700,
                    textTransform: 'uppercase' as const,
                    letterSpacing: '1.5px',
                    color: v.statsLabelColor,
                    margin: '0 0 4px 0',
                  }}>
                    Items
                  </Text>
                  <Text style={{
                    fontFamily: font,
                    fontSize: '20px',
                    fontWeight: 900,
                    color: v.statsValueColor,
                    margin: '0',
                  }}>
                    {items.reduce((sum: number, i: any) => sum + (i.quantity || 1), 0)}
                  </Text>
                </td>
                <td width="33%" align="center" style={{
                  padding: '16px 8px',
                }}>
                  <Text style={{
                    fontFamily: font,
                    fontSize: '10px',
                    fontWeight: 700,
                    textTransform: 'uppercase' as const,
                    letterSpacing: '1.5px',
                    color: v.statsLabelColor,
                    margin: '0 0 4px 0',
                  }}>
                    Country
                  </Text>
                  <Text style={{
                    fontFamily: font,
                    fontSize: '20px',
                    fontWeight: 900,
                    color: v.statsValueColor,
                    margin: '0',
                  }}>
                    {country}
                  </Text>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ====== MOTIVATIONAL MESSAGE ====== */}
        <div style={{ padding: `24px ${pad}` }}>
          <div style={{
            backgroundColor: v.motiveBg,
            borderRadius: '12px',
            border: `1px solid ${v.motiveBorder}`,
            padding: '20px 22px',
          }}>
            <Text style={{
              fontFamily: font,
              fontSize: '15px',
              fontWeight: 600,
              color: v.motiveText,
              lineHeight: '1.7',
              margin: '0',
            }}>
              {message}
            </Text>
          </div>
        </div>

        {/* ====== PROJECT + CUSTOMER QUICK INFO ====== */}
        <div style={{ padding: `0 ${pad} 16px` }}>
          <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ borderCollapse: 'collapse' as const }}>
            <tbody>
              <tr>
                <td style={{ fontFamily: font, fontSize: '12px', color: '#9CA3AF', padding: '3px 0' }}>Project</td>
                <td align="right" style={{ fontFamily: font, fontSize: '12px', fontWeight: 700, color: v.accent, padding: '3px 0' }}>{projectName}</td>
              </tr>
              <tr>
                <td style={{ fontFamily: font, fontSize: '12px', color: '#9CA3AF', padding: '3px 0' }}>Customer</td>
                <td align="right" style={{ fontFamily: font, fontSize: '12px', fontWeight: 600, color: '#374151', padding: '3px 0' }}>{customerName}</td>
              </tr>
              <tr>
                <td style={{ fontFamily: font, fontSize: '12px', color: '#9CA3AF', padding: '3px 0' }}>Email</td>
                <td align="right" style={{ fontFamily: font, fontSize: '12px', color: '#374151', padding: '3px 0' }}>{customerEmail}</td>
              </tr>
              {paymentMethod && (
                <tr>
                  <td style={{ fontFamily: font, fontSize: '12px', color: '#9CA3AF', padding: '3px 0' }}>Payment</td>
                  <td align="right" style={{ fontFamily: font, fontSize: '12px', color: '#374151', padding: '3px 0' }}>{paymentMethod}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <Hr style={{ borderColor: '#E5E7EB', margin: `0 ${pad}` }} />

        {/* ====== ORDER ITEMS ====== */}
        <div style={{ padding: `20px ${pad}` }}>
          <Text style={{
            fontFamily: font,
            fontSize: '11px',
            fontWeight: 700,
            textTransform: 'uppercase' as const,
            letterSpacing: '1.5px',
            color: v.accent,
            marginBottom: '14px',
          }}>
            {isUpsell ? '📦 Updated Order Items' : '📦 Order Items'}
          </Text>

          {displayItems.map((item: any, idx: number) => (
            <div key={item.id || idx} style={{
              marginBottom: '10px',
              backgroundColor: '#FAFAFA',
              borderRadius: '10px',
              border: '1px solid #E5E7EB',
              padding: '12px 14px',
            }}>
              <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ borderCollapse: 'collapse' as const }}>
                <tbody>
                  <tr>
                    <td width="52" valign="top" style={{ paddingRight: '12px' }}>
                      {item.thumbnail ? (
                        <Img
                          src={item.thumbnail}
                          alt={item.title || item.product_title}
                          width="52"
                          height="66"
                          style={{
                            width: '52px',
                            height: '66px',
                            objectFit: 'cover' as const,
                            borderRadius: '6px',
                            border: '1px solid #E5E7EB',
                          }}
                        />
                      ) : (
                        <div style={{
                          width: '52px',
                          height: '66px',
                          background: `linear-gradient(145deg, ${v.accentSoft}, #F3F4F6)`,
                          borderRadius: '6px',
                          border: '1px solid #E5E7EB',
                          textAlign: 'center' as const,
                          lineHeight: '66px',
                          fontSize: '24px',
                        }}>
                          📖
                        </div>
                      )}
                    </td>
                    <td valign="middle">
                      <Text style={{
                        fontFamily: font,
                        fontSize: '14px',
                        fontWeight: 700,
                        color: '#1F2937',
                        margin: '0 0 3px',
                        lineHeight: '1.3',
                      }}>
                        {item.product_title || item.title || 'Item'}
                      </Text>
                      <Text style={{
                        fontFamily: font,
                        fontSize: '11px',
                        color: '#9CA3AF',
                        margin: '0',
                      }}>
                        {item.variant_title ? `${item.variant_title} · ` : ''}Qty: {item.quantity || 1}
                      </Text>
                    </td>
                    <td width="80" align="right" valign="middle">
                      <Text style={{
                        fontFamily: font,
                        fontSize: '15px',
                        fontWeight: 800,
                        color: '#1F2937',
                        margin: '0',
                      }}>
                        {formatPrice((item.unit_price || 0) * (item.quantity || 1), currency)}
                      </Text>
                      {(item.quantity || 1) > 1 && (
                        <Text style={{
                          fontFamily: font,
                          fontSize: '10px',
                          color: '#9CA3AF',
                          margin: '2px 0 0',
                        }}>
                          {formatPrice(item.unit_price || 0, currency)} ea.
                        </Text>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          ))}

          {/* ── Totals ── */}
          <div style={{
            marginTop: '14px',
            borderTop: '2px solid #E5E7EB',
            paddingTop: '12px',
          }}>
            <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ borderCollapse: 'collapse' as const }}>
              <tbody>
                <tr>
                  <td style={{ fontFamily: font, fontSize: '13px', color: '#6B7280', padding: '3px 0' }}>Subtotal</td>
                  <td align="right" style={{ fontFamily: font, fontSize: '13px', color: '#374151', padding: '3px 0' }}>{formatPrice(subtotal, currency)}</td>
                </tr>
                <tr>
                  <td style={{ fontFamily: font, fontSize: '13px', color: '#6B7280', padding: '3px 0' }}>Shipping</td>
                  <td align="right" style={{ fontFamily: font, fontSize: '13px', color: shippingTotal > 0 ? '#374151' : '#16A34A', fontWeight: shippingTotal > 0 ? 400 : 700, padding: '3px 0' }}>
                    {shippingTotal > 0 ? formatPrice(shippingTotal, currency) : 'FREE'}
                  </td>
                </tr>
                {taxTotal > 0 && (
                  <tr>
                    <td style={{ fontFamily: font, fontSize: '11px', color: '#9CA3AF', padding: '3px 0' }}>Incl. VAT</td>
                    <td align="right" style={{ fontFamily: font, fontSize: '11px', color: '#9CA3AF', padding: '3px 0' }}>{formatPrice(taxTotal, currency)}</td>
                  </tr>
                )}
                <tr>
                  <td colSpan={2} style={{ paddingTop: '8px' }}>
                    <div style={{ borderTop: '1px solid #E5E7EB' }}></div>
                  </td>
                </tr>
                <tr>
                  <td style={{ fontFamily: font, fontSize: '20px', fontWeight: 900, color: v.accent, padding: '10px 0 0' }}>TOTAL</td>
                  <td align="right" style={{ fontFamily: font, fontSize: '20px', fontWeight: 900, color: v.accent, padding: '10px 0 0' }}>{formatPrice(total, currency)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* ====== SHIPPING ADDRESS ====== */}
        {shippingAddress && (
          <>
            <Hr style={{ borderColor: '#E5E7EB', margin: `0 ${pad}` }} />
            <div style={{ padding: `16px ${pad} 20px` }}>
              <Text style={{
                fontFamily: font,
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase' as const,
                letterSpacing: '1.5px',
                color: v.accent,
                marginBottom: '10px',
              }}>
                📍 Shipping Address
              </Text>
              <Text style={{
                fontFamily: font,
                fontSize: '13px',
                color: '#374151',
                lineHeight: '1.7',
                margin: '0',
              }}>
                {shippingAddress.first_name} {shippingAddress.last_name}
                <br />
                {shippingAddress.address_1}
                {shippingAddress.address_2 ? <><br />{shippingAddress.address_2}</> : null}
                <br />
                {shippingAddress.postal_code} {shippingAddress.city}
                <br />
                {getCountryDisplay(shippingAddress.country_code)}
              </Text>
            </div>
          </>
        )}

        {/* ====== ACTION BUTTON ====== */}
        <div style={{ padding: `8px ${pad} 24px`, textAlign: 'center' as const }}>
          <Link href={orderUrl} style={{
            display: 'inline-block',
            backgroundColor: v.buttonBg,
            color: v.buttonText,
            fontFamily: font,
            fontSize: '14px',
            fontWeight: 700,
            textDecoration: 'none',
            padding: '14px 32px',
            borderRadius: '8px',
            letterSpacing: '0.5px',
          }}>
            View Order in Admin →
          </Link>
        </div>

        {/* ====== FOOTER ====== */}
        <div style={{
          backgroundColor: v.footerBg,
          padding: '28px',
          textAlign: 'center' as const,
        }}>
          <Text style={{
            fontFamily: font,
            fontSize: '13px',
            fontWeight: 700,
            color: v.footerAccent,
            margin: '0 0 6px',
          }}>
            {v.emoji} {v.name}
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '13px',
            color: v.footerText,
            lineHeight: '1.7',
            margin: '0 0 12px',
          }}>
            {v.closing}
          </Text>
          <Text style={{
            fontFamily: font,
            fontSize: '11px',
            color: v.footerText,
            lineHeight: '1.5',
            margin: '0',
            opacity: 0.7,
          }}>
            Admin notification · {projectName} · Variant #{variantIndex + 1}/10
          </Text>
        </div>
      </Section>
    </Base>
  )
}

AdminOrderNotificationTemplate.PreviewProps = {
  order: {
    id: 'order_01TEST123',
    display_id: '2084',
    metadata: { custom_order_number: 'NL2026-2084', project_id: 'dehondenbijbel' },
    created_at: new Date().toISOString(),
    email: 'jan@voorbeeld.nl',
    currency_code: 'eur',
    items: [
      {
        id: 'item-1',
        title: 'De Hondenbijbel',
        product_title: 'De Hondenbijbel',
        variant_title: 'Hardcover + E-book',
        quantity: 2,
        unit_price: 29.5,
        thumbnail: null,
      },
      {
        id: 'item-2',
        title: 'Laat Los Wat Je Kapotmaakt',
        product_title: 'Laat Los Wat Je Kapotmaakt',
        variant_title: 'DH Upsell',
        quantity: 1,
        unit_price: 25,
        thumbnail: null,
      },
    ],
    summary: {
      raw_current_order_total: { value: 84 },
      raw_shipping_total: { value: 0 },
      raw_tax_total: { value: 14.57 },
    },
  },
  shippingAddress: {
    first_name: 'Jan',
    last_name: 'de Groot',
    address_1: 'Prinsengracht 263',
    city: 'Amsterdam',
    postal_code: '1016 GV',
    country_code: 'nl',
  },
  paymentMethod: 'iDEAL',
  type: 'new_order',
  variantIndex: 0,
} as any

export default AdminOrderNotificationTemplate
