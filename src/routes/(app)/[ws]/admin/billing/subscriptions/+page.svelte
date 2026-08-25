<script lang="ts">
import type { AdminWorkspaceRow, Plan } from '@kernhq/module-billing/client'
import { formatBytes, formatMoney } from '@kernhq/module-billing/client'
import {
  Badge,
  Button,
  Dialog,
  DropdownMenu,
  EmptyState,
  IconButton,
  type MenuItem,
  SearchBox,
  Select,
  Skeleton,
  StatTile,
  Table,
  TableCell,
  TableHeader,
  TableRow,
  toast,
} from '@kernhq/ui'
import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query'
import { getBillingApi } from '$lib/modules/billing/api'
import { getLocale } from '$lib/paraglide/runtime'
import * as m from '$msg'

/**
 * Every workspace on the instance, and what it pays.
 *
 * The operator's screen, not a workspace's — it deliberately crosses workspaces, which is why the
 * console's layout gates the whole area on the instance-admin flag rather than on membership.
 */

const api = getBillingApi()
const queryClient = useQueryClient()
const locale = $derived(getLocale())

let query = $state('')
let suspending = $state<AdminWorkspaceRow | null>(null)
let planFor = $state<AdminWorkspaceRow | null>(null)
let chosenPlanId = $state<string>('')

const rows = createQuery(() => ({
  // the search term is in the key, or a warm cache serves the previous term's rows and the box
  // looks broken
  queryKey: ['billing', 'admin-workspace', query],
  queryFn: () => api.admin.workspaces({ q: query || undefined, limit: 200 }),
}))

const plans = createQuery(() => ({
  queryKey: ['billing', 'plan', 'all'],
  queryFn: () => api.plans.list({ includeUnpublished: true }),
}))

const items = $derived(rows.data?.items ?? [])
const totals = $derived({
  workspaces: items.length,
  paying: items.filter((r) => r.status === 'active').length,
  suspended: items.filter((r) => r.status === 'suspended').length,
  monthly: items.reduce((n, r) => n + r.monthlyMinor, 0),
  currency: items.find((r) => r.monthlyMinor > 0)?.currency ?? 'usd',
})

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

const nf = $derived(new Intl.NumberFormat(locale))
const dateFmt = $derived(new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }))
const day = (iso: string | null) => (iso ? dateFmt.format(new Date(iso)) : '—')

const refresh = () => queryClient.invalidateQueries({ queryKey: ['billing'] })

const setStatus = createMutation(() => ({
  mutationFn: (v: { workspaceId: string; status: 'active' | 'suspended' }) => api.admin.setStatus(v),
  onSuccess: (_r, v) => {
    const name = items.find((i) => i.workspaceId === v.workspaceId)?.workspaceName ?? ''
    toast.success(
      v.status === 'suspended'
        ? m.billing_admin_suspended_toast({ name })
        : m.billing_admin_resumed_toast({ name }),
    )
    suspending = null
    void refresh()
  },
  onError: (e: Error) => toast.error(e.message),
}))

const setPlan = createMutation(() => ({
  mutationFn: (v: { workspaceId: string; planId: string | null }) => api.admin.setPlan(v),
  onSuccess: () => {
    toast.success(m.billing_admin_plan_changed_toast())
    planFor = null
    void refresh()
  },
  onError: (e: Error) => toast.error(e.message),
}))

const extendTrial = createMutation(() => ({
  mutationFn: (workspaceId: string) => api.admin.extendTrial({ workspaceId, days: 14 }),
  onSuccess: () => {
    toast.success(m.billing_admin_trial_extended_toast())
    void refresh()
  },
  onError: (e: Error) => toast.error(e.message),
}))

const clearOverride = createMutation(() => ({
  mutationFn: (workspaceId: string) => api.admin.override({ workspaceId, limits: null }),
  onSuccess: () => void refresh(),
  onError: (e: Error) => toast.error(e.message),
}))

