import { createQuireClient, type QuireApi } from '@kernhq/module-quire/client'
import { browser } from '$app/environment'
import { env } from '$env/dynamic/public'
import { isMock } from '$lib/api/client'
import { createMockQuireApi } from './mock'

/**
 * This module's API client.
 *
 * An empty base URL keeps requests same-origin, so the dev proxy and the reverse proxy both work
 * without CORS. `PUBLIC_API_MOCK=1` swaps in the in-memory implementation, which satisfies the same
 * contract types — so no screen has a second code path for demos and end-to-end tests.
 */
export type { QuireApi }

let cached: QuireApi | null = null

export function getQuireApi(): QuireApi {
  if (cached) return cached
  cached = isMock() ? (createMockQuireApi() as unknown as QuireApi) : createQuireClient({
    baseUrl: env.PUBLIC_API_URL || (browser ? window.location.origin : 'http://localhost:4000'),
  })
  return cached
}

/** Test seam. */
export function __setQuireApi(api: QuireApi | null) {
  cached = api
}
