import { createTrackerClient, type TrackerApi } from '@kernhq/module-tracker/client'
import { browser } from '$app/environment'
import { env } from '$env/dynamic/public'
import { isMock } from '$lib/api/client'
import { createMockTrackerApi } from './mock'

/**
 * The tracker API client.
 *
 * A module is reached at `/api/<module>`, so every module gets its own client built from its own
 * contract; this is the tracker's, alongside `getApi()` for core. `PUBLIC_API_MOCK=1` swaps in the
 * in-memory implementation from `./mock`, which satisfies the same contract types, so no view has a
 * second code path for demos and end-to-end tests.
 */
export type { TrackerApi }

let cached: TrackerApi | null = null

export function getTrackerApi(): TrackerApi {
  if (cached) return cached
  cached = isMock() ? (createMockTrackerApi() as unknown as TrackerApi) : createReal()
  return cached
}

function createReal(): TrackerApi {
  return createTrackerClient({
    // empty base URL keeps requests same-origin: the dev server proxies /api, and in production the
    // reverse proxy routes it, so the session cookie works without CORS in both
    baseUrl: env.PUBLIC_API_URL || (browser ? window.location.origin : 'http://localhost:4000'),
  })
}

/** Test seam: lets tests install a fake without touching module state elsewhere. */
export function __setTrackerApi(api: TrackerApi | null) {
  cached = api
}
