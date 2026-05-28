// @ts-nocheck
import { Pool, type PoolConfig } from "pg"

/**
 * Module-level singleton pg.Pool reused across requests.
 *
 * Per-request `new Pool(...) + pool.end()` adds 500-1500ms of connection /
 * teardown overhead on every call (Railway DB is reached over TLS even when
 * the app runs in the same region). A persistent pool keeps connections
 * warm and brings most direct-pg endpoints from ~1s to <50ms.
 *
 * Use this for read-heavy admin/store routes that bypass MedusaService and
 * talk to Postgres directly (joins, aggregations, jsonb queries).
 */
let pool: Pool | null = null

export function getSharedPgPool(overrides: Partial<PoolConfig> = {}): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30_000,
      ...overrides,
    })
    pool.on("error", (err) => {
      console.error("[pg-pool] idle client error", err)
    })
  }
  return pool
}
