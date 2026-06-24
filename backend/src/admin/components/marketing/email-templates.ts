// @ts-nocheck
/**
 * email-templates.ts — ready-made starting points for the campaign builder.
 *
 * Each template is expressed as a list of blocks (the same shape the visual
 * Block Builder edits — see email-blocks.tsx). Choosing a template fills the
 * editor with blocks, which then compile to the responsive `custom_html` that
 * is actually sent.
 *
 * Placeholders honoured downstream by the dispatcher:
 *   {{ first_name }}      — personalisation (falls back via |default filter)
 *   {{ unsubscribe_url }} — required by compliance footer / one-click unsub
 *
 * Keep everything inline-CSS + table-friendly; no external assets required.
 */

import type { EmailBlock } from "./email-blocks"

export type EmailTemplate = {
  id: string
  name: string
  description: string
  icon: string
  /** Factory so every insert gets fresh block ids. */
  build: () => EmailBlock[]
}

let _seq = 0
function bid(): string {
  _seq += 1
  return `blk_${Date.now().toString(36)}_${_seq.toString(36)}`
}

/** Welcome — warm intro for a new subscriber. */
function welcomeBlocks(): EmailBlock[] {
  return [
    { id: bid(), type: "heading", text: "Welcome, {{ first_name|default:\"friend\" }} 👋" },
    {
      id: bid(),
      type: "text",
      text:
        "We're so glad you're here. You just joined a community of readers who decided to make a change — and that already says a lot about you.",
    },
    {
      id: bid(),
      type: "text",
      text:
        "Over the next few days we'll share the ideas that help people most. No fluff, just what works. Keep an eye on your inbox.",
    },
    { id: bid(), type: "button", text: "Read your first chapter", url: "https://" },
    { id: bid(), type: "spacer", size: 24 },
    {
      id: bid(),
      type: "text",
      text: "Talk soon,\nThe team",
    },
  ]
}

/** Promo / Offer — single clear offer with CTA. */
function promoBlocks(): EmailBlock[] {
  return [
    { id: bid(), type: "heading", text: "A little something for you, {{ first_name|default:\"there\" }}" },
    {
      id: bid(),
      type: "text",
      text:
        "For the next 48 hours you can get the book at a special price. It's the lowest we offer all year — a good moment to finally start.",
    },
    {
      id: bid(),
      type: "image",
      url: "https://via.placeholder.com/560x280?text=Your+product",
      alt: "Product",
      width: 560,
    },
    { id: bid(), type: "button", text: "Claim your discount", url: "https://" },
    { id: bid(), type: "divider" },
    {
      id: bid(),
      type: "text",
      text: "*Offer ends in 48 hours. One per customer.*",
    },
  ]
}

/** Newsletter — a few short sections + read-more. */
function newsletterBlocks(): EmailBlock[] {
  return [
    { id: bid(), type: "heading", text: "This week's letter" },
    {
      id: bid(),
      type: "text",
      text: "Hi {{ first_name|default:\"there\" }}, here's what we've been thinking about.",
    },
    { id: bid(), type: "divider" },
    { id: bid(), type: "heading", text: "The one idea worth keeping", level: 2 },
    {
      id: bid(),
      type: "text",
      text:
        "Most change doesn't come from doing more — it comes from letting go of one thing that drains you. Pick that one thing this week.",
    },
    { id: bid(), type: "button", text: "Read the full story", url: "https://" },
    { id: bid(), type: "spacer", size: 16 },
    { id: bid(), type: "divider" },
    {
      id: bid(),
      type: "text",
      text: "Until next week,\nThe team",
    },
  ]
}

/** Announcement — short, focused, one CTA. */
function announcementBlocks(): EmailBlock[] {
  return [
    { id: bid(), type: "heading", text: "Big news 🎉" },
    {
      id: bid(),
      type: "text",
      text:
        "We've got something new to share with you, {{ first_name|default:\"friend\" }} — and we couldn't wait to tell you first.",
    },
    {
      id: bid(),
      type: "image",
      url: "https://via.placeholder.com/560x300?text=Announcement",
      alt: "Announcement",
      width: 560,
    },
    {
      id: bid(),
      type: "text",
      text: "Here's everything you need to know in one click.",
    },
    { id: bid(), type: "button", text: "See what's new", url: "https://" },
  ]
}

/** Plain text-style — minimal, personal, no images. Best deliverability. */
function plainBlocks(): EmailBlock[] {
  return [
    {
      id: bid(),
      type: "text",
      text: "Hi {{ first_name|default:\"there\" }},",
    },
    {
      id: bid(),
      type: "text",
      text:
        "I wanted to write you a quick personal note. No graphics, no buttons — just a real message, the way a friend would send it.",
    },
    {
      id: bid(),
      type: "text",
      text:
        "If this resonates, just hit reply and let me know. I read every response.",
    },
    {
      id: bid(),
      type: "text",
      text: "Warmly,\nThe author",
    },
  ]
}

export const EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    id: "welcome",
    name: "Welcome",
    description: "Warm intro for a new subscriber",
    icon: "👋",
    build: welcomeBlocks,
  },
  {
    id: "promo",
    name: "Promo / Offer",
    description: "One clear offer with a strong CTA",
    icon: "🏷️",
    build: promoBlocks,
  },
  {
    id: "newsletter",
    name: "Newsletter",
    description: "A few short sections + read-more",
    icon: "📰",
    build: newsletterBlocks,
  },
  {
    id: "announcement",
    name: "Announcement",
    description: "Short, focused, single CTA",
    icon: "📣",
    build: announcementBlocks,
  },
  {
    id: "plain",
    name: "Plain text-style",
    description: "Minimal & personal — best deliverability",
    icon: "✉️",
    build: plainBlocks,
  },
]
