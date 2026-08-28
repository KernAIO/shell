import { describe, expect, it } from 'vitest'
import { planLimitOf, reasonOf, suspensionOf } from '$lib/api/errors'

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

/**
 * The other half of the same feature. `Entitlements.requireActive` gates every non-GET
 * workspace-scoped procedure, so this reason can arrive from anywhere — which is exactly why it
 * needs its own sentence rather than the generic conflict toast a suspended workspace used to get.
 */
describe('suspensionOf', () => {
  const suspended = Object.assign(
    new Error('This workspace is suspended because its subscription is not current'),
    { code: 'CONFLICT', data: { reason: 'billing.subscription.inactive', plan: 'Team' } },
  )

  it('recognises the suspension gate and keeps the plan name', () => {
    expect(suspensionOf(suspended)).toEqual({ plan: 'Team' })
  })

  it('reads a KernError that never crossed the wire', () => {
    expect(suspensionOf({ reason: 'billing.subscription.inactive' })).toEqual({ plan: null })
  })

  it('leaves the plan null on an instance with no plans at all', () => {
    expect(suspensionOf({ data: { reason: 'billing.subscription.inactive', plan: null } })).toEqual({
      plan: null,
    })
  })

  /*
   * The mirror of the negative above, and it matters for the same reason. Suspension is the one
   * refusal that says "everything is read-only", so offering to reactivate after a name clash or a
   * refused role would be a far bigger lie than offering a plan page.
   */
  it('is null for a refusal that is not the suspension gate', () => {
    expect(suspensionOf({ data: { reason: 'core.members.already_member' } })).toBeNull()
    expect(suspensionOf({ data: { reason: 'billing.seats.limit_reached' } })).toBeNull()
    expect(suspensionOf(new Error('This workspace is suspended'))).toBeNull()
    expect(suspensionOf(null)).toBeNull()
  })

  /** A plan limit is never a suspension and a suspension is never a plan limit. */
  it('does not overlap with planLimitOf', () => {
    expect(planLimitOf(suspended)).toBeNull()
    expect(suspensionOf(seatsError)).toBeNull()
    expect(suspensionOf(moduleError)).toBeNull()
  })
})
