// @ts-nocheck
/**
 * Jobs run in-process (fire-and-forget), so a Railway deploy restart kills
 * them mid-flight and they'd sit "running" forever. Every job touches
 * updated_at on each step, so anything running/queued with no update for
 * 20+ minutes is dead — sweep it to "failed" with a retry hint.
 */
const STALE_MS = 20 * 60 * 1000

export async function sweepStaleJobs(svc: any) {
  try {
    const stuck = await svc.listAdLocalizationJobs(
      { status: ["queued", "running"] }, { take: 50 }
    )
    const now = Date.now()
    for (const j of stuck) {
      const at = new Date(j.updated_at).getTime()
      if (now - at < STALE_MS) continue
      const steps = (j.steps || []).map((s: any) =>
        s.status === "running" || s.status === "queued"
          ? { ...s, status: "failed", detail: "přerušeno restartem serveru (deploy)" } : s)
      await svc.updateAdLocalizationJobs({
        id: j.id, status: "failed", steps,
        error: "Generování přerušil restart serveru při deployi — klikni ↻ Zkusit znovu.",
      })
      console.warn(`[Ads Library] stale job ${j.id} swept to failed (no update for ${Math.round((now - at) / 60000)} min)`)
    }
  } catch (e: any) {
    console.warn(`[Ads Library] stale sweep failed: ${e.message}`)
  }
}
