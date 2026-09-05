<script lang="ts">
/**
 * A workspace scheduled for erasure says so on every screen in it, and offers the way out.
 *
 * The undo used to live in exactly one place — `/settings/data`, the page the Delete button is on —
 * and scheduling made that page unreachable: core archives the workspace in the same call, the
 * workspace left `users.me()`, and the layout forwarded the owner to `/onboarding`. Even with the
 * workspace reachable again, a 30-day window whose only control is on one settings page is a
 * promise somebody has to go looking for. A workspace being destroyed on a date is the most
 * important thing about it, so it is said wherever the person actually is, with the button in the
 * sentence rather than a link to a page carrying it.
 *
 * Rendered by `(app)/[ws]/+layout.svelte` beside `OfflineBanner`, which is the one place above the
 * page content that every route in a workspace passes through.
 */
import { Button, formatDate, toast } from '@kernhq/ui'
import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query'
import { dataRights, dataRightsKeys } from '$lib/api/data-rights'
import { toastMutationError } from '$lib/api/mutation-errors'
import * as m from '$msg'

interface Props {
  workspaceId: string
  /** the summary's `archivedAt`; the banner is for an archived workspace and nothing else */
  archivedAt: string | null
}

const { workspaceId, archivedAt }: Props = $props()

/**
 * Only ask about a deletion for a workspace that is actually archived.
 *
 * Archiving is also reachable on its own (the danger zone's Archive button), so "archived" does not
 * imply "being erased" — the record is what carries the date and the undo. Asking only when the
 * flag is set keeps this to one request on the workspaces that have one, rather than a `GET` on
 * every route change in every workspace.
 */
const pending = createQuery(() => ({
  queryKey: dataRightsKeys.workspaceDeletion(workspaceId),
  queryFn: () => dataRights.workspaceDeletion.pending(workspaceId),
  enabled: Boolean(archivedAt) && Boolean(workspaceId),
}))

const scheduled = $derived(pending.data?.status === 'scheduled' ? pending.data : null)

const queryClient = useQueryClient()

/*
 * A plain `$state` flag rather than `disabled={isPending}`: the attribute only reaches the button on
 * the next render, so two quick clicks would file two cancellations. Guarding the handler also
 * leaves the control focusable, which disabling it does not — the browser blurs a focused element
 * the moment it becomes disabled and hands focus nowhere.
 */
let cancelling = $state(false)

const cancelDeletion = createMutation(() => ({
  mutationFn: () => dataRights.workspaceDeletion.cancel(workspaceId),
  onSuccess: () => {
    toast.success(m.data_delete_cancelled_toast())
    // `me()` carries the workspace's `archivedAt`, so the banner only goes when that is refetched too
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

{#if scheduled}
  <div
    role="status"
    class="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 bg-[var(--kern-danger-tint)] px-4 py-2 text-[12.5px] text-[var(--kern-danger)]"
  >
    <span>{m.workspace_scheduled_banner({ date: formatDate(scheduled.purgeAfter) })}</span>
    <Button variant="secondary" size="sm" onclick={keepWorkspace} loading={cancelling} aria-busy={cancelling}>
      {m.data_delete_cancel()}
    </Button>
  </div>
{/if}
