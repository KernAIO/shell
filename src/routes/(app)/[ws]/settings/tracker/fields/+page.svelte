<script lang="ts">
import type { FieldDef } from '@kernhq/module-tracker/client'
import { Badge, Button, EmptyState, Spinner, toast } from '@kernhq/ui'
import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query'
import { page } from '$app/state'
import SettingsPage from '$lib/components/settings/SettingsPage.svelte'
import SettingsSection from '$lib/components/settings/SettingsSection.svelte'
import { getTrackerApi } from '$lib/modules/tracker/api'
import { canTracker } from '$lib/modules/tracker/permissions'
import { trackerKeys } from '$lib/modules/tracker/query'
import FieldEditor from '$lib/modules/tracker/settings/FieldEditor.svelte'
import { session } from '$lib/state/session.svelte'
import * as m from '$msg'

/**
 * The workspace's custom fields.
 *
 * Creating a field here is what makes the layout editor useful: a field exists once, in one
 * catalogue, and each work item type decides where — or whether — it appears.
 */
const api = getTrackerApi()
const queryClient = useQueryClient()

const slug = $derived(page.params.ws ?? '')
const workspaceId = $derived(session.workspaces.find((w) => w.slug === slug)?.id ?? '')
const canManage = $derived(canTracker('fieldManage'))

let editing = $state<FieldDef | null>(null)
let editorOpen = $state(false)
let confirmingDelete = $state<FieldDef | null>(null)

const fieldsQuery = createQuery(() => ({
  queryKey: trackerKeys.fields(workspaceId),
  queryFn: () => api.fields.list({ workspaceId, includeArchived: false }),
  enabled: Boolean(workspaceId),
}))
const fields = $derived(fieldsQuery.data ?? [])

const invalidate = () => {
  void queryClient.invalidateQueries({ queryKey: trackerKeys.fields(workspaceId) })
  // A field's existence changes every type's resolved layout, so those go too.
  void queryClient.invalidateQueries({ queryKey: ['tracker', 'type', workspaceId] })
}
const fail = (error: Error) => toast.error(error.message)

const save = createMutation(() => ({
  mutationFn: (input: Record<string, unknown>) =>
    editing
      ? api.fields.update({ workspaceId, id: editing.id, patch: input })
      : api.fields.create({ workspaceId, ...(input as { key: string; name: string; type: never }) }),
  onSuccess: () => {
    editorOpen = false
    editing = null
    invalidate()
  },
  onError: fail,
}))

const remove = createMutation(() => ({
  mutationFn: (id: string) => api.fields.delete({ workspaceId, id }),
  onSuccess: () => {
    confirmingDelete = null
    invalidate()
  },
  onError: fail,
}))

const openNew = () => {
  editing = null
  editorOpen = true
}
const openEdit = (field: FieldDef) => {
  editing = field
  editorOpen = true
}
</script>

<SettingsPage title={m.tracker_settings_fields()} description={m.tracker_settings_fields_hint()}>
  {#snippet actions()}
    {#if canManage}
      <Button size="sm" onclick={openNew} data-testid="new-field">{m.tracker_field_new()}</Button>
    {/if}
  {/snippet}

  <SettingsSection flush>
    {#if fieldsQuery.isPending}
      <div class="state"><Spinner /></div>
    {:else if fieldsQuery.isError}
      <div class="state">
        <p>{m.tracker_settings_fields_failed()}</p>
        <Button size="sm" variant="ghost" onclick={() => fieldsQuery.refetch()}>{m.retry()}</Button>
      </div>
    {:else if !fields.length}
      <EmptyState
        icon="tag"
        title={m.tracker_settings_fields_empty()}
        description={m.tracker_settings_fields_empty_hint()}
      />
    {:else}
      <ul class="rows" data-testid="field-list">
        {#each fields as field (field.id)}
          <li>
            <button
              type="button"
              class="main"
              disabled={!canManage}
              onclick={() => openEdit(field)}
              data-testid="field-row"
              data-field-key={field.key}
            >
              <span class="fname">{field.name}</span>
              <span class="fkey">cf.{field.key}</span>
              <span class="ftype">{field.type}</span>
              {#if field.required}<Badge tone="warning">{m.tracker_field_required()}</Badge>{/if}
              {#if field.projectId}<Badge>{m.tracker_field_project_scoped()}</Badge>{/if}
            </button>
            {#if canManage}
              <Button
                size="sm"
                variant="ghost"
                onclick={() => (confirmingDelete = field)}
                data-testid="field-delete"
              >
                {m.delete()}
              </Button>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
  </SettingsSection>

  {#if confirmingDelete}
    <!-- Inline rather than window.confirm, and it names the consequence: deleting a field strips
         its value from every issue that has one, which no undo brings back. -->
    <SettingsSection tone="danger" title={m.tracker_field_delete_title({ name: confirmingDelete.name })}>
      <p class="warn">{m.tracker_field_delete_body()}</p>
      <div class="row">
        <Button
          size="sm"
          variant="danger"
          loading={remove.isPending}
          onclick={() => remove.mutate(confirmingDelete!.id)}
          data-testid="field-delete-confirm"
        >
          {m.delete()}
        </Button>
        <Button size="sm" variant="ghost" onclick={() => (confirmingDelete = null)}>{m.cancel()}</Button>
      </div>
    </SettingsSection>
  {/if}
</SettingsPage>

<FieldEditor
  open={editorOpen}
  field={editing}
  busy={save.isPending}
  onclose={() => {
    editorOpen = false
    editing = null
  }}
  onsave={(input) => save.mutate(input)}
/>

<style>
.state {
  display: grid;
  place-items: center;
  gap: 8px;
  padding: 32px;
  font-size: 13px;
}
.rows {
  list-style: none;
  margin: 0;
  padding: 0;
}
.rows li {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-inline-end: 12px;
  border-bottom: 1px solid var(--kern-border-hairline);
}
.rows li:last-child {
  border-bottom: 0;
}
.main {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
  padding: 10px 18px;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  text-align: start;
  cursor: pointer;
}
.main:disabled {
  cursor: default;
}
.main:not(:disabled):hover {
  background: var(--kern-surface-hover);
}
.fname {
  font-size: 13px;
  color: var(--kern-ink-800);
}
.fkey,
.ftype {
  font-family: var(--kern-font-mono);
  font-size: 11.5px;
  color: var(--kern-ink-400);
}
.warn {
  margin: 0 0 10px;
  font-size: 13px;
}
.row {
  display: flex;
  gap: 8px;
}
</style>
