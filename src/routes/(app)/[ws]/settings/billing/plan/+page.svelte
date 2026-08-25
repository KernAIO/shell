<script lang="ts">
import type { Plan } from '@kernhq/module-billing/client'
import {
  BILLING_PERMISSIONS,
  formatBytes,
  formatMoney,
  planBlockedReason,
  trialDaysLeft,
  usageRatio,
} from '@kernhq/module-billing/client'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ProgressBar,
  Skeleton,
  Table,
  TableCell,
  TableHeader,
  TableRow,
  Tooltip,
  toast,
} from '@kernhq/ui'
import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query'
import { page } from '$app/state'
import { getBillingApi } from '$lib/modules/billing/api'
import { getLocale } from '$lib/paraglide/runtime'
import { session } from '$lib/state/session.svelte'
import * as m from '$msg'

/**
 * What this workspace is on, what it uses, and what it has been charged.
 *
 * Everything money-shaped is read from the server rather than worked out here: a second opinion
 * about somebody's bill, computed in a browser, is the one kind of disagreement this screen must not
 * be able to have.
 */

const api = getBillingApi()
const queryClient = useQueryClient()

const slug = $derived(page.params.ws!)
const workspace = $derived(session.workspaces.find((w) => w.slug === slug))
const workspaceId = $derived(workspace?.id ?? '')
const canManage = $derived(session.can(BILLING_PERMISSIONS.manage))
const locale = $derived(getLocale())

const billing = createQuery(() => ({
  queryKey: ['billing', 'subscription', workspaceId],
  queryFn: () => api.subscription.get({ workspaceId }),
  enabled: Boolean(workspaceId),
}))

const plans = createQuery(() => ({
  queryKey: ['billing', 'plan', 'offered'],
  queryFn: () => api.plans.list({ includeUnpublished: false }),
  enabled: Boolean(workspaceId),
}))

const invoices = createQuery(() => ({
  queryKey: ['billing', 'invoice', workspaceId],
  queryFn: () => api.subscription.invoices({ workspaceId, limit: 24 }),
  enabled: Boolean(workspaceId),
}))

const data = $derived(billing.data)
const sub = $derived(data?.subscription ?? null)
const usage = $derived(data?.usage ?? { seats: 0, storageBytes: 0, updatedAt: '' })

const STATUS_LABEL: Record<string, () => string> = {
  trialing: m.billing_status_trialing,
  active: m.billing_status_active,
  past_due: m.billing_status_past_due,
  canceled: m.billing_status_canceled,
  suspended: m.billing_status_suspended,
}
const STATUS_TONE: Record<string, 'info' | 'success' | 'warning' | 'danger' | 'grey'> = {
  trialing: 'info',
  active: 'success',
  past_due: 'warning',
  canceled: 'grey',
  suspended: 'danger',
}

const trialLeft = $derived(trialDaysLeft(sub?.trialEndsAt ?? null))

function priceNote(plan: Plan): string {
  if (plan.priceMinor === 0) return m.billing_free()
  if (plan.interval === 'year') return plan.perSeat ? m.billing_per_user_year() : m.billing_per_year()
  return plan.perSeat ? m.billing_per_user_month() : m.billing_per_month()
}

// every number a person reads goes through Intl, counts included — a Latin seat count beside a
// Persian byte count is the one untranslated thing on the screen
const nf = $derived(new Intl.NumberFormat(locale))
const dateFmt = $derived(new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }))
const day = (iso: string | null) => (iso ? dateFmt.format(new Date(iso)) : '—')

/** Sends the person to Stripe. Kept as a mutation so the button can show it is working. */
const checkout = createMutation(() => ({
  mutationFn: (planSlug: string) => api.subscription.checkout({ workspaceId, planSlug }),
  onSuccess: ({ url }) => {
    window.location.href = url
  },
  onError: (e: Error) => toast.error(e.message),
}))

const portal = createMutation(() => ({
  mutationFn: () => api.subscription.portal({ workspaceId, returnPath: `/${slug}/settings/billing/plan` }),
  onSuccess: ({ url }) => {
    window.location.href = url
  },
  onError: (e: Error) => toast.error(e.message),
}))

const reload = () => {
  void queryClient.invalidateQueries({ queryKey: ['billing'] })
}
</script>

<svelte:head><title>{m.billing_title()} · {m.settings_title()}</title></svelte:head>

