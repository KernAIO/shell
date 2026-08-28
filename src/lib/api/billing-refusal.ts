import { toast } from '@kernhq/ui'
import { goto } from '$app/navigation'
import * as m from '$msg'
import { planLimitOf, suspensionOf } from './errors'

/**
 * Turn a billing refusal into something a person can act on, instead of the server's English
 * sentence.
 *
 * Two refusals arrive here and they are not the same thing:
 *
 * - A **plan limit** (`PLAN_LIMIT_REASONS`) is a ceiling. The workspace works; this one action
 *   needs more room than the plan has.
 * - A **suspension** (`SUSPENDED_REASON`) is the whole workspace held read-only because the
 *   subscription lapsed. It can arrive from any write at all, so the person meeting it has very
 *   likely done nothing unusual and is owed the explanation more than in any other case.
 *
 * Neither is a mistake: nothing was typed wrongly and trying again will not help. Every one of them
 * used to arrive as a bare toast reading "This workspace is suspended because its subscription is
 * not current" — the server's own words, in English whatever the reader's language, with nowhere to
 * go from there.
 *
 * Returns `false` when the failure is neither, so a caller keeps its own error handling:
 *
 * ```ts
 * onError: (err) => {
 *   if (billingRefusalToast(err, plan)) return
 *   toast.error(err instanceof Error ? err.message : m.error_generic())
 * }
 * ```
 *
 * The action is offered only to somebody who may actually open the page. Without that check the
 * toast sends a member who cannot see billing to a route the module router answers with 404 — worse
 * than no button, because it looks like the product is broken rather than like the plan is the
 * limit. They are told to ask an owner instead, which is the one thing they can actually do; both
 * still get the translated sentence, which is the half that was missing.
 */
export interface PlanContext {
  /** The workspace whose plan was the limit — its slug, because that is what the URL carries. */
  workspaceSlug: string
  /** Whether this person holds `billing.subscription.view`. */
  canSeePlans: boolean
}

// Longer than the default: these are sentences to read and a decision to make, not an
// acknowledgement, and an action is useless if it has gone before it is reached.
const READING_TIME = 10_000

export function billingRefusalToast(err: unknown, ctx: PlanContext): boolean {
  return suspendedToast(err, ctx) || planLimitToast(err, ctx)
}

/**
 * The workspace is suspended, so nothing can be changed until the subscription is current.
 *
 * Says what still works, because that is the part that stops this reading as an outage: the kernel
 * gates writes only, so everything the customer has is still theirs to read and to export. ADR 0003
 * §6 promises exactly that, and a person who cannot tell the difference between "suspended" and
 * "broken" has no reason to believe the promise.
 */
function suspendedToast(err: unknown, ctx: PlanContext): boolean {
  if (!suspensionOf(err)) return false

  toast.error(m.billing_suspended(), {
    description: ctx.canSeePlans ? m.billing_suspended_hint() : m.billing_suspended_hint_member(),
    duration: READING_TIME,
    action: ctx.canSeePlans
      ? { label: m.billing_reactivate(), onClick: () => void goto(planUrl(ctx)) }
      : undefined,
  })
  return true
}

function planLimitToast(err: unknown, ctx: PlanContext): boolean {
  const limit = planLimitOf(err)
  if (!limit) return false

  const said =
    limit.reason === 'billing.seats.limit_reached'
      ? { title: m.billing_limit_seats(), body: m.billing_limit_seats_hint() }
      : limit.reason === 'billing.storage.limit_reached'
        ? { title: m.billing_limit_storage(), body: m.billing_limit_storage_hint() }
        : { title: m.billing_limit_module(), body: m.billing_limit_module_hint() }

  toast.error(said.title, {
    description: said.body,
    duration: READING_TIME,
    action: ctx.canSeePlans
      ? { label: m.billing_see_plans(), onClick: () => void goto(planUrl(ctx)) }
      : undefined,
  })
  return true
}

/**
 * Billing declares `settingsPages: [{ id: 'plan', scope: 'workspace' }]`, and the shell mounts a
 * module settings page at `/<ws>/settings/<moduleId>/<pageId>` — so this URL is the declaration, not
 * a route file somebody has to keep in step with it.
 */
const planUrl = (ctx: PlanContext) => `/${ctx.workspaceSlug}/settings/billing/plan`
