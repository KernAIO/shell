<script lang="ts">
import { Button, Dialog, Input, Select, toast } from '@kernhq/ui'
import { createMutation, useQueryClient } from '@tanstack/svelte-query'
import * as m from '$msg'
import { getTrackerApi } from '../api'
import { canTracker } from '../permissions'
import { trackerKeys } from '../query'

/**
 * Naming the query you are looking at.
 *
 * The view captures what the page is showing — the KQL, the layout and the grouping — because that
 * is what somebody means by "this view". Anything they change afterwards is a different view until
 * they save it again.
 */
interface Props {
  open: boolean
  workspaceId: string
  kql: string
  layout: 'list' | 'board'
  groupBy: string
  onclose: () => void
}
let { open, workspaceId, kql, layout, groupBy, onclose }: Props = $props()

const api = getTrackerApi()
const queryClient = useQueryClient()

let name = $state('')
let visibility = $state<'private' | 'project' | 'workspace'>('private')

$effect(() => {
  if (!open) return
  name = ''
  visibility = 'private'
})

/** Sharing a view with other people is a permission; keeping one for yourself is not. */
const canShare = $derived(canTracker('viewManageShared'))
const options = $derived([
  { value: 'private', label: m.tracker_view_private() },
  ...(canShare
    ? [
        { value: 'project', label: m.tracker_view_project() },
        { value: 'workspace', label: m.tracker_view_workspace() },
      ]
    : []),
])

const save = createMutation(() => ({
  mutationFn: () =>
    api.views.create({
      workspaceId,
      name: name.trim(),
      kql,
      layout,
      display: { groupBy },
      visibility,
    } as never),
  onSuccess: (view: { name: string }) => {
    void queryClient.invalidateQueries({ queryKey: trackerKeys.views(workspaceId) })
    toast.success(m.tracker_view_saved({ name: view.name }))
    onclose()
  },
  onError: (error: Error) => toast.error(error.message),
}))
</script>

<Dialog
  {open}
  title={m.tracker_view_save()}
  size="sm"
  onOpenChange={(next: boolean) => {
    if (!next) onclose()
  }}
>
  <div class="grid gap-3">
    <label class="grid gap-1">
      <span class="lbl">{m.tracker_view_name()}</span>
      <Input bind:value={name} placeholder="My open bugs" data-testid="view-name" />
    </label>
    <label class="grid gap-1">
      <span class="lbl">{m.tracker_view_visibility()}</span>
      <Select
        value={visibility}
        {options}
        onValueChange={(v: string) => (visibility = v as typeof visibility)}
      />
    </label>
    <p class="preview" data-testid="view-preview">{kql || m.tracker_all_issues()}</p>
  </div>

  {#snippet footer()}
    <Button variant="ghost" size="sm" onclick={onclose}>{m.cancel()}</Button>
    <Button
      size="sm"
      disabled={!name.trim()}
      loading={save.isPending}
      onclick={() => save.mutate()}
      data-testid="view-save"
    >
      {m.save()}
    </Button>
  {/snippet}
</Dialog>

<style>
.lbl {
  font-size: 12px;
  color: var(--kern-ink-550);
}
.preview {
  margin: 0;
  padding: 6px 8px;
  border-radius: var(--kern-radius-sm);
  background: var(--kern-shell);
  font-family: var(--kern-font-mono);
  font-size: 12px;
  color: var(--kern-ink-450, var(--kern-ink-400));
  overflow-wrap: anywhere;
}
</style>
