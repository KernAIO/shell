<script lang="ts">
import {
  Badge,
  Button,
  Dialog,
  formatBytes,
  formatDate,
  formatDateTime,
  Icon,
  Input,
  Skeleton,
  Textarea,
  toast,
} from '@kernhq/ui'
import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query'
import { page } from '$app/state'
import { dataRights, dataRightsKeys, type ExportRecord } from '$lib/api/data-rights'
import { toastMutationError } from '$lib/api/mutation-errors'
import SettingsPage from '$lib/components/settings/SettingsPage.svelte'
import SettingsSection from '$lib/components/settings/SettingsSection.svelte'
import { session } from '$lib/state/session.svelte'
import * as m from '$msg'

/**
 * Taking a copy of a workspace's data out, and having the workspace erased.
 *
 * Both are promised by the terms and the privacy policy, both were implemented in core, and until
 * now nothing in the product called either: the danger zone on the general settings page offered
 * Archive and nothing else. For an EU customer portability and erasure are not features, they are
 * obligations — so a screen that does not exist is not a gap in the interface, it is the obligation
 * unmet.
 *
 * These are the one part of core's API that is not on the contract (see `$lib/api/data-rights`), so
 * they are plain `fetch` calls rather than SDK procedures. Nothing else about the screen differs.
 */
const queryClient = useQueryClient()
const slug = $derived(page.params.ws!)
const workspaceId = $derived(session.workspaces.find((w) => w.slug === slug)?.id ?? '')
const workspaceName = $derived(session.workspaces.find((w) => w.slug === slug)?.name ?? slug)

const canExport = $derived(session.can('core.export.run'))
const canDelete = $derived(session.can('core.workspace.delete'))

const exportsQuery = createQuery(() => ({
  queryKey: dataRightsKeys.exports(workspaceId),
  queryFn: () => dataRights.exports.list(workspaceId),
  enabled: Boolean(workspaceId) && canExport,
  /**
   * An export is built by a background job, so the row arrives `pending` and becomes `ready` some
   * seconds later with nothing pushing that news. Poll only while one is actually building — a
   * screen that polls for ever is a screen that costs a request every two seconds for as long as
   * somebody leaves the tab open.
   */
  refetchInterval: (query) =>
    (query.state.data ?? []).some((r) => r.status === 'pending' || r.status === 'running') ? 2_000 : false,
}))

const deletionQuery = createQuery(() => ({
  queryKey: dataRightsKeys.workspaceDeletion(workspaceId),
  queryFn: () => dataRights.workspaceDeletion.pending(workspaceId),
  enabled: Boolean(workspaceId) && canDelete,
}))

const rows = $derived(exportsQuery.data ?? [])
const building = $derived(rows.some((r) => r.status === 'pending' || r.status === 'running'))
const scheduled = $derived(deletionQuery.data ?? null)

/* --------------------------------------------------------------------------- export */

let requesting = $state(false)
const requestExport = createMutation(() => ({
  mutationFn: () => dataRights.exports.request(workspaceId),
  onSuccess: () => {
    toast.success(m.data_export_requested())
    void queryClient.invalidateQueries({ queryKey: dataRightsKeys.exports(workspaceId) })
  },
  onError: (err) => toastMutationError(err),
  onSettled: () => {
    requesting = false
  },
}))

/**
 * A plain flag rather than `disabled={isPending}`: the attribute only reaches the button on the next
 * render, and two quick clicks are one render apart. Core de-duplicates a second request anyway —
 * it hands back the build already in flight — but an export reads every table in the workspace and
 * the click that starts a second one should not leave this screen.
 */
function startExport() {
  if (requesting || building) return
  requesting = true
  requestExport.mutate()
}

let downloading = $state<string | null>(null)
async function download(row: ExportRecord) {
  if (downloading) return
  downloading = row.id
  try {
    const { url } = await dataRights.exports.downloadUrl(workspaceId, row.id)
    /*
     * A presigned URL rather than a redirect, opened in a new tab. `window.open` rather than a
     * synthesised `<a download>`: the URL points at object storage on another origin, where the
     * `download` attribute is ignored anyway, and core already sets the filename and
     * `content-disposition: attachment` in the signature.
     */
    window.open(url, '_blank', 'noopener')
  } catch (err) {
    toastMutationError(err)
  } finally {
    downloading = null
  }
}

const statusTone = (s: ExportRecord['status']) =>
  s === 'ready' ? 'done' : s === 'failed' ? 'danger' : s === 'expired' ? 'neutral' : 'active'

