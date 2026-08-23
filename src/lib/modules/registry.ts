import type {
  SvelteClientModule as ClientModule,
  ClientNavItem,
  SlotName,
  SvelteWidgetDefinition,
} from '@kernhq/ui'
import { billingClientModule } from './billing/client'
import { chatClientModule } from './chat/client'
import { coreClientModule } from './core/client'
import { mailClientModule } from './mail/client'
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

export interface WidgetEntry extends SvelteWidgetDefinition {
  moduleId: string
  moduleName: string
}

/**
 * Every dashboard widget the person may place.
 *
 * Same filter as navigation and slots — an enabled module, and a permission they hold — which is
 * what makes a widget disappear from the picker *and* from a layout that already named it when a
 * workspace switches its module off, with no conditional on the dashboard itself.
 */
export function widgetsFor(ctx: NavContext): WidgetEntry[] {
  return modules
    .filter((mod) => ctx.enabled.has(mod.id))
    .flatMap((mod) => (mod.widgets ?? []).map((w) => ({ ...w, moduleId: mod.id, moduleName: mod.name })))
    .filter((w) => !w.permission || ctx.can(w.permission))
    .sort((a, b) => (a.order ?? 100) - (b.order ?? 100) || a.id.localeCompare(b.id))
}

/**
 * One widget by id, for drawing a layout that was stored earlier.
 *
 * Returning `undefined` is the normal case, not an error: a saved layout can name a widget from a
 * module that has since been switched off, uninstalled, or renamed between releases. The frame
 * draws "no longer available" with a way to remove it — never a blank card, and never a crash.
 */
export function widgetById(id: string, ctx: NavContext): WidgetEntry | undefined {
  return widgetsFor(ctx).find((w) => w.id === id)
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
// Core first: it is always enabled, and its widgets are the ones every workspace has.
registerModule(coreClientModule)
registerModule(trackerClientModule)
registerModule(chatClientModule)
registerModule(mailClientModule)
registerModule(billingClientModule)

export interface ModuleSettingsLink {
  moduleId: string
  moduleName: string
  id: string
  label: string
  icon?: string
  permission?: string
  order: number
}

/**
 * Where each enabled module is configured.
 *
 * A module declares its settings pages; the route is conventional
 * (`/<workspace>/settings/<module>/<id>`), so the shell can offer them without a module having to
 * mount pages of its own. Filtered by permission, like every other navigation: somebody who cannot
 * manage fields does not see the entry rather than meeting a page that refuses them.
 */
export function settingsLinksFor(ctx: NavContext): ModuleSettingsLink[] {
  return pagesForScope(
    'workspace',
    modules.filter((m) => ctx.enabled.has(m.id)),
    ctx,
  )
}

/**
 * Pages a module contributes to the **instance console**.
 *
 * Not filtered by which modules a workspace has enabled, because the console is not about a
 * workspace: an operator looking at what every workspace is billed must still see the screen when
 * the workspace they happen to be standing in has that module switched off. The console's layout
 * gates the whole area on the instance-admin flag, which is the check that matters here.
 */
export function instanceLinksFor(ctx: Pick<NavContext, 'can'>): ModuleSettingsLink[] {
  return pagesForScope('instance', modules, { enabled: new Set(), can: ctx.can })
}

function pagesForScope(
  scope: 'workspace' | 'instance',
  from: ClientModule[],
  ctx: NavContext,
): ModuleSettingsLink[] {
  return from
    .flatMap((m) =>
      (m.settingsPages ?? [])
        .filter((p) => p.scope === scope)
        .map((p) => ({
          moduleId: m.id,
          moduleName: m.name,
          id: p.id,
          label: p.label,
          icon: p.icon,
          permission: p.permission,
          order: p.order ?? 100,
        })),
    )
    .filter((link) => !link.permission || ctx.can(link.permission))
    .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label))
}
