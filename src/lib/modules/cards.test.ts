import { beforeEach, describe, expect, it, vi } from 'vitest'
import { type ModuleCardEntry, type RegisteredModule, selectModuleCards } from './cards'

/**
 * Settings → Modules, driven the way an administrator drives it.
 *
 * The screen is a list of cards with a switch on each, so the only question worth asking is whether
 * a person can reach a module and change it. Asserting that an array has a length would have passed
 * throughout the defect this file exists for: `entries` was the right length, it simply never
 * contained Chat.
 *
 * `fakeCore` is core's own behaviour, transcribed from a run rather than from its source — see the
 * measurement in `cards.ts`. Every case below goes through it, so a card that cannot be toggled or
 * survives a toggle wrongly fails here.
 */

/** What this shell registers. `chat`, `mail` and `collab` are hosted by their own services. */
const SHIPPED: RegisteredModule[] = [
  { id: 'core', name: 'Core', icon: 'settings' },
  { id: 'tracker', name: 'Tracker', icon: 'target' },
  { id: 'chat', name: 'Chat', icon: 'message-circle' },
  { id: 'hr', name: 'People', icon: 'users' },
  { id: 'mail', name: 'Mail', icon: 'mail' },
]

/** The modules the core *process* hosts, and so the only ones it holds a manifest for. */
const HOSTED = ['core', 'tracker', 'hr']

/**
 * A stand-in for `workspaces.modules.list` and `workspaces.modules.setEnabled`.
 *
 * It reproduces the two things that make this screen hard: core answers with the manifests of the
 * modules it hosts plus a row for anything else somebody has expressed an opinion about, and the
 * manifest it invents for that row names the module by its id with `defaultHost: 'unknown'`.
 */
function fakeCore() {
  const rows = new Map<string, boolean>()
  return {
    setEnabled: vi.fn((moduleId: string, enabled: boolean) => {
      rows.set(moduleId, enabled)
    }),
    list(): ModuleCardEntry[] {
      const out: ModuleCardEntry[] = HOSTED.map((id) => ({
        manifest: {
          id,
          name: id === 'hr' ? 'People' : id[0]!.toUpperCase() + id.slice(1),
          version: '0.4.0',
          description: `Everything ${id} does`,
          core: id === 'core',
          dependsOn: id === 'core' ? [] : ['core'],
          defaultHost: 'core',
          permissions: [{ key: `${id}.thing.view` }],
        },
        state: { enabled: id === 'core' || (rows.get(id) ?? true) },
      }))
      for (const [id, enabled] of rows)
        if (!HOSTED.includes(id))
          out.push({
            manifest: {
              id,
              name: id,
              version: '0.0.0',
              core: false,
              dependsOn: [],
              permissions: [],
              defaultHost: 'unknown',
            },
            state: { enabled },
          })
      return out
    },
  }
}

/** The screen: cards, and the one a person points at. */
const cardsOf = (core: ReturnType<typeof fakeCore>) => selectModuleCards(SHIPPED, core.list())
const cardFor = (core: ReturnType<typeof fakeCore>, id: string) =>
  cardsOf(core).find((c) => c.manifest.id === id)

/** What the switch on a card does, which is the whole of the interaction being tested. */
function toggle(core: ReturnType<typeof fakeCore>, id: string) {
  const card = cardFor(core, id)
  if (!card) throw new Error(`no card for "${id}" — an administrator cannot reach this module`)
  core.setEnabled(card.manifest.id, !card.state.enabled)
}

let core: ReturnType<typeof fakeCore>
beforeEach(() => {
  core = fakeCore()
})

