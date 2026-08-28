<script lang="ts">
import {
  Avatar,
  Badge,
  Button,
  Dialog,
  DropdownMenu,
  EmptyState,
  Field,
  Input,
  type MenuItem,
  SearchBox,
  Select,
  Skeleton,
  Textarea,
  toast,
} from '@kernhq/ui'
import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query'
import { goto } from '$app/navigation'
import { page } from '$app/state'
import { billingRefusalToast } from '$lib/api/billing-refusal'
import { getApi } from '$lib/api/client'
import SettingsPage from '$lib/components/settings/SettingsPage.svelte'
import SettingsSection from '$lib/components/settings/SettingsSection.svelte'
import { formatDate } from '$lib/format'
import { keys } from '$lib/query'
import { session } from '$lib/state/session.svelte'
import * as m from '$msg'

/**
 * Who is in the workspace, and everything you can do about it: change a role, edit a job title,
 * suspend, remove, invite, revoke and resend. A workspace must always keep an owner, and nobody
 * changes their own role — both are enforced here as well as by the API, so the reason is visible
 * before the action is attempted rather than arriving as an error afterwards.
 */
const api = getApi()
const queryClient = useQueryClient()
const slug = $derived(page.params.ws!)
const workspace = $derived(session.workspaces.find((w) => w.slug === slug))
const workspaceId = $derived(workspace?.id ?? '')

const canManage = $derived(session.can('core.members.manage'))
const canInvite = $derived(session.can('core.members.invite'))

/**
 * Inviting is where a workspace runs out of seats, so it is where the plan has to be explainable.
 *
 * `billing.seats.limit_reached` used to arrive here as the server's own English sentence in a bare
 * toast, with no way forward from it — see `$lib/api/billing-refusal.ts`. The same call carries the
 * suspension gate, which refuses every write in a lapsed workspace and so can land on this one too.
 */
const plan = $derived({ workspaceSlug: slug, canSeePlans: session.can('billing.subscription.view') })

let search = $state('')
let inviteOpen = $state(false)
let inviteMode = $state<'email' | 'directory'>('email')
let inviteEmails = $state('')
let inviteRole = $state('member')
let inviteMessage = $state('')
let directoryQuery = $state('')
let picked = $state<Set<string>>(new Set())

type Member = NonNullable<typeof members.data>['items'][number]
let removing = $state<Member | null>(null)
let editingTitle = $state<Member | null>(null)
let titleDraft = $state('')
let leaveOpen = $state(false)

const members = createQuery(() => ({
  queryKey: keys.members(workspaceId),
  queryFn: () => api.workspaces.members.list({ workspaceId, limit: 200 }),
  enabled: Boolean(workspaceId),
}))

const invitations = createQuery(() => ({
  queryKey: keys.invitations(workspaceId),
  queryFn: () => api.workspaces.invitations.list({ workspaceId }),
  enabled: Boolean(workspaceId) && canManage,
}))

const directory = createQuery(() => ({
  queryKey: ['core', 'directory', directoryQuery],
  queryFn: () => api.users.directory({ q: directoryQuery || undefined, limit: 20 }),
  enabled: inviteOpen && inviteMode === 'directory',
}))

const all = $derived(members.data?.items ?? [])
const owners = $derived(all.filter((row) => row.role === 'owner' && row.status === 'active'))
const visible = $derived(
  all.filter((row) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return row.user.name.toLowerCase().includes(q) || row.user.email.toLowerCase().includes(q)
  }),
)

const roleLabel = (role: string) =>
  ({
    owner: m.members_role_owner(),
    admin: m.members_role_admin(),
    member: m.members_role_member(),
    guest: m.members_role_guest(),
  })[role] ?? role

const statusLabel = (status: string) =>
  ({
    active: m.members_status_active(),
    invited: m.members_status_invited(),
    suspended: m.members_status_suspended(),
  })[status] ?? status

const isSelf = (row: Member) => row.userId === session.user?.id
/** The last owner must keep the workspace: demoting or removing them would strand it. */
const isLastOwner = (row: Member) => row.role === 'owner' && owners.length <= 1

