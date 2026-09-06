import { describe, expect, it } from 'vitest'
import { type ModuleListEntry, selectEnabled } from './enabled'

const entry = (id: string, enabled: boolean): ModuleListEntry => ({
  manifest: { id },
  state: { enabled },
})

/** What this shell registers. `chat`, `mail` and `collab` are hosted by their own services. */
const SHIPPED = ['core', 'tracker', 'chat', 'quire', 'hr', 'mail', 'billing', 'inventory']

/** What real `core` can report: its own manifests, and nothing about the three it does not host. */
const CORE_REPORTS = [
  entry('core', true),
  entry('tracker', true),
  entry('quire', true),
  entry('hr', true),
  entry('billing', true),
  entry('inventory', true),
]

describe('which modules a workspace has on', () => {
  /**
   * The regression this exists for.
   *
   * Chat and Mail were invisible on every instance — no rail item, and not listed on the settings
   * screen that could have enabled them, because that screen reads the same list. The shell was
   * treating "core did not mention it" as "off", when core has no opinion about a module it does
   * not host.
   */
  it('keeps a module core does not host, because an absent row means nobody switched it off', () => {
    const on = selectEnabled(SHIPPED, CORE_REPORTS)
    expect(on.has('chat'), 'chat vanished — the defect this test exists for').toBe(true)
    expect(on.has('mail')).toBe(true)
    expect([...on].sort()).toEqual([...SHIPPED].sort())
  })

  it('still obeys an administrator who switched one off', () => {
    // A disabled module HAS a row, and core returns rows even for modules it cannot see — so this
    // is the case that separates "off" from "unmentioned", and the whole rule turns on it.
    const on = selectEnabled(SHIPPED, [...CORE_REPORTS, entry('chat', false)])
    expect(on.has('chat')).toBe(false)
    expect(on.has('mail'), 'unmentioned is not the same as off').toBe(true)
  })

  it('obeys it for a module core does host, too', () => {
    const on = selectEnabled(SHIPPED, [
      ...CORE_REPORTS.slice(1),
      entry('core', true),
      entry('tracker', false),
    ])
    expect(on.has('tracker')).toBe(false)
  })

  it('never invents a module this shell does not ship', () => {
    const on = selectEnabled(SHIPPED, [...CORE_REPORTS, entry('recruiting', true)])
    expect(on.has('recruiting'), 'a module the shell cannot render must not appear in the rail').toBe(false)
  })

  it('answers before the query resolves without hiding everything', () => {
    // undefined is "not loaded yet", not "nothing is on". Returning an empty set here would blank
    // the rail on every first paint.
    expect([...selectEnabled(SHIPPED, undefined)].sort()).toEqual([...SHIPPED].sort())
  })
})