const statusLabel = (s: ExportRecord['status']) =>
  s === 'ready'
    ? m.data_export_ready()
    : s === 'failed'
      ? m.data_export_failed()
      : s === 'expired'
        ? m.data_export_expired()
        : s === 'running'
          ? m.data_export_running()
          : m.data_export_pending()

/* ------------------------------------------------------------------------- deletion */

let deleteOpen = $state(false)
let confirmText = $state('')
let reason = $state('')
let deleting = $state(false)
/** Typing the workspace's own name, so the confirmation cannot be dismissed by reflex. */
const confirmed = $derived(confirmText.trim() === workspaceName)

const scheduleDeletion = createMutation(() => ({
  mutationFn: () => dataRights.workspaceDeletion.schedule(workspaceId, reason.trim() || undefined),
  onSuccess: (record) => {
    deleteOpen = false
    confirmText = ''
    reason = ''
    toast.success(m.data_delete_scheduled_toast({ date: formatDate(record.purgeAfter) }))
    void queryClient.invalidateQueries({ queryKey: ['core'] })
    /*
     * Stay on this page, which now renders the scheduled panel at the top of it.
     *
     * This used to `goto('/workspaces')` on the reasoning that a workspace on its way out is not
     * one to keep working in. Two things were wrong with that. The smaller one is that it takes the
     * undo away from the person the instant they might want it: they pressed a button, and the
     * screen that would tell them what happens next is one they have to find. The larger one is
     * that it could not work at all — scheduling archives the workspace, archived workspaces were
     * absent from `users.me()`, and so the chooser they were sent to offered "Create your first
     * workspace" instead. Landing back on the page you pressed the button on, with the date and the
     * way to call it off on it, is both kinder and the thing that actually happens.
     */
  },
  onError: (err) => toastMutationError(err),
  onSettled: () => {
    deleting = false
  },
}))

function confirmDelete() {
  if (deleting || !confirmed) return
  deleting = true
  scheduleDeletion.mutate()
}

let cancelling = $state(false)
const cancelDeletion = createMutation(() => ({
  mutationFn: () => dataRights.workspaceDeletion.cancel(workspaceId),
  onSuccess: () => {
    toast.success(m.data_delete_cancelled_toast())
    void queryClient.invalidateQueries({ queryKey: ['core'] })
  },
  onError: (err) => toastMutationError(err),
  onSettled: () => {
    cancelling = false
  },
}))

function keepWorkspace() {
  if (cancelling) return
  cancelling = true
  cancelDeletion.mutate()
}
</script>