const update = createMutation(() => ({
  mutationFn: (vars: { userId: string; patch: Record<string, unknown>; done: string }) =>
    api.workspaces.members.update({ workspaceId, userId: vars.userId, patch: vars.patch as never }),
  onSuccess: (_res, vars) => {
    toast.success(vars.done)
    void queryClient.invalidateQueries({ queryKey: ['core'] })
  },
  onError: (err) => toast.error(err instanceof Error ? err.message : m.error_generic()),
}))

const remove = createMutation(() => ({
  mutationFn: (userId: string) => api.workspaces.members.remove({ workspaceId, userId }),
  onSuccess: (_res, userId) => {
    const name = all.find((row) => row.userId === userId)?.user.name ?? ''
    toast.success(m.members_removed({ name }))
    removing = null
    void queryClient.invalidateQueries({ queryKey: ['core'] })
  },
  onError: (err) => toast.error(err instanceof Error ? err.message : m.error_generic()),
}))

const leave = createMutation(() => ({
  mutationFn: () => api.workspaces.members.leave({ workspaceId }),
  onSuccess: () => {
    toast.success(m.members_left({ workspace: workspace?.name ?? '' }))
    void goto('/')
  },
  onError: (err) => toast.error(err instanceof Error ? err.message : m.error_generic()),
}))

const invite = createMutation(() => ({
  mutationFn: () => {
    const invites =
      inviteMode === 'email'
        ? inviteEmails
            .split(/[,\n]/)
            .map((e) => e.trim())
            .filter(Boolean)
            .map((email) => ({ email, role: inviteRole }))
        : [...picked].map((userId) => ({ userId, role: inviteRole }))
    return api.workspaces.invitations.create({
      workspaceId,
      invites: invites as never,
      message: inviteMessage || undefined,
    })
  },
  onSuccess: (created) => {
    toast.success(m.invite_sent({ count: created.length }))
    inviteOpen = false
    inviteEmails = ''
    inviteMessage = ''
    picked = new Set()
    void queryClient.invalidateQueries({ queryKey: keys.invitations(workspaceId) })
  },
  onError: (err) => {
    if (billingRefusalToast(err, plan)) return
    toast.error(err instanceof Error ? err.message : m.error_generic())
  },
}))

const revoke = createMutation(() => ({
  mutationFn: (id: string) => api.workspaces.invitations.revoke({ workspaceId, id }),
  onSuccess: () => {
    toast.success(m.invite_revoked())
    void queryClient.invalidateQueries({ queryKey: keys.invitations(workspaceId) })
  },
}))

// There is no resend endpoint: inviting the same address again issues a fresh token and email.
const resend = createMutation(() => ({
  mutationFn: (invitation: { email: string; role: string }) =>
    api.workspaces.invitations.create({
      workspaceId,
      invites: [{ email: invitation.email, role: invitation.role }] as never,
    }),
  onSuccess: (_res, invitation) => {
    toast.success(m.invite_resent({ email: invitation.email }))
    void queryClient.invalidateQueries({ queryKey: keys.invitations(workspaceId) })
  },
  onError: (err) => {
    if (billingRefusalToast(err, plan)) return
    toast.error(err instanceof Error ? err.message : m.error_generic())
  },
}))

/** Why this member's role cannot be changed, or null when it can. */
function roleBlockedReason(row: Member): string | null {
  if (isSelf(row)) return m.members_cannot_change_own_role()
  if (isLastOwner(row)) return m.members_last_owner()
  return null
}

