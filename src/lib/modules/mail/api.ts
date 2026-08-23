import { createMailClient, type MailApi } from '@kernhq/module-mail/client'
import { browser } from '$app/environment'
import { env } from '$env/dynamic/public'
import { isMock } from '$lib/api/client'
import { createMockMailApi } from './mock'

/**
 * The mail API client.
 *
 * Mail runs in its own service because it holds provider connections and a delivery queue, but its
 * REST surface is reached like any other module's: `/api/mail`, same origin, same session cookie.
 * The dev server proxies the prefix to 4200 and Caddy does the same in production.
 *
 * `PUBLIC_API_MOCK=1` swaps in the in-memory implementation, which satisfies the same contract
 * types, so the settings screen has no second code path for demos and end-to-end tests.
 */
export type { MailApi }

let cached: MailApi | null = null

export function getMailApi(): MailApi {
  if (cached) return cached
  cached = isMock()
    ? (createMockMailApi() as unknown as MailApi)
    : createMailClient({
        baseUrl: env.PUBLIC_API_URL || (browser ? window.location.origin : 'http://localhost:4200'),
      })
  return cached
}

/** Test seam: lets tests install a fake without touching module state elsewhere. */
export function __setMailApi(api: MailApi | null) {
  cached = api
}
