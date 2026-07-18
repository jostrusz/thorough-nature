/**
 * Ephemeral navigation queue shared between the ticket LIST and the ticket
 * DETAIL page — the SupportBox equivalent of Shopify's up/down order arrows.
 *
 * The list writes the ordered ticket IDs it is currently showing (respecting the
 * active filter + sort); the detail page reads them to power prev/next and
 * "solve → next".
 *
 * Why sessionStorage: the list's filters (config / status / project / search)
 * live in `useState`, not in the URL. When you open a ticket the list unmounts
 * and that context is gone, so the detail page has no way to reconstruct the
 * queue on its own. A per-tab snapshot is the least invasive way to carry the
 * ordered queue across the route change (no backend change, no routing change).
 *
 * The queue is a snapshot from the moment you were in the list — exactly what
 * you want for batch-processing a filtered inbox. It self-guards: if the current
 * ticket isn't in the stored queue (e.g. opened via a direct link), navigation
 * simply hides.
 */

const KEY = "supportbox:nav-queue"

export type NavQueue = { ids: string[]; savedAt: number }

/** List side: persist the ordered ticket IDs currently on screen. */
export function saveNavQueue(ids: string[]): void {
  try {
    if (!ids.length) return
    sessionStorage.setItem(KEY, JSON.stringify({ ids, savedAt: Date.now() }))
  } catch {
    /* sessionStorage unavailable (private mode / SSR) — arrows just stay hidden */
  }
}

function readNavQueue(): NavQueue | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    const q = JSON.parse(raw)
    return Array.isArray(q?.ids) ? q : null
  } catch {
    return null
  }
}

export type Neighbors = {
  index: number // 0-based position of the current ticket, -1 if not in queue
  total: number
  prevId: string | null // the ticket ABOVE — newer (↑)
  nextId: string | null // the ticket BELOW — older (↓)
}

/**
 * Detail side: locate the current ticket in the stored queue and expose its
 * neighbours. The list is sorted newest-first, so "up" = newer and "down" =
 * older, matching the visual order the operator sees.
 */
export function neighborsOf(currentId: string | undefined): Neighbors {
  const ids = readNavQueue()?.ids || []
  const index = currentId ? ids.indexOf(currentId) : -1
  return {
    index,
    total: ids.length,
    prevId: index > 0 ? ids[index - 1] : null,
    nextId: index >= 0 && index < ids.length - 1 ? ids[index + 1] : null,
  }
}
