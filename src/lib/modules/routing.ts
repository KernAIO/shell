import type { SvelteClientRoute } from '@kernhq/ui'
import { hasCapability } from './capabilities'
import { allModules } from './registry'

/** One resolved module route: the declaration, who declared it, and what is left of the path. */
export interface ResolvedModuleRoute {
  route: SvelteClientRoute
  moduleId: string
  /** path segments after the matched prefix — the module page's own params */
  rest: string[]
  /** values of the `:name` segments the declaration matched */
  params: Record<string, string>
}

/**
 * Route resolution for module-declared pages.
 *
 * Modules declare their screens in the client manifest (`routes:`); this resolves a URL's segments
 * after `/<workspace>` against those declarations. A path no enabled module claims is `undefined`,
 * and the caller renders the app's own 404.
 *
 * A declaration may name parameters: `/quire/:space/:page` matches `/quire/eng/getting-started` and
 * hands the component `{ space: 'eng', page: 'getting-started' }`.
 *
 * **Specificity, not length, decides.** `/quire/:space` and `/quire/settings` both match
 * `/quire/settings`, and the literal has to win — otherwise a space called "settings" would shadow
 * a real page, which is the kind of bug that only appears once a customer names something
 * unfortunately. So the winner is the declaration with the most literal segments, and length breaks
 * the tie.
 *
 * The same filters as every other contribution (`navigationFor`, `widgetsFor`, …): a disabled
 * module or switched-off capability resolves to nothing here, and a permission the person lacks
 * likewise. The server answers those API calls with 404 either way, so the two halves agree.
 */
export function resolveModuleRoute(
  segments: string[],
  opts: {
    enabled: Set<string>
    capabilities?: Set<string>
    can: (permission: string) => boolean
    /** which settings pages to resolve; module `routes` are always considered */
    scope?: 'workspace' | 'instance'
  },
): ResolvedModuleRoute | undefined {
  const wantScope = opts.scope ?? 'workspace'
  let best: ResolvedModuleRoute | undefined
  /** How specific a match is: literal segments first, then total length. */
  let bestScore = -1

  const consider = (
    moduleId: string,
    path: string,
    decl: Pick<SvelteClientRoute, 'component' | 'permission' | 'capability'>,
  ) => {
    const parts = path.split('/').filter(Boolean)
    if (segments.length < parts.length) return

    const params: Record<string, string> = {}
    let literals = 0
    for (const [i, part] of parts.entries()) {
      if (part.startsWith(':')) {
        // A parameter matches one segment and never an empty one: `/quire/:space` must not claim
        // `/quire`, or the spaces index would render as a space with no key.
        const value = segments[i]
        if (!value) return
        params[part.slice(1)] = value
        continue
      }
      if (segments[i] !== part) return
      literals++
    }

    if (decl.permission && !opts.can(decl.permission)) return
    if (!hasCapability(opts.capabilities, moduleId, decl.capability)) return

    const score = literals * 1000 + parts.length
    if (score <= bestScore) return
    bestScore = score
    best = { route: { path, ...decl }, moduleId, rest: segments.slice(parts.length), params }
  }

  for (const mod of allModules()) {
    // Instance pages belong to the console, not to a workspace, so they survive a module the
    // current workspace has switched off. Everything else is filtered on it.
    if (wantScope !== 'instance' && !opts.enabled.has(mod.id)) continue
    for (const route of mod.routes ?? []) consider(mod.id, route.path, route)
    // A declared workspace settings page is mounted at its conventional URL
    // (`/settings/<moduleId>[/<pageId>]`) — declaring it is enough, exactly as the settings
    // navigation already treats it. The `id === moduleId` page is the module's main settings
    // screen and lives one level up; anything else nests below.
    for (const p of mod.settingsPages ?? []) {
      if (p.scope !== wantScope) continue
      if (p.scope === 'instance') {
        // The console is not about a workspace, so an instance page is never filtered on which
        // modules this workspace enabled — `instanceLinksFor` offers it either way, and a link the
        // console shows must resolve. The admin layout gates the whole area on the instance-admin
        // flag, which is the check that matters here.
        consider(mod.id, `/admin/${mod.id}/${p.id}`, { ...p, capability: undefined })
        continue
      }
      consider(mod.id, p.id === mod.id ? `/settings/${mod.id}` : `/settings/${mod.id}/${p.id}`, p)
    }
  }
  return best
}
