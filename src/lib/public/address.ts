/**
 * Where a published page sits, in this application's URL space.
 *
 * The module decides the shape — `publicSiteBasePath` in `@kernhq/module-quire/client` is the only
 * definition of a publication's address, and this route exists to match it. What is here is the two
 * things that definition deliberately leaves to whatever renders the site: SvelteKit resolves
 * `/p/acme/handbook/` to `/p/acme/handbook` (the default `trailingSlash: 'never'`), so the base
 * this file builds carries no trailing slash and every link built from it is the canonical one; and
 * a page's address inside the publication is a `path` the server invented from titles, so joining
 * the two is the only place a link between two published pages is made.
 *
 * Kept free of imports so a `.svelte` component can use it: everything a browser needs to draw the
 * site is passed down from the server load, and nothing in the public route pulls the Quire client
 * into the client bundle.
 */

/** `/p/<workspace>/<publication>` — no trailing slash, both segments already encoded. */
export function publicBasePath(workspace: string, publication: string): string {
  return `/p/${encodeURIComponent(workspace)}/${encodeURIComponent(publication)}`
}

/**
 * The `basePath` argument `public.page` rewrites the page's inter-page links against.
 *
 * It has to start *and end* with a slash, and its segments have to be unreserved characters only —
 * the contract refuses anything else, and the refusal is the point: `//evil.example/` is a
 * protocol-relative URL wearing the costume of a local path, and a caller who could set it would
 * repoint every link on somebody's published site.
 */
export function publicLinkBase(basePath: string): string {
  return `${basePath}/`
}

/** A page's address: the front page is the base itself, everything else hangs off it. */
export function pageHref(basePath: string, path: string): string {
  const trail = path
    .split('/')
    .filter((segment) => segment.length > 0)
    .map(encodeURIComponent)
    .join('/')
  return trail ? `${basePath}/${trail}` : basePath
}

/** The same address, absolute, for `<link rel="canonical">` and the Open Graph tags. */
export function pageUrl(origin: string, basePath: string, path: string): string {
  return `${origin.replace(/\/+$/, '')}${pageHref(basePath, path)}`
}
