import { session, toast } from '@kernhq/ui'
import type { QueryClient } from '@tanstack/svelte-query'
import { browser } from '$app/environment'
import { page } from '$app/state'
import * as m from '$msg'
import { type PlanContext, suspensionToast } from './billing-refusal'
import { suspensionOf } from './errors'

/**
 * The one refusal that has to be handled in a single place, and the rule that keeps it there.
 *
 * `Entitlements.requireActive` gates **every** non-GET workspace-scoped procedure, so a suspended
 * workspace refuses every write in the product — creating an issue, renaming a page, ticking a
 * checkbox. Wiring that at call sites would mean remembering it at every mutation that exists now
 * and every one added later, and the ones nobody remembered are exactly the ones a customer meets.
 * So it is installed once, on the mutation cache, and every other error handler stands down for it.
 */

/**
 * Say what a failed mutation means, unless the global handler has already said it.
 *
 * This is the sentence that used to be written out at each of two dozen call sites as
 * `toast.error(err instanceof Error ? err.message : m.error_generic())`. Collecting it here is what
 * makes "the global handler owns suspension" true by construction rather than by two dozen
 * independent promises — a new mutation gets the behaviour by using the same helper as its
 * neighbours, and a handler that forgets is the only way to reintroduce the double toast.
 */
export function toastMutationError(err: unknown): void {
  if (suspensionOf(err)) return
  toast.error(err instanceof Error ? err.message : m.error_generic())
}

/**
 * Who is asking, at the moment a mutation failed.
 *
 * Read live rather than captured, because the handler outlives any one screen: it is installed once
 * for the life of the tab and fires for whichever workspace is open when something is refused.
 *
 * With no workspace in the URL there is no plan page to send anyone to, so the action is dropped and
 * the message keeps its "ask an owner" wording. A workspace-scoped mutation cannot really happen
 * outside `[ws]`, but the alternative to handling it is a toast that offers a link to `/undefined`.
 */
function currentContext(): PlanContext {
  const slug = browser ? (page.params.ws ?? '') : ''
  return {
    workspaceSlug: slug,
    canSeePlans: slug !== '' && session.can('billing.subscription.view'),
  }
}

/**
 * Install the suspension handler on a query client's mutation cache.
 *
 * `MutationCache.config` is a public, writable field, and the cache's `onError` runs *before* the
 * mutation's own — which is the ordering this depends on, since the per-site handler then decides
 * whether anything is left to say.
 *
 * Only suspension goes through here. A plan limit stays at its call site, where the screen knows
 * what was being attempted; see `$lib/api/billing-refusal`.
 */
export function installSuspensionToast(client: QueryClient): void {
  client.getMutationCache().config.onError = (err: unknown) => {
    suspensionToast(err, currentContext())
  }
}
