<script lang="ts">
import {
  Avatar,
  Badge,
  Button,
  Card,
  Dialog,
  Field,
  Input,
  SearchBox,
  Select,
  Skeleton,
  Table,
  TableCell,
  TableHeader,
  TableRow,
  Textarea,
  toast,
} from '@kernaio/ui'
import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query'
import { page } from '$app/state'
import { getApi } from '$lib/api/client'
import { formatDate } from '$lib/format'
import { keys } from '$lib/query'
import { session } from '$lib/state/session.svelte'
import * as m from '$msg'

const api = getApi()
const queryClient = useQueryClient()
const slug = $derived(page.params.ws!)
const workspaceId = $derived(session.workspaces.find((w) => w.slug === slug)?.id ?? '')

let search = $state('')
let inviteOpen = $state(false)
let inviteMode = $state<'email' | 'directory'>('email')
let inviteEmails = $state('')
let inviteRole = $state('member')
let inviteMessage = $state('')
let directoryQuery = $state('')
let picked = $state<Set<string>>(new Set())

const members = createQuery(() => ({
  queryKey: keys.members(workspaceId),
  queryFn: () => api.workspaces.members.list({ workspaceId, limit: 100 }),
  enabled: Boolean(workspaceId),
}))

const invitations = createQuery(() => ({
  queryKey: keys.invitations(workspaceId),
  queryFn: () => api.workspaces.invitations.list({ workspaceId }),
  enabled: Boolean(workspaceId) && session.can('core.members.manage'),
}))

// people you already share a workspace with — inviting a colleague should not require typing
// their address again
const directory = createQuery(() => ({
  queryKey: ['core', 'directory', directoryQuery],
  queryFn: () => api.users.directory({ q: directoryQuery || undefined, limit: 20 }),
  enabled: inviteOpen && inviteMode === 'directory',
}))

const roleOptions = [
  { value: 'admin', label: m.members_role_admin() },
  { value: 'member', label: m.members_role_member() },
  { value: 'guest', label: m.members_role_guest() },
]

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

const visible = $derived(
  (members.data?.items ?? []).filter((row) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return row.user.name.toLowerCase().includes(q) || row.user.email.toLowerCase().includes(q)
  }),
)

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
  onError: (err) => toast.error(err instanceof Error ? err.message : m.error_generic()),
}))

const revoke = createMutation(() => ({
  mutationFn: (id: string) => api.workspaces.invitations.revoke({ workspaceId, id }),
  onSuccess: () => {
    toast.success(m.invite_revoked())
    void queryClient.invalidateQueries({ queryKey: keys.invitations(workspaceId) })
  },
}))

function togglePicked(id: string) {
  const next = new Set(picked)
  next.has(id) ? next.delete(id) : next.add(id)
  picked = next
}

const canInvite = $derived(inviteMode === 'email' ? inviteEmails.trim().length > 0 : picked.size > 0)
</script>

<svelte:head><title>{m.members_title()} · {m.settings_title()}</title></svelte:head>

