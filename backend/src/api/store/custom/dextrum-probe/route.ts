import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import net from "net"

/**
 * Public diagnostic endpoint — NO AUTH.
 * GET /store/custom/dextrum-probe
 *
 * Returns:
 *  - egress_ip: outbound IP of Railway container as seen by ipify
 *  - probes[]: TCP connect test results for wmsint.dextrum.cz:443 and :9341
 *
 * Use when Dextrum claims our IP is whitelisted but SYN still times out,
 * so we can show them the exact source IP + target + outcome.
 */

const HOST = "wmsint.dextrum.cz"
const PORTS = [443, 9341]
const TIMEOUT_MS = 8000

function probeTcp(host: string, port: number): Promise<{ port: number; ok: boolean; ms: number; error?: string }> {
  return new Promise((resolve) => {
    const start = Date.now()
    const socket = new net.Socket()
    let done = false
    const finish = (ok: boolean, error?: string) => {
      if (done) return
      done = true
      try { socket.destroy() } catch {}
      resolve({ port, ok, ms: Date.now() - start, error })
    }
    socket.setTimeout(TIMEOUT_MS)
    socket.once("connect", () => finish(true))
    socket.once("timeout", () => finish(false, `timeout after ${TIMEOUT_MS}ms`))
    socket.once("error", (err: any) => finish(false, `${err.code || err.name}: ${err.message}`))
    socket.connect(port, host)
  })
}

export async function GET(_req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const out: any = {
    host: HOST,
    timestamp: new Date().toISOString(),
  }

  // Egress IP
  try {
    const r = await fetch("https://api.ipify.org?format=json")
    const j = (await r.json()) as { ip: string }
    out.egress_ip = j.ip
  } catch (err: any) {
    out.egress_ip_error = err?.message || String(err)
  }

  // Probe both ports in parallel
  out.probes = await Promise.all(PORTS.map((p) => probeTcp(HOST, p)))

  res.json(out)
}