function actionsFor(row: AdminWorkspaceRow): MenuItem[] {
  const out: MenuItem[] = [
    {
      label: m.billing_admin_action_set_plan(),
      icon: 'tag',
      onSelect: () => {
        planFor = row
        chosenPlanId = row.planSlug ? ((plans.data ?? []).find((p) => p.slug === row.planSlug)?.id ?? '') : ''
      },
    },
    {
      label: m.billing_admin_action_extend_trial(),
      icon: 'clock',
      onSelect: () => extendTrial.mutate(row.workspaceId),
    },
  ]
  if (row.overridden)
    out.push({
      label: m.billing_admin_action_clear_override(),
      icon: 'undo-2',
      onSelect: () => clearOverride.mutate(row.workspaceId),
    })
  if (row.stripeCustomerId)
    out.push({
      label: m.billing_admin_action_stripe(),
      icon: 'external-link',
      href: `https://dashboard.stripe.com/customers/${row.stripeCustomerId}`,
    })
  out.push({ type: 'separator' })
  out.push(
    row.status === 'suspended'
      ? {
          label: m.billing_admin_action_resume(),
          icon: 'play',
          onSelect: () => setStatus.mutate({ workspaceId: row.workspaceId, status: 'active' }),
        }
      : {
          label: m.billing_admin_action_suspend(),
          icon: 'slash',
          danger: true,
          onSelect: () => {
            suspending = row
          },
        },
  )
  return out
}

const planOptions = $derived([
  { value: '', label: m.billing_admin_plan_none() },
  ...(plans.data ?? []).map((p: Plan) => ({ value: p.id, label: p.name })),
])
</script>

<svelte:head><title>{m.billing_admin_subscriptions_title()} · {m.nav_admin()}</title></svelte:head>

