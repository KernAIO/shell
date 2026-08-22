import type { SvelteClientModule as ClientModule, ClientNavItem } from '@kernaio/ui'

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

/** Command-palette actions contributed by enabled modules. */
export function commandsFor(ctx: NavContext) {
  return modules
    .filter((m) => ctx.enabled.has(m.id))
    .flatMap((m) => (m.commands ?? []).map((c) => ({ ...c, moduleId: m.id })))
    .filter((c) => !c.permission || ctx.can(c.permission))
}
