import { describe, expect, it } from 'vitest'
import { capabilitiesOf, hasCapability } from './capabilities'

const entry = (id: string, capabilities?: string[]) => ({
  manifest: { id },
  state: capabilities ? { capabilities } : {},
})

describe('capabilitiesOf', () => {
  it('namespaces each capability by its module', () => {
    const set = capabilitiesOf([entry('hr', ['core', 'leave']), entry('tracker', ['sla'])])
    expect([...set].sort()).toEqual(['hr.core', 'hr.leave', 'tracker.sla'])
  })

  it('does not collide when two modules name a capability the same', () => {
    const set = capabilitiesOf([entry('hr', ['reports']), entry('tracker', ['reports'])])
    expect(set.has('hr.reports')).toBe(true)
    expect(set.has('tracker.reports')).toBe(true)
    expect(set.size).toBe(2)
  })

  it('is empty for modules that declare none', () => {
    expect(capabilitiesOf([entry('chat'), entry('mail')]).size).toBe(0)
  })

  it('survives a state with no capabilities field at all', () => {
    // Every module published before capabilities existed answers this way.
    expect(() => capabilitiesOf([{ manifest: { id: 'chat' }, state: {} }])).not.toThrow()
  })
})

describe('hasCapability', () => {
  const on = new Set(['hr.leave'])

  it('passes a contribution that names no capability', () => {
    expect(hasCapability(on, 'chat')).toBe(true)
    expect(hasCapability(undefined, 'chat')).toBe(true)
  })

  it('passes when the workspace has it', () => {
    expect(hasCapability(on, 'hr', 'leave')).toBe(true)
  })

  it('fails when the workspace does not', () => {
    expect(hasCapability(on, 'hr', 'attendance')).toBe(false)
  })

  it('does not match another module with the same capability id', () => {
    expect(hasCapability(on, 'tracker', 'leave')).toBe(false)
  })

  it('fails closed when no set was supplied', () => {
    // The instance console passes no capabilities — there is no workspace to ask. A page that names
    // one anyway must not be offered there.
    expect(hasCapability(undefined, 'hr', 'leave')).toBe(false)
  })
})
