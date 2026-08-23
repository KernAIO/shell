import { type BillingApi, createBillingClient } from '@kernhq/module-billing/client'
import { browser } from '$app/environment'
import { env } from '$env/dynamic/public'
import { isMock } from '$lib/api/client'
import { createMockBillingApi } from './mock'

/**
 * The billing API client.
 *
 * Billing is hosted by core, so `/api/billing` is the same origin and the same session cookie as
 * everything else. `PUBLIC_API_MOCK=1` swaps in the in-memory implementation from `./mock`, which
 * satisfies the same contract types, so no view has a second code path for demos and end-to-end
 * tests — with one deliberate hole: the demo's checkout and billing portal throw rather than
 * pretending, because the one thing a demo must never imply is that money moved.
 */
export type { BillingApi }

let cached: BillingApi | null = null

export function getBillingApi(): BillingApi {
  if (cached) return cached
  if (isMock()) {
    cached = createMockBillingApi()
    return cached
  }
  cached = createBillingClient({
    // empty base URL keeps requests same-origin: the dev server proxies /api, and in production the
    // reverse proxy routes it, so the session cookie works without CORS in both
    baseUrl: env.PUBLIC_API_URL || (browser ? window.location.origin : 'http://localhost:4000'),
  })
  return cached
}

/** Test seam: lets tests install a fake without touching module state elsewhere. */
export function __setBillingApi(api: BillingApi | null) {
  cached = api
}
