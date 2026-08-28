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

/**
 * Only an address a browser will actually navigate to, and never one that runs code.
 *
 * These come from the environment, so an operator can already put anything in them — but a typo
 * should fail visibly rather than silently, and `javascript:` in an `href` an anonymous visitor is
 * invited to click is the one shape worth refusing outright. Anything that is not http(s) is treated
 * as unset, which is the same as not configuring it: the link is not drawn.
 */
function externalUrl(value: string | undefined): string | null {
  const raw = value?.trim()
  if (!raw) return null
  try {
    const url = new URL(raw)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null
  } catch {
    return null
  }
}

/**
 * The instance's terms of service and privacy policy, if it has published any.
 *
 * An instance setting rather than a Kern-wide constant: every deployment is somebody else's, so the
 * documents a person consents to at sign-up are the operator's, not ours. It is a `PUBLIC_*` variable
 * for the same reason `PUBLIC_INSTANCE_NAME` is — the screen that needs it is the one screen nobody
 * is signed in on, so it cannot come from an API call behind a session.
 *
 * **Both are optional and unset is the default.** A self-hosted instance for one team has no terms
 * to point at, and inventing a link to a page nobody wrote is worse than showing none; the caller
 * draws whichever exist and nothing when neither does.
 *
 * The demo configures both, and that is not decoration. `dev:mock` is the environment the interface
 * is developed, demoed and swept in, so an instance-configured element that is absent there is one
 * `tests/e2e/ux.spec.ts` never renders — and a rule that judges nothing reports nothing. Leaving
 * them out would have shipped the two links without anything ever having measured their contrast,
 * their target size, or how they wrap in Persian.
 */
const DEMO_LEGAL = {
  terms: 'https://example.test/terms',
  privacy: 'https://example.test/privacy',
}

export function legalLinks(): { terms: string | null; privacy: string | null } {
  const demo = isMock() ? DEMO_LEGAL : { terms: undefined, privacy: undefined }
  return {
    terms: externalUrl(env.PUBLIC_TERMS_URL || demo.terms),
    privacy: externalUrl(env.PUBLIC_PRIVACY_URL || demo.privacy),
  }
}

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
