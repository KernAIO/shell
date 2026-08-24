/**
 * Which sub-features of a module this workspace has on.
 *
 * A module is the coarse switch and a capability is the one below it: a workspace that uses HR for
 * a staff directory and nothing else turns `attendance` off, and every nav row, widget, command and
 * settings page behind it disappears — rather than being greyed out, or worse, being offered and
 * then refused by the API.
 *
 * Kept apart from `registry.ts` for the same reason `segment.ts` is: the registry imports every
 * module's client, which reaches `$msg`, and a module that imports `$msg` cannot be unit-tested —
 * SvelteKit's aliases come from a plugin vitest does not run, so the import fails before the first
 * assertion.
 */

/** What `workspaces.modules.list` returns, narrowed to the two fields this needs. */
export interface ModuleStateEntry {
  manifest: { id: string }
  state: { capabilities?: string[] }
}

/**
 * The capability set for a workspace, as `<moduleId>.<capabilityId>`.
 *
 * Namespaced here and nowhere else. A module declares `capability: 'attendance'` against itself,
 * because from inside a module there is only one namespace; the shell holds every module's at once
 * and needs `hr.attendance` to keep them apart.
 *
 * Read from `state.capabilities`, which the **server** resolved — defaults applied, `required`
 * forced on, anything whose dependency is off pruned. Deriving it again from raw settings here
 * would be a second implementation of that closure, and two implementations eventually disagree.
 * The way that disagreement shows up is a menu item whose API answers 404.
 */
export function capabilitiesOf(entries: readonly ModuleStateEntry[]): Set<string> {
  const out = new Set<string>()
  for (const entry of entries)
    for (const id of entry.state.capabilities ?? []) out.add(`${entry.manifest.id}.${id}`)
  return out
}

/**
 * Does this workspace have the capability a contribution asked for?
 *
 * A contribution with no `capability` always passes — that is every contribution written before
 * capabilities existed, and every one belonging to a module that declares none. A contribution that
 * *does* name one when the shell was given no set at all does not pass: an unanswered question about
 * a feature's availability resolves to "not available", because the other direction offers a screen
 * the server will refuse.
 */
export function hasCapability(
  capabilities: ReadonlySet<string> | undefined,
  moduleId: string,
  capability?: string,
): boolean {
  if (!capability) return true
  return capabilities?.has(`${moduleId}.${capability}`) ?? false
}
