/**
 * The parts of two-factor authentication that are decisions rather than requests.
 *
 * Everything here is pure so it can be unit-tested: `$lib/auth/client` reaches `$env` and `$app`,
 * which vitest does not resolve, and the one thing in this flow most worth pinning is a predicate
 * that was wrong for as long as the flow existed.
 */

/**
 * Whether a sign-in stopped at a second factor.
 *
 * Better Auth answers a **correct** password on a 2FA account with HTTP 200, no session cookie and
 * `{ twoFactorRedirect: true }` — the pending factor is a success as far as the password goes, so
 * `error` is null. Reading it inside an error branch is therefore reading it never: that is how
 * `sign-in/+page.svelte` shipped a challenge page nothing could reach, from the day it was written
 * until 2026-09-05.
 */
export function twoFactorPending(result: { data?: unknown } | null | undefined): boolean {
  const data = result?.data
  if (!data || typeof data !== 'object') return false
  return (data as { twoFactorRedirect?: unknown }).twoFactorRedirect === true
}

/**
 * The shared secret out of an `otpauth://` URI, for the people who cannot point a camera at the
 * screen they are reading — an authenticator on the same machine, a phone with no camera, a
 * screen reader. Better Auth hands back the URI only, so the key has to be read out of it.
 */
export function secretFromTotpUri(uri: string): string | null {
  try {
    const secret = new URL(uri).searchParams.get('secret')
    return secret && secret.length > 0 ? secret : null
  } catch {
    return null
  }
}

/**
 * A base32 secret in groups of four.
 *
 * Thirty-two unbroken characters is a string nobody types correctly and nobody can read back to
 * somebody else; the grouping is cosmetic and every authenticator strips the spaces.
 */
export function groupSecret(secret: string, size = 4): string {
  return (secret.match(new RegExp(`.{1,${size}}`, 'g')) ?? []).join(' ')
}

/**
 * The enrolment `dev:mock` walks through.
 *
 * Mock mode has no auth server — `authDisabled()` is always true — so without this the *only*
 * environment the interface is developed, demoed and audited in shows a button that does nothing,
 * which is the defect this whole screen was rebuilt to remove. The secret is the one every TOTP
 * tutorial uses and the codes are fixed, so nothing here is a credential: it is demo data, and the
 * caller only reaches it when the mock is the backend.
 */
export const DEMO_TOTP_SECRET = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP'

export function demoTotpUri(email: string, issuer: string): string {
  const label = encodeURIComponent(`${issuer}:${email}`)
  const query = new URLSearchParams({
    secret: DEMO_TOTP_SECRET,
    issuer,
    algorithm: 'SHA1',
    digits: '6',
    period: '30',
  })
  return `otpauth://totp/${label}?${query}`
}

/** Ten codes in Better Auth's own shape (`xxxxx-xxxxx`), so the screen is laid out for the real ones. */
export function demoBackupCodes(): string[] {
  return [
    'k4m2q-7xbd9',
    'p9wla-3nzt6',
    'j5rcv-8fhq2',
    'm2xtb-6dnw4',
    'q7ghs-1kvp5',
    'z3fdn-9mcr8',
    'b6ptl-4wjx7',
    'v8kya-2qsm3',
    'c1nrw-5gbz9',
    'h4dme-7tvl6',
  ]
}