<div class="grid gap-5">
  <header class="grid gap-1">
    <h1 class="text-[20px] font-medium text-[var(--kern-ink-900)]">{m.billing_admin_subscriptions_title()}</h1>
    <p class="text-[13px] text-[var(--kern-ink-400)]">{m.billing_admin_subscriptions_subtitle()}</p>
  </header>

  <div class="grid gap-3 sm:grid-cols-4" style="grid-auto-rows: 1fr">
    <StatTile label={m.billing_admin_workspaces()} value={nf.format(totals.workspaces)} />
    <StatTile label={m.billing_admin_paying()} value={nf.format(totals.paying)} />
    <StatTile label={m.billing_admin_suspended_count()} value={nf.format(totals.suspended)} />
    <StatTile label={m.billing_admin_mrr()} value={formatMoney(totals.monthly, totals.currency, locale)} />
  </div>

  <SearchBox bind:value={query} placeholder={m.billing_admin_search()} />

  {#if rows.isPending}
    <Skeleton class="h-[220px] w-full rounded-[var(--kern-r-md)]" />
  {:else if rows.isError}
    <EmptyState title={m.billing_admin_error()} icon="triangle-alert">
      {#snippet actions()}
        <Button variant="secondary" onclick={() => void refresh()}>{m.billing_retry()}</Button>
      {/snippet}
    </EmptyState>
  {:else if items.length === 0}
    <EmptyState title={m.billing_admin_empty()} description={m.billing_admin_empty_hint()} icon="building" />
  {:else}
    <!-- the table scrolls inside itself; the page body must never scroll sideways -->
    <div class="overflow-x-auto">
      <Table
        columns="minmax(150px,2fr) minmax(110px,1fr) minmax(104px,auto) minmax(68px,auto) minmax(84px,auto) minmax(96px,auto) minmax(84px,auto) 40px"
      >
        <TableHeader>
          <TableCell header>{m.billing_admin_col_workspace()}</TableCell>
          <TableCell header>{m.billing_admin_col_plan()}</TableCell>
          <TableCell header>{m.billing_admin_col_status()}</TableCell>
          <TableCell header end>{m.billing_admin_col_seats()}</TableCell>
          <TableCell header end>{m.billing_admin_col_storage()}</TableCell>
          <TableCell header>{m.billing_admin_col_renews()}</TableCell>
          <TableCell header end>{m.billing_admin_col_revenue()}</TableCell>
          <TableCell header end></TableCell>
        </TableHeader>
        {#each items as row (row.workspaceId)}
          <TableRow>
            <TableCell>
              <div class="grid">
                <span class="truncate text-[13px] text-[var(--kern-ink-900)]">{row.workspaceName}</span>
                <span class="truncate font-[var(--kern-font-mono)] text-[11px] text-[var(--kern-ink-400)]">
                  {row.workspaceSlug}
                </span>
              </div>
            </TableCell>
            <TableCell>
              <div class="flex items-center gap-1.5">
                <span class="truncate">{row.planName ?? m.billing_no_plan()}</span>
                {#if row.overridden}
                  <Badge tone="purple" title={m.billing_admin_overridden_hint()}>
                    {m.billing_admin_overridden()}
                  </Badge>
                {/if}
              </div>
            </TableCell>
            <TableCell>
              {#if row.status}
                <Badge tone={STATUS_TONE[row.status] ?? 'grey'}>
                  {(STATUS_LABEL[row.status] ?? m.billing_status_active)()}
                </Badge>
              {:else}
                <span class="text-[var(--kern-ink-400)]">—</span>
              {/if}
            </TableCell>
            <TableCell end>
              {row.seatsPurchased > 0
                ? `${nf.format(row.seatsUsed)}/${nf.format(row.seatsPurchased)}`
                : nf.format(row.seatsUsed)}
            </TableCell>
            <TableCell end>{formatBytes(row.storageBytes, locale)}</TableCell>
            <TableCell>{day(row.currentPeriodEnd ?? row.trialEndsAt)}</TableCell>
            <TableCell end>
              {row.monthlyMinor > 0 ? formatMoney(row.monthlyMinor, row.currency, locale) : '—'}
            </TableCell>
            <TableCell end>
              <DropdownMenu items={actionsFor(row)} align="end">
                {#snippet trigger(props)}
                  <IconButton {...props} icon="ellipsis" size={28} label={m.billing_actions()} />
                {/snippet}
              </DropdownMenu>
            </TableCell>
          </TableRow>
        {/each}
      </Table>
    </div>
  {/if}
</div>

<!-- Suspending withholds the service; it never deletes anything, and the dialog says so. -->
<Dialog
  open={suspending !== null}
  title={m.billing_admin_suspend_title()}
  description={suspending ? m.billing_admin_suspend_body({ name: suspending.workspaceName }) : ''}
  onOpenChange={(o) => {
    if (!o) suspending = null
  }}
>
  {#snippet children()}{/snippet}
  {#snippet footer()}
    <Button variant="secondary" onclick={() => (suspending = null)}>{m.billing_admin_cancel()}</Button>
    <Button
      variant="danger"
      loading={setStatus.isPending}
      onclick={() =>
        suspending && setStatus.mutate({ workspaceId: suspending.workspaceId, status: 'suspended' })}
    >
      {m.billing_admin_suspend_confirm()}
    </Button>
  {/snippet}
</Dialog>

<Dialog
  open={planFor !== null}
  title={planFor ? m.billing_admin_set_plan_title({ name: planFor.workspaceName }) : ''}
  description={m.billing_admin_set_plan_body()}
  onOpenChange={(o) => {
    if (!o) planFor = null
  }}
>
  {#snippet children()}
    <Select bind:value={chosenPlanId} options={planOptions} />
  {/snippet}
  {#snippet footer()}
    <Button variant="secondary" onclick={() => (planFor = null)}>{m.billing_admin_cancel()}</Button>
    <Button
      loading={setPlan.isPending}
      onclick={() =>
        planFor && setPlan.mutate({ workspaceId: planFor.workspaceId, planId: chosenPlanId || null })}
    >
      {m.billing_admin_save()}
    </Button>
  {/snippet}
</Dialog>
