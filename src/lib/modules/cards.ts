import { selectEnabled } from './enabled'

/**
 * What Settings → Modules offers a card for.
 *
 * `selectEnabled` decides which modules a workspace *has*; this decides which ones an administrator
 * can *change*, and the two have to cover the same set or a module appears in the rail with no way
 * to switch it off. They did not: the screen built its cards straight from
 * `workspaces.modules.list`, so Chat and Mail were visible and unswitchable on every instance.
 *
 * Measured against a real core on 2026-09-06 (scratch database, `startCore()`, one fresh workspace):
 * `workspaces.modules.list` answered `["core","tracker","quire","hr","billing","inventory","meet"]`
 * — the modules the core *process* hosts. `setEnabled({ moduleId: 'chat', enabled: false })` was
 * accepted and returned `{"moduleId":"chat","enabled":false,"installedVersion":null}`, and the next
 * `list` carried chat as an eighth entry. So the write is available before core has ever heard of
 * the module, which is what makes a synthesised card work: it is needed once per module per
 * workspace, and after that core reports the row.
 *
 * What core reports at that point is **not** a normal entry. Its `stubManifest` names the module by
 * its id — `"name":"chat"`, lower case — with `version: '0.0.0'`, no description, no icon and
 * `defaultHost: 'unknown'`. Left alone that renames the card from "Chat" to "chat" and empties it
 * the moment somebody switches the module off, so a placeholder is filled from the client module
 * the same way an absent one is.
 */

/** A module this shell has registered: `ClientModule`'s own identity fields. */
export interface RegisteredModule {
  id: string
  name: string
  icon?: string
}

/** The manifest fields the cards read. Structurally a subset of `ModuleManifest`. */
export interface ModuleCardManifest {
  id: string
  name: string
  /** Absent when nothing knows it — a module core does not host has no version to report. */
  version?: string
  description?: string
  icon?: string
  core: boolean
  dependsOn?: readonly string[]
  minKernel?: string
  permissions?: readonly unknown[]
  events?: readonly unknown[]
  objectTypes?: readonly unknown[]
  settingsSchema?: unknown
  /**
   * Who serves the module. `'unknown'` is the one value core never reads off a real manifest: it is
   * what `stubManifest` writes for a module it has a `workspace_modules` row for and nothing else.
   */
  defaultHost?: string
}

export interface ModuleCardEntry {
  manifest: ModuleCardManifest
  state: { enabled: boolean }
}

export interface ModuleCard extends ModuleCardEntry {
  /**
   * True when nothing but this shell knows what the module is called — core reported no manifest,
   * or the placeholder it writes for one it does not host.
   */
  fromClient: boolean
}

/** Whether core answered with the placeholder it writes for a module it does not host. */
const isPlaceholder = (manifest: ModuleCardManifest) => manifest.defaultHost === 'unknown'

/**
 * What the shell knows about a module from its client alone.
 *
 * `name` is the manifest literal (`'Chat'`), not `moduleDisplayName` — every other card on this
 * screen shows the untranslated manifest name, and one translated name among them would read as a
 * different kind of thing rather than as a nicety.
 */
const describe = (mod: RegisteredModule) => ({ id: mod.id, name: mod.name, icon: mod.icon })

/**
 * One card per module, from what core reports and what this shell ships.
 *
 * The switch position comes from `selectEnabled` for every module the shell registered — the same
 * call the rail is built from, so the two cannot disagree about a module — and from core's own
 * answer for a module the shell does not ship, which an instance can genuinely have:
 * `KERN_EXTRA_MODULES` puts modules into core that were never compiled into this app.
 */
export function selectModuleCards(
  registered: readonly RegisteredModule[],
  entries: readonly ModuleCardEntry[] | undefined,
): ModuleCard[] {
  const reported = entries ?? []
  const byId = new Map(registered.map((mod) => [mod.id, mod]))
  const on = selectEnabled(
    registered.map((mod) => mod.id),
    reported,
  )

  const cards: ModuleCard[] = reported.map((entry) => {
    const mod = byId.get(entry.manifest.id)
    if (!mod) return { ...entry, fromClient: false }
    const state = { ...entry.state, enabled: on.has(mod.id) }
    if (!isPlaceholder(entry.manifest)) return { manifest: entry.manifest, state, fromClient: false }
    return { manifest: { ...entry.manifest, ...describe(mod), version: undefined }, state, fromClient: true }
  })

  const seen = new Set(reported.map((entry) => entry.manifest.id))
  for (const mod of registered)
    if (!seen.has(mod.id)) {
      seen.add(mod.id)
      cards.push({
        manifest: { ...describe(mod), core: false, dependsOn: [] },
        state: { enabled: on.has(mod.id) },
        fromClient: true,
      })
    }

  // Two cards with one id is a duplicate `{#each}` key, which stops Svelte mid-paint and reads as a
  // screen that never finished loading rather than as a broken one. `registerModule` rejects a
  // repeated id and core cannot repeat one either, so this only fires on data neither of them
  // produced — but it is the failure that hid `hr` being listed twice in the mock, and the cost of
  // ruling it out here is one pass.
  return cards.filter((card, i) => cards.findIndex((c) => c.manifest.id === card.manifest.id) === i)
}
