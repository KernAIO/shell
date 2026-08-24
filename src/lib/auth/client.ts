import { passkeyClient } from '@better-auth/passkey/client'
import { magicLinkClient, multiSessionClient, twoFactorClient } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/svelte'
import { browser } from '$app/environment'
import { env } from '$env/dynamic/public'
import { isMock } from '../api/client'

/**
 * Better Auth client. Requests go to the core service, same-origin in development (through the Vite
 * proxy) and in production (through Caddy), so session cookies work without CORS.
 */
export const auth = createAuthClient({
  baseURL: env.PUBLIC_API_URL || (browser ? window.location.origin : 'http://localhost:4000'),
  basePath: '/api/auth',
  plugins: [magicLinkClient(), twoFactorClient(), passkeyClient(), multiSessionClient()],
})

/** Social providers this instance offers, configured with PUBLIC_AUTH_PROVIDERS. */
export function socialProviders(): Array<'google' | 'github' | 'microsoft'> {
  return (env.PUBLIC_AUTH_PROVIDERS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(
      (s): s is 'google' | 'github' | 'microsoft' => s === 'google' || s === 'github' || s === 'microsoft',
    )
}

export const instanceName = () => env.PUBLIC_INSTANCE_NAME || 'Kern'

/** In mock mode there is no auth server, so the app behaves as if the demo user is signed in. */
export const authDisabled = () => isMock()

export async function signOut() {
  if (authDisabled()) {
    if (browser) window.location.href = '/sign-in'
    return
  }
  await auth.signOut()
  if (browser) window.location.href = '/sign-in'
}

/**
 * Where a successful sign-in lands.
 *
 * A deep link the user was bounced from wins — they asked for that page. Otherwise the workspace
 * chooser decides: it forwards straight through when there is one workspace (or none), and asks
 * when there are several, which is the one moment a person actually knows which one they want.
 */
export const CHOOSE_WORKSPACE = '/workspaces'
export const landingFor = (next: string) => (next === '/' ? CHOOSE_WORKSPACE : next)
