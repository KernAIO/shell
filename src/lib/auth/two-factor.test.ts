import { describe, expect, it } from 'vitest'
import { demoTotpUri, groupSecret, secretFromTotpUri, twoFactorPending } from './two-factor.js'

describe('twoFactorPending', () => {
  it('is true for the answer Better Auth gives a correct password on a 2FA account', () => {
    // 200, no session, and `error: null` — which is why this cannot be read inside an error branch
    expect(twoFactorPending({ data: { twoFactorRedirect: true, twoFactorMethods: ['totp'] } })).toBe(true)
  })

  it('is false for an ordinary successful sign-in', () => {
    expect(twoFactorPending({ data: { user: { id: 'u1' }, token: 'session' } })).toBe(false)
  })

  it('is false for a refusal, and for nothing at all', () => {
    expect(twoFactorPending({ data: null })).toBe(false)
    expect(twoFactorPending(null)).toBe(false)
    expect(twoFactorPending(undefined)).toBe(false)
  })

  it('does not accept a truthy value that is not the flag', () => {
    expect(twoFactorPending({ data: { twoFactorRedirect: 'yes' } })).toBe(false)
  })
})

describe('secretFromTotpUri', () => {
  it('reads the shared secret out of the URI Better Auth returns', () => {
    const uri = 'otpauth://totp/Kern:someone@example.com?secret=JBSWY3DPEHPK3PXP&issuer=Kern'
    expect(secretFromTotpUri(uri)).toBe('JBSWY3DPEHPK3PXP')
  })

  it('answers null rather than throwing when there is no secret to show', () => {
    expect(secretFromTotpUri('otpauth://totp/Kern:someone@example.com?issuer=Kern')).toBeNull()
    expect(secretFromTotpUri('not a uri')).toBeNull()
    expect(secretFromTotpUri('')).toBeNull()
  })

  it('reads back the secret in the demo URI, so dev:mock shows a real key', () => {
    expect(secretFromTotpUri(demoTotpUri('someone@example.com', 'Kern'))).toHaveLength(32)
  })
})

describe('groupSecret', () => {
  it('breaks the key into fours', () => {
    expect(groupSecret('JBSWY3DPEHPK3PXP')).toBe('JBSW Y3DP EHPK 3PXP')
  })

  it('leaves a short last group alone', () => {
    expect(groupSecret('ABCDE')).toBe('ABCD E')
  })

  it('has nothing to do with an empty key', () => {
    expect(groupSecret('')).toBe('')
  })
})

describe('demoTotpUri', () => {
  it('is a URI an authenticator would accept', () => {
    const uri = demoTotpUri('kaveh@example.com', 'Kern')
    expect(uri.startsWith('otpauth://totp/')).toBe(true)
    const params = new URL(uri).searchParams
    expect(params.get('issuer')).toBe('Kern')
    expect(params.get('digits')).toBe('6')
    expect(params.get('period')).toBe('30')
  })
})
