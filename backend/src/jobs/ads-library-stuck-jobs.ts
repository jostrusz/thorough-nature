// @ts-nocheck
import { ADS_LIBRARY_MODULE } from "../modules/ads-library"

/**
 * Localization/Studio jobs run fire-and-forget inside the API process. A deploy
 * (or any restart) kills them mid-flight and they stay "running" forever, so
 * the UI spins indefinitely. Mark anything stalled as failed with a clear
 * reason — the user can then just hit generate again.
 *
 * Threshold is generous: a 4-variant book-swap job with retries can legitimately
 * take ~10 minutes.
 */
const STALL_MINUTES = Number(process.env.ADS_JOB_STALL_MINUTES || 15)

export default async function adsLibraryStuckJobs({ container }) {
  const svc = container.resolve(ADS_LIBRARY_MODULE)
  const cutoff = new Date(Date.now() - STALL_MINUTES * 60_000)

  const stuck = await svc.listAdLocalizationJobs(
    { status: ["queued", "running"] },
    { take: 50, order: { created_at: "ASC" } }
  )
  const dead = stuck.filter((j: any) => new Date(j.updated_at || j.created_at) < cutoff)
  if (!dead.length) return

  for (const j of dead) {
    const msg = `job byl přerušen (restart serveru nebo výpadek) — spusť generování znovu`
    const steps = (j.steps || []).map((s: any) =>
      s.status === "running" || s.status === "queued" ? { ...s, status: "failed", detail: "přerušeno" } : s)
    await svc.updateAdLocalizationJobs({ id: j.id, status: "failed", error: msg, steps })
    if (j.result_creative_id) {
      try {
        const [c] = await svc.listAdCreatives({ id: j.result_creative_id })
        await svc.updateAdCreatives({
          id: j.result_creative_id,
          metadata: { ...(c?.metadata || {}), generating: false, failed: msg },
        })
      } catch {}
    }
  }
  console.log(`[Ads Library] uvolněno ${dead.length} zaseknutých jobů (>${STALL_MINUTES} min)`)
}

export const config = {
  name: "ads-library-stuck-jobs",
  schedule: "*/5 * * * *",
}
