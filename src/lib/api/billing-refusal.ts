import { toast } from '@kernhq/ui'
import { goto } from '$app/navigation'
import * as m from '$msg'
import { planLimitOf, suspensionOf } from './errors'

/**
 * What to say when billing refuses something, instead of the server's English sentence.
 *
 * Two refusals live here and they are told apart deliberately, because they reach a person by
 * completely different routes:
 *
 * - A **plan limit** is a ceiling, and it belongs to the feature that hit it. Only two actions in
 *   this app can raise one, so both are wired by hand at the call site, where the surrounding screen
 *   already explains what was being attempted.
 * - A **suspension** is the whole workspace held read-only, and `Entitlements.requireActive` gates
 *   every non-GET workspace-scoped procedure — so it can arrive from any mutation in the product,
 *   including ones nobody would remember to wire. That one is installed once, globally, by
 *   `$lib/api/mutation-errors`.
 *
 * Neither is a mistake: nothing was typed wrongly and trying again will not help, so the only useful
 * next step is the plan.
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

/**
 * One id for every suspension toast, which is what makes a suspended workspace say this once.
 *
 * The store replaces a toast carrying an id it already holds rather than stacking a second one, so
 * a single click that fires two mutations — both refused, because *every* write is refused — leaves
 * one message on screen instead of a pile that has to be dismissed one at a time.
 */
const SUSPENDED_TOAST = 'billing-suspended'

/**
 * The workspace is suspended, so nothing can be changed until the subscription is current.
 *
 * Says what still works, because that is the part that stops this reading as an outage: the kernel
 * gates writes only, so everything the customer has is still theirs to read and to export. ADR 0003
 * §6 promises exactly that, and a person who cannot tell "suspended" from "broken" has no reason to
 * believe the promise.
 *
 * The action is offered only to somebody who may actually open the page. Without that check the
 * toast sends a member who cannot see billing to a route the module router answers with 404 — worse
 * than no button, because it looks like the product is broken rather than like the plan is the
 * limit. They are told to ask an owner instead, which is the one thing they can actually do.
 */
export function suspensionToast(err: unknown, ctx: PlanContext): boolean {
  if (!suspensionOf(err)) return false

  toast.error(m.billing_suspended(), {
    id: SUSPENDED_TOAST,
    description: ctx.canSeePlans ? m.billing_suspended_hint() : m.billing_suspended_hint_member(),
    duration: READING_TIME,
    action: ctx.canSeePlans
      ? { label: m.billing_reactivate(), onClick: () => void goto(planUrl(ctx)) }
      : undefined,
  })
  return true
}

/**
 * A plan limit, named and with the plans one click away.
 *
 * Returns `false` when the failure is not one, so a caller keeps its own error handling:
 *
 * ```ts
 * onError: (err) => {
 *   if (planLimitToast(err, plan)) return
 *   toastMutationError(err)
 * }
 * ```
 *
 * Deliberately not installed globally the way suspension is. A ceiling is only ever reached by the
 * one action that reached it, and a toast that arrives with no idea what was being attempted is
 * worse than the screen that knows.
 */
export function planLimitToast(err: unknown, ctx: PlanContext): boolean {
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
