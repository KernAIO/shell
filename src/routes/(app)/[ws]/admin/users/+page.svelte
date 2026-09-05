<script lang="ts">
import {
  Avatar,
  Badge,
  Button,
  Dialog,
  DropdownMenu,
  EmptyState,
  formatDate,
  type MenuItem,
  SearchBox,
  Skeleton,
  Table,
  TableCell,
  TableHeader,
  TableRow,
  toast,
} from '@kernhq/ui'
import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query'
import { untrack } from 'svelte'
import { getApi } from '$lib/api/client'
import { toastMutationError } from '$lib/api/mutation-errors'
import SettingsPage from '$lib/components/settings/SettingsPage.svelte'
import SettingsSection from '$lib/components/settings/SettingsSection.svelte'
import { keys } from '$lib/query'
import { session } from '$lib/state/session.svelte'
import * as m from '$msg'

/**
 * Everyone with an account on this installation.
 *
 * `admin.users` and `admin.setUserStatus` are implemented in core and, until now, called by
 * nothing — so an operator whose colleague had left, or whose account had been taken over, had no
 * way to suspend it, and no way to hand the instance console to somebody else. Suspending revokes
 * every session server-side, which is the only reason it is worth having here rather than in the
 * database.
 *
 * Two refusals are enforced on the server (`core.admin.self`) and therefore also shown here before
 * the action is offered: nobody suspends themselves, and nobody removes their own instance admin.
 * Doing it in both places is deliberate — the server is what makes it true, and the screen is what
 * makes it understandable. A menu that offers an action core will refuse is a screen that lies.
 */
const api = getApi()
const queryClient = useQueryClient()

let search = $state('')
let cursor = $state<string | null>(null)

const users = createQuery(() => ({
  queryKey: [...keys.adminUsers(), search, cursor],
  queryFn: () => api.admin.users({ q: search || undefined, cursor: cursor ?? undefined, limit: 50 }),
}))

type Account = NonNullable<typeof users.data>['items'][number]

const rows = $derived(users.data?.items ?? [])
const isSelf = (row: Account) => row.id === session.user?.id

/** What the dialog is about to do, or `null` when it is closed. */
type Pending = { row: Account; action: 'suspend' | 'activate' | 'promote' | 'demote' }
let pending = $state<Pending | null>(null)
/**
 * Guarded in the same tick as the click rather than by `disabled`.
 *
 * `disabled={mutation.isPending}` reaches the button on the next render, and two quick clicks are
 * one render apart — so a double-click would file two `setUserStatus` writes.
 */
let acting = $state(false)

const setStatus = createMutation(() => ({
  mutationFn: (vars: { id: string; status: 'active' | 'suspended'; instanceAdmin?: boolean }) =>
    api.admin.setUserStatus(vars),
  onSuccess: (_data, vars) => {
    const name = pending?.row.name ?? ''
    const action = pending?.action
    pending = null
    void queryClient.invalidateQueries({ queryKey: keys.adminUsers() })
    if (action === 'suspend') toast.success(m.admin_users_suspended_toast({ name }))
    else if (action === 'activate') toast.success(m.admin_users_activated_toast({ name }))
    else if (action === 'promote') toast.success(m.admin_users_made_admin_toast({ name }))
    else if (action === 'demote') toast.success(m.admin_users_removed_admin_toast({ name }))
    void vars
  },
  onError: (err) => toastMutationError(err),
  onSettled: () => {
    acting = false
  },
}))

function confirm() {
  if (acting || !pending) return
  acting = true
  const { row, action } = pending
  if (action === 'suspend') setStatus.mutate({ id: row.id, status: 'suspended' })
  else if (action === 'activate') setStatus.mutate({ id: row.id, status: 'active' })
  else if (action === 'promote')
    setStatus.mutate({ id: row.id, status: row.status as 'active', instanceAdmin: true })
  else setStatus.mutate({ id: row.id, status: row.status as 'active', instanceAdmin: false })
}

/**
 * The menu for one row.
 *
 * Nothing an account cannot be the subject of is offered: your own row gets neither Suspend nor
 * Remove instance admin, because core refuses both with `core.admin.self`.
 */
function menuFor(row: Account): MenuItem[] {
  const items: MenuItem[] = []
  if (!isSelf(row))
    items.push(
      row.status === 'suspended'
        ? {
            label: m.admin_activate(),
            icon: 'circle-check',
            onSelect: () => (pending = { row, action: 'activate' }),
          }
        : {
            label: m.admin_suspend(),
            icon: 'circle-x',
            danger: true,
            onSelect: () => (pending = { row, action: 'suspend' }),
          },
    )
  if (row.instanceAdmin) {
    if (!isSelf(row))
      items.push({
        label: m.admin_remove_admin(),
        icon: 'lock-open',
        onSelect: () => (pending = { row, action: 'demote' }),
      })
  } else {
    items.push({
      label: m.admin_make_admin(),
      icon: 'shield',
      onSelect: () => (pending = { row, action: 'promote' }),
    })
  }
  return items
}

const dialogTitle = $derived.by(() => {
  if (!pending) return ''
  const name = pending.row.name
  return {
    suspend: m.admin_users_suspend_title({ name }),
    activate: m.admin_users_activate_title({ name }),
    promote: m.admin_users_make_admin_title({ name }),
    demote: m.admin_users_remove_admin_title({ name }),
  }[pending.action]
})

const dialogBody = $derived.by(() => {
  if (!pending) return ''
  return {
    suspend: m.admin_users_suspend_body(),
    activate: m.admin_users_activate_body(),
    promote: m.admin_users_make_admin_body(),
    demote: m.admin_users_remove_admin_body(),
  }[pending.action]
})