describe('a module core does not host', () => {
  /**
   * The regression this file exists for. Chat had a live service, a rail item and a settings screen
   * that could not offer it, because the screen was built from core's list and core has no manifest
   * for a module another service hosts.
   */
  it('has a card an administrator can point at', () => {
    const chat = cardFor(core, 'chat')
    expect(chat, 'no Chat card — the module is in the rail and cannot be switched off').toBeDefined()
    expect(chat?.manifest.name).toBe('Chat')
    expect(chat?.manifest.icon).toBe('message-circle')
    expect(chat?.state.enabled, 'an absent row means enabled, so the switch starts on').toBe(true)
  })

  it('switches off through the same procedure every other module uses', () => {
    toggle(core, 'chat')
    expect(core.setEnabled).toHaveBeenCalledWith('chat', false)
  })

  it('is still switched off after core starts reporting it', () => {
    toggle(core, 'chat')
    const chat = cardFor(core, 'chat')
    expect(chat?.state.enabled, 'the switch snapped back — the write did not take').toBe(false)
  })

  it('keeps its name and icon once core answers with a placeholder', () => {
    // Core's `stubManifest` calls the module "chat" and gives it no icon, so reading its answer
    // straight would rename the card and blank it the moment somebody used the switch.
    toggle(core, 'chat')
    const chat = cardFor(core, 'chat')
    expect(chat?.manifest.name).toBe('Chat')
    expect(chat?.manifest.icon).toBe('message-circle')
  })

  it('claims no version rather than reporting core’s "0.0.0"', () => {
    toggle(core, 'chat')
    expect(cardFor(core, 'chat')?.manifest.version).toBeUndefined()
  })

  it('can be switched back on', () => {
    toggle(core, 'chat')
    toggle(core, 'chat')
    expect(core.setEnabled).toHaveBeenLastCalledWith('chat', true)
    expect(cardFor(core, 'chat')?.state.enabled).toBe(true)
  })
})

describe('the rest of the screen', () => {
  it('offers every module this shell ships', () => {
    expect(
      cardsOf(core)
        .map((c) => c.manifest.id)
        .sort(),
    ).toEqual(SHIPPED.map((m) => m.id).sort())
  })

  it('never lists a module twice, which would stop the page rendering', () => {
    // A duplicate `{#each}` key is a render error that looks exactly like loading — the failure
    // that left four admin screens on their skeletons when the mock listed `hr` twice.
    const ids = cardsOf(core).map((c) => c.manifest.id)
    expect(ids).toEqual([...new Set(ids)])
  })

  it('keeps a module core hosts that this shell does not ship', () => {
    // `KERN_EXTRA_MODULES` puts modules into core that were never compiled into this app. An
    // administrator must still be able to switch one off.
    const entries = [
      ...core.list(),
      {
        manifest: {
          id: 'recruiting',
          name: 'Recruiting',
          version: '1.0.0',
          core: false,
          defaultHost: 'core',
        },
        state: { enabled: true },
      },
    ]
    const card = selectModuleCards(SHIPPED, entries).find((c) => c.manifest.id === 'recruiting')
    expect(card?.manifest.name).toBe('Recruiting')
    expect(card?.state.enabled).toBe(true)
  })

  it('leaves a module core does host described by core', () => {
    const hr = cardFor(core, 'hr')
    expect(hr?.manifest.description).toBe('Everything hr does')
    expect(hr?.manifest.version).toBe('0.4.0')
    expect(hr?.fromClient).toBe(false)
  })

  it('switches off a module core does host, through the same handler', () => {
    toggle(core, 'hr')
    expect(core.setEnabled).toHaveBeenCalledWith('hr', false)
    expect(cardFor(core, 'hr')?.state.enabled).toBe(false)
  })

  it('draws the whole screen before the query resolves', () => {
    // `undefined` is "not loaded yet". Returning nothing here would render an empty settings screen
    // on every first paint, which reads as a workspace with no modules at all.
    const cards = selectModuleCards(SHIPPED, undefined)
    expect(cards.map((c) => c.manifest.id).sort()).toEqual(SHIPPED.map((m) => m.id).sort())
    expect(cards.every((c) => c.state.enabled)).toBe(true)
  })
})
