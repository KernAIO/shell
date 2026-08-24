import { createHrClient, type HrApi } from '@kernhq/module-hr/client'
import { browser } from '$app/environment'
import { env } from '$env/dynamic/public'
import { isMock } from '$lib/api/client'
import { createMockHrApi } from './mock'

/**
 * This module's API client.
 *
 * An empty base URL keeps requests same-origin, so the dev proxy and the reverse proxy both work
 * without CORS. `PUBLIC_API_MOCK=1` swaps in the in-memory implementation, which satisfies the same
 * contract types — so no screen has a second code path for demos and end-to-end tests.
 */
export type { HrApi }

let cached: HrApi | null = null

export function getHrApi(): HrApi {
  if (cached) return cached
  cached = isMock() ? (createMockHrApi() as unknown as HrApi) : createHrClient({
    baseUrl: env.PUBLIC_API_URL || (browser ? window.location.origin : 'http://localhost:4000'),
  })
  return cached
}

/** Test seam. */
export function __setHrApi(api: HrApi | null) {
  cached = api
}
