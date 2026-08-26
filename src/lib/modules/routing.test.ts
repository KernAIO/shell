import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * `routing.ts` reaches the registry, which imports every module and the message runtime — none of
 * which a unit test can load. Mocking the one function it calls keeps the resolver testable without
 * refactoring the registry.
 */
const modules: Array<Record<string, unknown>> = []
vi.mock('./registry', () => ({ allModules: () => modules }))

const { resolveModuleRoute } = await import('./routing')

const ALLOW = () => true
const component = () => Promise.resolve({ default: {} }) as never

beforeEach(() => {
  modules.length = 0
  modules.push({
    id: 'hr',
    routes: [
      { path: '/hr/offices', component, permission: 'hr.office.view', capability: 'offices' },
      { path: '/hr', component, permission: 'hr.person.view' },
    ],
  })
})

const resolve = (path: string, capabilities: Set<string>, can: (p: string) => boolean = ALLOW) =>
  resolveModuleRoute(path.split('/').filter(Boolean), {
    enabled: new Set(['hr']),
    capabilities,
    can,
  })

describe('resolveModuleRoute', () => {
  it('resolves a route whose capability is on', () => {
    const found = resolve('/hr/offices', new Set(['hr.offices']))
    expect(found?.route.path).toBe('/hr/offices')
  })

  /**
   * The bug this file exists for.
   *
   * `/hr` is a prefix of `/hr/offices`, and the resolver allowed a prefix match with the leftover
   * segments handed to the page as `rest`. So switching the `offices` capability off did not make
   * `/hr/offices` a 404 — it silently rendered the people directory *at that URL*, with the browser
   * tab still saying Offices. A gate that turns a page into a different page is worse than one that
   * does nothing: the person sees a real screen and believes it is the one they asked for.
   */
  it('answers not-found when the exact route is gated off, rather than falling back to its prefix', () => {
    expect(resolve('/hr/offices', new Set(['hr.core']))).toBeUndefined()
  })

  it('does the same when the permission is what rejects it', () => {
    const found = resolve('/hr/offices', new Set(['hr.offices']), (p) => p !== 'hr.office.view')
    expect(found).toBeUndefined()
  })

  it('still falls through for a path no declaration claims exactly', () => {
    // `/hr/anything` is not declared, so the module's own root page answers — that is the
    // sub-path behaviour, and it is unaffected.
    expect(resolve('/hr/anything', new Set(['hr.core']))?.route.path).toBe('/hr')
  })

  it('gives the module root back when the root itself is asked for', () => {
    expect(resolve('/hr', new Set(['hr.core']))?.route.path).toBe('/hr')
  })
})
