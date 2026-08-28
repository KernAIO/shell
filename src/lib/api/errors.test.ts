import { describe, expect, it } from 'vitest'
import { planLimitOf, reasonOf } from '$lib/api/errors'

/**
 * The shapes here are the ones the kernel actually produces — `kernErrorToORPC` folds `reason` into
 * `data` alongside `details`, so `{ reason, key, limit, wanted, plan }` is what
 * `entitlements.require` puts on the wire and `{ reason, module, plan }` is what `setEnabled` does.
 */
const seatsError = Object.assign(new Error("This workspace's plan includes 25 seats"), {
  code: 'CONFLICT',
  data: { reason: 'billing.seats.limit_reached', key: 'seats', limit: 25, wanted: 26, plan: 'Team' },
})

const moduleError = Object.assign(new Error('"hr" is not included in the Starter plan'), {
  code: 'CONFLICT',
  data: { reason: 'billing.modules.not_included', module: 'hr', plan: 'Starter' },
})

describe('reasonOf', () => {
  it('reads the code oRPC carries in data', () => {
    expect(reasonOf(seatsError)).toBe('billing.seats.limit_reached')
  })

  it('reads a KernError that never crossed the wire', () => {
    expect(reasonOf({ reason: 'core.invitation.expired' })).toBe('core.invitation.expired')
  })

  it('is null for anything without one', () => {
    expect(reasonOf(new Error('boom'))).toBeNull()
    expect(reasonOf(null)).toBeNull()
    expect(reasonOf(undefined)).toBeNull()
    expect(reasonOf('a string')).toBeNull()
    expect(reasonOf({ data: { reason: 42 } })).toBeNull()
  })
})

describe('planLimitOf', () => {
  it('recognises a seat limit and keeps the plan name', () => {
    expect(planLimitOf(seatsError)).toEqual({
      reason: 'billing.seats.limit_reached',
      plan: 'Team',
      module: null,
    })
  })

  it('recognises a module that is not in the plan, and says which', () => {
    expect(planLimitOf(moduleError)).toEqual({
      reason: 'billing.modules.not_included',
      plan: 'Starter',
      module: 'hr',
    })
  })

  it('recognises a storage limit', () => {
    const err = { data: { reason: 'billing.storage.limit_reached', key: 'storageBytes', limit: 1 } }
    expect(planLimitOf(err)?.reason).toBe('billing.storage.limit_reached')
  })

  it('leaves the plan null on an instance with no plans at all', () => {
    const err = { data: { reason: 'billing.seats.limit_reached', limit: 3, plan: null } }
    expect(planLimitOf(err)?.plan).toBeNull()
  })

  /*
   * The important negative. Every one of these is a CONFLICT too, and offering "See plans" for a
   * name that is taken or a role that is refused would teach people that the button means nothing.
   */
  it('is null for a refusal that is not about the plan', () => {
    expect(planLimitOf({ data: { reason: 'core.members.already_member' } })).toBeNull()
    expect(planLimitOf({ data: { reason: 'billing.subscription.inactive' } })).toBeNull()
    expect(planLimitOf(new Error('Seat limit reached'))).toBeNull()
    expect(planLimitOf(null)).toBeNull()
  })
})
