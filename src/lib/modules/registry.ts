import type {
  SvelteClientModule as ClientModule,
  ClientNavItem,
  SvelteSidebarContribution,
  SvelteWidgetDefinition,
} from '@kernhq/ui'

import { hasCapability } from './capabilities'

export { capabilitiesOf } from './capabilities'
export { segmentOf } from './segment'

import { billingClientModule } from './billing/client'
import { chatClientModule } from './chat/client'
import { coreClientModule } from './core/client'
import { mailClientModule } from './mail/client'
import { quireClientModule } from './quire/client'
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
  /**
   * Capabilities this workspace has on, as `<moduleId>.<capabilityId>`.
   *
   * Optional because most call sites predate capabilities and every module without them is
   * unaffected either way: a contribution that declares no `capability` is never filtered on one.
   * Where it *is* passed, it must be the set the server resolved — the same answer
   * `requiresCapability` enforces — or the shell offers a row whose API answers 404.
   */
  capabilities?: Set<string>
  can(permission: string): boolean
}

/** Navigation for the rail and sidebar: enabled modules only, filtered by permission. */
export function navigationFor(ctx: NavContext): Array<ClientNavItem & { moduleId: string }> {
  return modules
    .filter((m) => ctx.enabled.has(m.id))
    .flatMap((m) => (m.nav ?? []).map((item) => ({ ...item, moduleId: m.id })))
    .filter((item) => !item.permission || ctx.can(item.permission))
    .filter((item) => hasCapability(ctx.capabilities, item.moduleId, item.capability))
    .sort((a, b) => (a.order ?? 100) - (b.order ?? 100))
}

export interface SidebarEntry extends SvelteSidebarContribution {
  moduleId: string
}

/**
 * The sidebar for a path, from the modules that own it.
 *
 * The rail switches modules and the sidebar holds the one you are in (DESIGN.md 2.3), so this asks
 * which modules claim the first path segment and hands them the column. `''` is the home sidebar,
 * where several modules each contribute a group.
 *
 * The segment is compared exactly. The previous version of this gated on
 * `pathname.includes('/chat')`, which also fires for a workspace whose slug is `chat` — and for any
 * route that merely contains the word.
 */
export function sidebarsFor(ctx: NavContext & { segment: string }): SidebarEntry[] {
  return modules
    .filter((mod) => ctx.enabled.has(mod.id))
    .flatMap((mod) => (mod.sidebar ?? []).map((s) => ({ ...s, moduleId: mod.id })))
    .filter((s) => s.match.includes(ctx.segment))
    .filter((s) => !s.permission || ctx.can(s.permission))
    .filter((s) => hasCapability(ctx.capabilities, s.moduleId, s.capability))
    .sort((a, b) => (a.order ?? 100) - (b.order ?? 100) || a.id.localeCompare(b.id))
}

export interface WidgetEntry extends SvelteWidgetDefinition {
  moduleId: string
  moduleName: string
}

/**
 * Every dashboard widget the person may place.
 *
 * Same filter as navigation and the sidebar — an enabled module, and a permission they hold — which
 * is what makes a widget disappear from the picker *and* from a layout that already named it when a
 * workspace switches its module off, with no conditional on the dashboard.
 */
export function widgetsFor(ctx: NavContext): WidgetEntry[] {
  return modules
    .filter((mod) => ctx.enabled.has(mod.id))
    .flatMap((mod) => (mod.widgets ?? []).map((w) => ({ ...w, moduleId: mod.id, moduleName: mod.name })))
    .filter((w) => !w.permission || ctx.can(w.permission))
    .filter((w) => hasCapability(ctx.capabilities, w.moduleId, w.capability))
    .sort((a, b) => (a.order ?? 100) - (b.order ?? 100) || a.id.localeCompare(b.id))
}

/**
 * One widget by id, for drawing a layout stored earlier.
 *
 * Returning `undefined` is ordinary, not an error: a saved layout can name a widget from a module
 * since switched off, uninstalled, or renamed between releases. The frame says so and offers to
 * remove it — never a blank card, never a crash.
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
    .filter((c) => hasCapability(ctx.capabilities, c.moduleId, c.capability))
}

// Composition happens here, at build time. Importing a module's client and registering it is the only
// wiring the shell needs: navigation, commands, presenters and routes all follow from the manifest.
// Core first: it is always enabled, and its widgets are the ones every workspace has.
registerModule(coreClientModule)
registerModule(trackerClientModule)
registerModule(chatClientModule)
registerModule(quireClientModule)
registerModule(mailClientModule)
registerModule(billingClientModule)

export interface ModuleSettingsLink {
  moduleId: string
  moduleName: string
  id: string
  label: string
  icon?: string
  permission?: string
  capability?: string
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
 *
 * For the same reason an instance page must not declare a `capability`: capabilities are a
 * workspace's choice, and there is no workspace here to ask. One declared anyway is filtered out,
 * which is the safe direction but a silent one — do not do it.
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
          capability: p.capability,
          order: p.order ?? 100,
        })),
    )
    .filter((link) => !link.permission || ctx.can(link.permission))
    .filter((link) => hasCapability(ctx.capabilities, link.moduleId, link.capability))
    .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label))
}