<div class="grid gap-4">
  <Card class="p-0">
    <header class="flex items-center gap-3 border-b border-[var(--kern-border)] px-4 py-3">
      <h2 class="flex-1 text-[15px] font-semibold text-[var(--kern-ink-900)]">{m.members_title()}</h2>
      <SearchBox bind:value={search} placeholder={m.members_search()} class="w-[200px]" />
      {#if session.can('core.members.invite')}
        <Button onclick={() => (inviteOpen = true)}>{m.members_invite()}</Button>
      {/if}
    </header>

    {#if members.isPending}
      <div class="grid gap-2 p-4">
        {#each [1, 2, 3] as i (i)}<Skeleton class="h-10 w-full" />{/each}
      </div>
    {:else}
      <Table columns="minmax(0,2fr) 100px 110px 90px">
        <TableHeader>
          <TableCell header>{m.members_col_name()}</TableCell>
          <TableCell header>{m.members_col_role()}</TableCell>
          <TableCell header>{m.members_col_joined()}</TableCell>
          <TableCell header>{m.members_col_status()}</TableCell>
        </TableHeader>

        {#each visible as row (row.id)}
          <TableRow>
            <TableCell>
              <div class="flex items-center gap-2.5">
                <Avatar name={row.user.name} src={row.user.avatarUrl} id={row.user.id} size={26} />
                <div class="min-w-0">
                  <div class="truncate text-[13px] text-[var(--kern-ink-900)]">{row.user.name}</div>
                  <div class="truncate text-[11.5px] text-[var(--kern-ink-400)]">{row.user.email}</div>
                </div>
              </div>
            </TableCell>
            <TableCell>{roleLabel(row.role)}</TableCell>
            <TableCell class="font-[var(--kern-font-mono)] text-[11.5px]">{formatDate(row.joinedAt)}</TableCell>
            <TableCell>
              <Badge tone={row.status === 'active' ? 'success' : 'neutral'}>
                {statusLabel(row.status)}
              </Badge>
            </TableCell>
          </TableRow>
        {/each}
      </Table>
    {/if}
  </Card>

  {#if session.can('core.members.manage') && (invitations.data?.length ?? 0) > 0}
    <Card class="p-0">
      <header class="border-b border-[var(--kern-border)] px-4 py-3">
        <h2 class="text-[15px] font-semibold text-[var(--kern-ink-900)]">{m.members_pending()}</h2>
      </header>
      <ul>
        {#each invitations.data! as inv (inv.id)}
          <li class="flex items-center gap-3 border-b border-[var(--kern-border-hairline)] px-4 py-2.5 last:border-0">
            <span class="min-w-0 flex-1 truncate text-[13px] text-[var(--kern-ink-700)]">{inv.email}</span>
            <Badge tone="grey">{roleLabel(inv.role)}</Badge>
            <Button size="sm" variant="ghost" onclick={() => revoke.mutate(inv.id)}>{m.invite_revoke()}</Button>
          </li>
        {/each}
      </ul>
    </Card>
  {/if}
</div>

<Dialog bind:open={inviteOpen} title={m.invite_dialog_title({ workspace: session.workspaces.find((w) => w.slug === slug)?.name ?? '' })}>
  <div class="grid gap-4">
    <div class="flex gap-1 rounded-[9px] bg-[var(--kern-surface-chip)] p-1">
      {#each [{ id: 'email', label: m.invite_by_email() }, { id: 'directory', label: m.invite_from_directory() }] as opt (opt.id)}
        <button
          type="button"
          class="flex-1 rounded-[7px] px-2 py-1.5 text-[12.5px] transition-colors {inviteMode === opt.id
            ? 'bg-[var(--kern-ink-inverse)] text-[var(--kern-ink-900)] shadow-[var(--kern-shadow-segment)]'
            : 'text-[var(--kern-ink-500)]'}"
          onclick={() => (inviteMode = opt.id as 'email' | 'directory')}
        >
          {opt.label}
        </button>
      {/each}
    </div>

    {#if inviteMode === 'email'}
      <Field label={m.auth_email()} id="invite-emails">
        <Textarea id="invite-emails" bind:value={inviteEmails} rows={3} placeholder={m.invite_email_placeholder()} />
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
      <Select id="invite-role" bind:value={inviteRole} options={roleOptions} />
    </Field>
    <Field label={m.invite_message()} id="invite-message" hint={m.optional()}>
      <Textarea id="invite-message" bind:value={inviteMessage} rows={2} placeholder={m.invite_message_placeholder()} />
    </Field>
  </div>

  {#snippet footer()}
    <Button variant="ghost" onclick={() => (inviteOpen = false)}>{m.cancel()}</Button>
    <Button onclick={() => invite.mutate()} disabled={!canInvite} loading={invite.isPending}>
      {m.invite_send()}
    </Button>
  {/snippet}
</Dialog>
