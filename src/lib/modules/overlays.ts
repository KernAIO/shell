import type { SvelteOverlayContribution } from '@kernhq/ui'
import { hasCapability } from './capabilities'

/**
 * Which overlays a workspace mounts, and in what order.
 *
 * Kept apart from `registry.ts` for the same reason `segment.ts` and `capabilities.ts` are: the
 * registry imports every module's client, and those reach `$msg` and their own `.svelte` files, so
 * vitest cannot load it — the import fails during transform, before the first assertion. Taking the
 * module list as an argument is what makes the selection testable; `overlaysFor` in the registry
 * passes the real one.
 */

/** A module, narrowed to the two fields this needs. */
export interface OverlayModule {
  id: string
  overlays?: SvelteOverlayContribution[]
}

export interface OverlaySelection {
  enabled: ReadonlySet<string>
  capabilities?: ReadonlySet<string>
  can(permission: string): boolean
}

export interface SelectedOverlay extends SvelteOverlayContribution {
  moduleId: string
}

/**
 * The same three filters as the sidebar — an enabled module, a permission held, a capability the
 * workspace switched on — and no fourth: an overlay claims no path, because outliving the route is
 * the whole reason it exists.
 *
 * Sorted by module and then by id so the order two overlays stack in is a property of the registry
 * rather than of whichever module happened to register first.
 */
export function selectOverlays(modules: readonly OverlayModule[], ctx: OverlaySelection): SelectedOverlay[] {
  return modules
    .filter((mod) => ctx.enabled.has(mod.id))
    .flatMap((mod) => (mod.overlays ?? []).map((o) => ({ ...o, moduleId: mod.id })))
    .filter((o) => !o.permission || ctx.can(o.permission))
    .filter((o) => hasCapability(ctx.capabilities, o.moduleId, o.capability))
    .sort((a, b) => a.moduleId.localeCompare(b.moduleId) || a.id.localeCompare(b.id))
}
