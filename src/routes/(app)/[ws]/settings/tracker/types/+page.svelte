<script lang="ts">
import type { FieldLayoutItem, WorkItemType } from '@kernhq/module-tracker/client'
import { Badge, Button, Icon, Select, Spinner, toast } from '@kernhq/ui'
import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query'
import { page } from '$app/state'
import SettingsPage from '$lib/components/settings/SettingsPage.svelte'
import SettingsSection from '$lib/components/settings/SettingsSection.svelte'
import { getTrackerApi } from '$lib/modules/tracker/api'
import { canTracker } from '$lib/modules/tracker/permissions'
import { trackerKeys } from '$lib/modules/tracker/query'
import LayoutEditor from '$lib/modules/tracker/settings/LayoutEditor.svelte'
import { session } from '$lib/state/session.svelte'
import * as m from '$msg'

/**
 * Work item types, and what each one shows.
 *
 * This is where the layout that `types.layout` resolves is actually written. Everything else in the
 * tracker reads it: the issue panel, the create dialog, and the cards.
 */
const api = getTrackerApi()
const queryClient = useQueryClient()

const slug = $derived(page.params.ws ?? '')
const workspaceId = $derived(session.workspaces.find((w) => w.slug === slug)?.id ?? '')
const canManage = $derived(canTracker('typeManage'))

let selectedId = $state<string | null>(null)
/** The arrangement in progress. `null` means "unchanged", which is what disables Save. */
let draft = $state<FieldLayoutItem[] | null>(null)

const typesQuery = createQuery(() => ({
  queryKey: trackerKeys.types(workspaceId),
  queryFn: () => api.types.list({ workspaceId, includeArchived: false }),
  enabled: Boolean(workspaceId),
}))
const types = $derived(typesQuery.data ?? [])
const selected = $derived(types.find((t) => t.id === selectedId) ?? types[0] ?? null)

const layoutQuery = createQuery(() => ({
  queryKey: trackerKeys.layout(workspaceId, selected?.id ?? '', null),
  queryFn: () => api.types.layout({ workspaceId, id: selected?.id as string, projectId: null }),
  enabled: Boolean(selected?.id),
}))

const save = createMutation(() => ({
  mutationFn: (items: FieldLayoutItem[]) =>
    api.types.update({
      workspaceId,
      id: selected?.id as string,
      // A `$state` array is a deep proxy, and a proxy cannot be structured-cloned or posted as-is.
      patch: { fieldLayout: $state.snapshot(items) as FieldLayoutItem[] },
    }),
  onSuccess: () => {
    draft = null
    void queryClient.invalidateQueries({ queryKey: ['tracker', 'type', workspaceId] })
    toast.success(m.tracker_layout_saved())
  },
  onError: (error: Error) => toast.error(error.message),
}))

/** Switching type abandons an unsaved arrangement rather than carrying it onto another type. */
const select = (type: WorkItemType) => {
  selectedId = type.id
  draft = null
}
</script>

<SettingsPage title={m.tracker_settings_types()} description={m.tracker_settings_types_hint()}>
  {#if typesQuery.isPending}
    <SettingsSection><div class="state"><Spinner /></div></SettingsSection>
  {:else if typesQuery.isError}
    <SettingsSection>
      <div class="state">
        <p>{m.tracker_settings_types_failed()}</p>
        <Button size="sm" variant="ghost" onclick={() => typesQuery.refetch()}>{m.retry()}</Button>
      </div>
    </SettingsSection>
  {:else}
    <SettingsSection flush>
      <ul class="types" data-testid="type-list">
        {#each types as type (type.id)}
          <li>
            <button
              type="button"
              class="trow"
              class:on={selected?.id === type.id}
              onclick={() => select(type)}
              data-testid="type-row"
              data-type-key={type.key}
            >
              <Icon name={type.icon ?? 'square-check-big'} size={14} strokeWidth={1.8} />
              <span class="tname">{type.name}</span>
              <span class="tkey">{type.key}</span>
              {#if type.isDefault}<Badge>{m.tracker_type_default()}</Badge>{/if}
              {#if type.fieldLayout.length}<Badge tone="info">{m.tracker_type_customised()}</Badge>{/if}
            </button>
          </li>
        {/each}
      </ul>
    </SettingsSection>

    {#if selected}
      <SettingsSection
        title={m.tracker_layout_for({ name: selected.name })}
        description={m.tracker_layout_hint()}
      >
        {#if layoutQuery.isPending}
          <div class="state"><Spinner /></div>
        {:else if layoutQuery.data}
          <LayoutEditor
            layout={layoutQuery.data}
            disabled={!canManage}
            onchange={(items) => (draft = items)}
          />
        {/if}

        {#snippet footer()}
          <Button variant="ghost" size="sm" onclick={() => (draft = null)} disabled={!draft}>
            {m.discard()}
          </Button>
          <Button
            size="sm"
            disabled={!draft || !canManage}
            loading={save.isPending}
            onclick={() => draft && save.mutate(draft)}
            data-testid="save-layout"
          >
            {m.save()}
          </Button>
        {/snippet}
      </SettingsSection>
    {/if}
  {/if}
</SettingsPage>

<style>
.state {
  display: grid;
  place-items: center;
  gap: 8px;
  padding: 28px;
  font-size: 13px;
}
.types {
  list-style: none;
  margin: 0;
  padding: 0;
}
.types li {
  border-bottom: 1px solid var(--kern-border-hairline);
}
.types li:last-child {
  border-bottom: 0;
}
.trow {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 18px;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  text-align: start;
  cursor: pointer;
}
.trow:hover {
  background: var(--kern-surface-hover);
}
.trow.on {
  background: var(--kern-surface-active);
}
.tname {
  font-size: 13px;
  color: var(--kern-ink-800);
}
.tkey {
  flex: 1;
  font-family: var(--kern-font-mono);
  font-size: 11.5px;
  color: var(--kern-ink-400);
}
</style>