<SettingsPage title={m.data_title()} description={m.data_hint()}>
  {#if scheduled}
    <!--
      The scheduled erasure comes first and cannot be missed: everything else on this page is about
      a workspace that is going to be destroyed on a date, and the way to stop that is here.
    -->
    <SettingsSection title={m.data_delete_scheduled_title()} tone="danger">
      <div class="grid gap-3 py-1">
        <p class="text-[13px] leading-relaxed text-[var(--kern-ink-700)]">
          {m.data_delete_scheduled_body({ date: formatDateTime(scheduled.purgeAfter) })}
        </p>
        {#if scheduled.followUps.length}
          <div class="grid gap-1.5">
            <div class="text-[11.5px] uppercase tracking-[0.06em] text-[var(--kern-ink-400)]">
              {m.data_follow_ups()}
            </div>
            <ul class="grid gap-1">
              {#each scheduled.followUps as note (note)}
                <li class="text-[12.5px] leading-relaxed text-[var(--kern-ink-600)]">{note}</li>
              {/each}
            </ul>
          </div>
        {/if}
        <div>
          <Button variant="secondary" size="sm" onclick={keepWorkspace} loading={cancelling}>
            {m.data_delete_cancel()}
          </Button>
        </div>
      </div>
    </SettingsSection>
  {/if}

  {#if canExport}
    <SettingsSection
      title={m.data_export_title()}
      description={m.data_export_hint()}
      action={exportAction}
    >
      {#if exportsQuery.isPending}
        <Skeleton class="h-[72px] w-full rounded-[8px]" />
      {:else if rows.length === 0}
        <p class="py-3 text-[13px] text-[var(--kern-ink-500)]">{m.data_export_empty()}</p>
      {:else}
        <ul class="grid">
          {#each rows as row, i (row.id)}
            <li
              class="grid gap-x-4 gap-y-2 py-3.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center {i ===
              0
                ? ''
                : 'border-t border-[var(--kern-border-hairline)]'}"
            >
              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-2">
                  <Badge tone={statusTone(row.status)}>{statusLabel(row.status)}</Badge>
                  <span class="text-[13px] text-[var(--kern-ink-800)]">
                    {formatDateTime(row.createdAt)}
                  </span>
                  {#if row.sizeBytes !== null}
                    <span class="text-[12.5px] text-[var(--kern-ink-450)]">{formatBytes(row.sizeBytes)}</span>
                  {/if}
                </div>
                {#if row.status === 'ready' && row.expiresAt}
                  <p class="mt-0.5 text-[12px] text-[var(--kern-ink-450)]">
                    {m.data_export_expires({ date: formatDateTime(row.expiresAt) })}
                  </p>
                {/if}
                {#if row.status === 'failed' && row.error}
                  <p class="mt-0.5 text-[12px] text-[var(--kern-danger)]">{row.error}</p>
                {/if}
                <!--
                  The modules whose data is *not* in the archive, shown rather than hidden. No
                  first-party module implements `<module>.export` yet, so this list is not an edge
                  case — it is every export today, and a customer who believes they have all their
                  data when they do not is worse off than one who was told.
                -->
                {#if row.status === 'ready' && row.followUps.length}
                  <details class="mt-1.5">
                    <summary
                      class="inline-flex cursor-pointer items-center gap-1.5 text-[12px] text-[var(--kern-ink-600)]"
                    >
                      <Icon name="info" size={13} />
                      {m.data_export_partial({ count: row.followUps.length })}
                    </summary>
                    <ul class="mt-1.5 grid gap-1 ps-[18px]">
                      {#each row.followUps as note (note)}
                        <li class="text-[12px] leading-relaxed text-[var(--kern-ink-600)]">{note}</li>
                      {/each}
                    </ul>
                  </details>
                {/if}
              </div>
              <div class="sm:justify-self-end">
                {#if row.status === 'ready'}
                  <Button
                    variant="secondary"
                    size="sm"
                    icon="download"
                    loading={downloading === row.id}
                    onclick={() => download(row)}
                  >
                    {m.data_export_download()}
                  </Button>
                {/if}
              </div>
            </li>
          {/each}
        </ul>
      {/if}
    </SettingsSection>
  {/if}

  {#if canDelete && !scheduled}
    <SettingsSection title={m.ws_danger_zone()} tone="danger">
      <div class="grid gap-x-6 gap-y-2 py-3.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div class="min-w-0">
          <div class="text-[13px] font-medium text-[var(--kern-ink-800)]">{m.data_delete_title()}</div>
          <p class="mt-0.5 text-[12px] leading-relaxed text-[var(--kern-ink-450)]">{m.data_delete_hint()}</p>
        </div>
        <div class="sm:justify-self-end">
          <Button variant="danger" size="sm" onclick={() => (deleteOpen = true)}>
            {m.data_delete_title()}
          </Button>
        </div>
      </div>
    </SettingsSection>
  {/if}
</SettingsPage>

{#snippet exportAction()}
  <Button size="sm" onclick={startExport} loading={requesting || building}>
    {building ? m.data_export_building() : m.data_export_request()}
  </Button>
{/snippet}

<Dialog bind:open={deleteOpen} title={m.data_delete_confirm_title({ name: workspaceName })} size="sm">
  <div class="grid gap-3.5">
    <p class="text-[13px] leading-relaxed text-[var(--kern-ink-700)]">{m.data_delete_confirm_body()}</p>
    <label class="grid gap-1.5">
      <span class="text-[12.5px] text-[var(--kern-ink-600)]"
        >{m.data_delete_confirm_prompt({ name: workspaceName })}</span
      >
      <Input bind:value={confirmText} autocomplete="off" />
    </label>
    <label class="grid gap-1.5">
      <span class="text-[12.5px] text-[var(--kern-ink-600)]">{m.data_delete_reason()}</span>
      <Textarea bind:value={reason} rows={2} />
    </label>
  </div>

  {#snippet footer()}
    <Button variant="ghost" onclick={() => (deleteOpen = false)}>{m.cancel()}</Button>
    <Button variant="danger" onclick={confirmDelete} disabled={!confirmed} loading={deleting}>
      {m.data_delete_title()}
    </Button>
  {/snippet}
</Dialog>
