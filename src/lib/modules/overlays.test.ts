import type { AnyComponent } from '@kernhq/ui'
import { describe, expect, it } from 'vitest'
import { type OverlayModule, selectOverlays } from './overlays'

/** Never rendered here — the selection is what is under test, not the component it names. */
const component = () => Promise.resolve({ default: {} as AnyComponent })

const mod = (
  id: string,
  overlays?: Array<{ id: string; permission?: string; capability?: string }>,
): OverlayModule => ({
  id,
  overlays: overlays?.map((o) => ({ ...o, component })),
})

const ctx = (over: Partial<Parameters<typeof selectOverlays>[1]> = {}) => ({
  enabled: new Set(['meet', 'chat']),
  can: () => true,
  ...over,
})

const ids = (modules: OverlayModule[], over = {}) =>
  selectOverlays(modules, ctx(over)).map((o) => `${o.moduleId}.${o.id}`)

describe('selectOverlays', () => {
  it('returns nothing for a module the workspace has switched off', () => {
    const modules = [mod('meet', [{ id: 'call' }])]
    expect(ids(modules, { enabled: new Set<string>() })).toEqual([])
    expect(ids(modules)).toEqual(['meet.call'])
  })

  it('ignores a module that declares no overlays', () => {
    expect(ids([mod('chat'), mod('meet', [{ id: 'call' }])])).toEqual(['meet.call'])
  })

  it('drops a contribution whose permission the person does not hold', () => {
    const modules = [mod('meet', [{ id: 'call', permission: 'meet.call.join' }])]
    expect(ids(modules, { can: (p: string) => p === 'meet.call.join' })).toEqual(['meet.call'])
    expect(ids(modules, { can: () => false })).toEqual([])
  })

  it('keeps a contribution that names no permission', () => {
    expect(ids([mod('meet', [{ id: 'call' }])], { can: () => false })).toEqual(['meet.call'])
  })

  it('drops a contribution whose capability the workspace has off', () => {
    const modules = [mod('meet', [{ id: 'call', capability: 'calls' }])]
    expect(ids(modules, { capabilities: new Set(['meet.calls']) })).toEqual(['meet.call'])
    expect(ids(modules, { capabilities: new Set(['meet.rooms']) })).toEqual([])
  })

  it('drops a contribution that names a capability when no set was resolved at all', () => {
    // The guard that keeps a module inert in a workspace that predates it: `isEnabled` answers
    // `row?.enabled ?? true`, so the module is on everywhere the night it rolls out, and this is
    // what stops the shell mounting anything before an administrator switches the capability on.
    expect(ids([mod('meet', [{ id: 'call', capability: 'calls' }])])).toEqual([])
  })

  it('namespaces the capability by module, so two modules naming it the same do not collide', () => {
    const modules = [
      mod('meet', [{ id: 'call', capability: 'calls' }]),
      mod('chat', [{ id: 'huddle', capability: 'calls' }]),
    ]
    expect(ids(modules, { capabilities: new Set(['meet.calls']) })).toEqual(['meet.call'])
  })

  it('orders by module then by id, whatever order the modules registered in', () => {
    const modules = [
      mod('meet', [{ id: 'ring' }, { id: 'bar' }]),
      mod('chat', [{ id: 'zeta' }, { id: 'alpha' }]),
    ]
    expect(ids(modules)).toEqual(['chat.alpha', 'chat.zeta', 'meet.bar', 'meet.ring'])
  })

  it('does not filter on a path, which is what lets an overlay outlive the route', () => {
    // `sidebarsFor` takes a `segment` and matches on it; this deliberately takes none, so the same
    // selection holds on every page of the workspace.
    const modules = [mod('meet', [{ id: 'call' }])]
    expect(ids(modules)).toEqual(selectOverlays(modules, ctx()).map((o) => `${o.moduleId}.${o.id}`))
    expect(Object.keys(ctx())).not.toContain('segment')
  })

  it('carries the contribution through untouched apart from its module id', () => {
    const selected = selectOverlays(
      [mod('meet', [{ id: 'call', permission: 'meet.call.join', capability: 'calls' }])],
      ctx({ capabilities: new Set(['meet.calls']) }),
    )
    expect(selected).toHaveLength(1)
    expect(selected[0]).toMatchObject({
      moduleId: 'meet',
      id: 'call',
      permission: 'meet.call.join',
      capability: 'calls',
    })
    expect(typeof selected[0]?.component).toBe('function')
  })
})