<!-- `limit` is already formatted by the caller: bytes have to arrive as "50 GB", never as the
     number itself, and a snippet that took a number could not tell the two apart. -->
{#snippet meter(label: string, used: string, limit: string | null, ratio: number | null)}
  <div class="grid gap-1.5">
    <div class="flex items-baseline justify-between gap-3">
      <span class="text-[13px] text-[var(--kern-ink-700)]">{label}</span>
      <span class="font-[var(--kern-font-mono)] text-[12px] text-[var(--kern-ink-400)]">
        {limit === null ? used : m.billing_usage_of({ used, limit })}
      </span>
    </div>
    {#if ratio === null}
      <div class="text-[12px] text-[var(--kern-ink-400)]">{m.billing_unlimited()}</div>
    {:else}
      <ProgressBar value={ratio * 100} tone={ratio >= 1 ? 'danger' : ratio > 0.85 ? 'info' : 'accent'} />
    {/if}
  </div>
{/snippet}

<div class="grid gap-6">
  <header class="grid gap-1">
    <h1 class="text-[20px] font-medium text-[var(--kern-ink-900)]">{m.billing_title()}</h1>
    <p class="text-[13px] text-[var(--kern-ink-400)]">{m.billing_subtitle()}</p>
  </header>

  {#if billing.isPending}
    <Skeleton class="h-[132px] w-full rounded-[var(--kern-r-md)]" />
    <Skeleton class="h-[180px] w-full rounded-[var(--kern-r-md)]" />
  {:else if billing.isError}
    <EmptyState title={m.billing_error()} icon="triangle-alert">
      {#snippet actions()}
        <Button variant="secondary" onclick={reload}>{m.billing_retry()}</Button>
      {/snippet}
    </EmptyState>
  {:else}
    <!-- current plan -->
    <Card>
      <div class="grid gap-4 p-5">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="grid gap-1">
            <span class="text-[12px] text-[var(--kern-ink-400)]">{m.billing_current_plan()}</span>
            <div class="flex items-center gap-2">
              <span class="text-[17px] font-medium text-[var(--kern-ink-900)]">
                {sub?.planName ?? m.billing_no_plan()}
              </span>
              {#if sub}
                <Badge tone={STATUS_TONE[sub.status] ?? 'grey'}>
                  {(STATUS_LABEL[sub.status] ?? m.billing_status_active)()}
                </Badge>
              {/if}
            </div>
            {#if !sub}
              <p class="text-[13px] text-[var(--kern-ink-400)]">{m.billing_no_plan_hint()}</p>
            {:else if sub.status === 'trialing' && trialLeft !== null}
              <p class="text-[13px] text-[var(--kern-ink-400)]">
                {trialLeft === 0 ? m.billing_trial_ends_today() : m.billing_trial_days_left({ count: trialLeft })}
              </p>
            {:else if sub.currentPeriodEnd}
              <p class="text-[13px] text-[var(--kern-ink-400)]">
                {sub.cancelAtPeriodEnd ? m.billing_cancels() : m.billing_renews()}
                {day(sub.currentPeriodEnd)}
              </p>
            {/if}
          </div>

          {#if data?.paymentsEnabled && sub?.stripeCustomerId}
            <!-- disabled controls say why: a dead button with no explanation is a bug -->
            <Tooltip text={m.billing_no_permission()} disabled={canManage}>
              {#snippet children(props)}
                <span {...props}>
                  <Button
                    variant="secondary"
                    disabled={!canManage || portal.isPending}
                    loading={portal.isPending}
                    onclick={() => portal.mutate()}
                  >
                    {m.billing_manage_payment()}
                  </Button>
                </span>
              {/snippet}
            </Tooltip>
          {/if}
        </div>

        {#if sub?.status === 'past_due'}
          <p class="rounded-[var(--kern-r-sm)] bg-[var(--kern-warning-tint)] px-3 py-2 text-[13px] text-[var(--kern-ink-900)]">
            {m.billing_past_due_hint()}
          </p>
        {:else if sub?.status === 'suspended'}
          <p class="rounded-[var(--kern-r-sm)] bg-[var(--kern-danger-tint)] px-3 py-2 text-[13px] text-[var(--kern-ink-900)]">
            {m.billing_suspended_hint()}
          </p>
        {/if}

        <div class="grid gap-4 sm:grid-cols-2">
          {@render meter(
            m.billing_seats(),
            nf.format(usage.seats),
            data?.limits.seats == null ? null : nf.format(data.limits.seats),
            usageRatio(usage.seats, data?.limits.seats ?? null),
          )}
          {@render meter(
            m.billing_storage(),
            formatBytes(usage.storageBytes, locale),
            data?.limits.storageBytes == null ? null : formatBytes(data.limits.storageBytes, locale),
            usageRatio(usage.storageBytes, data?.limits.storageBytes ?? null),
          )}
        </div>
      </div>
    </Card>

    <!-- what can be bought -->
    {#if !data?.paymentsEnabled}
      <p class="text-[13px] text-[var(--kern-ink-400)]">{m.billing_payments_disabled()}</p>
    {:else if plans.isPending}
      <Skeleton class="h-[160px] w-full rounded-[var(--kern-r-md)]" />
    {:else if (plans.data ?? []).length === 0}
      <EmptyState title={m.billing_no_plans()} description={m.billing_no_plans_hint()} icon="tag" />
    {:else}
      <!-- `grid-auto-rows:1fr` + `display:grid` on the cell, so a longer description does not leave
           the card beside it visibly short -->
      <ul class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" style="grid-auto-rows: 1fr">
        {#each plans.data ?? [] as plan (plan.id)}
          {@const isCurrent = sub?.planId === plan.id}
          {@const blocked = planBlockedReason(plan, { seats: usage.seats })}
          <li class="grid">
            <Card class="grid content-between gap-4 p-4">
              <div class="grid gap-2">
                <div class="flex items-center justify-between gap-2">
                  <span class="text-[15px] font-medium text-[var(--kern-ink-900)]">{plan.name}</span>
                  {#if isCurrent}<Badge tone="accent">{m.billing_current()}</Badge>{/if}
                </div>
                <div class="flex items-baseline gap-1.5">
                  <span class="text-[22px] font-medium text-[var(--kern-ink-900)]">
                    {formatMoney(plan.priceMinor, plan.currency, locale)}
                  </span>
                  <span class="text-[12px] text-[var(--kern-ink-400)]">{priceNote(plan)}</span>
                </div>
                {#if plan.description}
                  <p class="text-[13px] text-[var(--kern-ink-700)]">{plan.description}</p>
                {/if}
                {#if plan.highlights.length}
                  <ul class="mt-1 grid gap-1">
                    {#each plan.highlights as h (h)}
                      <li class="text-[12.5px] text-[var(--kern-ink-700)]">{h}</li>
                    {/each}
                  </ul>
                {/if}
              </div>
              <!-- A plan smaller than the workspace names the number it cannot fit, rather than
                   refusing on submit with nothing to act on. -->
              <Tooltip
                text={blocked === 'seats'
                  ? m.billing_blocked_seats({
                      seats: nf.format(plan.limits.seats ?? 0),
                      used: nf.format(usage.seats),
                    })
                  : m.billing_no_permission()}
                disabled={blocked === null && canManage}
              >
                {#snippet children(props)}
                  <span class="block w-full" {...props}>
                    <Button
                      class="w-full"
                      variant={isCurrent ? 'secondary' : 'primary'}
                      disabled={isCurrent || !canManage || blocked !== null || checkout.isPending}
                      loading={checkout.isPending && checkout.variables === plan.slug}
                      onclick={() => checkout.mutate(plan.slug)}
                    >
                      {isCurrent ? m.billing_current() : m.billing_choose_plan()}
                    </Button>
                  </span>
                {/snippet}
              </Tooltip>
            </Card>
          </li>
        {/each}
      </ul>
    {/if}

    <!-- invoices -->
    <section class="grid gap-2">
      <h2 class="text-[14px] font-medium text-[var(--kern-ink-900)]">{m.billing_invoices_section()}</h2>
      {#if invoices.isPending}
        <Skeleton class="h-[96px] w-full rounded-[var(--kern-r-md)]" />
      {:else if (invoices.data?.items ?? []).length === 0}
        <EmptyState
          title={m.billing_invoices_empty()}
          description={m.billing_invoices_empty_hint()}
          icon="file-text"
          compact
        />
      {:else}
        <div class="overflow-x-auto">
          <Table columns="minmax(120px,1fr) minmax(120px,1fr) minmax(100px,auto) minmax(80px,auto)">
            <TableHeader>
              <TableCell header>{m.billing_invoice_number()}</TableCell>
              <TableCell header>{m.billing_invoice_date()}</TableCell>
              <TableCell header end>{m.billing_invoice_amount()}</TableCell>
              <TableCell header end></TableCell>
            </TableHeader>
            {#each invoices.data?.items ?? [] as inv (inv.id)}
              <TableRow>
                <TableCell>{inv.number ?? '—'}</TableCell>
                <TableCell>{day(inv.createdAt)}</TableCell>
                <TableCell end>{formatMoney(inv.totalMinor, inv.currency, locale)}</TableCell>
                <TableCell end>
                  {#if inv.hostedUrl}
                    <a
                      class="text-[13px] text-[var(--kern-accent-deep)] underline-offset-2 hover:underline"
                      href={inv.hostedUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      {m.billing_invoice_view()}
                    </a>
                  {/if}
                </TableCell>
              </TableRow>
            {/each}
          </Table>
        </div>
      {/if}
    </section>
  {/if}
</div>
