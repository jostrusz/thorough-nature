// @ts-nocheck
/**
 * Process-wide cap on concurrent image generations.
 *
 * Every localization job is fired the moment it is queued, so a bulk run of 20
 * cards used to hit Gemini with 20 parallel requests. The model allows 20
 * requests per minute, and a single image takes 60-150 s, so the burst blew the
 * quota and came back as a wall of 429s — jobs failed while still being billed
 * for the tokens already spent.
 *
 * A slot is held for the whole call, so at most `LIMIT` images are ever in
 * flight no matter which route asked (localize, retry-images, studio). The
 * queue is FIFO, so cards finish roughly in the order they were submitted
 * instead of all crawling forward together.
 */
const LIMIT = Math.max(1, Number(process.env.ADS_IMAGE_CONCURRENCY) || 5)

let active = 0
const waiting: Array<() => void> = []

export function imageSlots() {
  return { limit: LIMIT, active, queued: waiting.length }
}

export async function withImageSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (active >= LIMIT) {
    // resolved by whoever hands its slot over — `active` already counts us then
    await new Promise<void>((resolve) => waiting.push(resolve))
  } else {
    active++
  }
  try {
    return await fn()
  } finally {
    // Hand the slot straight to the next waiter instead of decrementing first.
    // Decrementing would open a gap that a freshly arriving caller could take
    // before the woken waiter resumes, putting two calls in one slot.
    const next = waiting.shift()
    if (next) next()
    else active--
  }
}
