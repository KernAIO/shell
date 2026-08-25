import type { SvelteClientRoute } from '@kernhq/ui'
import { hasCapability } from './capabilities'
import { allModules } from './registry'

/** One resolved module route: the declaration, who declared it, and what is left of the path. */
export interface ResolvedModuleRoute {
  route: SvelteClientRoute
  moduleId: string
  /** path segments after the matched prefix — the module page's own params */
  rest: string[]
}

/**
 * Route resolution for module-declared pages.
 *
 * Modules declare their screens in the client manifest (`routes:`); this resolves a URL's segments
 * after `/<workspace>` against those declarations — longest prefix wins, so `/tracker/reports/x`
 * resolves tracker's `/tracker/reports` and hands it `['x']`. A path no enabled module claims is
 * `undefined`, and the caller renders the app's own 404.
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
  },
): ResolvedModuleRoute | undefined {
  let best: ResolvedModuleRoute | undefined
  const consider = (
    moduleId: string,
    path: string,
    decl: Pick<SvelteClientRoute, 'component' | 'permission' | 'capability'>,
  ) => {
    const parts = path.split('/').filter(Boolean)
    if (segments.length < parts.length) return
    if (!parts.every((p, i) => segments[i] === p)) return
    if (decl.permission && !opts.can(decl.permission)) return
    if (!hasCapability(opts.capabilities, moduleId, decl.capability)) return
    // Longest declaration wins regardless of which module made it; ties are impossible in
    // practice (two modules claiming one segment would be a collision the shell cannot render).
    if (!best || parts.length > best.route.path.split('/').filter(Boolean).length) {
      best = { route: { path, ...decl }, moduleId, rest: segments.slice(parts.length) }
    }
  }

  for (const mod of allModules()) {
    if (!opts.enabled.has(mod.id)) continue
    for (const route of mod.routes ?? []) consider(mod.id, route.path, route)
    // A declared workspace settings page is mounted at its conventional URL
    // (`/settings/<moduleId>[/<pageId>]`) — declaring it is enough, exactly as the settings
    // navigation already treats it. The `id === moduleId` page is the module's main settings
    // screen and lives one level up; anything else nests below.
    for (const p of mod.settingsPages ?? []) {
      if (p.scope !== 'workspace') continue
      consider(mod.id, p.id === mod.id ? `/settings/${mod.id}` : `/settings/${mod.id}/${p.id}`, p)
    }
  }
  return best
}
