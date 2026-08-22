import { type CoreClient, createCoreClient } from '@kernalo/sdk'
import { browser } from '$app/environment'
import { env } from '$env/dynamic/public'
import { createMockApi } from './mock'

/**
 * The Kern API client.
 *
 * In development and in production the app talks to the core service over oRPC; `PUBLIC_API_MOCK=1`
 * swaps in an in-memory implementation with demo data so the interface can be developed, demoed and
 * tested without a backend. Both satisfy the same generated contract type, so there is no separate
 * code path in the UI.
 */
export type Api = CoreClient

let cached: Api | null = null

export const isMock = () => env.PUBLIC_API_MOCK === '1' || env.PUBLIC_API_MOCK === 'true'

export function getApi(): Api {
  if (cached) return cached
  cached = isMock() ? (createMockApi() as unknown as Api) : createRealClient()
  return cached
}

function createRealClient(): Api {
  return createCoreClient({
    // empty base URL keeps requests same-origin: the dev server proxies /api to core, and in
    // production Caddy routes it, so cookies work without CORS in both.
    baseUrl: env.PUBLIC_API_URL || (browser ? window.location.origin : 'http://localhost:4000'),
    onUnauthorized: () => {
      if (!browser) return
      const next = encodeURIComponent(window.location.pathname + window.location.search)
      if (!window.location.pathname.startsWith('/sign-in')) window.location.href = `/sign-in?next=${next}`
    },
  })
}

/** Test seam: lets tests install a fake without touching module state elsewhere. */
export function __setApi(api: Api | null) {
  cached = api
}
