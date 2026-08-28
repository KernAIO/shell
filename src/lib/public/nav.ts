import type { PublicNavEntry } from '@kernhq/module-quire/client'

/**
 * The site's table of contents, rebuilt from the flat list `public.site` answers with.
 *
 * Flat on the wire for the same reason `pages.tree` is: one request draws every level, and a docs
 * sidebar shows every level at once. Addressed by `path` rather than by id, because the whole
 * public surface carries no ids — a nav entry, a breadcrumb, a search hit and a sitemap line are
 * all `path`, and there is nothing in any of them anybody can try somewhere else.
 *
 * An entry whose `parentPath` names nothing in the list is lifted to the top rather than dropped:
 * a page is never invisible because of where it happens to sit. The server prunes rather than
 * filters, so that should not happen — but a sidebar that silently loses a page is a worse failure
 * than one that shows it in the wrong place.
 */
export interface PublicNavNode extends PublicNavEntry {
  children: PublicNavNode[]
}

export function buildPublicNav(entries: readonly PublicNavEntry[]): PublicNavNode[] {
  const byPath = new Map<string, PublicNavNode>(
    entries.map((entry) => [entry.path, { ...entry, children: [] }]),
  )
  const roots: PublicNavNode[] = []
  for (const node of byPath.values()) {
    const parent = node.parentPath === null ? undefined : byPath.get(node.parentPath)
    if (parent) parent.children.push(node)
    else roots.push(node)
  }
  return roots
}

/**
 * Every ancestor of `path`, so a branch containing the open page is drawn open.
 *
 * Derived from the path rather than from the tree because it can be: a nested page's address *is*
 * its ancestors' slugs joined with `/`, which is what makes `guide/install` open `guide` without a
 * second lookup. The front page (`''`) has no ancestors and is its own entry.
 */
export function ancestorPaths(path: string): Set<string> {
  const out = new Set<string>([''])
  const segments = path.split('/').filter((segment) => segment.length > 0)
  let at = ''
  for (const segment of segments) {
    at = at === '' ? segment : `${at}/${segment}`
    out.add(at)
  }
  return out
}