function rowMenu(row: Member): MenuItem[] {
  const blocked = roleBlockedReason(row)
  const roles = ['owner', 'admin', 'member', 'guest'] as const

  const items: MenuItem[] = [
    { type: 'label', label: m.members_change_role() },
    ...(blocked
      ? ([{ label: roleLabel(row.role), icon: 'shield-check', disabled: true, hint: blocked }] as MenuItem[])
      : ([
          {
            type: 'radio',
            value: row.role,
            options: roles.map((r) => ({ value: r, label: roleLabel(r) })),
            onValueChange: (role) =>
              update.mutate({ userId: row.userId, patch: { role }, done: m.members_role_updated() }),
          },
        ] as MenuItem[])),
    { type: 'separator' },
    {
      label: m.members_edit_title(),
      icon: 'square-pen',
      onSelect: () => {
        editingTitle = row
        titleDraft = row.title ?? ''
      },
    },
    {
      label: m.members_copy_email(),
      icon: 'copy',
      onSelect: () => {
        void navigator.clipboard.writeText(row.user.email)
        toast.success(m.copied())
      },
    },
  ]

  if (!isSelf(row)) {
    items.push({
      label: row.status === 'suspended' ? m.members_reactivate() : m.members_suspend(),
      icon: row.status === 'suspended' ? 'circle-check' : 'circle-alert',
      disabled: Boolean(blocked),
      hint: blocked ?? undefined,
      onSelect: () =>
        update.mutate({
          userId: row.userId,
          patch: { status: row.status === 'suspended' ? 'active' : 'suspended' },
          done:
            row.status === 'suspended'
              ? m.members_reactivated_toast({ name: row.user.name })
              : m.members_suspended_toast({ name: row.user.name }),
        }),
    })
    items.push({ type: 'separator' })
    items.push({
      label: m.members_remove(),
      icon: 'trash-2',
      danger: true,
      disabled: Boolean(blocked),
      hint: blocked ?? undefined,
      onSelect: () => (removing = row),
    })
  } else {
    items.push({ type: 'separator' })
    items.push({
      label: m.members_leave(),
      icon: 'log-out',
      danger: true,
      disabled: isLastOwner(row),
      hint: isLastOwner(row) ? m.members_last_owner() : undefined,
      onSelect: () => (leaveOpen = true),
    })
  }

  // a member who cannot manage others may still leave, so the menu is never empty
  return canManage
    ? items
    : items.filter(
        (i) => 'label' in i && (i.label === m.members_leave() || i.label === m.members_copy_email()),
      )
}

const roleOptions = [
  { value: 'admin', label: m.members_role_admin() },
  { value: 'member', label: m.members_role_member() },
  { value: 'guest', label: m.members_role_guest() },
]

function togglePicked(id: string) {
  const next = new Set(picked)
  next.has(id) ? next.delete(id) : next.add(id)
  picked = next
}

const canSendInvite = $derived(inviteMode === 'email' ? inviteEmails.trim().length > 0 : picked.size > 0)
</script>