/**
 * Searching starts a new page.
 *
 * The cursor is in the query key, so keeping it while the term changes would ask core for page two
 * of a list it is no longer building — `admin.users` pages by user id, and the second page of "ada"
 * is not the second page of "ad".
 */
let lastSearch = ''
$effect(() => {
  const term = search
  if (term !== untrack(() => lastSearch)) {
    lastSearch = term
    cursor = null
  }
})
</script>

<SettingsPage title={m.admin_users()} description={m.admin_users_hint()} section={m.admin_title()}>
  <SettingsSection flush>
    <div class="border-b border-[var(--kern-border-hairline)] p-3">
      <SearchBox bind:value={search} placeholder={m.admin_users_search()} label={m.admin_users_search()} />
    </div>

    {#if users.isPending}
      <div class="grid gap-2 p-3">
        <Skeleton class="h-10 w-full rounded-[8px]" />
        <Skeleton class="h-10 w-full rounded-[8px]" />
        <Skeleton class="h-10 w-full rounded-[8px]" />
      </div>
    {:else if users.isError}
      <div class="p-6">
        <EmptyState icon="circle-alert" title={m.error_generic()}>
          {#snippet actions()}
            <Button variant="secondary" size="sm" onclick={() => users.refetch()}>{m.retry()}</Button>
          {/snippet}
        </EmptyState>
      </div>
    {:else if rows.length === 0}
      <div class="p-6">
        <EmptyState icon="users" title={search ? m.admin_users_empty() : m.admin_users_none()} />
      </div>
    {:else}
      <Table
        columns="minmax(0,1.6fr) minmax(0,0.8fr) minmax(0,0.7fr) 44px"
        ariaLabel={m.admin_users()}
      >
        <TableHeader>
          <TableCell header>{m.admin_users_col_user()}</TableCell>
          <TableCell header>{m.admin_users_col_status()}</TableCell>
          <TableCell header>{m.admin_users_col_created()}</TableCell>
          <TableCell header end></TableCell>
        </TableHeader>

        {#each rows as row (row.id)}
          <TableRow>
            <TableCell>
              <div class="flex min-w-0 items-center gap-2.5">
                <Avatar name={row.name} src={row.avatarUrl} id={row.id} size={26} />
                <div class="min-w-0">
                  <div class="flex min-w-0 items-center gap-1.5">
                    <span class="truncate text-[13px] text-[var(--kern-ink-900)]">{row.name}</span>
                    {#if isSelf(row)}<Badge tone="neutral">{m.admin_users_badge_you()}</Badge>{/if}
                    {#if row.instanceAdmin}<Badge tone="accent">{m.admin_users_badge_admin()}</Badge>{/if}
                  </div>
                  <div class="truncate text-[12px] text-[var(--kern-ink-450)]">{row.email}</div>
                </div>
              </div>
            </TableCell>

            <TableCell>
              <div class="grid min-w-0 gap-0.5">
                <span>
                  {#if row.status === 'suspended'}
                    <Badge tone="danger">{m.members_status_suspended()}</Badge>
                  {:else}
                    <Badge tone="success">{m.members_status_active()}</Badge>
                  {/if}
                </span>
                {#if !row.emailVerified}
                  <span class="text-[11.5px] text-[var(--kern-ink-450)]">{m.admin_users_unverified()}</span>
                {/if}
              </div>
            </TableCell>

            <TableCell>
              <span class="text-[12.5px] text-[var(--kern-ink-500)]">{formatDate(row.createdAt)}</span>
            </TableCell>

            <TableCell end>
              <DropdownMenu items={menuFor(row)} align="end">
                {#snippet trigger(props)}
                  <button
                    {...props}
                    aria-label={m.admin_users_actions({ name: row.name })}
                    class="grid h-7 w-7 place-items-center rounded-[6px] text-[var(--kern-ink-400)] transition-colors hover:bg-[var(--kern-surface-hover)] hover:text-[var(--kern-ink-900)]"
                  >
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true">
                      <circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle
                        cx="19"
                        cy="12"
                        r="1.6"
                      />
                    </svg>
                  </button>
                {/snippet}
              </DropdownMenu>
            </TableCell>
          </TableRow>
        {/each}
      </Table>

      <div class="flex items-center justify-between gap-3 px-3 py-2.5">
        <p class="text-[12px] text-[var(--kern-ink-450)]">{m.admin_users_self_hint()}</p>
        {#if users.data?.nextCursor}
          <Button
            variant="secondary"
            size="sm"
            onclick={() => (cursor = users.data?.nextCursor ?? null)}
          >
            {m.admin_users_more()}
          </Button>
        {/if}
      </div>
    {/if}
  </SettingsSection>
</SettingsPage>

<Dialog
  open={pending !== null}
  onOpenChange={(open) => {
    if (!open) pending = null
  }}
  title={dialogTitle}
  size="sm"
>
  <p class="text-[13px] leading-relaxed text-[var(--kern-ink-600)]">{dialogBody}</p>

  {#snippet footer()}
    <Button variant="ghost" onclick={() => (pending = null)}>{m.cancel()}</Button>
    <Button
      variant={pending?.action === 'suspend' ? 'danger' : 'primary'}
      onclick={confirm}
      loading={setStatus.isPending}
    >
      {#if pending?.action === 'suspend'}{m.admin_suspend()}
      {:else if pending?.action === 'activate'}{m.admin_activate()}
      {:else if pending?.action === 'promote'}{m.admin_make_admin()}
      {:else}{m.admin_remove_admin()}{/if}
    </Button>
  {/snippet}
</Dialog>
