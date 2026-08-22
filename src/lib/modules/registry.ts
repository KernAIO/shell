import type { SvelteClientModule as ClientModule, ClientNavItem, SlotName } from '@kernhq/ui'
import { chatClientModule } from './chat/client'
import { trackerClientModule } from './tracker/client'

/**
 * The client-side module registry.
 *
 * Modules are composed at build time: each one contributes navigation, routes, command-palette
 * actions and slot components, and the shell renders whatever is registered. Which modules a
 * workspace actually sees is decided at runtime by `workspaces.modules.list`, so an instance can ship
 * every module while a workspace turns off the ones it does not use.
 */
const modules: ClientModule[] = []

export function registerModule(mod: ClientModule) {
  if (modules.some((m) => m.id === mod.id)) return
  modules.push(mod)
}

export function allModules(): ClientModule[] {
  return modules
}

export function getModule(id: string): ClientModule | undefined {
  return modules.find((m) => m.id === id)
}

export interface NavContext {
  enabled: Set<string>
  can(permission: string): boolean
}

/** Navigation for the rail and sidebar: enabled modules only, filtered by permission. */
export function navigationFor(ctx: NavContext): Array<ClientNavItem & { moduleId: string }> {
  return modules
    .filter((m) => ctx.enabled.has(m.id))
    .flatMap((m) => (m.nav ?? []).map((item) => ({ ...item, moduleId: m.id })))
    .filter((item) => !item.permission || ctx.can(item.permission))
    .sort((a, b) => (a.order ?? 100) - (b.order ?? 100))
}

/**
 * Slot contributions from enabled modules.
 *
 * A slot is how a module puts something inside a part of the shell it does not own — the sidebar's
 * nav area, a tab on an object panel, an action on a chat message. The shell renders whatever is
 * contributed and knows nothing about who contributed it, which is what lets a workspace switch a
 * module off and have every trace of it disappear.
 */
export function slotsFor(slot: SlotName, ctx: NavContext & { pathname?: string }) {
  return modules
    .filter((mod) => ctx.enabled.has(mod.id))
    .flatMap((mod) =>
      (mod.slots ?? []).filter((s) => s.slot === slot).map((s) => ({ ...s, moduleId: mod.id })),
    )
    .filter((s) => !s.when || s.when({ pathname: ctx.pathname ?? '' } as never))
    .sort((a, b) => (a.order ?? 100) - (b.order ?? 100))
}

/** Command-palette actions contributed by enabled modules. */
export function commandsFor(ctx: NavContext) {
  return modules
    .filter((m) => ctx.enabled.has(m.id))
    .flatMap((m) => (m.commands ?? []).map((c) => ({ ...c, moduleId: m.id })))
    .filter((c) => !c.permission || ctx.can(c.permission))
}

// Composition happens here, at build time. Importing a module's client and registering it is the only
// wiring the shell needs: navigation, commands, presenters and routes all follow from the manifest.
registerModule(trackerClientModule)
registerModule(chatClientModule)