<SettingsPage title={m.members_title()} description={m.members_count({ count: all.length })}>
  {#snippet actions()}
    <SearchBox bind:value={search} placeholder={m.members_search()} width="200px" />
    {#if canInvite}
      <Button size="sm" onclick={() => (inviteOpen = true)}>{m.members_invite()}</Button>
    {/if}
  {/snippet}

  <SettingsSection flush>
    <div
      class="grid grid-cols-[minmax(0,1fr)_110px_110px_100px_40px] items-center gap-3 border-b border-[var(--kern-border)] px-[18px] py-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--kern-ink-350)]"
    >
      <span>{m.members_col_name()}</span>
      <span>{m.members_col_role()}</span>
      <span>{m.members_col_joined()}</span>
      <span>{m.members_col_status()}</span>
      <span></span>
    </div>

    {#if members.isPending}
      <div class="grid gap-2 p-4">
        {#each [1, 2, 3] as i (i)}<Skeleton class="h-10 w-full" />{/each}
      </div>
    {:else if members.isError}
      <div class="p-8">
        <EmptyState icon="triangle-alert" title={m.error_generic()} compact>
          {#snippet actions()}
            <Button size="sm" variant="secondary" onclick={() => members.refetch()}>{m.retry()}</Button>
          {/snippet}
        </EmptyState>
      </div>
    {:else if visible.length === 0}
      <div class="p-8"><EmptyState icon="users" title={m.members_empty()} compact /></div>
    {:else}
      {#each visible as row (row.id)}
        <div
          class="grid grid-cols-[minmax(0,1fr)_110px_110px_100px_40px] items-center gap-3 border-b border-[var(--kern-border-hairline)] px-[18px] py-2.5 last:border-0 hover:bg-[var(--kern-surface-hover)]"
        >
          <div class="flex min-w-0 items-center gap-2.5">
            <Avatar name={row.user.name} src={row.user.avatarUrl} id={row.user.id} size={26} />
            <div class="min-w-0">
              <div class="flex items-center gap-1.5">
                <span class="truncate text-[13px] text-[var(--kern-ink-900)]">{row.user.name}</span>
                {#if isSelf(row)}
                  <span class="text-[11.5px] text-[var(--kern-ink-400)]">({m.members_you()})</span>
                {/if}
              </div>
              <div class="truncate text-[11.5px] text-[var(--kern-ink-400)]">
                {row.title || row.user.email}
              </div>
            </div>
          </div>

          <span class="text-[13px] text-[var(--kern-ink-700)]">{roleLabel(row.role)}</span>

          <span class="font-[var(--kern-font-mono)] text-[11.5px] text-[var(--kern-ink-450)]">
            {formatDate(row.joinedAt)}
          </span>

          <span>
            <Badge tone={row.status === 'active' ? 'success' : row.status === 'suspended' ? 'danger' : 'grey'}>
              {statusLabel(row.status)}
            </Badge>
          </span>

          <div class="flex justify-end">
            <DropdownMenu items={rowMenu(row)} align="end">
              {#snippet trigger(props)}
                <button
                  {...props}
                  aria-label={m.members_actions()}
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
          </div>
        </div>
      {/each}
    {/if}
  </SettingsSection>

  {#if canManage && (invitations.data?.length ?? 0) > 0}
    <SettingsSection title={m.members_pending()} flush>
      {#each invitations.data! as inv (inv.id)}
        <div
          class="flex items-center gap-3 border-b border-[var(--kern-border-hairline)] px-[18px] py-2.5 last:border-0"
        >
          <div class="min-w-0 flex-1">
            <div class="truncate text-[13px] text-[var(--kern-ink-800)]">{inv.email}</div>
            <div class="text-[11.5px] text-[var(--kern-ink-400)]">
              {m.invite_expires({ date: formatDate(inv.expiresAt) })}
            </div>
          </div>
          <Badge tone="grey">{roleLabel(inv.role)}</Badge>
          <Button
            size="sm"
            variant="ghost"
            loading={resend.isPending}
            onclick={() => resend.mutate({ email: inv.email, role: inv.role })}
          >
            {m.invite_resend()}
          </Button>
          <Button size="sm" variant="ghost" onclick={() => revoke.mutate(inv.id)}>{m.invite_revoke()}</Button>
        </div>
      {/each}
    </SettingsSection>
  {/if}
</SettingsPage>

<!-- invite -->
<Dialog bind:open={inviteOpen} title={m.invite_dialog_title({ workspace: workspace?.name ?? '' })}>
  <div class="grid gap-4">
    <div class="flex gap-1 rounded-[9px] bg-[var(--kern-surface-chip)] p-1">
      {#each [{ id: 'email', label: m.invite_by_email() }, { id: 'directory', label: m.invite_from_directory() }] as opt (opt.id)}
        <button
          type="button"
          class="flex-1 rounded-[7px] px-2 py-1.5 text-[12.5px] transition-colors {inviteMode === opt.id
            ? 'bg-[var(--kern-surface-raised)] text-[var(--kern-ink-900)] shadow-[var(--kern-shadow-segment)]'
            : 'text-[var(--kern-ink-500)]'}"
          onclick={() => (inviteMode = opt.id as 'email' | 'directory')}
        >
          {opt.label}
        </button>
      {/each}
    </div>

    {#if inviteMode === 'email'}
      <Field label={m.auth_email()} id="invite-emails">
        {#snippet children(id)}
          <Textarea {id} bind:value={inviteEmails} rows={3} placeholder={m.invite_email_placeholder()} />
        {/snippet}
      </Field>
    {:else}
      <SearchBox bind:value={directoryQuery} placeholder={m.members_search()} />
      <div class="max-h-[220px] overflow-y-auto rounded-[10px] border border-[var(--kern-border)]">
        {#if (directory.data?.items.length ?? 0) === 0}
          <p class="p-4 text-center text-[12.5px] text-[var(--kern-ink-400)]">{m.invite_directory_empty()}</p>
        {:else}
          {#each directory.data!.items as person (person.id)}
            <button
              type="button"
              class="flex w-full items-center gap-2.5 border-b border-[var(--kern-border-hairline)] px-3 py-2 text-start last:border-0 hover:bg-[var(--kern-surface-hover)] {picked.has(
                person.id,
              )
                ? 'bg-[var(--kern-accent-tint)]'
                : ''}"
              onclick={() => togglePicked(person.id)}
            >
              <Avatar name={person.name} src={person.avatarUrl} id={person.id} size={24} />
              <span class="min-w-0 flex-1">
                <span class="block truncate text-[13px] text-[var(--kern-ink-900)]">{person.name}</span>
                <span class="block truncate text-[11.5px] text-[var(--kern-ink-400)]">
                  {m.invite_shares_with_you({ count: person.sharedWorkspaces?.length ?? 1 })}
                </span>
              </span>
              {#if picked.has(person.id)}<Badge tone="accent">✓</Badge>{/if}
            </button>
          {/each}
        {/if}
      </div>
    {/if}

    <Field label={m.invite_role()} id="invite-role">
      {#snippet children(id)}
        <Select {id} bind:value={inviteRole} options={roleOptions} />
      {/snippet}
    </Field>
    <Field label={m.invite_message()} id="invite-message" hint={m.optional()}>
      {#snippet children(id)}
        <Textarea {id} bind:value={inviteMessage} rows={2} placeholder={m.invite_message_placeholder()} />
      {/snippet}
    </Field>
  </div>

  {#snippet footer()}
    <Button variant="ghost" onclick={() => (inviteOpen = false)}>{m.cancel()}</Button>
    <Button onclick={() => invite.mutate()} disabled={!canSendInvite} loading={invite.isPending}>
      {m.invite_send()}
    </Button>
  {/snippet}
</Dialog>

<!-- job title -->
<Dialog
  open={editingTitle !== null}
  onOpenChange={(open) => {
    if (!open) editingTitle = null
  }}
  title={m.members_edit_title()}
  size="sm"
>
  <Field label={m.members_title_label()} id="member-title">
    {#snippet children(id)}
      <Input {id} bind:value={titleDraft} placeholder="Engineering lead" />
    {/snippet}
  </Field>

  {#snippet footer()}
    <Button variant="ghost" onclick={() => (editingTitle = null)}>{m.cancel()}</Button>
    <Button
      loading={update.isPending}
      onclick={() => {
        if (!editingTitle) return
        update.mutate({
          userId: editingTitle.userId,
          patch: { title: titleDraft || null },
          done: m.members_title_updated(),
        })
        editingTitle = null
      }}
    >
      {m.save()}
    </Button>
  {/snippet}
</Dialog>

<!-- remove -->
<Dialog
  open={removing !== null}
  onOpenChange={(open) => {
    if (!open) removing = null
  }}
  title={removing ? m.members_remove_title({ name: removing.user.name }) : ''}
  size="sm"
>
  <p class="text-[13px] leading-relaxed text-[var(--kern-ink-600)]">{m.members_remove_body()}</p>

  {#snippet footer()}
    <Button variant="ghost" onclick={() => (removing = null)}>{m.cancel()}</Button>
    <Button variant="danger" loading={remove.isPending} onclick={() => removing && remove.mutate(removing.userId)}>
      {m.remove()}
    </Button>
  {/snippet}
</Dialog>

<!-- leave -->
<Dialog bind:open={leaveOpen} title={m.members_leave_title({ workspace: workspace?.name ?? '' })} size="sm">
  <p class="text-[13px] leading-relaxed text-[var(--kern-ink-600)]">{m.members_leave_body()}</p>

  {#snippet footer()}
    <Button variant="ghost" onclick={() => (leaveOpen = false)}>{m.cancel()}</Button>
    <Button variant="danger" loading={leave.isPending} onclick={() => leave.mutate()}>
      {m.members_leave()}
    </Button>
  {/snippet}
</Dialog>
