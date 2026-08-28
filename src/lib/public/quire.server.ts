import type { QuireApi } from '@kernhq/module-quire/client'
import { createMockQuireApi } from '@kernhq/module-quire/client/mock.js'
import { createModuleClient } from '@kernhq/sdk'
import { error } from '@sveltejs/kit'
import { env as privateEnv } from '$env/dynamic/private'
import { env as publicEnv } from '$env/dynamic/public'

/**
 * The published-site half of Quire, called with no principal at all.
 *
 * **Every call in this file is made from the Node server, never from the browser, and never with
 * the reader's cookies.** That is not an implementation detail, it is the security model:
 * `public.*` is the only surface in Kern with nothing signed in behind it, and the module answers
 * it through `anonymousOnly`, which replaces the principal rather than ignoring it. If this route
 * forwarded a session cookie, the one person who ever checks whether a published site works — its
 * author, opening their own URL — would be shown a site nobody else can see, and the failure would
 * be invisible in exactly the situation somebody is looking for it. `createModuleClient`'s default
 * fetch sends `credentials: 'include'`, which does nothing on a server with no cookie jar; the
 * important half is that nothing here ever copies a header off the incoming request.
 *
 * Everything else follows from that. The loads that use this are `+layout.server.ts` and
 * `+page.server.ts` only, so none of it reaches the client bundle, and a reader with JavaScript
 * turned off is served the same page as a reader without.
 */

let cached: QuireApi | null = null

export const isMockApi = () => publicEnv.PUBLIC_API_MOCK === '1' || publicEnv.PUBLIC_API_MOCK === 'true'

/**
 * Where core answers, from the server's point of view rather than the browser's.
 *
 * `KERN_API_ORIGIN` is the private address — `http://core:4000` inside the compose network — and it
 * is the only one of these three that is right for a server-side call.
 *
 * **`PUBLIC_API_URL` is the fallback and it is the wrong address, which is worth stating rather
 * than implying.** This comment used to say it was "empty in every shipped configuration"; it is
 * set in all three (`selfhost/`, `selfhost/coolify/` and `cloud/`), to the public browser-facing
 * origin. So a stack that has not set `KERN_API_ORIGIN` renders every published page by leaving its
 * own container, going out through Caddy — and, on the cloud, through Cloudflare — and coming back
 * in. It works and it should not be relied on: it is a round trip through the internet to reach a
 * service one hop away, and it fails in whole classes of way that a private hop cannot.
 *
 * The last resort is the loopback address a developer runs core on. **127.0.0.1, never
 * `localhost`**: a Node process resolves `localhost` to `::1` first, where nothing is listening,
 * and `fetch` does not retry over IPv4.
 */
function apiBaseUrl(): string {
  return privateEnv.KERN_API_ORIGIN || publicEnv.PUBLIC_API_URL || 'http://127.0.0.1:4000'
}

export function publicQuire(): QuireApi {
  if (cached) return cached
  cached = isMockApi()
    ? (createMockQuireApi() as unknown as QuireApi)
    : createModuleClient<QuireApi>({ baseUrl: apiBaseUrl() }, 'quire')
  return cached
}

/** Test seam, and the way a future spec installs a fake without touching module state elsewhere. */
export function __setPublicQuire(api: QuireApi | null) {
  cached = api
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * The first segment of a published URL, turned into the workspace id the API asks for.
 *
 * `public-url.ts` in the module decides the address, and it names the workspace by **slug**:
 * `/p/acme/handbook`, because a customer publishing a handbook is publishing a URL they will print.
 * The `public.*` procedures take a `workspaceId`, and they have to — *anonymous means no principal,
 * not no tenant*, so the request must name a workspace before anything touches `mod_quire` or
 * row-level security has nothing to fence with.
 *
 * Turning one into the other is a lookup nothing can currently do signed out. Every workspace read
 * in `core` is behind `workspaceScoped`, which requires membership, and a published site has no
 * member reading it. So this resolves the id form and refuses everything else, and the refusal is a
 * **404** rather than an error: a stranger asking for a URL is owed "there is nothing here", and
 * saying anything else about a segment would make this the oracle that the rest of the surface
 * carefully refuses to be.
 *
 * What closes the gap is one procedure in `core` — a signed-out `workspaces.publicBySlug` answering
 * `{ id }` for a slug and 404 otherwise. It belongs there rather than here: only core holds the
 * table, and it is the same lookup `[ws]` already does for a member. Until it exists, the link the
 * share dialog copies resolves only in its id form, and the shell half fails closed rather than
 * guessing.
 *
 * In mock mode the segment is passed through untouched: the in-memory Quire finds a publication by
 * slug alone and ignores the workspace entirely, which is what lets `dev:mock` and the UX sweep
 * open `/p/northstar/working-here` with no backend at all.
 */
export function resolveWorkspaceId(segment: string): string | null {
  if (isMockApi()) return segment
  return UUID.test(segment) ? segment : null
}

/**
 * Whatever went wrong, the reader is told the same thing — and the operator is told which.
 *
 * Not published, opted out, archived, trashed, never rendered, expired, another workspace's page,
 * a workspace with Quire switched off — the module answers all of them with `NOT_FOUND` on purpose,
 * because a refusal that separates "not yours" from "not there" confirms the page exists to whoever
 * is guessing. This keeps that true one layer up: a transport failure, a malformed slug and a
 * genuine 404 all reach the reader as the app's own not-found, and never as a stack trace.
 *
 * **What it must not do is launder the three into each other for everybody.** Core being unreachable
 * produced exactly the same silent 404 as a page nobody had published, and wrote nothing anywhere —
 * so "the published sites are all 404" and "that address was never published" were the same
 * observation, with no way to tell them apart short of reading this file. The reader still gets one
 * answer; the server log gets the reason, and only for a failure that is not the module's own
 * `NOT_FOUND`. A 404 from the module is the normal case and logging it would be noise at the rate a
 * crawler can generate.
 */
export function notFound(cause?: unknown): never {
  const code = (cause as { code?: unknown } | null | undefined)?.code
  if (cause !== undefined && code !== 'NOT_FOUND')
    console.error('[public] the Quire public API did not answer', {
      apiBaseUrl: apiBaseUrl(),
      code: typeof code === 'string' ? code : null,
      error: cause instanceof Error ? cause.message : String(cause),
    })
  error(404, 'There is no published site at this address')
}
