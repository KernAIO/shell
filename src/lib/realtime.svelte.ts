/**
 * The realtime singleton moved into `@kernhq/ui`.
 *
 * A module's screens read presence and badge counts from it, and a module cannot import the app —
 * so it lives in the framework, and the shell hands it the URL and the token at `connect()` rather
 * than the framework knowing what this application's env vars are called.
 *
 * `realtimeUrl()` is the app's half of that: the env var, and the same-origin default that makes
 * the dev proxy and the reverse proxy both work without configuration.
 */
import { browser } from '$app/environment'
import { env } from '$env/dynamic/public'

export { type ConnectionStatus, realtime } from '@kernhq/ui'

export function realtimeUrl(): string | null {
  if (!browser) return null
  return env.PUBLIC_WS_URL || `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`
}
